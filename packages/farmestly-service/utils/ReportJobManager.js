// utils/ReportJobManager.js
// Centralized job lifecycle management for report generation

const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const { getStorage } = require('./ReportStorage');
const PuppeteerService = require('./PuppeteerService');
const EmailQueue = require('./EmailQueue');
const { generateReportHtml } = require('./ReportTemplates');
const { getAccountLocale } = require('./locale');

// Collection name for job records
const COLLECTION_NAME = 'reportJobs';

// Report generation limits
const MAX_RECORDS_TOTAL = 10000;              // Hard cap for any report
const MAX_EMAIL_ATTACHMENT_RECORDS = 500;     // Max records for PDF email attachment

// Job status constants
const JobStatus = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	FAILED: 'failed',
	CANCELLED: 'cancelled'
};

// Delivery type constants
const DeliveryType = {
	EMAIL: 'email',
	DOWNLOAD: 'download',
	BOTH: 'both'
};

/**
 * Manages the full lifecycle of report generation jobs.
 * Singleton pattern for consistent access across the application.
 */
class ReportJobManager {
	static _instance = null;

	static getInstance() {
		if (!ReportJobManager._instance) {
			ReportJobManager._instance = new ReportJobManager();
		}
		return ReportJobManager._instance;
	}

	_col() {
		return getDb().collection(COLLECTION_NAME);
	}

	/**
	 * Cancel any pending or processing jobs for the given account.
	 * Ensures only one job runs per user at a time.
	 */
	async cancelPendingJobs(accountId) {
		const result = await this._col().updateMany(
			{
				accountId: new ObjectId(accountId),
				status: { $in: [JobStatus.PENDING, JobStatus.PROCESSING] }
			},
			{
				$set: {
					status: JobStatus.CANCELLED,
					updatedAt: new Date()
				}
			}
		);
		return result.modifiedCount;
	}

	/**
	 * Delete any existing report files for the account.
	 * Called when a new report is requested to avoid stale files.
	 */
	async deleteExistingReportFiles(accountId) {
		const storage = getStorage();

		// Find all completed jobs with download keys for this account
		const existingJobs = await this._col()
			.find({
				accountId: new ObjectId(accountId),
				status: JobStatus.COMPLETED,
				'result.downloadKey': { $exists: true }
			})
			.toArray();

		// Delete associated files
		for (const job of existingJobs) {
			if (job.result.downloadKey) {
				try {
					await storage.delete(job.result.downloadKey);
					// Also delete meta file
					await storage.delete(job.result.downloadKey + '.meta.json');
				} catch (err) {
					console.warn('[ReportJobManager] Failed to delete old file:', job.result.downloadKey, err.message);
				}
			}
		}

		// Clear download keys from job records
		if (existingJobs.length > 0) {
			await this._col().updateMany(
				{
					accountId: new ObjectId(accountId),
					'result.downloadKey': { $exists: true }
				},
				{
					$unset: { 'result.downloadKey': '', 'result.downloadUrl': '' },
					$set: { updatedAt: new Date() }
				}
			);
		}

		return existingJobs.length;
	}

