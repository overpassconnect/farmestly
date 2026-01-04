import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as g from '../../global.module.css';
import * as styles from './EmailVerificationPage.module.css';

const API_BASE = process.env.REACT_API_URL || 'https://api.farmestly.dev-staging.overpassconnect.com';

function isMobileDevice() {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function EmailVerificationPage() {
	const [searchParams] = useSearchParams();
	const token = searchParams.get('token');

	const [status, setStatus] = useState('loading');
	const [message, setMessage] = useState('');
	const [isMobile, setIsMobile] = useState(false);
	const verificationAttempted = useRef(false);

	useEffect(() => {
		setIsMobile(isMobileDevice());
	}, []);

	useEffect(() => {
		if (!token) {
			setStatus('error');
			setMessage('Invalid verification link. No token provided.');
			return;
		}

		if (verificationAttempted.current) {
			return;
		}
		verificationAttempted.current = true;

		verifyEmail(token);
	}, [token]);

	const verifyEmail = async (verificationToken) => {
		try {
			const response = await fetch(`${API_BASE}/auth/verifyEmail?token=${verificationToken}`);

			if (response.ok) {
				setStatus('success');
				setMessage('Your email has been verified successfully!');

				if (isMobileDevice()) {
					setTimeout(() => {
						tryOpenApp('success');
					}, 1500);
				}
			} else if (response.status === 404) {
				setStatus('error');
				setMessage('This verification link has already been used or is invalid.');
			} else if (response.status === 410) {
				setStatus('error');
				setMessage('This verification link has expired.');
			} else {
				setStatus('error');
				setMessage('Verification failed. Please try again later.');
			}
		} catch (err) {
			setStatus('error');
			setMessage('Unable to verify email. Please check your connection and try again.');
		}
	};

	const tryOpenApp = (resultStatus) => {
		window.location.href = `farmestly://emailVerified?status=${resultStatus}`;
	};

	const handleOpenApp = () => {
		tryOpenApp(status === 'success' ? 'success' : 'error');
	};

	return (
		<div className={styles.pageContainer}>
			<img
				src="/assets/farmestly_logo.png"
				alt="Farmestly"
				className={styles.logo}
				onError={(e) => { e.target.style.display = 'none'; }}
			/>

			<div className={styles.verificationCard}>
				{status === 'loading' && (
					<>
						<div className={styles.iconPending}>
							<div className={g.spinner}></div>
						</div>
						<h1 className={styles.title}>Verifying Email</h1>
						<p className={`${g.subtitle} ${styles.messageText}`}>
							Please wait while we verify your email address...
						</p>
					</>
				)}

				{status === 'success' && (
					<>
						<div className={styles.iconSuccess}>
							<svg className={styles.iconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						</div>
						<h1 className={styles.title}>Email Verified!</h1>
						<p className={`${g.subtitle} ${styles.messageText}`}>
							{message}
						</p>

						{isMobile ? (
							<>
								<div className={g.buttonStack}>
									<button
										className={`${g.btn} ${g.btnFilled} ${g.btnFullWidth}`}
										onClick={handleOpenApp}
									>
										Open Farmestly App
									</button>
								</div>
								<p className={`${g.textSmall} ${styles.fallbackText}`}>
									If the app doesn't open automatically, tap the button above.
								</p>
							</>
						) : (
							<p className={`${g.textSmall} ${styles.desktopNote}`}>
								You can now close this page and continue using the Farmestly app on your mobile device.
							</p>
						)}
					</>
				)}

				{status === 'error' && (
					<>
						<div className={styles.iconError}>
							<svg className={styles.iconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</div>
						<h1 className={styles.title}>Verification Failed</h1>
						<p className={`${g.subtitle} ${styles.messageText}`}>
							{message}
						</p>

						{isMobile ? (
							<>
								<div className={g.buttonStack}>
									<button
										className={`${g.btn} ${g.btnOutline} ${g.btnFullWidth}`}
										onClick={handleOpenApp}
									>
										Open Farmestly App
									</button>
								</div>
								<p className={`${g.textSmall} ${styles.fallbackText}`}>
									Request a new verification link from the app.
								</p>
							</>
						) : (
							<p className={`${g.textSmall} ${styles.desktopNote}`}>
								Please request a new verification link from the Farmestly app on your mobile device.
							</p>
						)}
					</>
				)}
			</div>

			<footer className={styles.footer}>
				&copy; {new Date().getFullYear()} Farmestly. All rights reserved.
			</footer>
		</div>
	);
}

export default EmailVerificationPage;
