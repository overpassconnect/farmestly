const fs = require('fs');
const path = require('path');
const express = require('express');
const sax = require('sax');
const Database = require('better-sqlite3');
const AdmZip = require('adm-zip');
const cron = require('node-cron');
const { removeDiacritics, transformName, transformNames, acquireLock, releaseLock } = require('../../shared/utils');

const router = express.Router();

// Configuration (set by initialize)
let config = null;
const DB_BASE = 'eppo';

let allowedTypes = new Set();
let db, stmts;
let currentDbPath = null;
let currentXmlPath = null;
let rebuilding = false;
let fetching = false;
let ready = false;
let meta = { dateexport: null, version: null, builtAt: null, lastFetch: null };

function getDbPath() {
	return path.join(config.dir, `${DB_BASE}_${Date.now()}.db`);
}

function findXmlFile() {
	if (!fs.existsSync(config.dir)) return null;
	const files = fs.readdirSync(config.dir)
		.filter(f => f.endsWith('.xml'))
		.sort((a, b) => fs.statSync(path.join(config.dir, b)).mtime - fs.statSync(path.join(config.dir, a)).mtime);
	return files.length ? path.join(config.dir, files[0]) : null;
}

function getZipPath() {
	return path.join(config.dir, 'fullcodes.zip');
}

function getLockPath(operation) {
	return path.join(config.dir, `${operation}.lock`);
}

function findLatestDb() {
	if (!fs.existsSync(config.dir)) return null;
	const files = fs.readdirSync(config.dir)
		.filter(f => f.startsWith(DB_BASE + '_') && f.endsWith('.db'))
		.sort()
		.reverse();
	return files.length ? path.join(config.dir, files[0]) : null;
}

function cleanupOldDbs(keepPath) {
	try {
		const files = fs.readdirSync(config.dir)
			.filter(f => f.startsWith(DB_BASE + '_') && f.endsWith('.db'))
			.map(f => path.join(config.dir, f))
			.filter(f => f !== keepPath);
		for (const f of files) {
			try { fs.unlinkSync(f); } catch (e) { /* ignore locked files */ }
		}
	} catch (e) { /* ignore */ }
}

// --- Fetch XML from EPPO API ---

async function fetchXmlFromApi() {
	if (fetching) {
		return { ok: false, error: 'already fetching' };
	}

	const lockPath = getLockPath('fetch');
	if (!acquireLock(lockPath)) {
		console.log('[EPPO] Fetch locked by another node, skipping');
		return { ok: false, error: 'locked by another node' };
	}

	fetching = true;
	console.log('[EPPO] Fetching dataset list from API...');

	try {
		// Step 1: Get dataset list
		const datasetsResponse = await fetch(config.apiUrl, {
			headers: {
				'x-api-key': config.apiKey
			}
		});

		if (!datasetsResponse.ok) {
			throw new Error(`API returned ${datasetsResponse.status}: ${datasetsResponse.statusText}`);
		}

		const datasets = await datasetsResponse.json();

		if (!Array.isArray(datasets)) {
			throw new Error('API did not return an array of datasets');
		}

		// Step 2: Find "XML Full" dataset
		let xmlDataset = datasets.find(d => d.label === 'XML Full');

		// Fallback: search for anything containing "xmlfull" (case-insensitive)
		if (!xmlDataset) {
			xmlDataset = datasets.find(d => {
				const values = Object.values(d).map(v => String(v).toLowerCase());
				return values.some(v => v.includes('xmlfull'));
			});
		}

		if (!xmlDataset || !xmlDataset.url) {
			throw new Error('Could not find XML Full dataset in API response');
		}

		console.log(`[EPPO] Found XML Full dataset: ${xmlDataset.label || 'unknown'}`);
		console.log(`[EPPO] Downloading from: ${xmlDataset.url}`);

		// Step 3: Download the ZIP file
		const zipResponse = await fetch(xmlDataset.url, {
			headers: {
				'x-api-key': config.apiKey
			}
		});

		if (!zipResponse.ok) {
			throw new Error(`ZIP download failed: ${zipResponse.status}`);
		}

		const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
		const zipPath = getZipPath();
		fs.writeFileSync(zipPath, zipBuffer);
		console.log(`[EPPO] Downloaded ZIP (${Math.round(zipBuffer.length / 1024 / 1024)} MB)`);

		// Step 4: Extract XML from ZIP
		const zip = new AdmZip(zipPath);
		const zipEntries = zip.getEntries();

		// Find the XML file in the ZIP
		const xmlEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.xml'));

		if (!xmlEntry) {
			throw new Error('No XML file found in ZIP archive');
		}

		// Extract with original filename (just the basename, not subdirs)
		const xmlFilename = path.basename(xmlEntry.entryName);
		const xmlDestPath = path.join(config.dir, xmlFilename);
		console.log(`[EPPO] Extracting: ${xmlEntry.entryName} -> ${xmlFilename}`);
		const xmlContent = zip.readFile(xmlEntry);
		fs.writeFileSync(xmlDestPath, xmlContent);
		currentXmlPath = xmlDestPath;
		console.log(`[EPPO] Extracted XML (${Math.round(xmlContent.length / 1024 / 1024)} MB)`);

		// Cleanup ZIP file
		try { fs.unlinkSync(zipPath); } catch (e) { /* ignore */ }

		meta.lastFetch = new Date().toISOString();
		fetching = false;
		releaseLock(lockPath);

		console.log('[EPPO] Fetch complete, triggering rebuild...');
		return await rebuild();

	} catch (e) {
		console.error('[EPPO] Fetch failed:', e.message);
		fetching = false;
		releaseLock(lockPath);
		return { ok: false, error: e.message };
	}
}

