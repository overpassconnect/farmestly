// MongoDB Storage Implementation
module.exports = class MongoDBStore {
	constructor(db) {
		this._db = db;
		this._collection = db.collection('email_queue');
	}

	ensureIndexes() {
		return Promise.all([
			this._collection.createIndex({ id: 1 }, { unique: true }),
			this._collection.createIndex({ status: 1, scheduledFor: 1 }),
			this._collection.createIndex({ createdAt: 1 }),
			this._collection.createIndex({ sentAt: 1 })
		]).catch(err => {
			console.error('Index creation error:', err);
			// Non-fatal, continue
		});
	}

	add(email) {
		// DEBUG
		console.log('=== MONGODB STORE ADD ===');
		if (email.attachments && email.attachments[0]) {
			console.log('Storing content type:', typeof email.attachments[0].content);
			console.log('Storing content preview:', email.attachments[0].content?.substring?.(0, 30));
		}

		return this._collection.insertOne(email)
			.then(result => {
				console.log('Inserted with _id:', result.insertedId);

				// DEBUG: Read it back immediately
				return this._collection.findOne({ _id: result.insertedId });
			})
			.then(stored => {
				console.log('=== AFTER MONGODB READ BACK ===');
				if (stored.attachments && stored.attachments[0]) {
					console.log('Retrieved content type:', typeof stored.attachments[0].content);
					console.log('Retrieved content constructor:', stored.attachments[0].content?.constructor?.name);
					console.log('Retrieved content preview:',
						typeof stored.attachments[0].content === 'string'
							? stored.attachments[0].content.substring(0, 30)
							: JSON.stringify(stored.attachments[0].content).substring(0, 50));
				}
			})
			.catch(error => {
				if (error.code === 11000) {
					throw new Error('Duplicate email ID');
				}
				throw error;
			});
	}

	getPending(limit) {
		const now = new Date().toISOString();

		return this._collection.find({
			status: { $in: ['pending', 'failed'] },
			scheduledFor: { $lte: now },
			attempts: { $lt: 5 }
		})
			.sort({ priority: -1, createdAt: 1 })
			.limit(limit)
			.toArray()
			.catch(error => {
				console.error('Error fetching pending emails:', error);
				return [];
			});
	}

	markAsSending(emailId) {
		return this._collection.updateOne(
			{ id: emailId },
			{
				$set: {
					status: 'sending',
					lastAttemptAt: new Date().toISOString()
				},
				$inc: { attempts: 1 }
			}
		);
	}

	markAsSent(emailId, messageId) {
		return this._collection.updateOne(
			{ id: emailId },
			{
				$set: {
					status: 'sent',
					sentAt: new Date().toISOString(),
					messageId: messageId,
					error: null
				}
			}
		);
	}

	markAsFailed(emailId, error, retryDelayMs) {
		const scheduledFor = new Date(Date.now() + retryDelayMs).toISOString();

		return this._collection.updateOne(
			{ id: emailId },
			{
				$set: {
					status: 'failed',
					error: error,
					scheduledFor: scheduledFor
				}
			}
		);
	}

	markAsPermanentlyFailed(emailId, error) {
		return this._collection.updateOne(
			{ id: emailId },
			{
				$set: {
					status: 'permanently_failed',
					error: error,
					failedAt: new Date().toISOString()
				}
			}
		);
	}

	cleanup(retentionDays) {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - retentionDays);

		return this._collection.deleteMany({
			status: 'sent',
			sentAt: { $lt: cutoff.toISOString() }
		})
			.then(result => result.deletedCount);
	}

	retryFailed() {
		return this._collection.updateMany(
			{
				status: 'failed',
				attempts: { $lt: 5 },
				scheduledFor: { $lte: new Date().toISOString() }
			},
			{
				$set: { status: 'pending' }
			}
		)
			.then(result => result.modifiedCount);
	}

	retryEmail(emailId) {
		return this._collection.updateOne(
			{ id: emailId },
			{
				$set: {
					status: 'pending',
					scheduledFor: new Date().toISOString(),
					attempts: 0
				}
			}
		);
	}

	getStats() {
		return this._collection.aggregate([
			{
				$group: {
					_id: '$status',
					count: { $sum: 1 },
					oldest: { $min: '$createdAt' },
					newest: { $max: '$createdAt' }
				}
			}
		]).toArray()
			.then(results => {
				const stats = {
					total: 0,
					byStatus: {}
				};

				results.forEach(item => {
					stats.byStatus[item._id] = {
						count: item.count,
						oldest: item.oldest,
						newest: item.newest
					};
					stats.total += item.count;
				});

				return stats;
			});
	}
}