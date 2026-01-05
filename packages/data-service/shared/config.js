const fs = require('fs');
const path = require('path');

// Required environment variables
const REQUIRED_ENV = [
	'PORT',
	'DATA_DIR',
	'EPPO_API_URL',
	'EPPO_API_KEY',
	'EPPO_TYPES',
	'INGREDIENTSEU_URL'
];

function validateEnv() {
	const missing = [];

	for (const key of REQUIRED_ENV) {
		if (!process.env[key]) {
			missing.push(key);
		}
	}

	if (missing.length > 0) {
		console.error('ERROR: Missing required environment variables:');
		for (const key of missing) {
			console.error(`  - ${key}`);
		}
		console.error('\nRequired environment variables:');
		console.error('  PORT                 - HTTP server port (e.g., 4000)');
		console.error('  DATA_DIR             - Directory for data files (e.g., /var/farmestlydataproviders)');
		console.error('  EPPO_API_URL         - EPPO API URL (e.g., https://api.eppo.int/eppocodes/v2/datasets)');
		console.error('  EPPO_API_KEY         - EPPO API key (x-api-key header)');
		console.error('  EPPO_TYPES           - EPPO code types to load (e.g., PFL)');
		console.error('  INGREDIENTSEU_URL    - URL to fetch EU ingredients data from');
		process.exit(1);
	}
}

function ensureDataDir() {
	const dataDir = process.env.DATA_DIR;

	if (!fs.existsSync(dataDir)) {
		try {
			fs.mkdirSync(dataDir, { recursive: true });
			console.log(`Created data directory: ${dataDir}`);
		} catch (e) {
			console.error(`ERROR: Cannot create data directory: ${dataDir}`);
			console.error(e.message);
			process.exit(1);
		}
	}

	// Create provider subdirectories
	const eppoDir = path.join(dataDir, 'eppo');
	const ingredientseuDir = path.join(dataDir, 'ingredientseu');

	if (!fs.existsSync(eppoDir)) {
		fs.mkdirSync(eppoDir, { recursive: true });
	}
	if (!fs.existsSync(ingredientseuDir)) {
		fs.mkdirSync(ingredientseuDir, { recursive: true });
	}

	return {
		dataDir,
		eppoDir,
		ingredientseuDir
	};
}

function getConfig() {
	const dirs = ensureDataDir();

	return {
		port: parseInt(process.env.PORT, 10),
		dataDir: dirs.dataDir,
		eppo: {
			dir: dirs.eppoDir,
			apiUrl: process.env.EPPO_API_URL,
			apiKey: process.env.EPPO_API_KEY,
			types: process.env.EPPO_TYPES.split(',').map(t => t.trim().toUpperCase())
		},
		ingredientseu: {
			dir: dirs.ingredientseuDir,
			fetchUrl: process.env.INGREDIENTSEU_URL
		}
	};
}

module.exports = {
	validateEnv,
	getConfig
};
