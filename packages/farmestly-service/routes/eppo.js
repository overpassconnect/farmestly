const express = require('express');
const router = express.Router();
const { ok, fail } = require('../utils/response');

const EPPO_SERVICE_URL = process.env.EPPO_SERVICE_URL || 'http://127.0.0.1:4000';

// GET /eppo/search - Search EPPO database for plant codes
router.get('/search', async (req, res) => {
	try {
		const search = req.query.search;

		// Return empty results if search is empty
		if (!search || !search.trim()) {
			return res.json(ok({ results: [] }));
		}

		// Make request to internal EPPO microservice
		const url = `${EPPO_SERVICE_URL}/search?q=${encodeURIComponent(search)}&limit=50`;

		let response;
		try {
			response = await fetch(url);
		} catch (fetchError) {
			console.error('EPPO service connection error:', fetchError.message);
			return res.status(502).json(fail('EPPO_SERVICE_UNAVAILABLE'));
		}

		if (!response.ok) {
			console.error('EPPO service returned error:', response.status);
			return res.status(502).json(fail('EPPO_SERVICE_UNAVAILABLE'));
		}

		const data = await response.json();

		// Deduplicate results by eppocode, keeping first occurrence (already sorted by relevance)
		// const seen = new Set();
		// const deduplicatedResults = [];

		// for (const item of data.results || data || []) {
		// 	if (item.eppocode && !seen.has(item.eppocode)) {
		// 		seen.add(item.eppocode);
		// 		deduplicatedResults.push(item);
		// 	}
		// }

		res.json(ok({ results: data.results }));
	} catch (err) {
		console.error('Error in EPPO search:', err);
		return res.status(502).json(fail('EPPO_SERVICE_UNAVAILABLE'));
	}
});

module.exports = router;