	/**
	 * Create a new report generation job.
	 * Cancels any existing pending jobs and deletes old report files for the account first.
	 */
	async createJob(accountId, params) {
		await this.cancelPendingJobs(accountId);
		await this.deleteExistingReportFiles(accountId);

		const jobId = uuidv4();
		const job = {
			jobId,
			accountId: new ObjectId(accountId),
			status: JobStatus.PENDING,
			delivery: params.delivery || DeliveryType.EMAIL,
			reportType: params.reportType || 'chronological',
			dateRange: params.dateRange || 'all',
			startDate: params.startDate || null,
			endDate: params.endDate || null,
			result: {},
			error: null,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		await this._col().insertOne(job);
		return jobId;
	}

	/**
	 * Get a job by its UUID.
	 */
	async getJob(jobId) {
		return this._col().findOne({ jobId });
	}

	/**
	 * Get a job by UUID, ensuring it belongs to the specified account.
	 * Provides security so users can only query their own jobs.
	 */
	async getJobForAccount(jobId, accountId) {
		return this._col().findOne({
			jobId,
			accountId: new ObjectId(accountId)
		});
	}

	/**
	 * Get the most recent completed job with a download URL for an account.
	 */
	async getLatestCompleted(accountId) {
		return this._col().findOne(
			{
				accountId: new ObjectId(accountId),
				status: JobStatus.COMPLETED,
				'result.downloadKey': { $exists: true }
			},
			{ sort: { createdAt: -1 } }
		);
	}

	/**
	 * Update job status with optional additional fields.
	 */
	async updateStatus(jobId, status, extra = {}) {
		await this._col().updateOne(
			{ jobId },
			{
				$set: {
					status,
					...extra,
					updatedAt: new Date()
				}
			}
		);
	}

	/**
	 * Process a report generation job.
	 * This is the core worker that generates the PDF and handles delivery.
	 */
	async processJob(jobId, account) {
		try {
			// Fetch the job and check if cancelled
			let job = await this.getJob(jobId);
			if (!job || job.status === JobStatus.CANCELLED) {
				return;
			}

			// Update to processing
			await this.updateStatus(jobId, JobStatus.PROCESSING);

			// Build query for job records
			const query = { accountId: account._id };

			if (job.dateRange !== 'all') {
				const now = new Date();
				let startDate;

				switch (job.dateRange) {
					case 'month':
						startDate = new Date(now.getFullYear(), now.getMonth(), 1);
						break;
					case 'quarter':
						startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
						break;
					case 'year':
						startDate = new Date(now.getFullYear(), 0, 1);
						break;
					case 'custom':
						startDate = job.startDate ? new Date(job.startDate) : new Date(now.getFullYear(), 0, 1);
						break;
				}

				if (startDate) {
					const endDate = job.endDate ? new Date(job.endDate) : now;
					query.startedAt = { $gte: startDate, $lte: endDate };
				}
			}

			// Count records first to enforce limits
			const recordCount = await getDb().collection('jobs').countDocuments(query);

			// Enforce hard limit
			if (recordCount > MAX_RECORDS_TOTAL) {
				throw new Error('TOO_MANY_RECORDS');
			}

			// Check if email-only with too many records (should be caught by precheck, but safety check)
			if (job.delivery === DeliveryType.EMAIL && recordCount > MAX_EMAIL_ATTACHMENT_RECORDS) {
				throw new Error('TOO_MANY_RECORDS_FOR_EMAIL');
			}

			// Determine if we can attach PDF to email
			const canAttachToEmail = recordCount <= MAX_EMAIL_ATTACHMENT_RECORDS;

			// Fetch job records (with limit as safety)
			const jobRecords = await getDb()
				.collection('jobs')
				.find(query)
				.sort({ startedAt: -1 })
				.limit(MAX_RECORDS_TOTAL)
				.toArray();

			// Check again if cancelled (user may have started a new request)
			job = await this.getJob(jobId);
			if (job.status === JobStatus.CANCELLED) {
				return;
			}

			// Build lookup maps from separate collections
			const [fields, machines, attachments, tools, products] = await Promise.all([
				getDb().collection('Fields').find({ accountId: account._id }).toArray(),
				getDb().collection('Machines').find({ accountId: account._id }).toArray(),
				getDb().collection('Attachments').find({ accountId: account._id }).toArray(),
				getDb().collection('Tools').find({ accountId: account._id }).toArray(),
				getDb().collection('Products').find({ accountId: account._id }).toArray()
			]);

			const fieldMap = {};
			const machineMap = {};
			const attachmentMap = {};
			const toolMap = {};
			const productMap = {};

			fields.forEach(f => { fieldMap[f._id.toString()] = f.name; });
			machines.forEach(m => { machineMap[m._id.toString()] = m.name; });
			attachments.forEach(a => { attachmentMap[a._id.toString()] = a.name; });
			tools.forEach(t => { toolMap[t._id.toString()] = t.name; });
			products.forEach(p => { productMap[p._id.toString()] = p.name; });

			// Get user's locale for formatting
			const locale = getAccountLocale(account);

			// Generate HTML report
			const farmData = account.content.farmData || {};
			const html = generateReportHtml({
				reportType: job.reportType,
				dateRange: job.dateRange,
				farmName: farmData.farmName || 'Farm',
				jobRecords,
				fieldMap,
				machineMap,
				attachmentMap,
				toolMap,
				productMap,
				locale
			});

			// Generate PDF
			const pdfBase64 = await PuppeteerService.getInstance().generatePdfBase64(html, { showPageNumbers: true });
			const pdfBuffer = Buffer.from(pdfBase64, 'base64');

			// Check if cancelled one more time before delivery
			job = await this.getJob(jobId);
			if (job.status === JobStatus.CANCELLED) {
				return;
			}

			// Build filename
			const farmName = farmData.farmName || 'Farm';
			const now = new Date();
			const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
			const filename = `${farmName.replace(/\s+/g, '_')}_Report_${dateTimeStr}.pdf`;

			const result = {};
			const storage = getStorage();

			// For 'both' or 'download', always save to storage
			// For 'email' with too many records, we'd fail earlier, so no storage needed for email-only
			const needsStorage = job.delivery === DeliveryType.DOWNLOAD ||
				job.delivery === DeliveryType.BOTH ||
				(job.delivery === DeliveryType.EMAIL && !canAttachToEmail);

			if (needsStorage) {
				await storage.saveWithMeta(filename, pdfBuffer);
				result.downloadUrl = storage.getSignedUrl(filename);
				result.downloadKey = filename;
			}

			// Handle email delivery
			if (job.delivery === DeliveryType.EMAIL || job.delivery === DeliveryType.BOTH) {
				if (account.metadata.email) {
					const farmLogo = account.content.farmLogo || null;

					if (canAttachToEmail) {
						// Small report: attach PDF to email
						const emailHtml = this._buildEmailHtml(farmName, job.reportType, job.dateRange, now, farmLogo, null, locale);

						await EmailQueue.getInstance().queue({
							to: account.metadata.email,
							subject: `📊 ${farmName} - Farm Report (${now.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })})`,
							html: emailHtml,
							attachments: [{
								filename,
								content: pdfBase64,
								contentType: 'application/pdf'
							}],
							priority: 1
						});
					} else {
						// Large report: send email with download link only
						const emailHtml = this._buildEmailHtml(farmName, job.reportType, job.dateRange, now, farmLogo, result.downloadUrl, locale);

						await EmailQueue.getInstance().queue({
							to: account.metadata.email,
							subject: `📊 ${farmName} - Farm Report (${now.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })})`,
							html: emailHtml,
							attachments: [],
							priority: 1
						});
					}
					result.emailSent = true;
				}
			}

			// Mark as completed
			await this.updateStatus(jobId, JobStatus.COMPLETED, { result });

		} catch (err) {
			console.error('[ReportJobManager] Job processing error:', err);
			await this.updateStatus(jobId, JobStatus.FAILED, { error: err.message });
		}
	}

	/**
	 * Build the HTML email body for report delivery.
	 * @param {string} farmName - Name of the farm
	 * @param {string} reportType - Type of report
	 * @param {string} dateRange - Date range selection
	 * @param {Date} now - Current timestamp
	 * @param {string|null} farmLogo - Base64 encoded farm logo (optional)
	 * @param {string|null} downloadUrl - Download link for large reports (optional, if null PDF is attached)
	 * @param {string} locale - BCP 47 locale tag for date/number formatting
	 */
	_buildEmailHtml(farmName, reportType, dateRange, now, farmLogo = null, downloadUrl = null, locale = 'en-US') {
		const WEB_URL = process.env.WEB_URL || 'https://my.farmestly.dev-staging.overpassconnect.com';

		const reportTypeLabels = {
			'chronological': 'Chronological',
			'field': 'By Field',
			'machine': 'By Machine',
			'job_type': 'By Job Type',
			'attachment': 'By Attachment',
			'tool': 'By Tool'
		};

		const dateRangeLabels = {
			'all': 'All Time',
			'month': 'This Month',
			'quarter': 'This Quarter',
			'year': 'This Year',
			'custom': 'Custom Range'
		};

		// Build delivery message based on whether PDF is attached or needs download
		const deliveryMessage = downloadUrl
			? `Your farm report has been successfully generated. Due to its size, please use the button below to download it. The link will expire in 30 minutes.`
			: `Your farm report has been successfully generated and is attached to this email.`;

		// Build download button HTML if needed
		const downloadButtonHtml = downloadUrl
			? `
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
								<tr>
									<td style="padding: 16px 0; text-align: center;">
										<!--[if mso]>
										<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${downloadUrl}" style="height:40px;v-text-anchor:middle;width:200px;" arcsize="60%" strokecolor="#E37F1B" fillcolor="#E37F1B">
										<w:anchorlock/>
										<center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">Download Report</center>
										</v:roundrect>
										<![endif]-->
										<!--[if !mso]><!-->
										<a href="${downloadUrl}" style="display: inline-block; padding: 12px 32px; background-color: #E37F1B; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 24px; mso-hide: all;">Download Report</a>
										<!--<![endif]-->
									</td>
								</tr>
							</table>
							<p style="margin: 8px 0 0; color: #A09085; font-size: 13px; text-align: center;">
								This link will expire in 30 minutes.
							</p>
			`
			: '';

		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Farm Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fbf2ec;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fbf2ec;">
		<tr>
			<td style="padding: 40px 20px;">
				<!-- Logo -->
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
					<tr>
						<td style="text-align: center; padding-bottom: 32px;">
							<img src="${WEB_URL}/assets/farmestly_logo.png" alt="Farmestly" width="180" style="display: block; margin: 0 auto;">
						</td>
					</tr>
				</table>
				<!-- Card -->
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(66, 33, 11, 0.12);">
					<!-- Content -->
					<tr>
						<td style="padding: 48px 40px;">
							<h1 style="margin: 0 0 8px; color: #42210B; font-size: 22px; font-weight: 500; text-align: center;">Your Farm Report is Ready</h1>
							<p style="margin: 0 0 24px; color: #A09085; font-size: 15px; line-height: 1.5; text-align: center;">
								${deliveryMessage}
							</p>
${downloadButtonHtml}
							<!-- Info Box -->
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; background-color: #fbf2ec; border-radius: 10px;">
								<tr>
									<td style="padding: 16px 20px;">
										<p style="margin: 0 0 8px; color: #E37F1B; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
											Report Details
										</p>
										<p style="margin: 0; color: #42210B; font-size: 14px; line-height: 1.6;">
											<strong>Farm:</strong> ${farmName}<br>
											<strong>Type:</strong> ${reportTypeLabels[reportType] || reportType}<br>
											<strong>Period:</strong> ${dateRangeLabels[dateRange] || dateRange}<br>
											<strong>Generated:</strong> ${now.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
										</p>
									</td>
								</tr>
							</table>

							<p style="margin: 24px 0 0; color: #A09085; font-size: 13px; line-height: 1.5; text-align: center;">
								If you have any questions about this report, please don't hesitate to reach out.
							</p>
						</td>
					</tr>
				</table>
				<!-- Footer -->
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
					<tr>
						<td style="padding: 24px 0; text-align: center;">
							<p style="margin: 0; color: #A09085; font-size: 12px;">&copy; ${now.getFullYear()} Farmestly. All rights reserved.</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
		`.trim();
	}

	/**
	 * Clean up expired jobs and files.
	 * Removes old job records and their associated files.
	 */
	async cleanupExpiredJobs() {
		const storage = getStorage();
		const expiryMs = storage.getDefaultExpiryMs();
		const cutoffTime = new Date(Date.now() - expiryMs);

		let deletedFiles = 0;
		let deletedRecords = 0;

		try {
			// Find completed jobs with download keys older than cutoff
			const expiredJobs = await this._col()
				.find({
					status: JobStatus.COMPLETED,
					'result.downloadKey': { $exists: true },
					createdAt: { $lt: cutoffTime }
				})
				.toArray();

			// Delete associated files
			for (const job of expiredJobs) {
				if (job.result.downloadKey) {
					const deleted = await storage.delete(job.result.downloadKey);
					if (deleted) deletedFiles++;

					// Also try to delete the meta file
					try {
						await storage.delete(job.result.downloadKey + '.meta.json');
					} catch { /* ignore */ }
				}
			}

			// Delete old job records (24 hours old, in terminal states)
			const recordCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const deleteResult = await this._col().deleteMany({
				status: { $in: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED] },
				createdAt: { $lt: recordCutoff }
			});
			deletedRecords = deleteResult.deletedCount;

		} catch (err) {
			console.error('[ReportJobManager] Cleanup error:', err);
		}

		return { deletedFiles, deletedRecords };
	}
}

module.exports = {
	ReportJobManager,
	JobStatus,
	DeliveryType,
	MAX_RECORDS_TOTAL,
	MAX_EMAIL_ATTACHMENT_RECORDS
};
