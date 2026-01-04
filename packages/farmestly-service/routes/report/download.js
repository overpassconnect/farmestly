const express = require('express');
const router = express.Router();
const { fail } = require('../../utils/response');
const { getStorage } = require('../../utils/ReportStorage');

/**
 * GET /report/download/:key
 * Serve a PDF file with signed URL verification.
 * Uses nginx X-Accel-Redirect for efficient file serving.
 *
 * This route is PUBLIC - authentication is via signed URL, not session.
 */
router.get('/:key', async (req, res) => {
	try {
		const storage = getStorage();

		// Verify the signed URL
		if (!storage.verifyRequest(req)) {
			return res.status(403).json(fail('INVALID_OR_EXPIRED_LINK'));
		}

		const key = req.params.key;

		// Check if file exists
		const exists = await storage.exists(key);
		if (!exists) {
			return res.status(404).json(fail('FILE_NOT_FOUND'));
		}

		// Let nginx serve the file via X-Accel-Redirect
		storage.sendFile(key, res);

	} catch (err) {
		console.error('[Report] Download error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
