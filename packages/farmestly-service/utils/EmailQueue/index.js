const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const Imap = require('imap');

const MongoDBStore = require('./MongoDBStore');
const RedisStore = require('./RedisStore');



/**
 * EmailQueue: v.1.0 (c) claude + stergios
 * 
 * Features:
 * - Supports both MongoDB and Redis as storage backends
 * - Automatic retry with exponential backoff for failed emails
 * - Priority-based queue processing (higher priority emails sent first)
 * - Scheduled sending (delay emails until specific time)
 * - Configurable retention period for sent emails
 * - Graceful shutdown with proper cleanup
 * - Connection pooling for SMTP efficiency
 * - Permanent failure detection (e.g., invalid email addresses)
 * - Automatic cleanup of old sent emails
 * - Real-time processing for high-priority emails
 * 
 * Queue Processing:
 * - Emails are processed every 30 seconds via cron job
 * - High priority emails (priority > 0) trigger immediate processing
 * - Failed emails automatically retry with exponential backoff (1min, 2min, 4min, etc.)
 * - Maximum 5 retry attempts by default (configurable per email)
 * - Permanent failures (invalid addresses) are not retried
 * 
 * Storage Backends:
 * - MongoDB: Full-featured with indexed queries and aggregation stats
 * - Redis: Lightweight with automatic expiration and sorted sets
 * 
 * @example
 * // Initialize with MongoDB
 * const emailQueue = EmailQueue.getInstance();
 * emailQueue.initialize({
 *   storage: { type: 'mongodb', db: mongoDb },
 *   smtp: {
 *     host: 'smtp.example.com',
 *     port: 587,
 *     user: 'user@example.com',
 *     pass: 'password'
 *   }
 * });
 * 
 * // Queue an email
 * emailQueue.queue({
 *   to: 'recipient@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome to our service</h1>',
 *   priority: 1  // High priority, sends immediately
 * });
 * 
 * @class EmailQueue
 * @singleton
 */
class EmailQueue {
	constructor() {
		this._store = null;
		this._isProcessing = false;
		this._tasks = {};
		this._isInitialized = false;
		this._transporter = null;
		this._config = {};
		this._shuttingDown = false;
	}

	/**
	 * Get singleton instance of EmailQueue
	 * @returns {EmailQueue} The EmailQueue instance
	 */
	static getInstance() {
		if (!EmailQueue.instance) {
			EmailQueue.instance = new EmailQueue();
		}
		return EmailQueue.instance;
	}
	/**
	 * Initialize the email queue system
	 * @param {Object} config - Configuration object
	 * @param {Object} config.storage - Storage configuration
	 * @param {string} config.storage.type - Storage type: 'mongodb' or 'redis'
	 * @param {Object} [config.storage.db] - MongoDB database instance (required for mongodb)
	 * @param {string} [config.storage.host] - Redis host (for redis)
	 * @param {number} [config.storage.port] - Redis port (for redis)
	 * @param {string} [config.storage.password] - Redis password (for redis)
	 * @param {Object} config.smtp - SMTP configuration
	 * @param {string} config.smtp.host - SMTP host
	 * @param {number} config.smtp.port - SMTP port
	 * @param {string} config.smtp.user - SMTP username
	 * @param {string} config.smtp.pass - SMTP password
	 * @param {boolean} [config.smtp.secure] - Use TLS
	 * @param {boolean} [config.smtp.requireTLS] - Require TLS for STARTTLS
	 * @param {string} [config.smtp.from] - Default from address
	 * @param {number} [config.retentionDays=30] - Days to retain sent emails
	 * @returns {Promise<void>}
	 * @throws {Error} If configuration is invalid or initialization fails
	 */
	initialize(config) {
		if (this._isInitialized) {
			return Promise.resolve();
		}

		// Validate configuration
		if (!config || !config.storage || !config.smtp) {
			return Promise.reject(new Error('Storage and SMTP configuration required'));
		}

		if (!['mongodb', 'redis'].includes(config.storage.type)) {
			return Promise.reject(new Error('Storage type must be "mongodb" or "redis"'));
		}

		const requiredSmtpFields = ['host', 'port', 'user', 'pass'];
		for (const field of requiredSmtpFields) {
			if (!config.smtp[field]) {
				return Promise.reject(new Error(`SMTP ${field} is required`));
			}
		}

		this._config = config;

		// Initialize storage
		let storagePromise;
		if (config.storage.type === 'mongodb') {
			if (!config.storage.db) {
				return Promise.reject(new Error('MongoDB database instance required'));
			}
			this._store = new MongoDBStore(config.storage.db);
			storagePromise = this._store.ensureIndexes();
		} else {
			this._store = new RedisStore(config.storage);
			storagePromise = this._store.connect();
		}

		return storagePromise
			.then(() => {
				// Initialize SMTP
				const transportConfig = {
					host: config.smtp.host,
					port: config.smtp.port,
					secure: config.smtp.secure === true,
					requireTLS: config.smtp.requireTLS === true,
					auth: {
						user: config.smtp.user,
						pass: config.smtp.pass
					},
					pool: true,
					maxConnections: config.smtp.maxConnections || 5
				};

				this._transporter = nodemailer.createTransport(transportConfig);
				return this._transporter.verify();
			})
			.then(() => {
				// Setup cron jobs
				this._setupCronJobs();
				this._isInitialized = true;

				// Process pending emails
				this.processQueue();
			})
			.catch(error => {
				this._cleanup();
				throw error;
			});
	}

