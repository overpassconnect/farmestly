import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import EmailVerificationPage from './EmailVerificationPage';
import '../global.css';

function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/emailVerification" element={<EmailVerificationPage />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
