// utils/ReportStorage.js
// Storage abstraction layer for report PDFs using the strategy pattern

const fs = require('fs').promises;
const path = require('path');
const { Signature } = require('signed');

// Configuration from environment variables
const STORAGE_TYPE = process.env.REPORT_STORAGE_TYPE || 'filesystem';
const STORAGE_PATH = process.env.REPORT_STORAGE_PATH || '/var/farmestly/reports';
const URL_SECRET = process.env.REPORT_URL_SECRET || 'default-secret-change-in-production';
const EXPIRY_MINUTES = parseInt(process.env.REPORT_EXPIRY_MINUTES, 10) || 30;

/**
 * Base class defining the storage interface.
 * Concrete implementations must override all methods.
 */
class ReportStorage {
	save(key, buffer) {
		throw new Error('Not implemented');
	}

	getSignedUrl(key) {
		throw new Error('Not implemented');
	}

	delete(key) {
		throw new Error('Not implemented');
	}

	exists(key) {
		throw new Error('Not implemented');
	}

	sendFile(key, res) {
		throw new Error('Not implemented');
	}

	cleanup() {
		throw new Error('Not implemented');
	}

	verifyRequest(req) {
		throw new Error('Not implemented');
	}

	getDefaultExpiryMs() {
		return EXPIRY_MINUTES * 60 * 1000;
	}
}

/**
 * Filesystem-based storage implementation.
 * Stores PDFs on local disk with signed URL support for secure downloads.
 */
class FileSystemStorage extends ReportStorage {
	constructor() {
		super();
		this._basePath = STORAGE_PATH;
		this._signature = new Signature({
			secret: URL_SECRET,
			ttl: EXPIRY_MINUTES * 60 // TTL in seconds
		});
		this._ensureDir();
	}

	async _ensureDir() {
		try {
			await fs.mkdir(this._basePath, { recursive: true });
		} catch (err) {
			if (err.code !== 'EEXIST') {
				console.error('[ReportStorage] Failed to create storage directory:', err);
			}
		}
	}

	/**
	 * Sanitize key to prevent path traversal attacks.
	 * Only allows alphanumeric, underscore, hyphen, and dot characters.
	 */
	_filePath(key) {
		const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '');
		return path.join(this._basePath, safeKey);
	}

	async save(key, buffer) {
		await this._ensureDir();
		const filePath = this._filePath(key);
		await fs.writeFile(filePath, buffer);
		return { key };
	}

	/**
	 * Generate a time-limited signed URL for downloading the file.
	 * Uses the 'signed' package for cryptographic URL signing.
	 */
	getSignedUrl(key) {
		const baseUrl = `/report/download/${encodeURIComponent(key)}`;
		return this._signature.sign(baseUrl);
	}

	async delete(key) {
		try {
			await fs.unlink(this._filePath(key));
			return true;
		} catch (err) {
			if (err.code === 'ENOENT') {
				return false;
			}
			throw err;
		}
	}

	async exists(key) {
		try {
			await fs.access(this._filePath(key));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Send the PDF file via nginx X-Accel-Redirect.
	 * Nginx serves the file directly, bypassing Node for efficiency.
	 */
	sendFile(key, res) {
		const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '');
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `inline; filename="${safeKey.replace(/"/g, '')}"`);
		res.setHeader('X-Accel-Redirect', `/_internal_reports/${safeKey}`);
		res.end();
	}

	/**
	 * Verify a signed URL from an incoming request.
	 * Returns true if valid, false if invalid or expired.
	 */
	verifyRequest(req) {
		try {
			// The signed package needs the URL string with the signature query param
			// req.originalUrl contains "/report/download/filename.pdf?signed=..."
			this._signature.verify(req.originalUrl);
			return true;
		} catch (err) {
			console.error('[ReportStorage] Signature verification failed:', err.message);
			return false;
		}
	}

	/**
	 * Clean up is handled by ReportJobManager using database records.
	 * This method exists for interface compatibility but does nothing
	 * since the database is the source of truth for file expiration.
	 */
	async cleanup() {
		// No-op: cleanup is driven by ReportJobManager.cleanupExpiredJobs()
		// which uses the database to track file expiration
		return 0;
	}

	/**
	 * Save a PDF file. Metadata tracking is handled by the database
	 * in ReportJobManager, not by companion files.
	 */
	async saveWithMeta(key, buffer) {
		await this.save(key, buffer);
		return { key };
	}
}

// Singleton instance
let _instance = null;

/**
 * Factory function returning the appropriate storage implementation.
 * Uses singleton pattern for consistent access across the application.
 */
function getStorage() {
	if (_instance) {
		return _instance;
	}

	switch (STORAGE_TYPE) {
		case 's3':
			throw new Error('S3 storage not yet implemented');
		case 'filesystem':
		default:
			_instance = new FileSystemStorage();
	}

	return _instance;
}

module.exports = {
	getStorage,
	ReportStorage,
	FileSystemStorage
};
