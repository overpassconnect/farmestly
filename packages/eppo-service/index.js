const fs = require('fs');
const path = require('path');
const express = require('express');
const sax = require('sax');
const Database = require('better-sqlite3');

const XML_PATH = process.env.EPPO_XML || path.join(__dirname, 'fullcodes.xml');
const DB_DIR = path.dirname(XML_PATH);
const DB_BASE = path.basename(XML_PATH, '.xml');
const PORT = process.env.EPPO_PORT || 4000;

let allowedTypes = new Set((process.env.EPPO_TYPES || 'PFL').split(','));
let db, stmts;
let currentDbPath = null;
let rebuilding = false;
let ready = false;
let meta = { dateexport: null, version: null, builtAt: null };

function getDbPath() {
	return path.join(DB_DIR, `${DB_BASE}_${Date.now()}.db`);
}

function findLatestDb() {
	if (!fs.existsSync(DB_DIR)) return null;
	const files = fs.readdirSync(DB_DIR)
		.filter(f => f.startsWith(DB_BASE + '_') && f.endsWith('.db'))
		.sort()
		.reverse();
	return files.length ? path.join(DB_DIR, files[0]) : null;
}

function cleanupOldDbs(keepPath) {
	try {
		const files = fs.readdirSync(DB_DIR)
			.filter(f => f.startsWith(DB_BASE + '_') && f.endsWith('.db'))
			.map(f => path.join(DB_DIR, f))
			.filter(f => f !== keepPath);
		for (const f of files) {
			try { fs.unlinkSync(f); } catch (e) { /* ignore locked files */ }
		}
	} catch (e) { /* ignore */ }
}

// --- Build ---

function buildDb(targetPath, types) {
	console.log('Building', targetPath, 'types:', [...types]);

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
			console.log(`Inserted ${codeCount} codes, ${nameCount} names`);
			tmpDb.exec(`
        CREATE INDEX idx_codes_eppo ON codes(eppocode);
        CREATE INDEX idx_names_eppo ON names(eppocode);
        CREATE INDEX idx_names_code_id ON names(code_id);
        CREATE INDEX idx_names_lang ON names(eppocode, lang);
        CREATE INDEX idx_names_lang_country ON names(eppocode, lang, langcountry);
        CREATE VIRTUAL TABLE names_fts USING fts5(fullname_norm, eppocode, tokenize='unicode61 remove_diacritics 2');
      `);
			// Insert normalized text into FTS for diacritic-insensitive search (including Greek tonos)
			const removeDiacritics = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
		fs.createReadStream(XML_PATH).pipe(parser);
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

		// Name lookup with fallback support
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

		// Search - dynamic query built in endpoint for optional filters

		// Stats
		countCodes: newDb.prepare('SELECT COUNT(*) FROM codes').pluck(),
		countNames: newDb.prepare('SELECT COUNT(*) FROM names').pluck(),
		countNamesActive: newDb.prepare('SELECT COUNT(*) FROM names WHERE isactive = 1').pluck()
	};
	return { db: newDb, stmts: newStmts, meta: newMeta };
}

async function rebuild(types) {
	if (rebuilding) return { ok: false, error: 'already rebuilding' };
	rebuilding = true;

	const typesSet = types ? new Set(types.split(',').map(t => t.trim().toUpperCase())) : allowedTypes;
	console.log('Rebuilding with types:', [...typesSet]);

	const newPath = getDbPath();

	try {
		const result = await buildDb(newPath, typesSet);
		const newOpened = openDb(newPath);

		const oldDb = db;

		db = newOpened.db;
		stmts = newOpened.stmts;
		meta = newOpened.meta;
		currentDbPath = newPath;
		allowedTypes = typesSet;

		if (oldDb) oldDb.close();
		setTimeout(() => cleanupOldDbs(newPath), 1000);

		console.log('Rebuild complete');
		rebuilding = false;
		return { ok: true, codes: result.codeCount, names: result.nameCount, meta };
	} catch (e) {
		console.error('Rebuild failed:', e);
		try { fs.unlinkSync(newPath); } catch (e2) { /* ignore */ }
		rebuilding = false;
		return { ok: false, error: e.message };
	}
}

// --- Watch via polling (more reliable than fs.watch) ---
let lastXmlMtime = 0;

function scheduleCheck() {
	setTimeout(async () => {
		if (ready && !rebuilding) {
			try {
				const stat = fs.statSync(XML_PATH);
				if (stat.mtimeMs > lastXmlMtime) {
					console.log(db ? 'XML file changed, rebuilding...' : 'XML file changed, retrying database build...');
					lastXmlMtime = stat.mtimeMs;
					await rebuild();
				}
			} catch (e) { /* ignore */ }
		}
		scheduleCheck();
	}, 60000);
}

scheduleCheck();

