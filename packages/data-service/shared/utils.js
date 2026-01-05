// Shared utilities for data-service providers

const fs = require('fs');

/**
 * Remove diacritics/accents from a string for normalized search
 * Handles Greek tonos, French accents, German umlauts, etc.
 */
function removeDiacritics(str) {
	return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * File-based locking to prevent concurrent builds across load-balanced nodes.
 * Uses atomic file creation with O_EXCL flag.
 */
function acquireLock(lockPath, maxAge = 30 * 60 * 1000) {
	try {
		// Check if stale lock exists (older than maxAge)
		if (fs.existsSync(lockPath)) {
			const stat = fs.statSync(lockPath);
			const age = Date.now() - stat.mtimeMs;
			if (age > maxAge) {
				// Stale lock, remove it
				console.log(`[Lock] Removing stale lock (${Math.round(age / 1000)}s old): ${lockPath}`);
				fs.unlinkSync(lockPath);
			} else {
				// Lock is held by another process
				return false;
			}
		}

		// Try to create lock file atomically
		const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
		const os = require('os');
		fs.writeSync(fd, JSON.stringify({ pid: process.pid, host: os.hostname(), time: new Date().toISOString() }));
		fs.closeSync(fd);
		return true;
	} catch (e) {
		if (e.code === 'EEXIST') {
			// Another process created the lock first
			return false;
		}
		console.error('[Lock] Error acquiring lock:', e.message);
		return false;
	}
}

function releaseLock(lockPath) {
	try {
		if (fs.existsSync(lockPath)) {
			fs.unlinkSync(lockPath);
		}
	} catch (e) {
		console.error('[Lock] Error releasing lock:', e.message);
	}
}

/**
 * Convert ispreferred integer to boolean
 */
function transformName(obj) {
	return obj ? { ...obj, ispreferred: !!obj.ispreferred } : obj;
}

/**
 * Transform array of names
 */
function transformNames(arr) {
	return arr.map(transformName);
}

module.exports = {
	removeDiacritics,
	transformName,
	transformNames,
	acquireLock,
	releaseLock
};
