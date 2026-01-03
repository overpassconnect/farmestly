import React from 'react';
import * as styles from './App.module.css';

function Home() {
	return (
		<div className="container">
			<header className={styles.header}>
				<h1>Hello</h1>
				<h2 className="subtitle">World</h2>
			</header>
		</div>
	);
}

export default Home;
