const express = require('express');
const router = express.Router();
const { getDb } = require('../../utils/db');

const WEB_URL = process.env.WEB_URL || 'https://my.farmestly.dev-staging.overpassconnect.com';

/**
 * Build success HTML page
 */
function buildSuccessHtml() {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Email Verified - Farmestly</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 16px;
			box-shadow: 0 4px 24px rgba(0,0,0,0.1);
			padding: 48px;
			text-align: center;
			max-width: 480px;
		}
		.icon {
			width: 80px;
			height: 80px;
			background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0 auto 24px;
		}
		.icon svg {
			width: 40px;
			height: 40px;
			stroke: white;
			stroke-width: 3;
			fill: none;
		}
		h1 {
			color: #166534;
			font-size: 28px;
			margin-bottom: 16px;
		}
		p {
			color: #4b5563;
			font-size: 16px;
			line-height: 1.6;
			margin-bottom: 32px;
		}
		.button {
			display: inline-block;
			padding: 14px 32px;
			background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
			color: white;
			text-decoration: none;
			font-size: 16px;
			font-weight: 600;
			border-radius: 8px;
			transition: transform 0.2s, box-shadow 0.2s;
		}
		.button:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="icon">
			<svg viewBox="0 0 24 24">
				<polyline points="20 6 9 17 4 12"></polyline>
			</svg>
		</div>
		<h1>Email Verified!</h1>
		<p>Your email address has been successfully verified. You can now receive reports and notifications via email.</p>
		<a href="${WEB_URL}" class="button">Return to Farmestly</a>
	</div>
</body>
</html>
`;
}

/**
 * Build error HTML page
 */
function buildErrorHtml(title, message) {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title} - Farmestly</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 16px;
			box-shadow: 0 4px 24px rgba(0,0,0,0.1);
			padding: 48px;
			text-align: center;
			max-width: 480px;
		}
		.icon {
			width: 80px;
			height: 80px;
			background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0 auto 24px;
		}
		.icon svg {
			width: 40px;
			height: 40px;
			stroke: white;
			stroke-width: 3;
			fill: none;
		}
		h1 {
			color: #991b1b;
			font-size: 28px;
			margin-bottom: 16px;
		}
		p {
			color: #4b5563;
			font-size: 16px;
			line-height: 1.6;
			margin-bottom: 32px;
		}
		.button {
			display: inline-block;
			padding: 14px 32px;
			background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
			color: white;
			text-decoration: none;
			font-size: 16px;
			font-weight: 600;
			border-radius: 8px;
			transition: transform 0.2s, box-shadow 0.2s;
		}
		.button:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="icon">
			<svg viewBox="0 0 24 24">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</div>
		<h1>${title}</h1>
		<p>${message}</p>
		<a href="${WEB_URL}" class="button">Return to Farmestly</a>
	</div>
</body>
</html>
`;
}

/**
 * GET /auth/verifyEmail
 * Public endpoint - validates token and verifies email
 */
router.get('/', async (req, res) => {
	try {
		const { token } = req.query;

		if (!token || typeof token !== 'string' || token.length !== 64) {
			return res.status(400).send(buildErrorHtml(
				'Invalid Link',
				'This verification link is invalid. Please request a new verification email from your account settings.'
			));
		}

		// Find account with this token
		const account = await getDb().collection('Accounts').findOne({
			'metadata.emailVerification.token': token
		});

		if (!account) {
			return res.status(404).send(buildErrorHtml(
				'Link Not Found',
				'This verification link has already been used or is invalid. If you need to verify your email, please request a new verification email from your account settings.'
			));
		}

		const verification = account.metadata.emailVerification;

		// Check expiration
		if (new Date() > new Date(verification.expiresAt)) {
			// Clear expired verification
			await getDb().collection('Accounts').updateOne(
				{ _id: account._id },
				{ $unset: { 'metadata.emailVerification': '' } }
			);

			return res.status(410).send(buildErrorHtml(
				'Link Expired',
				'This verification link has expired. Please request a new verification email from your account settings.'
			));
		}

		// Verification successful - update account
		const updateObj = {
			'metadata.email': verification.pendingEmail,
			'metadata.emailVerified': true
		};

		await getDb().collection('Accounts').updateOne(
			{ _id: account._id },
			{
				$set: updateObj,
				$unset: { 'metadata.emailVerification': '' }
			}
		);

		console.log(`[EmailVerify] Email verified for account ${account._id}: ${verification.pendingEmail}`);

		// Return success page
		res.send(buildSuccessHtml());

	} catch (err) {
		console.error('[EmailVerify] Verification error:', err);
		res.status(500).send(buildErrorHtml(
			'Something Went Wrong',
			'An error occurred while verifying your email. Please try again later or contact support.'
		));
	}
});

module.exports = router;
