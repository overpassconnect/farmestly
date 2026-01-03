import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EmailVerification from '../pages/EmailVerification';
import Home from './Home';
import '../global.css';

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/emailVerification" element={<EmailVerification />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