	/**
	 * Queue an email for sending
	 * @param {Object} emailData - Email data
	 * @param {string} emailData.to - Recipient email address
	 * @param {string} emailData.subject - Email subject
	 * @param {string} emailData.html - HTML content
	 * @param {string} [emailData.text] - Plain text content (auto-generated from HTML if not provided)
	 * @param {string} [emailData.from] - Sender address (uses config default if not provided)
	 * @param {number} [emailData.priority=0] - Priority (higher = sent first, >0 triggers immediate send)
	 * @param {string} [emailData.scheduledFor] - ISO date string for delayed sending
	 * @param {number} [emailData.maxAttempts=5] - Maximum retry attempts
	 * @param {Object} [emailData.metadata={}] - Additional metadata to store with email
	 * @returns {Promise<{success: boolean, emailId: string}>} Result with generated email ID
	 * @throws {Error} If required fields missing or queue not initialized
	 */
	queue(emailData) {
		if (!this._isInitialized) {
			return Promise.reject(new Error('EmailQueue not initialized'));
		}

		if (this._shuttingDown) {
			return Promise.reject(new Error('EmailQueue is shutting down'));
		}

		if (!emailData.to || !emailData.subject || !emailData.html) {
			return Promise.reject(new Error('Required fields: to, subject, html'));
		}

		// Process attachments
		const attachments = (emailData.attachments || []).map(att => {
			let content = att.content;

			// If it's a Buffer, convert to base64 string
			if (Buffer.isBuffer(content)) {
				content = content.toString('base64');
			}
			// If it's a Uint8Array (but not Buffer), convert to base64
			else if (content instanceof Uint8Array) {
				content = Buffer.from(content).toString('base64');
			}
			// If it's already a string, keep it
			else if (typeof content !== 'string') {
				content = String(content);
			}

			return {
				filename: att.filename,
				content,
				contentType: att.contentType || 'application/pdf'
			};
		});

		const email = {
			id: uuidv4(),
			to: emailData.to,
			from: emailData.from || this._config.smtp.from || this._config.smtp.user,
			subject: emailData.subject,
			html: emailData.html,
			text: emailData.text || this._stripHtml(emailData.html),
			attachments,
			status: 'pending',
			attempts: 0,
			maxAttempts: emailData.maxAttempts || 5,
			createdAt: new Date().toISOString(),
			scheduledFor: emailData.scheduledFor || new Date().toISOString(),
			priority: emailData.priority || 0,
			metadata: emailData.metadata || {}
		};

		return this._store.add(email)
			.then(() => {
				if (email.priority > 0 && !this._isProcessing) {
					setImmediate(() => this.processQueue());
				}

				return { success: true, emailId: email.id };
			});
	}