// --- Build ---

function buildDb(targetPath, types, xmlFilePath) {
	console.log('[EPPO] Building', targetPath, 'types:', [...types]);

	const tmpDb = new Database(targetPath);
	tmpDb.pragma('journal_mode = OFF');
	tmpDb.pragma('synchronous = OFF');

	tmpDb.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE codes (
      id INTEGER PRIMARY KEY, eppocode TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
      creation TEXT, modification TEXT
    );
    CREATE TABLE names (
      id INTEGER PRIMARY KEY, code_id INTEGER NOT NULL, eppocode TEXT NOT NULL,
      fullname TEXT NOT NULL, lang TEXT NOT NULL, langcountry TEXT, authority TEXT,
      ispreferred INTEGER NOT NULL, isactive INTEGER NOT NULL,
      creation TEXT, modification TEXT
    );
  `);

	const insertCode = tmpDb.prepare('INSERT INTO codes VALUES (?, ?, ?, ?, ?)');
	const insertName = tmpDb.prepare('INSERT INTO names VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
	const insertMeta = tmpDb.prepare('INSERT INTO meta VALUES (?, ?)');

	const insertBatch = tmpDb.transaction((codes, names) => {
		for (const c of codes) insertCode.run(c.id, c.eppocode, c.type, c.creation, c.modification);
		for (const n of names) insertName.run(n.id, n.code_id, n.eppocode, n.fullname, n.lang, n.langcountry, n.authority, n.ispreferred, n.isactive, n.creation, n.modification);
	});

	return new Promise((resolve, reject) => {
		const parser = sax.createStream(true, { trim: true });
		const codeBatch = [], nameBatch = [];
		let currentCode = null, currentName = null, textBuffer = '';
		let codeCount = 0, nameCount = 0, rootMeta = {};

		parser.on('opentag', node => {
			if (node.name === 'codes') {
				rootMeta.dateexport = node.attributes.dateexport || null;
				rootMeta.version = node.attributes.version || null;
			} else if (node.name === 'code' && types.has(node.attributes.type) && node.attributes.isactive === 'true') {
				currentCode = { id: +node.attributes.id, eppocode: '', type: node.attributes.type, creation: node.attributes.creation || null, modification: node.attributes.modification || null };
			} else if (currentCode && node.name === 'name') {
				currentName = { id: +node.attributes.id, code_id: currentCode.id, fullname: '', lang: '', langcountry: null, authority: null, ispreferred: node.attributes.ispreferred === 'true' ? 1 : 0, isactive: node.attributes.isactive === 'true' ? 1 : 0, creation: node.attributes.creation || null, modification: node.attributes.modification || null };
			}
			textBuffer = '';
		});

		parser.on('text', t => { textBuffer += t; });

		parser.on('closetag', name => {
			if (currentCode) {
				if (name === 'eppocode') currentCode.eppocode = textBuffer.trim();
				else if (currentName) {
					if (name === 'fullname') currentName.fullname = textBuffer.trim();
					else if (name === 'lang') currentName.lang = textBuffer.trim();
					else if (name === 'langcountry') currentName.langcountry = textBuffer.trim();
					else if (name === 'authority') currentName.authority = textBuffer.trim();
					else if (name === 'name') { currentName.eppocode = currentCode.eppocode; nameBatch.push(currentName); nameCount++; currentName = null; }
				} else if (name === 'code') {
					codeBatch.push(currentCode); codeCount++;
					if (codeBatch.length >= 5000) { insertBatch(codeBatch, nameBatch); codeBatch.length = 0; nameBatch.length = 0; }
					currentCode = null;
				}
			}
			textBuffer = '';
		});

		parser.on('end', () => {
			if (codeBatch.length) insertBatch(codeBatch, nameBatch);
			const builtAt = new Date().toISOString();
			insertMeta.run('dateexport', rootMeta.dateexport);
			insertMeta.run('version', rootMeta.version);
			insertMeta.run('builtAt', builtAt);
			insertMeta.run('types', [...types].join(','));
			console.log(`[EPPO] Inserted ${codeCount} codes, ${nameCount} names`);
			tmpDb.exec(`
        CREATE INDEX idx_codes_eppo ON codes(eppocode);
        CREATE INDEX idx_names_eppo ON names(eppocode);
        CREATE INDEX idx_names_code_id ON names(code_id);
        CREATE INDEX idx_names_lang ON names(eppocode, lang);
        CREATE INDEX idx_names_lang_country ON names(eppocode, lang, langcountry);
        CREATE VIRTUAL TABLE names_fts USING fts5(fullname_norm, eppocode, tokenize='unicode61 remove_diacritics 2');
      `);
			// Insert normalized text into FTS for diacritic-insensitive search
			const insertFts = tmpDb.prepare('INSERT INTO names_fts(rowid, fullname_norm, eppocode) VALUES (?, ?, ?)');
			const activeNames = tmpDb.prepare('SELECT id, fullname, eppocode FROM names WHERE isactive = 1').all();
			const insertFtsBatch = tmpDb.transaction((rows) => {
				for (const row of rows) {
					insertFts.run(row.id, removeDiacritics(row.fullname), row.eppocode);
				}
			});
			insertFtsBatch(activeNames);
			tmpDb.close();
			resolve({ codeCount, nameCount, meta: { ...rootMeta, builtAt } });
		});

		parser.on('error', (err) => {
			tmpDb.close();
			reject(err);
		});
		fs.createReadStream(xmlFilePath).pipe(parser);
	});
}

function openDb(dbPath) {
	const newDb = new Database(dbPath, { readonly: true });
	const metaRows = newDb.prepare('SELECT key, value FROM meta').all();
	const newMeta = {};
	for (const row of metaRows) newMeta[row.key] = row.value;

	const newStmts = {
		codeInfo: newDb.prepare('SELECT id, eppocode, type, creation, modification FROM codes WHERE eppocode = ?'),
		codeNamesActive: newDb.prepare('SELECT id, fullname, lang, langcountry, authority, ispreferred, creation, modification FROM names WHERE eppocode = ? AND isactive = 1 ORDER BY ispreferred DESC, lang'),
		byCodeLang: newDb.prepare('SELECT fullname, authority, langcountry, ispreferred FROM names WHERE eppocode = ? AND lang = ? AND isactive = 1'),
		preferredName: newDb.prepare('SELECT fullname, lang, authority FROM names WHERE eppocode = ? AND ispreferred = 1 AND isactive = 1'),

		nameByLangCountry: newDb.prepare(`
      SELECT fullname, lang, langcountry, authority, ispreferred
      FROM names
      WHERE eppocode = ? AND lang = ? AND langcountry = ? AND isactive = 1
      ORDER BY ispreferred DESC
      LIMIT 1
    `),
		nameByLangGeneric: newDb.prepare(`
      SELECT fullname, lang, langcountry, authority, ispreferred
      FROM names
      WHERE eppocode = ? AND lang = ? AND langcountry IS NULL AND isactive = 1
      ORDER BY ispreferred DESC
      LIMIT 1
    `),
		nameByLang: newDb.prepare(`
      SELECT fullname, lang, langcountry, authority, ispreferred
      FROM names
      WHERE eppocode = ? AND lang = ? AND isactive = 1
      ORDER BY ispreferred DESC
      LIMIT 1
    `),

		countCodes: newDb.prepare('SELECT COUNT(*) FROM codes').pluck(),
		countNames: newDb.prepare('SELECT COUNT(*) FROM names').pluck(),
		countNamesActive: newDb.prepare('SELECT COUNT(*) FROM names WHERE isactive = 1').pluck()
	};
	return { db: newDb, stmts: newStmts, meta: newMeta };
}

async function rebuild(types) {
	if (rebuilding) return { ok: false, error: 'already rebuilding' };

	const lockPath = getLockPath('rebuild');
	if (!acquireLock(lockPath)) {
		console.log('[EPPO] Rebuild locked by another node, skipping');
		return { ok: false, error: 'locked by another node' };
	}

	rebuilding = true;

	const typesSet = types ? new Set(types.split(',').map(t => t.trim().toUpperCase())) : allowedTypes;
	console.log('[EPPO] Rebuilding with types:', [...typesSet]);

	// Find XML file if not already set
	if (!currentXmlPath) {
		currentXmlPath = findXmlFile();
	}
	if (!currentXmlPath || !fs.existsSync(currentXmlPath)) {
		console.error('[EPPO] XML file not found');
		rebuilding = false;
		releaseLock(lockPath);
		return { ok: false, error: 'XML file not found - run fetch first' };
	}

	const newPath = getDbPath();

	try {
		const result = await buildDb(newPath, typesSet, currentXmlPath);
		const newOpened = openDb(newPath);

		const oldDb = db;

		db = newOpened.db;
		stmts = newOpened.stmts;
		meta = { ...newOpened.meta, lastFetch: meta.lastFetch };
		currentDbPath = newPath;
		allowedTypes = typesSet;

		if (oldDb) oldDb.close();
		setTimeout(() => cleanupOldDbs(newPath), 1000);

		console.log('[EPPO] Rebuild complete');
		rebuilding = false;
		releaseLock(lockPath);
		return { ok: true, codes: result.codeCount, names: result.nameCount, meta };
	} catch (e) {
		console.error('[EPPO] Rebuild failed:', e);
		try { fs.unlinkSync(newPath); } catch (e2) { /* ignore */ }
		rebuilding = false;
		releaseLock(lockPath);
		return { ok: false, error: e.message };
	}
}

// --- Cron job for weekly fetch ---
function scheduleFetch() {
	// Run every Sunday at 2:00 AM (before ingredientseu at 3:00 AM)
	cron.schedule('0 2 * * 0', async () => {
		console.log('[EPPO] Running scheduled fetch...');
		await fetchXmlFromApi();
	});

	console.log('[EPPO] Weekly fetch scheduled (Sundays 2:00 AM)');
}

// --- Routes ---

// Middleware to add meta to responses
router.use((req, res, next) => {
	const originalJson = res.json.bind(res);
	res.json = (data) => originalJson({
		_meta: { provider: 'eppo', dataDate: meta.dateexport, version: meta.version, types: meta.types, builtAt: meta.builtAt, lastFetch: meta.lastFetch },
		...data
	});
	next();
});

// Guard endpoints when db is not available
router.use((req, res, next) => {
	if (!db && req.path !== '/health' && req.path !== '/rebuild' && req.path !== '/fetch') {
		return res.status(503).json({ error: 'database not ready - run fetch to download data' });
	}
	next();
});

// GET /code/:eppocode - full info
router.get('/code/:eppocode', (req, res) => {
	try {
		const eppocode = req.params.eppocode.toUpperCase();
		const { lang } = req.query;
		const code = stmts.codeInfo.get(eppocode);
		if (!code) return res.status(404).json({ error: 'code not found' });
		const names = lang ? stmts.byCodeLang.all(eppocode, lang) : stmts.codeNamesActive.all(eppocode);
		const preferred = stmts.preferredName.get(eppocode);
		res.json({ code: { ...code, preferred: preferred || null }, names: transformNames(names) });
	} catch (e) { console.error('[EPPO] Query error:', e); res.status(500).json({ error: 'query failed' }); }
});

// GET /name/:eppocode?lang=en&country=US - get single name with fallback
router.get('/name/:eppocode', (req, res) => {
	try {
		const eppocode = req.params.eppocode.toUpperCase();
		const { lang, country } = req.query;

		if (!lang) return res.status(400).json({ error: 'lang required' });

		let name = null;

		// 1. Try exact match: lang + country
		if (country) {
			name = stmts.nameByLangCountry.get(eppocode, lang, country.toUpperCase());
		}

		// 2. Fall back to lang only (generic, no country)
		if (!name) {
			name = stmts.nameByLangGeneric.get(eppocode, lang);
		}

		// 3. Fall back to any name in that lang
		if (!name) {
			name = stmts.nameByLang.get(eppocode, lang);
		}

		if (!name) return res.status(404).json({ error: 'name not found' });

		res.json({ name: transformName(name) });
	} catch (e) { console.error('[EPPO] Query error:', e); res.status(500).json({ error: 'query failed' }); }
});

// GET /search?q=...&lang=...&country=...&limit=...&offset=...
router.get('/search', (req, res) => {
	try {
		const { q, lang, country, limit = 100, offset = 0 } = req.query;
		if (!q) return res.status(400).json({ error: 'q required' });

		const escaped = removeDiacritics(q).replace(/"/g, '""');
		const matchExpr = `{fullname_norm eppocode}:"${escaped}"*`;
		const params = [matchExpr];
		let where = 'names_fts MATCH ? AND n.isactive = 1';

		if (lang) {
			where += ' AND n.lang = ?';
			params.push(lang);
		}
		if (country) {
			where += ' AND n.langcountry = ?';
			params.push(country.toUpperCase());
		}

		const countSql = `SELECT COUNT(DISTINCT n.eppocode || n.fullname || n.lang) FROM names_fts f JOIN names n ON f.rowid = n.id WHERE ${where}`;
		const total = db.prepare(countSql).pluck().get(...params);

		params.push(+limit, +offset);
		const dataSql = `
			SELECT DISTINCT n.eppocode, n.fullname, n.lang, n.langcountry, n.ispreferred,
				(SELECT p.fullname FROM names p WHERE p.eppocode = n.eppocode AND p.ispreferred = 1 AND p.isactive = 1 LIMIT 1) AS preferred
			FROM names_fts f JOIN names n ON f.rowid = n.id WHERE ${where} ORDER BY bm25(names_fts) LIMIT ? OFFSET ?`;
		const results = db.prepare(dataSql).all(...params);

		res.json({ results: transformNames(results), total, limit: +limit, offset: +offset });
	} catch (e) { console.error('[EPPO] Search error:', e); res.status(500).json({ error: 'search failed' }); }
});

// POST /rebuild
router.post('/rebuild', async (req, res) => {
	const { types } = req.body || {};
	res.json(await rebuild(types));
});

// POST /fetch - manually trigger data fetch from API
router.post('/fetch', async (req, res) => {
	res.json(await fetchXmlFromApi());
});

// GET /health
router.get('/health', (req, res) => {
	const mem = process.memoryUsage();

	if (!db) {
		return res.json({
			ok: false,
			provider: 'eppo',
			error: 'database not loaded - run POST /fetch to download data',
			rebuilding,
			fetching,
			memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB', rss: Math.round(mem.rss / 1024 / 1024) + ' MB' }
		});
	}

	res.json({
		ok: !rebuilding && !fetching,
		provider: 'eppo',
		rebuilding,
		fetching,
		stats: { codes: stmts.countCodes.get(), names: stmts.countNames.get(), namesActive: stmts.countNamesActive.get() },
		memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB', rss: Math.round(mem.rss / 1024 / 1024) + ' MB' },
		dbFile: path.basename(currentDbPath),
		dbSize: Math.round(fs.statSync(currentDbPath).size / 1024 / 1024) + ' MB',
		lastFetch: meta.lastFetch
	});
});

// --- Initialize ---
async function initialize(cfg) {
	config = cfg;
	allowedTypes = new Set(config.types);

	console.log(`[EPPO] Data directory: ${config.dir}`);
	console.log(`[EPPO] Types: ${[...allowedTypes].join(', ')}`);

	let existing = findLatestDb();

	if (existing) {
		try {
			const testDb = new Database(existing, { readonly: true });
			testDb.prepare('SELECT 1 FROM meta LIMIT 1').get();
			testDb.close();
		} catch (e) {
			console.log('[EPPO] Invalid db, will rebuild...');
			existing = null;
		}
	}

	// Find any existing XML file
	currentXmlPath = findXmlFile();

	if (existing) {
		// Use existing database
		const opened = openDb(existing);
		db = opened.db;
		stmts = opened.stmts;
		meta = opened.meta;
		currentDbPath = existing;
		cleanupOldDbs(currentDbPath);
		console.log('[EPPO] Provider ready (using existing database)');
	} else if (currentXmlPath) {
		// Build from existing XML
		console.log(`[EPPO] Building database from existing XML: ${path.basename(currentXmlPath)}`);
		const result = await rebuild();
		if (!result.ok) {
			console.error('[EPPO] Failed to build database:', result.error);
		}
	} else {
		// No data - need to fetch
		console.log('[EPPO] No data found, fetching from API...');
		const result = await fetchXmlFromApi();
		if (!result.ok) {
			console.error('[EPPO] Initial fetch failed:', result.error);
			console.log('[EPPO] Provider started without data - use POST /fetch to retry');
		}
	}

	ready = true;
	scheduleFetch();
}

module.exports = { router, initialize };
