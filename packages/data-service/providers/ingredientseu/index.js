const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const { removeDiacritics, acquireLock, releaseLock } = require('../../shared/utils');

const router = express.Router();

// Configuration (set by initialize)
let config = null;
const DB_BASE = 'ingredientseu';

let db, stmts;
let currentDbPath = null;
let rebuilding = false;
let fetching = false;
let ready = false;
let meta = { builtAt: null, recordCount: null, lastFetch: null };

// CAS number format: digits-digits-digit (e.g., "1072957-71-1")
const CAS_REGEX = /\d{2,7}-\d{2}-\d/;

function isValidCas(cas) {
	if (!cas || typeof cas !== 'string') return false;
	return CAS_REGEX.test(cas.trim());
}

// Extract CAS number from remark field if present
// Handles patterns like: "CAS (ECHA) Spinetoram J : 187166-40-1" or "CAS: 12345-67-8"
function extractCasFromRemark(remark) {
	if (!remark || typeof remark !== 'string') return null;
	const match = remark.match(CAS_REGEX);
	return match ? match[0] : null;
}

function getDbPath() {
	return path.join(config.dir, `${DB_BASE}_${Date.now()}.db`);
}

function getJsonPath() {
	return path.join(config.dir, 'data.json');
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

// --- Build ---

function buildDb(targetPath, data) {
	console.log('[IngredientsEU] Building', targetPath);

	const tmpDb = new Database(targetPath);
	tmpDb.pragma('journal_mode = OFF');
	tmpDb.pragma('synchronous = OFF');

	tmpDb.exec(`
		CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
		CREATE TABLE substances (
			substance_id INTEGER PRIMARY KEY,
			substance_name TEXT NOT NULL,
			as_cas_number TEXT,
			substance_status TEXT,
			approval_date TEXT,
			expiry_date TEXT,
			risk_assessment TEXT,
			substance_category TEXT,
			as_is_group TEXT,
			as_micro_org TEXT,
			rms TEXT,
			corms TEXT,
			remark TEXT,
			legislations_old TEXT,
			legislations_actives TEXT,
			tox_value_adi TEXT,
			tox_source_adi TEXT,
			tox_remark_adi TEXT,
			tox_value_arfd TEXT,
			tox_source_arfd TEXT,
			tox_remark_arfd TEXT,
			tox_value_aoel TEXT,
			tox_source_aoel TEXT,
			tox_remark_aoel TEXT,
			tox_value_aaoel TEXT,
			tox_source_aaoel TEXT,
			tox_remark_aaoel TEXT,
			tox_value_other TEXT,
			tox_source_other TEXT,
			tox_remark_other TEXT,
			authorisations_at_nat_level TEXT,
			classification_reg_1272 TEXT,
			ac_type INTEGER,
			basic_substance TEXT,
			low_risk_active_substance TEXT,
			candidate_for_substitution TEXT,
			candidate_for_substitution_type TEXT,
			active_substance_part_of_group TEXT,
			active_substance_part_of_group_id INTEGER,
			as_member_id INTEGER,
			as_member_name TEXT,
			pesticide_residue_linked TEXT,
			pest_res_linked_annex TEXT,
			pest_res_linked_legislation TEXT,
			pest_res_linked_legislation_url TEXT,
			pest_res_mrl_webpage TEXT
		);
	`);

	const insertSubstance = tmpDb.prepare(`
		INSERT OR REPLACE INTO substances VALUES (
			?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
		)
	`);

	const insertMeta = tmpDb.prepare('INSERT INTO meta VALUES (?, ?)');

	const insertBatch = tmpDb.transaction((items) => {
		for (const s of items) {
			insertSubstance.run(
				s.substance_id,
				s.substance_name,
				s.as_cas_number,
				s.substance_status,
				s.approval_date,
				s.expiry_date,
				s.risk_assessment,
				s.substance_category,
				s.as_is_group,
				s.as_micro_org,
				s.rms,
				s.corms,
				s.remark,
				s.legislations_old,
				s.legislations_actives,
				s.tox_value_adi,
				s.tox_source_adi,
				s.tox_remark_adi,
				s.tox_value_arfd,
				s.tox_source_earfd || s.tox_source_arfd, // Handle typo in source data
				s.tox_remark_arfd,
				s.tox_value_aoel,
				s.tox_source_aoel,
				s.tox_remark_aoel,
				s.tox_value_aaoel,
				s.tox_source_aaoel,
				s.tox_remark_aaoel,
				s.tox_value_other,
				s.tox_source_other,
				s.tox_remark_other,
				s.authorisations_at_nat_level,
				s.classification_reg_1272,
				s.ac_type,
				s.basic_substance,
				s.low_risk_active_substance,
				s.candidate_for_substitution,
				s.candidate_for_substitution_type,
				s.active_substance_part_of_group,
				s.active_substance_part_of_group_id,
				s.as_member_id,
				s.as_member_name,
				s.pesticide_residue_linked,
				s.pest_res_linked_annex,
				s.pest_res_linked_legislation,
				s.pest_res_linked_legislation_url,
				s.pest_res_mrl_webpage
			);
		}
	});

	// Process in batches
	const batchSize = 1000;
	for (let i = 0; i < data.length; i += batchSize) {
		insertBatch(data.slice(i, i + batchSize));
	}

	const builtAt = new Date().toISOString();
	insertMeta.run('builtAt', builtAt);
	insertMeta.run('recordCount', String(data.length));

	console.log(`[IngredientsEU] Inserted ${data.length} substances`);

	// Create indexes
	tmpDb.exec(`
		CREATE INDEX idx_substances_name ON substances(substance_name);
		CREATE INDEX idx_substances_cas ON substances(as_cas_number);
		CREATE INDEX idx_substances_status ON substances(substance_status);
		CREATE INDEX idx_substances_category ON substances(substance_category);
		CREATE VIRTUAL TABLE substances_fts USING fts5(
			substance_name_norm,
			as_cas_number,
			substance_category,
			tokenize='unicode61 remove_diacritics 2'
		);
	`);

	// Insert into FTS
	const insertFts = tmpDb.prepare('INSERT INTO substances_fts(rowid, substance_name_norm, as_cas_number, substance_category) VALUES (?, ?, ?, ?)');
	const allSubstances = tmpDb.prepare('SELECT substance_id, substance_name, as_cas_number, substance_category FROM substances').all();
	const insertFtsBatch = tmpDb.transaction((rows) => {
		for (const row of rows) {
			insertFts.run(row.substance_id, removeDiacritics(row.substance_name || ''), row.as_cas_number, row.substance_category);
		}
	});
	insertFtsBatch(allSubstances);

	tmpDb.close();
	return { recordCount: data.length, meta: { builtAt, recordCount: data.length } };
}

function openDb(dbPath) {
	const newDb = new Database(dbPath, { readonly: true });
	const metaRows = newDb.prepare('SELECT key, value FROM meta').all();
	const newMeta = {};
	for (const row of metaRows) newMeta[row.key] = row.value;

	const newStmts = {
		substanceById: newDb.prepare('SELECT * FROM substances WHERE substance_id = ?'),
		substanceByName: newDb.prepare('SELECT * FROM substances WHERE substance_name = ?'),
		substanceByCas: newDb.prepare('SELECT * FROM substances WHERE as_cas_number = ?'),
		countSubstances: newDb.prepare('SELECT COUNT(*) FROM substances').pluck(),
		countApproved: newDb.prepare("SELECT COUNT(*) FROM substances WHERE substance_status = 'Approved'").pluck(),
		countNotApproved: newDb.prepare("SELECT COUNT(*) FROM substances WHERE substance_status = 'Not approved'").pluck()
	};
	return { db: newDb, stmts: newStmts, meta: newMeta };
}

async function rebuild() {
	if (rebuilding) return { ok: false, error: 'already rebuilding' };

	const lockPath = getLockPath('rebuild');
	if (!acquireLock(lockPath)) {
		console.log('[IngredientsEU] Rebuild locked by another node, skipping');
		return { ok: false, error: 'locked by another node' };
	}

	rebuilding = true;

	console.log('[IngredientsEU] Rebuilding from JSON...');

	const jsonPath = getJsonPath();
	const newPath = getDbPath();

	try {
		// Read and parse JSON data
		if (!fs.existsSync(jsonPath)) {
			rebuilding = false;
			releaseLock(lockPath);
			throw new Error(`JSON file not found: ${jsonPath}`);
		}

		const raw = fs.readFileSync(jsonPath, 'utf8');

		// Handle malformed JSON (line-delimited JSON objects)
		let data;
		try {
			data = JSON.parse(raw);
		} catch (e) {
			// Try parsing as line-delimited JSON
			data = raw.trim().split('\n')
				.filter(line => line.trim())
				.map(line => JSON.parse(line));
		}

		if (!Array.isArray(data)) {
			data = [data];
		}

		const result = buildDb(newPath, data);
		const newOpened = openDb(newPath);

		const oldDb = db;

		db = newOpened.db;
		stmts = newOpened.stmts;
		meta = { ...newOpened.meta, lastFetch: meta.lastFetch };
		currentDbPath = newPath;

		if (oldDb) oldDb.close();
		setTimeout(() => cleanupOldDbs(newPath), 1000);

		console.log('[IngredientsEU] Rebuild complete');
		rebuilding = false;
		releaseLock(lockPath);
		return { ok: true, recordCount: result.recordCount, meta };
	} catch (e) {
		console.error('[IngredientsEU] Rebuild failed:', e);
		try { fs.unlinkSync(newPath); } catch (e2) { /* ignore */ }
		rebuilding = false;
		releaseLock(lockPath);
		return { ok: false, error: e.message };
	}
}

async function fetchData() {
	if (fetching) {
		return { ok: false, error: 'already fetching' };
	}

	const lockPath = getLockPath('fetch');
	if (!acquireLock(lockPath)) {
		console.log('[IngredientsEU] Fetch locked by another node, skipping');
		return { ok: false, error: 'locked by another node' };
	}

	fetching = true;
	console.log('[IngredientsEU] Fetching data from:', config.fetchUrl);

	try {
		const response = await fetch(config.fetchUrl);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const text = await response.text();

		fs.writeFileSync(getJsonPath(), text, 'utf8');
		meta.lastFetch = new Date().toISOString();

		console.log('[IngredientsEU] Data fetched and saved');
		fetching = false;
		releaseLock(lockPath);

		// Trigger rebuild
		const rebuildResult = await rebuild();
		return { ok: true, fetched: true, rebuild: rebuildResult };
	} catch (e) {
		console.error('[IngredientsEU] Fetch failed:', e);
		fetching = false;
		releaseLock(lockPath);
		return { ok: false, error: e.message };
	}
}

// --- Cron job for weekly fetch ---
function scheduleFetch() {
	// Run every Sunday at 3:00 AM
	cron.schedule('0 3 * * 0', async () => {
		console.log('[IngredientsEU] Running scheduled fetch...');
		await fetchData();
	});

	console.log('[IngredientsEU] Weekly fetch scheduled (Sundays 3:00 AM)');
}

// --- Routes ---

// Middleware to add meta to responses
router.use((req, res, next) => {
	const originalJson = res.json.bind(res);
	res.json = (data) => originalJson({
		_meta: { provider: 'ingredientseu', builtAt: meta.builtAt, recordCount: meta.recordCount, lastFetch: meta.lastFetch },
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

// GET /search?q=...&status=...&category=...&includeOther=...&limit=...&offset=...
// When category is specified, OT (Other) is always included unless includeOther=false
router.get('/search', (req, res) => {
	try {
		const { q, status, category, includeOther = 'true', limit = 100, offset = 0 } = req.query;
		if (!q) return res.status(400).json({ error: 'q required' });

		const escaped = removeDiacritics(q).replace(/"/g, '""');
		const matchExpr = `"${escaped}"*`;
		const params = [matchExpr];
		let where = 'substances_fts MATCH ?';

		if (status) {
			where += ' AND s.substance_status = ?';
			params.push(status);
		}
		if (category) {
			// Include both the requested category and OT (Other) by default
			if (includeOther === 'true' || includeOther === '1') {
				where += ' AND (s.substance_category LIKE ? OR s.substance_category LIKE ?)';
				params.push(`${category}%`, 'OT%');
			} else {
				where += ' AND s.substance_category LIKE ?';
				params.push(`${category}%`);
			}
		}

		const countSql = `SELECT COUNT(*) FROM substances_fts f JOIN substances s ON f.rowid = s.substance_id WHERE ${where}`;
		const total = db.prepare(countSql).pluck().get(...params);

		params.push(+limit, +offset);
		const dataSql = `
			SELECT s.substance_id, s.substance_name, s.as_cas_number, s.substance_status,
				s.substance_category, s.approval_date, s.expiry_date,
				s.tox_value_adi, s.tox_value_arfd, s.tox_value_aoel,
				s.candidate_for_substitution, s.low_risk_active_substance, s.remark
			FROM substances_fts f
			JOIN substances s ON f.rowid = s.substance_id
			WHERE ${where}
			ORDER BY bm25(substances_fts)
			LIMIT ? OFFSET ?`;
		const rawResults = db.prepare(dataSql).all(...params);

		// Normalize CAS numbers - use remark as fallback for invalid/missing CAS
		const results = rawResults.map(r => {
			let cas = isValidCas(r.as_cas_number) ? r.as_cas_number : null;
			if (!cas && r.remark) {
				cas = extractCasFromRemark(r.remark);
			}
			return { ...r, as_cas_number: cas };
		});

		res.json({ results, total, limit: +limit, offset: +offset });
	} catch (e) {
		console.error('[IngredientsEU] Search error:', e);
		res.status(500).json({ error: 'search failed' });
	}
});

// GET /substance/:id - get full substance details
router.get('/substance/:id', (req, res) => {
	try {
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });

		const substance = stmts.substanceById.get(id);
		if (!substance) return res.status(404).json({ error: 'substance not found' });

		res.json({ substance });
	} catch (e) {
		console.error('[IngredientsEU] Query error:', e);
		res.status(500).json({ error: 'query failed' });
	}
});

// GET /cas/:cas - get substance by CAS number
router.get('/cas/:cas', (req, res) => {
	try {
		const cas = req.params.cas;
		const substance = stmts.substanceByCas.get(cas);
		if (!substance) return res.status(404).json({ error: 'substance not found' });

		res.json({ substance });
	} catch (e) {
		console.error('[IngredientsEU] Query error:', e);
		res.status(500).json({ error: 'query failed' });
	}
});

// POST /rebuild
router.post('/rebuild', async (req, res) => {
	res.json(await rebuild());
});

// POST /fetch - manually trigger data fetch
router.post('/fetch', async (req, res) => {
	res.json(await fetchData());
});

// GET /health
router.get('/health', (req, res) => {
	const mem = process.memoryUsage();

	if (!db) {
		return res.json({
			ok: false,
			provider: 'ingredientseu',
			error: 'database not loaded - run POST /fetch to download data',
			rebuilding,
			fetching,
			memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB', rss: Math.round(mem.rss / 1024 / 1024) + ' MB' }
		});
	}

	res.json({
		ok: !rebuilding && !fetching,
		provider: 'ingredientseu',
		rebuilding,
		fetching,
		stats: {
			total: stmts.countSubstances.get(),
			approved: stmts.countApproved.get(),
			notApproved: stmts.countNotApproved.get()
		},
		memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB', rss: Math.round(mem.rss / 1024 / 1024) + ' MB' },
		dbFile: path.basename(currentDbPath),
		dbSize: Math.round(fs.statSync(currentDbPath).size / 1024 / 1024) + ' MB',
		lastFetch: meta.lastFetch
	});
});

// --- Initialize ---
async function initialize(cfg) {
	config = cfg;

	console.log(`[IngredientsEU] Data directory: ${config.dir}`);

	const jsonPath = getJsonPath();
	let existing = findLatestDb();

	if (existing) {
		try {
			const testDb = new Database(existing, { readonly: true });
			testDb.prepare('SELECT 1 FROM meta LIMIT 1').get();
			testDb.close();
		} catch (e) {
			console.log('[IngredientsEU] Invalid db, will rebuild...');
			existing = null;
		}
	}

	if (existing) {
		// Use existing database
		const opened = openDb(existing);
		db = opened.db;
		stmts = opened.stmts;
		meta = opened.meta;
		currentDbPath = existing;
		cleanupOldDbs(currentDbPath);
		console.log('[IngredientsEU] Provider ready (using existing database)');
	} else if (fs.existsSync(jsonPath)) {
		// Build from existing JSON
		console.log('[IngredientsEU] Building database from existing JSON...');
		const result = await rebuild();
		if (!result.ok) {
			console.error('[IngredientsEU] Failed to build database:', result.error);
		}
	} else {
		// No data - need to fetch
		console.log('[IngredientsEU] No data found, fetching from URL...');
		const result = await fetchData();
		if (!result.ok) {
			console.error('[IngredientsEU] Initial fetch failed:', result.error);
			console.log('[IngredientsEU] Provider started without data - use POST /fetch to retry');
		}
	}

	ready = true;
	scheduleFetch();
}

module.exports = { router, initialize };