	_processEmail(email) {
		if (this._shuttingDown) {
			return Promise.resolve();
		}

		return this._store.markAsSending(email.id)
			.then(() => {
				const attachments = (email.attachments || []).map(att => {
					let content;
					if (typeof att.content === 'string') {
						content = Buffer.from(att.content, 'base64');
					} else {
						content = att.content;
					}

					return {
						filename: att.filename,
						content,
						contentType: att.contentType
					};
				});

				const mailOptions = {
					from: email.from,
					to: email.to,
					subject: email.subject,
					html: email.html,
					text: email.text,
					attachments
				};

				return this._transporter.sendMail(mailOptions);
			})
			.then(result => {
				return this._store.markAsSent(email.id, result.messageId);
			})
			.catch(error => {
				const isRetryable = this._isRetryableError(error);
				const attempts = (email.attempts || 0) + 1;

				if (!isRetryable || attempts >= email.maxAttempts) {
					return this._store.markAsPermanentlyFailed(email.id, error.message);
				}

				const retryDelay = Math.min(60000 * Math.pow(2, attempts - 1), 3600000);
				return this._store.markAsFailed(email.id, error.message, retryDelay);
			});
	}

	/**
	 * Manually trigger queue processing
	 * @returns {Promise<void>}
	 */
	processQueue() {
		if (!this._isInitialized || this._isProcessing || this._shuttingDown) {
			return Promise.resolve();
		}

		this._isProcessing = true;

		return this._store.getPending(10)
			.then(emails => {
				if (!emails || emails.length === 0) {
					this._isProcessing = false;
					return;
				}

				// Process emails sequentially
				return emails.reduce((promise, email) => {
					return promise.then(() => this._processEmail(email));
				}, Promise.resolve());
			})
			.finally(() => {
				this._isProcessing = false;
			});
	}

	clearInbox() {
		if (!this._isInitialized) {
			return Promise.reject(new Error('EmailQueue not initialized'));
		}

		const Imap = require('imap');

		const imap = new Imap({
			user: this._config.smtp.user,
			password: this._config.smtp.pass,
			host: this._config.smtp.host,
			port: 993,
			tls: true,
			tlsOptions: { rejectUnauthorized: false }
		});

		return new Promise((resolve, reject) => {
			let deletedCount = 0;

			imap.once('ready', () => {
				imap.openBox('INBOX', false, (err, box) => {
					if (err) {
						imap.end();
						return reject(err);
					}

					if (box.messages.total === 0) {
						imap.end();
						return resolve(0);
					}

					// Get ALL messages
					imap.search(['ALL'], (err, results) => {
						if (err) {
							imap.end();
							return reject(err);
						}

						if (!results || results.length === 0) {
							imap.end();
							return resolve(0);
						}

						deletedCount = results.length;

						imap.addFlags(results, '\\Deleted', (err) => {
							if (err) {
								imap.end();
								return reject(err);
							}

							imap.expunge((err) => {
								if (err) {
									imap.end();
									return reject(err);
								}

								imap.end();
							});
						});
					});
				});
			});

			imap.once('error', (err) => {
				reject(err);
			});

			imap.once('end', () => {
				resolve(deletedCount);
			});

			imap.connect();
		});
	}

	// _processEmail(email) {
	// 	if (this._shuttingDown) {
	// 		return Promise.resolve();
	// 	}

	// 	const startTime = Date.now();

