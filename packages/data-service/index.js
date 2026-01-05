require('dotenv').config();

const { validateEnv, getConfig } = require('./shared/config');

// Validate environment variables before anything else
validateEnv();

const config = getConfig();

const express = require('express');

// Import providers
const eppoProvider = require('./providers/eppo');
const ingredientseuProvider = require('./providers/ingredientseu');

const app = express();
app.use(express.json());

// Reject proxied requests (nginx sets these headers)
app.use((req, res, next) => {
	if (req.headers['x-forwarded-for'] || req.headers['x-real-ip']) {
		return res.status(403).json({ error: 'direct access only' });
	}
	next();
});

// Mount providers
app.use('/eppo', eppoProvider.router);
app.use('/ingredientseu', ingredientseuProvider.router);

// Root health check - aggregates all providers
app.get('/health', (req, res) => {
	const mem = process.memoryUsage();
	res.json({
		service: 'data-service',
		providers: ['eppo', 'ingredientseu'],
		dataDir: config.dataDir,
		memory: {
			heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB',
			rss: Math.round(mem.rss / 1024 / 1024) + ' MB'
		}
	});
});

// Root info
app.get('/', (req, res) => {
	res.json({
		service: 'data-service',
		version: require('./package.json').version,
		providers: {
			eppo: '/eppo - EPPO plant codes database',
			ingredientseu: '/ingredientseu - EU active substances/pesticides database'
		},
		endpoints: {
			'/health': 'Service health check',
			'/eppo/health': 'EPPO provider health',
			'/eppo/search': 'Search EPPO codes',
			'/eppo/code/:eppocode': 'Get EPPO code details',
			'/ingredientseu/health': 'EU ingredients provider health',
			'/ingredientseu/search': 'Search EU substances',
			'/ingredientseu/substance/:id': 'Get substance details'
		}
	});
});

process.on('uncaughtException', e => console.error('Uncaught:', e));
process.on('unhandledRejection', e => console.error('Unhandled:', e));

// --- Start ---
(async () => {
	console.log('Starting data-service...');
	console.log(`Data directory: ${config.dataDir}`);

	// Initialize all providers
	await Promise.all([
		eppoProvider.initialize(config.eppo),
		ingredientseuProvider.initialize(config.ingredientseu)
	]);

	app.listen(config.port, '127.0.0.1', () => console.log(`Data service on :${config.port}`));
})();