// --- HTTP ---
const app = express();
app.use(express.json());

// Convert ispreferred integer to boolean
const transformName = (obj) => obj ? { ...obj, ispreferred: !!obj.ispreferred } : obj;
const transformNames = (arr) => arr.map(transformName);

// Normalize diacritics for search (FTS5 remove_diacritics doesn't apply to quoted strings)
const removeDiacritics = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

app.use((req, res, next) => {
	const originalJson = res.json.bind(res);
	res.json = (data) => originalJson({
		_meta: { dataDate: meta.dateexport, version: meta.version, types: meta.types, builtAt: meta.builtAt },
		...data
	});
	next();
});

// Guard endpoints when db is not available
app.use((req, res, next) => {
	if (!db && req.path !== '/health' && req.path !== '/rebuild') {
		return res.status(503).json({ error: 'database not ready - XML may be invalid' });
	}
	next();
});

// GET /code/:eppocode - full info
app.get('/code/:eppocode', (req, res) => {
	try {
		const eppocode = req.params.eppocode.toUpperCase();
		const { lang } = req.query;
		const code = stmts.codeInfo.get(eppocode);
		if (!code) return res.status(404).json({ error: 'code not found' });
		const names = lang ? stmts.byCodeLang.all(eppocode, lang) : stmts.codeNamesActive.all(eppocode);
		const preferred = stmts.preferredName.get(eppocode);
		res.json({ code: { ...code, preferred: preferred || null }, names: transformNames(names) });
	} catch (e) { console.error('Query error:', e); res.status(500).json({ error: 'query failed' }); }
});

// GET /name/:eppocode?lang=en&country=US - get single name with fallback
app.get('/name/:eppocode', (req, res) => {
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
	} catch (e) { console.error('Query error:', e); res.status(500).json({ error: 'query failed' }); }
});

// GET /search?q=...&lang=...&country=...&limit=...&offset=...
app.get('/search', (req, res) => {
	try {
		const { q, lang, country, limit = 100, offset = 0 } = req.query;
		if (!q) return res.status(400).json({ error: 'q required' });

		// Escape FTS5 special characters by wrapping in double quotes
		// Normalize diacritics to match the normalized FTS index (handles Greek tonos, etc.)
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
	} catch (e) { console.error('Search error:', e); res.status(500).json({ error: 'search failed' }); }
});

// POST /rebuild
app.post('/rebuild', async (req, res) => {
	const { types } = req.body || {};
	res.json(await rebuild(types));
});

// GET /health
app.get('/health', (req, res) => {
	const mem = process.memoryUsage();

	if (!db) {
		return res.json({
			ok: false,
			error: 'database not loaded - XML may be invalid',
			rebuilding,
			memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB', rss: Math.round(mem.rss / 1024 / 1024) + ' MB' }
		});
	}

	res.json({
		ok: !rebuilding, rebuilding,
		stats: { codes: stmts.countCodes.get(), names: stmts.countNames.get(), namesActive: stmts.countNamesActive.get() },
		memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB', rss: Math.round(mem.rss / 1024 / 1024) + ' MB' },
		dbFile: path.basename(currentDbPath),
		dbSize: Math.round(fs.statSync(currentDbPath).size / 1024 / 1024) + ' MB'
	});
});

process.on('uncaughtException', e => console.error('Uncaught:', e));
process.on('unhandledRejection', e => console.error('Unhandled:', e));

// --- Start ---
(async () => {
	try { lastXmlMtime = fs.statSync(XML_PATH).mtimeMs; } catch (e) { /* ignore */ }

	let existing = findLatestDb();

	if (existing) {
		try {
			const testDb = new Database(existing, { readonly: true });
			testDb.prepare('SELECT 1 FROM meta LIMIT 1').get();
			testDb.close();
		} catch (e) {
			console.log('Invalid db, rebuilding...');
			existing = null;
		}
	}

	if (!existing) {
		existing = getDbPath();
		try {
			await buildDb(existing, allowedTypes);
		} catch (e) {
			console.error('Failed to build initial database:', e.message);
			console.error('Fix the XML file and restart, or the service will retry every 5 seconds');

			// Start server anyway, but endpoints will fail
			ready = true;
			app.listen(PORT, () => console.log(`EPPO service on :${PORT} (NO DATA - XML invalid)`));
			return;
		}
		try { lastXmlMtime = fs.statSync(XML_PATH).mtimeMs; } catch (e) { /* ignore */ }
	}

	const opened = openDb(existing);
	db = opened.db;
	stmts = opened.stmts;
	meta = opened.meta;
	currentDbPath = existing;

	ready = true;
	cleanupOldDbs(currentDbPath);

	app.listen(PORT, '127.0.0.1', () => console.log(`EPPO service on :${PORT}`));
})();