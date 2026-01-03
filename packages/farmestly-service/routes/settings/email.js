const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');
const EmailQueue = require('../../utils/EmailQueue');

const VERIFICATION_EXPIRY_HOURS = parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS, 10) || 24;
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS, 10) || 60;
const WEB_URL = process.env.WEB_URL || 'https://my.farmestly.dev-staging.overpassconnect.com';

/**
 * Generate a cryptographically secure verification token
 * @returns {string} 64-character hex token
 */
function generateVerificationToken() {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Build the verification email HTML
 * @param {string} verificationUrl - The full verification URL
 * @param {string} farmName - User's farm name (optional)
 * @returns {string} HTML email content
 */
function buildVerificationEmailHtml(verificationUrl, farmName) {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
		<tr>
			<td style="padding: 40px 20px;">
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
					<!-- Header -->
					<tr>
						<td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 8px 8px 0 0;">
							<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Farmestly</h1>
						</td>
					</tr>
					<!-- Content -->
					<tr>
						<td style="padding: 40px;">
							<h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">Verify Your Email Address</h2>
							${farmName ? `<p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.5;">Hello from ${farmName}!</p>` : ''}
							<p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.5;">Please click the button below to verify your email address. This link will expire in ${VERIFICATION_EXPIRY_HOURS} hours.</p>
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
								<tr>
									<td style="padding: 20px 0; text-align: center;">
										<a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">Verify Email</a>
									</td>
								</tr>
							</table>
							<p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">If the button doesn't work, copy and paste this link into your browser:</p>
							<p style="margin: 10px 0 0; color: #3b82f6; font-size: 14px; word-break: break-all;">${verificationUrl}</p>
							<p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">If you didn't request this verification, you can safely ignore this email.</p>
						</td>
					</tr>
					<!-- Footer -->
					<tr>
						<td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
							<p style="margin: 0; color: #9ca3af; font-size: 12px;">&copy; ${new Date().getFullYear()} Farmestly. All rights reserved.</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
`;
}

/**
 * Queue a verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @param {string} farmName - User's farm name
 */
async function sendVerificationEmail(email, token, farmName) {
	const verificationUrl = `${WEB_URL}/emailVerification?token=${token}`;
	const html = buildVerificationEmailHtml(verificationUrl, farmName);

	await EmailQueue.getInstance().queue({
		to: email,
		subject: 'Verify Your Email - Farmestly',
		html,
		priority: 1, // High priority for immediate send
		metadata: { type: 'email_verification' }
	});
}

/**
 * PUT /settings/email
 * Submit or change email address, triggering verification flow
 */
router.put('/', validate([
	body('email').isEmail().withMessage('email.invalid').normalizeEmail()
]), async (req, res) => {
	try {
		const newEmail = req.body.email;

		// Fetch current account
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const currentEmail = account.metadata.email;
		const isEmailVerified = account.metadata.emailVerified === true;

		// If user already has a verified email and it's the same as the new one, no action needed
		if (currentEmail === newEmail && isEmailVerified) {
			return res.json(ok({ status: 'already_verified' }));
		}

		// If there's already a pending verification for this exact email, don't create a new token
		if (account.metadata.emailVerification?.pendingEmail === newEmail) {
			return res.json(ok({ status: 'verification_pending' }));
		}

		// Generate new verification token
		const token = generateVerificationToken();
		const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

		// Build update object
		const updateObj = {
			'metadata.emailVerification': {
				token,
				expiresAt,
				pendingEmail: newEmail,
				lastSentAt: new Date()
			}
		};

		// If user has NO email yet (first time setting), set the email directly but mark as unverified
		if (!currentEmail) {
			updateObj['metadata.email'] = newEmail;
			updateObj['metadata.emailVerified'] = false;
		} else if (!isEmailVerified) {
			// If current email is not verified, we can overwrite it directly
			updateObj['metadata.email'] = newEmail;
			updateObj['metadata.emailVerified'] = false;
		}
		// If current email IS verified, we store new email in pendingEmail only (handled above)

		await getDb().collection('Accounts').updateOne(
			{ _id: new ObjectId(req.session.accountId) },
			{ $set: updateObj }
		);

		// Get farm name for the email
		const farmName = account.content?.farmData?.farmName || '';

		// Queue verification email
		await sendVerificationEmail(newEmail, token, farmName);

		res.json(ok({
			status: 'verification_sent',
			message: 'Verification email has been sent'
		}));

	} catch (err) {
		console.error('[Email] Update error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

/**
 * POST /settings/email/resend
 * Resend verification email with rate limiting
 */
router.post('/resend', async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		// Check if there's a pending verification
		const verification = account.metadata.emailVerification;
		if (!verification || !verification.pendingEmail) {
			// Check if email exists but is unverified
			if (account.metadata.email && !account.metadata.emailVerified) {
				// Create a new verification for the existing unverified email
				const token = generateVerificationToken();
				const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

				await getDb().collection('Accounts').updateOne(
					{ _id: new ObjectId(req.session.accountId) },
					{
						$set: {
							'metadata.emailVerification': {
								token,
								expiresAt,
								pendingEmail: account.metadata.email,
								lastSentAt: new Date()
							}
						}
					}
				);

				const farmName = account.content?.farmData?.farmName || '';
				await sendVerificationEmail(account.metadata.email, token, farmName);

				return res.json(ok({ status: 'verification_sent' }));
			}

			return res.status(400).json(fail('NO_PENDING_VERIFICATION'));
		}

		// Rate limiting check
		if (verification.lastSentAt) {
			const timeSinceLastSent = Date.now() - new Date(verification.lastSentAt).getTime();
			const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;

			if (timeSinceLastSent < cooldownMs) {
				const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSent) / 1000);
				return res.status(429).json(fail('RATE_LIMITED', { retryAfter: remainingSeconds }));
			}
		}

		// Generate new token (invalidates old one)
		const token = generateVerificationToken();
		const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

		await getDb().collection('Accounts').updateOne(
			{ _id: new ObjectId(req.session.accountId) },
			{
				$set: {
					'metadata.emailVerification.token': token,
					'metadata.emailVerification.expiresAt': expiresAt,
					'metadata.emailVerification.lastSentAt': new Date()
				}
			}
		);

		const farmName = account.content?.farmData?.farmName || '';
		await sendVerificationEmail(verification.pendingEmail, token, farmName);

		res.json(ok({ status: 'verification_sent' }));

	} catch (err) {
		console.error('[Email] Resend error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
