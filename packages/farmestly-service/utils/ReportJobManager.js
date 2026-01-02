// utils/ReportJobManager.js
// Centralized job lifecycle management for report generation

const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const { getStorage } = require('./ReportStorage');
const PuppeteerService = require('./PuppeteerService');
const EmailQueue = require('./EmailQueue');
const { generateReportHtml } = require('./ReportTemplates');

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
	 * Create a new report generation job.
	 * Cancels any existing pending jobs for the account first.
	 */
	async createJob(accountId, params) {
		await this.cancelPendingJobs(accountId);

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
					query.startTime = { $gte: startDate, $lte: endDate };
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
				.sort({ startTime: -1 })
				.limit(MAX_RECORDS_TOTAL)
				.toArray();

			// Check again if cancelled (user may have started a new request)
			job = await this.getJob(jobId);
			if (job.status === JobStatus.CANCELLED) {
				return;
			}

			// Build lookup maps from farm data
			const farmData = account.content.farmData || {};
			const fieldMap = {};
			const machineMap = {};
			const attachmentMap = {};
			const toolMap = {};

			(farmData.fields || []).forEach(f => { fieldMap[f.id] = f.name; });
			(farmData.machines || []).forEach(m => { machineMap[m.id] = m.name; });
			(farmData.attachments || []).forEach(a => { attachmentMap[a.id] = a.name; });
			(farmData.tools || []).forEach(t => { toolMap[t.id] = t.name; });

			// Generate HTML report
			const html = generateReportHtml({
				reportType: job.reportType,
				dateRange: job.dateRange,
				farmName: account.content.farmName || 'Farm',
				jobRecords,
				fieldMap,
				machineMap,
				attachmentMap,
				toolMap
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
			const farmName = account.content.farmName || 'Farm';
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
						const emailHtml = this._buildEmailHtml(farmName, job.reportType, job.dateRange, now, farmLogo, null);

						await EmailQueue.getInstance().queue({
							to: account.metadata.email,
							subject: `📊 ${farmName} - Farm Report (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
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
						const emailHtml = this._buildEmailHtml(farmName, job.reportType, job.dateRange, now, farmLogo, result.downloadUrl);

						await EmailQueue.getInstance().queue({
							to: account.metadata.email,
							subject: `📊 ${farmName} - Farm Report (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
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
	 */
	_buildEmailHtml(farmName, reportType, dateRange, now, farmLogo = null, downloadUrl = null) {
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

		// Build logo HTML if available
		const logoHtml = farmLogo
			? `<img src="${farmLogo}" alt="${farmName}" style="max-width: 80px; max-height: 80px; margin-bottom: 16px; border-radius: 8px;" /><br>`
			: '';

		// Build delivery message based on whether PDF is attached or needs download
		const deliveryMessage = downloadUrl
			? `Your farm report has been successfully generated. Due to its size, please use the button below to download it. The link will expire in 30 minutes.`
			: `Your farm report has been successfully generated and is attached to this email. The report includes detailed information about your farm operations${dateRange !== 'all' ? ' for the selected date range' : ''}.`;

		// Build download button HTML if needed
		const downloadButtonHtml = downloadUrl
			? `
							<!-- Download Button -->
							<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 24px 0;">
								<tr>
									<td align="center">
										<a href="${downloadUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
											Download Report
										</a>
									</td>
								</tr>
							</table>
							<p style="margin: 0; color: #888888; font-size: 12px; text-align: center;">
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
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
	<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
		<tr>
			<td align="center" style="padding: 40px 20px;">
				<table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
					<!-- Header with brand color -->
					<tr>
						<td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%); border-radius: 8px 8px 0 0; text-align: center;">
							${logoHtml}
							<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
								${farmName}
							</h1>
							<p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
								Farm Report Generated
							</p>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 40px;">
							<h2 style="margin: 0 0 20px; color: #2E7D32; font-size: 20px; font-weight: 600;">
								Your Farm Report is Ready
							</h2>
							<p style="margin: 0 0 16px; color: #333333; font-size: 15px; line-height: 1.6;">
								Hello,
							</p>
							<p style="margin: 0 0 16px; color: #333333; font-size: 15px; line-height: 1.6;">
								${deliveryMessage}
							</p>
${downloadButtonHtml}
							<!-- Info Box -->
							<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 24px 0; background-color: #f1f8f4; border-radius: 6px; border-left: 4px solid #4CAF50;">
								<tr>
									<td style="padding: 16px 20px;">
										<p style="margin: 0 0 8px; color: #2E7D32; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
											Report Details
										</p>
										<p style="margin: 0; color: #555555; font-size: 14px; line-height: 1.5;">
											<strong>Type:</strong> ${reportTypeLabels[reportType] || reportType}<br>
											<strong>Period:</strong> ${dateRangeLabels[dateRange] || dateRange}<br>
											<strong>Generated:</strong> ${now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
										</p>
									</td>
								</tr>
							</table>

							<p style="margin: 24px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
								If you have any questions about this report, please don't hesitate to reach out.
							</p>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="padding: 30px 40px; background-color: #fafafa; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
							<p style="margin: 0; color: #888888; font-size: 12px; line-height: 1.5; text-align: center;">
								This is an automated message from your farm management system.<br>
								© ${now.getFullYear()} ${farmName}. All rights reserved.
							</p>
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
