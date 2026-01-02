import React from 'react';
import * as styles from './App.module.css';
import '../global.css';

function App() {
	return (
		<div className="container">
			<header className={styles.header}>
				<h1>Hello</h1>
				<h2 className="subtitle">World</h2>
			</header>
		</div>
	);
}

export default App;