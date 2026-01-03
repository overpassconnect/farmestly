import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as styles from './EmailVerification.module.css';

const API_URL = process.env.REACT_API_URL || 'https://api.farmestly.dev-staging.overpassconnect.com';
const DEEP_LINK_SCHEME = 'farmestly://';

function EmailVerification() {
	const [searchParams] = useSearchParams();
	const [status, setStatus] = useState('loading'); // loading, success, error, expired, invalid
	const [message, setMessage] = useState('');

	const token = searchParams.get('token');

	useEffect(() => {
		if (!token || token.length !== 64) {
			setStatus('invalid');
			setMessage('This verification link is invalid.');
			return;
		}

		verifyEmail(token);
	}, [token]);

	const verifyEmail = async (token) => {
		try {
			const response = await fetch(`${API_URL}/auth/verifyEmail?token=${token}`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json'
				}
			});

			// The backend returns HTML, but we want to handle it ourselves
			// Check status code to determine outcome
			if (response.ok) {
				setStatus('success');
				setMessage('Your email has been verified successfully!');
				// Try to open the app after a brief delay
				setTimeout(() => {
					tryOpenApp('success');
				}, 1500);
			} else if (response.status === 404) {
				setStatus('error');
				setMessage('This verification link has already been used or is invalid.');
			} else if (response.status === 410) {
				setStatus('expired');
				setMessage('This verification link has expired. Please request a new one from your account settings.');
			} else {
				setStatus('error');
				setMessage('Something went wrong. Please try again later.');
			}
		} catch (err) {
			console.error('Verification error:', err);
			setStatus('error');
			setMessage('Unable to verify email. Please check your connection and try again.');
		}
	};

	const tryOpenApp = (verificationStatus) => {
		const deepLink = `${DEEP_LINK_SCHEME}emailVerified?status=${verificationStatus}`;
		window.location.href = deepLink;
	};

	const handleOpenApp = () => {
		tryOpenApp(status === 'success' ? 'success' : 'failed');
	};

	const renderIcon = () => {
		if (status === 'loading') {
			return (
				<div className={styles.spinner}>
					<div className={styles.spinnerInner}></div>
				</div>
			);
		}

		if (status === 'success') {
			return (
				<div className={`${styles.icon} ${styles.iconSuccess}`}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				</div>
			);
		}

		return (
			<div className={`${styles.icon} ${styles.iconError}`}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</div>
		);
	};

	const getTitle = () => {
		switch (status) {
			case 'loading':
				return 'Verifying Email...';
			case 'success':
				return 'Email Verified!';
			case 'expired':
				return 'Link Expired';
			case 'invalid':
				return 'Invalid Link';
			default:
				return 'Verification Failed';
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.card}>
				<div className={styles.logo}>
					<span className={styles.logoText}>Farmestly</span>
				</div>

				{renderIcon()}

				<h1 className={styles.title}>{getTitle()}</h1>
				<p className={styles.message}>{message || 'Please wait while we verify your email address...'}</p>

				{status !== 'loading' && (
					<div className={styles.actions}>
						<button
							className={styles.primaryButton}
							onClick={handleOpenApp}
						>
							Open Farmestly App
						</button>
						<p className={styles.hint}>
							If the app doesn't open automatically, tap the button above.
						</p>
						{status === 'success' && (
							<p className={styles.desktopNote}>
								On desktop? You can now use email features in the Farmestly mobile app.
							</p>
						)}
					</div>
				)}
			</div>

			<footer className={styles.footer}>
				&copy; {new Date().getFullYear()} Farmestly. All rights reserved.
			</footer>
		</div>
	);
}

export default EmailVerification;
