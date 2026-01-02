const redis = require('redis')

module.exports = class RedisStore {
	constructor(config) {
		this._config = config;
		this._client = null;
		this._keyPrefix = config.keyPrefix || 'emailqueue:';
	}

	connect() {
		return new Promise((resolve, reject) => {

			this._client = redis.createClient({
				host: this._config.host || 'localhost',
				port: this._config.port || 6379,
				password: this._config.password,
				db: this._config.db || 0,
				retry_strategy: (options) => {
					if (options.error && options.error.code === 'ECONNREFUSED') {
						return new Error('Redis connection refused');
					}
					if (options.total_retry_time > 1000 * 60 * 60) {
						return new Error('Redis retry time exhausted');
					}
					if (options.attempt > 10) {
						return undefined;
					}
					return Math.min(options.attempt * 100, 3000);
				}
			});

			this._client.on('error', (err) => {
				console.error('Redis error:', err);
			});

			this._client.on('ready', () => {
				console.log('Redis connected');
				resolve();
			});

			this._client.on('connect', () => {
				// Connection established
			});
		});
	}

	add(email) {
		return new Promise((resolve, reject) => {
			const key = `${this._keyPrefix}email:${email.id}`;
			const score = email.priority * -1000000 + Date.now();

			this._client.multi()
				.set(key, JSON.stringify(email))
				.zadd(`${this._keyPrefix}pending`, score, email.id)
				.expire(key, 7 * 24 * 60 * 60) // 7 days TTL
				.exec((err, results) => {
					if (err) reject(err);
					else resolve();
				});
		});
	}

	getPending(limit) {
		return new Promise((resolve, reject) => {
			this._client.zrange(`${this._keyPrefix}pending`, 0, limit - 1, (err, emailIds) => {
				if (err) return reject(err);
				if (!emailIds || emailIds.length === 0) return resolve([]);

				const multi = this._client.multi();
				emailIds.forEach(id => {
					multi.get(`${this._keyPrefix}email:${id}`);
				});

				multi.exec((err, results) => {
					if (err) return reject(err);

					const emails = [];
					const now = Date.now();

					results.forEach((result, index) => {
						if (result && result[1]) {
							try {
								const email = JSON.parse(result[1]);
								const scheduledTime = new Date(email.scheduledFor).getTime();

								if (scheduledTime <= now && email.attempts < email.maxAttempts) {
									emails.push(email);
								}
							} catch (e) {
								console.error('Invalid email data:', e);
								// Remove invalid entry
								this._client.zrem(`${this._keyPrefix}pending`, emailIds[index]);
							}
						}
					});

					resolve(emails);
				});
			});
		});
	}

	markAsSending(emailId) {
		return new Promise((resolve, reject) => {
			const key = `${this._keyPrefix}email:${emailId}`;

			this._client.get(key, (err, data) => {
				if (err) return reject(err);
				if (!data) return reject(new Error('Email not found'));

				try {
					const email = JSON.parse(data);
					email.status = 'sending';
					email.lastAttemptAt = new Date().toISOString();
					email.attempts = (email.attempts || 0) + 1;

					this._client.multi()
						.set(key, JSON.stringify(email))
						.zrem(`${this._keyPrefix}pending`, emailId)
						.exec((err) => {
							if (err) reject(err);
							else resolve();
						});
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	markAsSent(emailId, messageId) {
		return new Promise((resolve, reject) => {
			const key = `${this._keyPrefix}email:${emailId}`;

			this._client.get(key, (err, data) => {
				if (err) return reject(err);
				if (!data) return resolve(); // Already processed

				try {
					const email = JSON.parse(data);
					email.status = 'sent';
					email.sentAt = new Date().toISOString();
					email.messageId = messageId;
					delete email.error;

					this._client.multi()
						.set(key, JSON.stringify(email))
						.expire(key, 30 * 24 * 60 * 60) // 30 days
						.exec((err) => {
							if (err) reject(err);
							else resolve();
						});
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	markAsFailed(emailId, error, retryDelayMs) {
		return new Promise((resolve, reject) => {
			const key = `${this._keyPrefix}email:${emailId}`;

			this._client.get(key, (err, data) => {
				if (err) return reject(err);
				if (!data) return resolve();

				try {
					const email = JSON.parse(data);
					email.status = 'failed';
					email.error = error;
					email.scheduledFor = new Date(Date.now() + retryDelayMs).toISOString();

					const score = email.priority * -1000000 + Date.now() + retryDelayMs;

					this._client.multi()
						.set(key, JSON.stringify(email))
						.zadd(`${this._keyPrefix}pending`, score, emailId)
						.exec((err) => {
							if (err) reject(err);
							else resolve();
						});
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	markAsPermanentlyFailed(emailId, error) {
		return new Promise((resolve, reject) => {
			const key = `${this._keyPrefix}email:${emailId}`;

			this._client.get(key, (err, data) => {
				if (err) return reject(err);
				if (!data) return resolve();

				try {
					const email = JSON.parse(data);
					email.status = 'permanently_failed';
					email.error = error;
					email.failedAt = new Date().toISOString();

					this._client.set(key, JSON.stringify(email), (err) => {
						if (err) reject(err);
						else resolve();
					});
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	cleanup(retentionDays) {
		// Redis handles via TTL
		return Promise.resolve(0);
	}

	retryFailed() {
		// In Redis, failed emails are already in pending queue
		return Promise.resolve(0);
	}

	retryEmail(emailId) {
		return new Promise((resolve, reject) => {
			const key = `${this._keyPrefix}email:${emailId}`;

			this._client.get(key, (err, data) => {
				if (err) return reject(err);
				if (!data) return reject(new Error('Email not found'));

				try {
					const email = JSON.parse(data);
					email.status = 'pending';
					email.scheduledFor = new Date().toISOString();
					email.attempts = 0;
					delete email.error;

					const score = email.priority * -1000000 + Date.now();

					this._client.multi()
						.set(key, JSON.stringify(email))
						.zadd(`${this._keyPrefix}pending`, score, emailId)
						.exec((err) => {
							if (err) reject(err);
							else resolve();
						});
				} catch (e) {
					reject(e);
				}
			});
		});
	}

	getStats() {
		return new Promise((resolve, reject) => {
			const stats = {
				total: 0,
				byStatus: {}
			};

			this._client.zcard(`${this._keyPrefix}pending`, (err, pending) => {
				if (err) return reject(err);

				stats.byStatus.pending = { count: pending || 0 };
				stats.total = pending || 0;

				// Get more detailed stats by scanning keys
				this._client.keys(`${this._keyPrefix}email:*`, (err, keys) => {
					if (err) return reject(err);
					if (!keys || keys.length === 0) return resolve(stats);

					let processed = 0;
					const statusCounts = {};

					keys.forEach(key => {
						this._client.get(key, (err, data) => {
							processed++;

							if (!err && data) {
								try {
									const email = JSON.parse(data);
									statusCounts[email.status] = (statusCounts[email.status] || 0) + 1;
								} catch (e) {
									// Invalid data
								}
							}

							if (processed === keys.length) {
								Object.keys(statusCounts).forEach(status => {
									stats.byStatus[status] = { count: statusCounts[status] };
									if (status !== 'pending') {
										stats.total += statusCounts[status];
									}
								});
								resolve(stats);
							}
						});
					});
				});
			});
		});
	}

	close() {
		if (this._client) {
			this._client.quit();
		}
	}
}