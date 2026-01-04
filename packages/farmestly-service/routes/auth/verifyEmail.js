const express = require('express');
const router = express.Router();
const { getDb } = require('../../utils/db');

const WEB_URL = process.env.WEB_URL || 'https://my.farmestly.dev-staging.overpassconnect.com';

/**
 * Common CSS styles following the Farmestly design system
 */
const commonStyles = `
	@import url('https://fonts.googleapis.com/css2?family=Geologica:wght@400;500;700&display=swap');

	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	html {
		font-size: 16px;
		line-height: 1.5;
	}

	body {
		font-family: 'Geologica', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 400;
		color: #42210B;
		background: linear-gradient(135deg, #fbf2ecff 0%, #fff5eb 50%, #ffe8d6 100%);
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding-top: 20px;
		padding-right: 20px;
		padding-bottom: 20px;
		padding-left: 20px;
	}

	.logo {
		width: 220px;
		object-fit: contain;
		margin-bottom: 50px;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 500px;
		padding-top: 48px;
		padding-right: 32px;
		padding-bottom: 48px;
		padding-left: 32px;
		background-color: #ffffff;
		border-top-left-radius: 12px;
		border-top-right-radius: 12px;
		border-bottom-right-radius: 12px;
		border-bottom-left-radius: 12px;
		box-shadow: 0 4px 12px rgba(66, 33, 11, 0.12);
		text-align: center;
	}

	.icon {
		width: 60px;
		height: 60px;
		border-top-left-radius: 30px;
		border-top-right-radius: 30px;
		border-bottom-right-radius: 30px;
		border-bottom-left-radius: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 24px;
	}

	.icon-success {
		background-color: #34C759;
	}

	.icon-error {
		background-color: #42210B;
	}

	.icon svg {
		width: 32px;
		height: 32px;
		stroke: #ffffff;
		stroke-width: 3;
		fill: none;
	}

	h1 {
		font-family: 'Geologica', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 500;
		font-size: 22px;
		color: #42210B;
		margin-bottom: 8px;
	}

	p {
		font-family: 'Geologica', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 400;
		font-size: 15px;
		color: #A09085;
		line-height: 1.5;
		margin-bottom: 16px;
		max-width: 320px;
	}

	.button-stack {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 20px;
		width: 100%;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 40px;
		padding-top: 0;
		padding-right: 24px;
		padding-bottom: 0;
		padding-left: 24px;
		border-top-left-radius: 24px;
		border-top-right-radius: 24px;
		border-bottom-right-radius: 24px;
		border-bottom-left-radius: 24px;
		font-family: 'Geologica', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 700;
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
		transition-property: opacity, background-color, border-color;
		transition-duration: 0.2s;
		transition-timing-function: ease;
		border-style: solid;
		border-width: 2px;
		text-decoration: none;
		width: 100%;
	}

	.btn:hover {
		opacity: 0.85;
	}

	.btn:active {
		opacity: 0.7;
	}

	.btn-filled {
		background-color: #E37F1B;
		border-color: #E37F1B;
		color: #ffffff;
	}

	.btn-outline {
		background-color: #ffffff;
		border-color: #E37F1B;
		color: #E37F1B;
	}

	.fallback-text {
		font-family: 'Geologica', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 400;
		font-size: 14px;
		color: #A09085;
		margin-top: 16px;
		max-width: 280px;
	}

	.desktop-note {
		font-family: 'Geologica', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 400;
		font-size: 14px;
		margin-top: 8px;
		text-align: center;
		max-width: 280px;
		padding-top: 12px;
		padding-right: 16px;
		padding-bottom: 12px;
		padding-left: 16px;
		border-top-left-radius: 10px;
		border-top-right-radius: 10px;
		border-bottom-right-radius: 10px;
		border-bottom-left-radius: 10px;
		color: #E37F1B;
	}

	.footer {
		margin-top: 32px;
		font-family: 'Geologica', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-weight: 400;
		font-size: 12px;
		color: #A09085;
		text-align: center;
	}

	@media (max-width: 480px) {
		.logo {
			width: 150px;
			margin-bottom: 32px;
		}
		.card {
			padding-top: 32px;
			padding-right: 24px;
			padding-bottom: 32px;
			padding-left: 24px;
			border-top-left-radius: 10px;
			border-top-right-radius: 10px;
			border-bottom-right-radius: 10px;
			border-bottom-left-radius: 10px;
		}
		h1 {
			font-size: 20px;
		}
		p {
			font-size: 14px;
		}
	}
`;

/**
 * Build success HTML page
 */
function buildSuccessHtml() {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
	<meta name="theme-color" content="#42210B">
	<title>Email Verified - Farmestly</title>
	<style>${commonStyles}</style>
</head>
<body>
	<img src="${WEB_URL}/assets/farmestly_logo.png" alt="Farmestly" class="logo">
	<div class="card">
		<div class="icon icon-success">
			<svg viewBox="0 0 24 24">
				<polyline points="20 6 9 17 4 12"></polyline>
			</svg>
		</div>
		<h1>Email Verified!</h1>
		<p>Your email has been verified successfully!</p>
		<p class="desktop-note">You can now close this page and continue using the Farmestly app on your mobile device.</p>
	</div>
	<footer class="footer">&copy; ${new Date().getFullYear()} Farmestly. All rights reserved.</footer>
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
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
	<meta name="theme-color" content="#42210B">
	<title>${title} - Farmestly</title>
	<style>${commonStyles}</style>
</head>
<body>
	<img src="${WEB_URL}/assets/farmestly_logo.png" alt="Farmestly" class="logo">
	<div class="card">
		<div class="icon icon-error">
			<svg viewBox="0 0 24 24">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</div>
		<h1>${title}</h1>
		<p>${message}</p>
		<p class="desktop-note">Please request a new verification link from the Farmestly app on your mobile device.</p>
	</div>
	<footer class="footer">&copy; ${new Date().getFullYear()} Farmestly. All rights reserved.</footer>
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
				'This verification link has already been used or is invalid.'
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
				'This verification link has expired.'
			));
		}

		// Verification successful - update account
		const updateObj = {
			'metadata.email': verification.pendingEmail,
			'metadata.emailVerified': true
		};

		// Track when verified email changes (for 6-month cooldown enforcement)
		// Only set if this is a change from a previously verified email
		const previousEmail = account.metadata.email;
		const wasVerified = account.metadata.emailVerified === true;
		if (wasVerified && previousEmail && previousEmail !== verification.pendingEmail) {
			updateObj['metadata.lastEmailChangeAt'] = new Date();
		}

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
