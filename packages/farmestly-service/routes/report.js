const express = require('express');
const { getDb } = require('../utils/db');
const router = express.Router();
const { ok, fail } = require('../utils/response');
const { ObjectId } = require('mongodb');
const { ReportJobManager, JobStatus, DeliveryType, MAX_RECORDS_TOTAL, MAX_EMAIL_ATTACHMENT_RECORDS } = require('../utils/ReportJobManager');
const { getStorage } = require('../utils/ReportStorage');

/**
 * Helper to build date query filter from request params
 */
function buildDateQuery(dateRange, startDate, endDate) {
	if (dateRange === 'all') return {};

	const now = new Date();
	let start;

	switch (dateRange) {
		case 'month':
			start = new Date(now.getFullYear(), now.getMonth(), 1);
			break;
		case 'quarter':
			start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
			break;
		case 'year':
			start = new Date(now.getFullYear(), 0, 1);
			break;
		case 'custom':
			start = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
			break;
		default:
			return {};
	}

	const end = endDate ? new Date(endDate) : now;
	return { startTime: { $gte: start, $lte: end } };
}

/**
 * GET /report/precheck
 * Check if report generation is possible for given parameters.
 * Returns whether email and download options are available.
 */
router.get('/precheck', async (req, res) => {
	try {
		const account = await getDb()
			.collection('Accounts')
			.findOne({ _id: new ObjectId(req.session.accountId) });

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const { reportType, dateRange, startDate, endDate } = req.query;

		// Build query
		const query = {
			accountId: account._id,
			...buildDateQuery(dateRange, startDate, endDate)
		};

		// Count records
		const count = await getDb().collection('jobs').countDocuments(query);

		let canEmail = true;
		let canDownload = true;
		let emailNotVerified = false;

		if (count === 0) {
			canEmail = false;
			canDownload = false;
		} else if (count > MAX_RECORDS_TOTAL) {
			canEmail = false;
			canDownload = false;
		} else if (count > MAX_EMAIL_ATTACHMENT_RECORDS) {
			canEmail = false;
		}

		// Check if email is verified for email delivery
		if (canEmail && (!account.metadata.email || account.metadata.emailVerified !== true)) {
			canEmail = false;
			emailNotVerified = !account.metadata.email ? false : true;
		}

		res.json(ok({ canEmail, canDownload, emailNotVerified }));

	} catch (err) {
		console.error('[Report] Precheck error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

/**
 * POST /report
 * Create a new report generation job.
 * Responds immediately with 202 Accepted and the jobId for polling.
 */
router.post('/', async (req, res) => {
	try {
		const account = await getDb()
			.collection('Accounts')
			.findOne({ _id: new ObjectId(req.session.accountId) });

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		// Get delivery type from query or body
		const delivery = req.query.delivery || req.body.delivery || DeliveryType.EMAIL;

		// Validate delivery type
		if (!Object.values(DeliveryType).includes(delivery)) {
			return res.status(400).json(fail('INVALID_DELIVERY_TYPE'));
		}

		// Check if email is required for the delivery type
		if (delivery === DeliveryType.EMAIL || delivery === DeliveryType.BOTH) {
			if (!account.metadata.email) {
				return res.status(400).json(fail('EMAIL_REQUIRED'));
			}
			if (account.metadata.emailVerified !== true) {
				return res.status(400).json(fail('EMAIL_NOT_VERIFIED'));
			}
		}

		// Create the job
		const jobId = await ReportJobManager.getInstance().createJob(req.session.accountId, {
			delivery,
			reportType: req.body.reportType || 'chronological',
			dateRange: req.body.dateRange || 'all',
			startDate: req.body.startDate,
			endDate: req.body.endDate
		});

		// Kick off processing asynchronously
		setImmediate(() => {
			ReportJobManager.getInstance()
				.processJob(jobId, account)
				.catch(err => console.error('[Report] Background processing error:', err));
		});

		// Return 202 Accepted with jobId for polling
		res.status(202).json(ok({
			jobId,
			message: 'Report generation started'
		}));

	} catch (err) {
		console.error('[Report] Create job error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

/**
 * GET /report/status/:jobId
 * Poll for job status.
 */
router.get('/status/:jobId', async (req, res) => {
	try {
		const job = await ReportJobManager.getInstance().getJobForAccount(
			req.params.jobId,
			req.session.accountId
		);

		if (!job) {
			return res.status(404).json(fail('JOB_NOT_FOUND'));
		}

		const response = {
			jobId: job.jobId,
			status: job.status,
			delivery: job.delivery,
			createdAt: job.createdAt
		};

		// Add result details for completed jobs
		if (job.status === JobStatus.COMPLETED) {
			response.result = {
				downloadUrl: job.result.downloadUrl || null,
				emailSent: job.result.emailSent || false
			};
		}

		// Add error for failed jobs
		if (job.status === JobStatus.FAILED) {
			response.error = job.error;
		}

		res.json(ok(response));

	} catch (err) {
		console.error('[Report] Get status error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

/**
 * GET /report/latest
 * Get the user's most recent downloadable report with a fresh signed URL.
 */
router.get('/latest', async (req, res) => {
	try {
		const job = await ReportJobManager.getInstance().getLatestCompleted(req.session.accountId);

		if (!job || !job.result.downloadKey) {
			return res.json(ok({ report: null }));
		}

		// Verify the file still exists
		const storage = getStorage();
		const exists = await storage.exists(job.result.downloadKey);

		if (!exists) {
			return res.json(ok({ report: null }));
		}

		// Generate a fresh signed URL
		const freshUrl = storage.getSignedUrl(job.result.downloadKey);

		res.json(ok({
			report: {
				jobId: job.jobId,
				createdAt: job.createdAt,
				downloadUrl: freshUrl,
				reportType: job.reportType,
				dateRange: job.dateRange
			}
		}));

	} catch (err) {
		console.error('[Report] Get latest error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

/**
 * GET /report/download/:key
 * Serve a PDF file with signed URL verification.
 * Uses nginx X-Accel-Redirect for efficient file serving.
 */
router.get('/download/:key', async (req, res) => {
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
