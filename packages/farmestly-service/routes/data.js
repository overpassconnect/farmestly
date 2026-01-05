const express = require('express');
const router = express.Router();
const { ok, fail } = require('../utils/response');

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || process.env.EPPO_SERVICE_URL || 'http://127.0.0.1:4000';

// Helper to proxy requests to data-service
async function proxyToDataService(provider, path, query = {}) {
	const queryString = new URLSearchParams(query).toString();
	const url = `${DATA_SERVICE_URL}/${provider}${path}${queryString ? '?' + queryString : ''}`;

	let response;
	try {
		response = await fetch(url);
	} catch (fetchError) {
		console.error(`Data service connection error (${provider}):`, fetchError.message);
		throw new Error('DATA_SERVICE_UNAVAILABLE');
	}

	if (!response.ok) {
		console.error(`Data service returned error (${provider}):`, response.status);
		throw new Error('DATA_SERVICE_UNAVAILABLE');
	}

	return response.json();
}

// ============================================
// EPPO ENDPOINTS
// ============================================

// GET /data/eppo/search - Search EPPO database for plant codes
router.get('/eppo/search', async (req, res) => {
	try {
		const search = req.query.search || req.query.q;

		// Return empty results if search is empty
		if (!search || !search.trim()) {
			return res.json(ok({ results: [] }));
		}

		const data = await proxyToDataService('eppo', '/search', {
			q: search,
			limit: req.query.limit || 50,
			...(req.query.lang && { lang: req.query.lang }),
			...(req.query.country && { country: req.query.country })
		});

		res.json(ok({ results: data.results }));
	} catch (err) {
		console.error('Error in EPPO search:', err);
		return res.status(502).json(fail('DATA_SERVICE_UNAVAILABLE'));
	}
});

// GET /data/eppo/code/:eppocode - Get EPPO code details
router.get('/eppo/code/:eppocode', async (req, res) => {
	try {
		const data = await proxyToDataService('eppo', `/code/${req.params.eppocode}`, {
			...(req.query.lang && { lang: req.query.lang })
		});
		res.json(ok(data));
	} catch (err) {
		console.error('Error in EPPO code lookup:', err);
		return res.status(502).json(fail('DATA_SERVICE_UNAVAILABLE'));
	}
});

// GET /data/eppo/name/:eppocode - Get EPPO name with fallback
router.get('/eppo/name/:eppocode', async (req, res) => {
	try {
		if (!req.query.lang) {
			return res.status(400).json(fail('LANG_REQUIRED'));
		}
		const data = await proxyToDataService('eppo', `/name/${req.params.eppocode}`, {
			lang: req.query.lang,
			...(req.query.country && { country: req.query.country })
		});
		res.json(ok(data));
	} catch (err) {
		console.error('Error in EPPO name lookup:', err);
		return res.status(502).json(fail('DATA_SERVICE_UNAVAILABLE'));
	}
});

// ============================================
// INGREDIENTS EU ENDPOINTS
// ============================================

// GET /data/ingredientseu/search - Search EU active substances
router.get('/ingredientseu/search', async (req, res) => {
	try {
		const search = req.query.search || req.query.q;

		// Return empty results if search is empty
		if (!search || !search.trim()) {
			return res.json(ok({ results: [] }));
		}

		const data = await proxyToDataService('ingredientseu', '/search', {
			q: search,
			limit: req.query.limit || 50,
			...(req.query.status && { status: req.query.status }),
			...(req.query.category && { category: req.query.category }),
			...(req.query.includeOther && { includeOther: req.query.includeOther })
		});

		res.json(ok({ results: data.results, total: data.total }));
	} catch (err) {
		console.error('Error in IngredientsEU search:', err);
		return res.status(502).json(fail('DATA_SERVICE_UNAVAILABLE'));
	}
});

// GET /data/ingredientseu/substance/:id - Get substance details
router.get('/ingredientseu/substance/:id', async (req, res) => {
	try {
		const data = await proxyToDataService('ingredientseu', `/substance/${req.params.id}`);
		res.json(ok(data));
	} catch (err) {
		console.error('Error in IngredientsEU substance lookup:', err);
		return res.status(502).json(fail('DATA_SERVICE_UNAVAILABLE'));
	}
});

// GET /data/ingredientseu/cas/:cas - Get substance by CAS number
router.get('/ingredientseu/cas/:cas', async (req, res) => {
	try {
		const data = await proxyToDataService('ingredientseu', `/cas/${req.params.cas}`);
		res.json(ok(data));
	} catch (err) {
		console.error('Error in IngredientsEU CAS lookup:', err);
		return res.status(502).json(fail('DATA_SERVICE_UNAVAILABLE'));
	}
});

module.exports = router;