	// 	return this._store.markAsSending(email.id)
	// 		.then(() => {
	// 			const mailOptions = {
	// 				from: email.from,
	// 				to: email.to,
	// 				subject: email.subject,
	// 				html: email.html,
	// 				text: email.text,
	// 				attachments: email.attachments || []
	// 			};

	// 			return this._transporter.sendMail(mailOptions);
	// 		})
	// 		.then(result => {
	// 			const duration = Date.now() - startTime;
	// 			console.log(`Email sent: ${email.id} to ${email.to} (${duration}ms)`);
	// 			return this._store.markAsSent(email.id, result.messageId);
	// 		})
	// 		.catch(error => {
	// 			console.error(`Email failed: ${email.id} - ${error.message}`);

	// 			const isRetryable = this._isRetryableError(error);
	// 			const attempts = (email.attempts || 0) + 1;

	// 			if (!isRetryable || attempts >= email.maxAttempts) {
	// 				return this._store.markAsPermanentlyFailed(email.id, error.message);
	// 			}

	// 			const retryDelay = Math.min(60000 * Math.pow(2, attempts - 1), 3600000);
	// 			return this._store.markAsFailed(email.id, error.message, retryDelay);
	// 		});
	// }

	_isRetryableError(error) {
		const permanentErrors = [
			'Invalid recipient',
			'Invalid email address',
			'Recipient address rejected',
			'User unknown'
		];

		const errorMessage = error.message || '';
		return !permanentErrors.some(msg => errorMessage.includes(msg));
	}

	_stripHtml(html) {
		return html.replace(/<[^>]*>/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	_setupCronJobs() {
		// Process queue every 30 seconds
		this._tasks.queue = cron.schedule('*/30 * * * * *', () => {
			if (!this._shuttingDown) {
				this.processQueue();
			}
		});

		// Cleanup old emails daily at 3 AM
		this._tasks.cleanup = cron.schedule('0 3 * * *', () => {
			if (!this._shuttingDown) {
				const retentionDays = this._config.retentionDays || 30;
				this._store.cleanup(retentionDays);
			}
		});

		// Retry failed emails every 5 minutes
		this._tasks.retry = cron.schedule('*/5 * * * *', () => {
			if (!this._shuttingDown) {
				this._store.retryFailed()
					.then(count => {
						if (count > 0) {
							this.processQueue();
						}
					});
			}
		});

		this._tasks.inboxCleanup = cron.schedule('0 * * * *', () => {
			if (!this._shuttingDown) {
				this.clearInbox(7);
			}
		});
	}
	/**
	 * Gracefully shutdown the queue
	 * Stops all cron jobs and closes connections
	 */
	shutdown() {
		this._shuttingDown = true;

		// Stop cron jobs
		Object.values(this._tasks).forEach(task => task.stop());

		// Close connections
		if (this._transporter) {
			this._transporter.close();
		}

		if (this._store && this._store.close) {
			this._store.close();
		}

		this._isInitialized = false;
	}

	_cleanup() {
		try {
			Object.values(this._tasks).forEach(task => task.stop());
			if (this._transporter) this._transporter.close();
			if (this._store && this._store.close) this._store.close();
		} catch (error) {
			// Silent cleanup
		}
	}
	/**
	 * Get queue statistics
	 * @returns {Promise<Object>} Statistics object with total count and breakdown by status
	 */
	getStats() {
		if (!this._isInitialized) {
			return Promise.resolve({ initialized: false });
		}
		return this._store.getStats();
	}
	/**
	 * Retry a specific email
	 * @param {string} emailId - The email ID to retry
	 * @returns {Promise<{success: boolean}>}
	 * @throws {Error} If email not found or queue not initialized
	 */
	retryEmail(emailId) {
		if (!this._isInitialized) {
			return Promise.reject(new Error('EmailQueue not initialized'));
		}

		return this._store.retryEmail(emailId)
			.then(() => {
				this.processQueue();
				return { success: true };
			});
	}
}

module.exports = EmailQueue;