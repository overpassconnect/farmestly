import React from 'react';
import * as g from '../../global.module.css';
import * as styles from './HomePage.module.css';

function HomePage() {
	return (
		<div className={styles.pageContainer}>
			<div className={styles.card}>
				<img
					src="/assets/farmestly_logo.png"
					alt="Farmestly"
					className={styles.logo}
					onError={(e) => { e.target.style.display = 'none'; }}
				/>
				<h1 className={styles.title}>Farmestly</h1>
				<p className={`${g.subtitle} ${styles.messageText}`}>
					Download the Farmestly app to manage your farm.
				</p>
			</div>

			<footer className={styles.footer}>
				&copy; {new Date().getFullYear()} Farmestly. All rights reserved.
			</footer>
		</div>
	);
}

export default HomePage;
