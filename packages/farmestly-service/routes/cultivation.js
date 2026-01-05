const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../utils/db');
const router = express.Router();
const { ok, fail } = require('../utils/response');



// Create a cultivation
router.post('/create', (req, res) => {
	// Find account from session
	return getDb().collection('Accounts').findOne({
		_id: new ObjectId(req.session.accountId)
	})
		.then(account => {
			if (!account) {
				return res.status(401).send(fail('SIGNED_OUT'));
			}

			// Check for idempotency key to prevent duplicate submissions
			const idempotencyKey = req.header('Idempotency-Key');

			if (idempotencyKey) {
				// Look for existing cultivation with this idempotency key
				return getDb().collection('cultivations')
					.findOne({
						accountId: account._id,
						idempotencyKey: idempotencyKey
					})
					.then(existingCultivation => {
						if (existingCultivation) {
							console.log(`Found existing cultivation with idempotency key ${idempotencyKey}`);
							// Return the existing cultivation with 200 status for successful sync
							return res.json(ok({
								cultivationId: existingCultivation._id,
								existing: true
							}));
						}

						// Continue with cultivation creation if no duplicate found
						return createCultivation();
					});
			} else {
				// No idempotency key provided, proceed normally
				return createCultivation();
			}

			// Function to create the cultivation
			function createCultivation() {
				// Create cultivation document
				const cultivationData = {
					accountId: account._id,
					fieldId: req.body.fieldId,
					crop: req.body.crop,
					variety: req.body.variety || '',
					startJobId: req.body.startJobId ? new ObjectId(req.body.startJobId) : null,
					startTime: new Date(),
					endJobId: null,
					endTime: null,
					status: 'active',
					// Save idempotency key if provided
					idempotencyKey: idempotencyKey || null
				};

				// Check if field already has an active cultivation
				return getDb().collection('Accounts').findOne(
					{
						_id: account._id,
						'content.farmData.fields.id': req.body.fieldId,
						'content.farmData.fields.currentCultivation': { $ne: null }
					}
				)
					.then(existingCultivation => {
						if (existingCultivation) {
							return res.status(400).send(fail('FIELD_HAS_ACTIVE_CULTIVATION'));
						}

						// Insert cultivation document
						return getDb().collection('cultivations').insertOne(cultivationData)
							.then(result => {
								// Update field with current cultivation
								return getDb().collection('Accounts').updateOne(
									{ _id: account._id, 'content.farmData.fields.id': req.body.fieldId },
									{
										$set: {
											'content.farmData.fields.$.currentCultivation': {
												id: result.insertedId.toString(),
												crop: req.body.crop,
												variety: req.body.variety || '',
												startTime: new Date()
											}
										}
									}
								)
									.then(() => {
										res.send(ok({
											cultivationId: result.insertedId
										}));
									});
							});
					});
			}
		})
		.catch(err => {
			console.error('Error creating cultivation:', err);
			res.status(500).send(fail('INTERNAL_ERROR'));
		});
});

// End a cultivation
router.post('/end', (req, res) => {
	// Find account from session
	return getDb().collection('Accounts').findOne({
		_id: new ObjectId(req.session.accountId)
	})
		.then(account => {
			if (!account) {
				return res.status(401).send(fail('SIGNED_OUT'));
			}

			// Update cultivation as completed
			return getDb().collection('cultivations').updateOne(
				{ _id: new ObjectId(req.body.cultivationId), accountId: account._id },
				{
					$set: {
						endJobId: req.body.endJobId ? new ObjectId(req.body.endJobId) : null,
						endTime: new Date(),
						status: 'completed'
					}
				}
			)
				.then(result => {
					if (result.matchedCount === 0) {
						return res.status(404).send(fail('CULTIVATION_NOT_FOUND'));
					}

					// Clear current cultivation from field
					return getDb().collection('Accounts').updateOne(
						{ _id: account._id, 'content.farmData.fields.id': req.body.fieldId },
						{ $set: { 'content.farmData.fields.$.currentCultivation': null } }
					)
						.then(() => {
							res.json(ok());
						});
				});
		})
		.catch(err => {
			console.error('Error ending cultivation:', err);
			res.status(500).send(fail('INTERNAL_ERROR'));
		});
});

// Update BBCH growth stage for a cultivation
router.post('/bbch', async (req, res) => {
	try {
		const { cultivationId, stage } = req.body;

		if (typeof stage !== 'number' || stage < 0 || stage > 99) {
			return res.status(400).send(fail('INVALID_STAGE'));
		}

		if (!cultivationId || !ObjectId.isValid(cultivationId)) {
			return res.status(400).send(fail('INVALID_CULTIVATION_ID'));
		}

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		const now = new Date();

		// Aggregation pipeline update:
		// - Sets current stage
		// - Appends to history
		// - Silently caps history at 500 entries (replaces last if at limit)
		const result = await getDb().collection('cultivations').findOneAndUpdate(
			{
				_id: new ObjectId(cultivationId),
				accountId: account._id,
				status: 'active'
			},
			[
				{
					$set: {
						bbchStage: stage,
						bbchHistory: {
							$cond: {
								if: { $gte: [{ $size: { $ifNull: ['$bbchHistory', []] } }, 500] },
								then: {
									$concatArrays: [
										{ $slice: ['$bbchHistory', 499] },
										[{ stage: stage, timestamp: now }]
									]
								},
								else: {
									$concatArrays: [
										{ $ifNull: ['$bbchHistory', []] },
										[{ stage: stage, timestamp: now }]
									]
								}
							}
						}
					}
				}
			],
			{ returnDocument: 'after' }
		);

		if (!result) {
			return res.status(404).send(fail('CULTIVATION_NOT_FOUND'));
		}

		res.json(ok({
			bbchStage: result.bbchStage,
			bbchHistory: result.bbchHistory
		}));
	} catch (err) {
		console.error('Error updating BBCH:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// Get cultivation history for a field
router.get('/field/:fieldId', (req, res) => {
	// Find account from session
	return getDb().collection('Accounts').findOne({
		_id: new ObjectId(req.session.accountId)
	})
		.then(account => {
			if (!account) {
				return res.status(401).send(fail('SIGNED_OUT'));
			}

			// Convert fieldId from string to number to match stored data
			const fieldIdNumber = parseInt(req.params.fieldId);

			// Find cultivations for this field
			return getDb().collection('cultivations').find({
				accountId: account._id,
				fieldId: fieldIdNumber  // Use number instead of string
			}).sort({ startTime: -1 }).toArray()
				.then(cultivations => {
					res.json(ok(cultivations));
				});
		})
		.catch(err => {
			console.error('Error fetching field cultivations:', err);
			res.status(500).send(fail('INTERNAL_ERROR'));
		});
});

module.exports = router;