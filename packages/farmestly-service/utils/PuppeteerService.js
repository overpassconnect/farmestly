const puppeteer = require('puppeteer');
const Queue = require('bull');
const os = require('os');

class PuppeteerService {
	constructor() {
		this._browser = null;
		this._isLaunching = false;
		this._launchPromise = null;
		this._pdfQueue = null;
		this._requestCount = 0;
		this._maxRequestsBeforeRestart = 100;
		this._isInitialized = false;
	}

	static getInstance() {
		if (!PuppeteerService.instance) {
			PuppeteerService.instance = new PuppeteerService();
		}
		return PuppeteerService.instance;
	}

	/**
	 * Initialize the service with Redis configuration and start the queue
	 * @param {Object} redisConfig - Redis configuration object
	 * @param {string} redisConfig.host - Redis host (default: localhost)
	 * @param {number} redisConfig.port - Redis port (default: 6379)
	 * @param {string} redisConfig.password - Redis password (optional)
	 * @param {number} redisConfig.db - Redis database number (default: 0)
	 */
	async initialize(redisConfig = {}) {
		if (this._isInitialized) {
			console.log('PuppeteerService already initialized');
			return;
		}

		const {
			host = 'localhost',
			port = 6379,
			password = '',
			db = 0
		} = redisConfig;

		// Create Bull queue with Redis configuration
		this._pdfQueue = new Queue('pdf-generation', {
			redis: {
				host,
				port,
				password: password || undefined,
				db
			}
		});

		// Calculate concurrency: CPU count - 2 (since PDF generation is CPU-bound)
		const concurrency = Math.max(1, os.cpus().length - 2);
		console.log(`PDF queue concurrency set to ${concurrency} (${os.cpus().length} CPUs available)`);

		// Process jobs from the queue
		this._pdfQueue.process(concurrency, async (job) => {
			const { html, options } = job.data;

			try {
				// Check if we need to restart the browser
				if (this._requestCount >= this._maxRequestsBeforeRestart) {
					console.log(`Restarting browser after ${this._requestCount} requests to prevent memory leaks`);
					await this._restartBrowser();
					this._requestCount = 0;
				}

				// Ensure browser is launched
				if (!this._browser) {
					await this.launch();
				}

				const page = await this._browser.newPage();

				try {
					await page.setContent(html, { waitUntil: 'networkidle0' });

					const pdfBuffer = await page.pdf({
						format: options.format || 'A4',
						margin: options.margin || { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
						printBackground: true
					});

					// Increment request count
					this._requestCount++;

					// Ensure proper base64 conversion
					let base64;
					if (Buffer.isBuffer(pdfBuffer)) {
						base64 = pdfBuffer.toString('base64');
					} else if (pdfBuffer instanceof Uint8Array) {
						base64 = Buffer.from(pdfBuffer).toString('base64');
					} else {
						throw new Error('Unexpected PDF output type: ' + typeof pdfBuffer);
					}

					return base64;
				} finally {
					await page.close();
				}
			} catch (error) {
				console.error('PDF generation error:', error);
				throw error;
			}
		});

		// Queue event listeners
		this._pdfQueue.on('error', (error) => {
			console.error('PDF queue error:', error);
		});

		this._pdfQueue.on('failed', (job, error) => {
			console.error(`Job ${job.id} failed:`, error.message);
		});

		this._pdfQueue.on('completed', (job) => {
			console.log(`Job ${job.id} completed successfully`);
		});

		// Launch the browser initially
		await this.launch();

		this._isInitialized = true;
		console.log('PuppeteerService initialized successfully');
	}

	launch() {
		if (this._browser) return Promise.resolve(this._browser);
		if (this._isLaunching) return this._launchPromise;

		this._isLaunching = true;
		this._launchPromise = puppeteer.launch({
			headless: 'new',
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu'
			]
		})
			.then(browser => {
				this._browser = browser;
				this._isLaunching = false;
				console.log('Puppeteer browser launched and warm');

				browser.on('disconnected', () => {
					console.log('Puppeteer browser disconnected');
					this._browser = null;
				});

				return browser;
			})
			.catch(err => {
				this._isLaunching = false;
				this._launchPromise = null;
				throw err;
			});

		return this._launchPromise;
	}

	async _restartBrowser() {
		if (this._browser) {
			try {
				await this._browser.close();
			} catch (error) {
				console.error('Error closing browser:', error);
			}
			this._browser = null;
		}
		await this.launch();
	}

	/**
	 * Generate PDF from HTML and return as base64 string
	 * This method adds the job to a Bull queue for processing
	 * @param {string} html - HTML content to convert to PDF
	 * @param {Object} options - PDF generation options
	 * @param {string} options.format - Page format (default: A4)
	 * @param {Object} options.margin - Page margins
	 * @returns {Promise<string>} Base64 encoded PDF
	 */
	async generatePdfBase64(html, options = {}) {
		if (!this._isInitialized) {
			throw new Error('PuppeteerService not initialized. Call initialize(redisConfig) first.');
		}

		// Add job to queue with retry configuration
		const job = await this._pdfQueue.add(
			{ html, options },
			{
				attempts: 3, // 3 retry attempts
				backoff: {
					type: 'exponential',
					delay: 2000 // Start with 2 seconds, then 4, then 8
				},
				timeout: 60000 // 60 second timeout
			}
		);

		// Wait for job to complete and return result
		const result = await job.finished();
		return result;
	}

	async shutdown() {
		// Close the queue
		if (this._pdfQueue) {
			await this._pdfQueue.close();
			console.log('PDF queue closed');
		}

		// Close the browser
		if (this._browser) {
			await this._browser.close();
			this._browser = null;
			console.log('Puppeteer browser closed');
		}

		this._isInitialized = false;
	}

	/**
	 * Get queue statistics
	 * @returns {Promise<Object>} Queue statistics
	 */
	async getQueueStats() {
		if (!this._pdfQueue) {
			return null;
		}

		const [waiting, active, completed, failed] = await Promise.all([
			this._pdfQueue.getWaitingCount(),
			this._pdfQueue.getActiveCount(),
			this._pdfQueue.getCompletedCount(),
			this._pdfQueue.getFailedCount()
		]);

		return {
			waiting,
			active,
			completed,
			failed,
			requestCount: this._requestCount,
			maxRequestsBeforeRestart: this._maxRequestsBeforeRestart
		};
	}
}

module.exports = PuppeteerService;
