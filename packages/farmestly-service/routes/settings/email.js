const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');
const EmailQueue = require('../../utils/EmailQueue');
const { createEmailChangeLimiter, createEmailResendLimiter } = require('../../middleware/rateLimiter');

const VERIFICATION_EXPIRY_HOURS = parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS, 10) || 24;
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS, 10) || 60;
const WEB_URL = process.env.WEB_URL || 'https://my.farmestly.dev-staging.overpassconnect.com';

// 6-month cooldown for changing email (in milliseconds)
// Default: 6 months = 180 days = 15,552,000,000 ms
const EMAIL_CHANGE_COOLDOWN_MS = parseInt(process.env.EMAIL_CHANGE_COOLDOWN_MS, 10) || 180 * 24 * 60 * 60 * 1000;

// Initialize rate limiters (will be set after Redis is ready)
let emailChangeLimiter = null;
let emailResendLimiter = null;

/**
 * Initialize rate limiters - call after Redis is connected
 */
function initializeLimiters() {
	try {
		emailChangeLimiter = createEmailChangeLimiter();
		emailResendLimiter = createEmailResendLimiter();
		console.log('[Email] Rate limiters initialized');
	} catch (err) {
		console.warn('[Email] Rate limiters not initialized (Redis not ready):', err.message);
	}
}

/**
 * Middleware to apply rate limiter if initialized
 */
function applyEmailChangeLimiter(req, res, next) {
	if (emailChangeLimiter) {
		return emailChangeLimiter(req, res, next);
	}
	next();
}

function applyEmailResendLimiter(req, res, next) {
	if (emailResendLimiter) {
		return emailResendLimiter(req, res, next);
	}
	next();
}

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
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fbf2ec;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fbf2ec;">
		<tr>
			<td style="padding: 40px 20px;">
				<!-- Logo -->
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
					<tr>
						<td style="text-align: center; padding-bottom: 32px;">
							<img src="${WEB_URL}/assets/farmestly_logo.png" alt="Farmestly" width="180" style="display: block; margin: 0 auto;">
						</td>
					</tr>
				</table>
				<!-- Card -->
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(66, 33, 11, 0.12);">
					<!-- Content -->
					<tr>
						<td style="padding: 48px 40px;">
							<h1 style="margin: 0 0 16px; color: #42210B; font-size: 22px; font-weight: 500; text-align: center;">Verify Your Email Address</h1>
							${farmName ? `<p style="margin: 0 0 16px; color: #A09085; font-size: 15px; line-height: 1.5; text-align: center;">Hello from ${farmName}!</p>` : ''}
							<p style="margin: 0 0 24px; color: #A09085; font-size: 15px; line-height: 1.5; text-align: center;">Please click the button below to verify your email address. This link will expire in ${VERIFICATION_EXPIRY_HOURS} hours.</p>
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
								<tr>
									<td style="padding: 16px 0; text-align: center;">
										<!--[if mso]>
										<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${verificationUrl}" style="height:40px;v-text-anchor:middle;width:200px;" arcsize="60%" strokecolor="#E37F1B" fillcolor="#E37F1B">
										<w:anchorlock/>
										<center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">Verify Email</center>
										</v:roundrect>
										<![endif]-->
										<!--[if !mso]><!-->
										<a href="${verificationUrl}" style="display: inline-block; padding: 12px 32px; background-color: #E37F1B; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 24px; mso-hide: all;">Verify Email</a>
										<!--<![endif]-->
									</td>
								</tr>
							</table>
							<p style="margin: 24px 0 0; color: #A09085; font-size: 13px; line-height: 1.5; text-align: center;">If the button doesn't work, copy and paste this link into your browser:</p>
							<p style="margin: 8px 0 0; color: #E37F1B; font-size: 13px; word-break: break-all; text-align: center;">${verificationUrl}</p>
							<p style="margin: 24px 0 0; color: #A09085; font-size: 13px; line-height: 1.5; text-align: center;">If you didn't request this verification, you can safely ignore this email.</p>
						</td>
					</tr>
				</table>
				<!-- Footer -->
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
					<tr>
						<td style="padding: 24px 0; text-align: center;">
							<p style="margin: 0; color: #A09085; font-size: 12px;">&copy; ${new Date().getFullYear()} Farmestly. All rights reserved.</p>
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
 * Rate limited + 6-month cooldown for verified email changes
 */
router.put('/', applyEmailChangeLimiter, validate([
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
			return res.status(409).json(fail('EMAIL_ALREADY_VERIFIED'));
		}

		// 6-month cooldown check: only applies when changing a VERIFIED email to a different one
		if (currentEmail && isEmailVerified && currentEmail !== newEmail) {
			const lastEmailChange = account.metadata.lastEmailChangeAt;
			if (lastEmailChange) {
				const timeSinceLastChange = Date.now() - new Date(lastEmailChange).getTime();
				if (timeSinceLastChange < EMAIL_CHANGE_COOLDOWN_MS) {
					const remainingMs = EMAIL_CHANGE_COOLDOWN_MS - timeSinceLastChange;
					const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
					return res.status(429).json(fail('EMAIL_CHANGE_COOLDOWN', {
						remainingDays,
						nextChangeAllowedAt: new Date(Date.now() + remainingMs).toISOString()
					}));
				}
			}
		}

		// If there's already a pending verification for this exact email and it hasn't expired, don't create a new token
		const existingVerification = account.metadata.emailVerification;
		if (existingVerification?.pendingEmail === newEmail && new Date() < new Date(existingVerification.expiresAt)) {
			return res.status(409).json(fail('VERIFICATION_ALREADY_PENDING'));
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
router.post('/resend', applyEmailResendLimiter, async (req, res) => {
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
module.exports.initializeLimiters = initializeLimiters;
