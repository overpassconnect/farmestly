const express = require('express');
const { ObjectId } = require('mongodb');
const { body, param, query } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');

// Valid job types
const VALID_JOB_TYPES = ['sow', 'harvest', 'spray', 'irrigate', 'custom'];

// Helper function to resolve temp_* cultivation IDs to real ObjectIds
const resolveCultivationId = async (accountId, cultivationRef) => {
	if (!cultivationRef || !cultivationRef.id) {
		return null;
	}

	const cultId = cultivationRef.id;

	// If it's already a valid ObjectId, use it directly
	if (ObjectId.isValid(cultId) && !cultId.startsWith('temp_')) {
		return cultId;
	}

	// If it's a temp_* ID, look up by either _id or tempId
	if (cultId.startsWith('temp_')) {
		const cultivation = await getDb().collection('cultivations').findOne({
			accountId: new ObjectId(accountId),
			$or: [
				{ tempId: cultId },
				...(ObjectId.isValid(cultId) ? [{ _id: new ObjectId(cultId) }] : [])
			]
		});

		if (cultivation) {
			return cultivation._id.toString();
		}

		// If not found, sow job hasn't synced yet - store temp_* as-is
		return cultId;
	}

	return cultId;
};

// Helper function to update equipment powerOnTime (seconds) in separate collections
const updateEquipmentPowerOnTime = async (accountId, job, elapsedTimeMs) => {
	const deltaSeconds = Math.floor(elapsedTimeMs / 1000);  // Convert ms to seconds

	if (deltaSeconds === 0) return;

	const updates = [];

	// Use embedded equipment IDs from the job document to update separate collections
	if (job.machine?.id && ObjectId.isValid(job.machine.id)) {
		updates.push(
			getDb().collection('Machines').updateOne(
				{ _id: new ObjectId(job.machine.id), accountId: new ObjectId(accountId) },
				{ $inc: { powerOnTime: deltaSeconds } }
			)
		);
	}

	if (job.attachment?.id && ObjectId.isValid(job.attachment.id)) {
		updates.push(
			getDb().collection('Attachments').updateOne(
				{ _id: new ObjectId(job.attachment.id), accountId: new ObjectId(accountId) },
				{ $inc: { powerOnTime: deltaSeconds } }
			)
		);
	}

	if (job.tool?.id && ObjectId.isValid(job.tool.id)) {
		updates.push(
			getDb().collection('Tools').updateOne(
				{ _id: new ObjectId(job.tool.id), accountId: new ObjectId(accountId) },
				{ $inc: { powerOnTime: deltaSeconds } }
			)
		);
	}

	if (updates.length > 0) {
		await Promise.all(updates);
	}
};

// Validation rules for POST /job/record
const createJobRules = [
	body('fieldId')
		.exists({ checkNull: true }).withMessage('job.fieldIdRequired')
		.notEmpty().withMessage('job.fieldIdEmpty'),
	body('type')
		.exists({ checkNull: true }).withMessage('job.typeRequired')
		.isIn(VALID_JOB_TYPES).withMessage('job.typeInvalid'),
	body('startedAt')
		.exists({ checkNull: true }).withMessage('job.startedAtRequired')
		.isISO8601().withMessage('job.startedAtInvalid'),
	body('elapsedTime')
		.isInt({ min: 0 }).withMessage('job.elapsedTimeInvalid'),
	body('status')
		.equals('completed').withMessage('job.statusMustBeCompleted')
];

// POST /job/record - Create a new job record
router.post('/record', validate(createJobRules), async (req, res) => {
	try {
		const idempotencyKey = req.header('Idempotency-Key');
		const body = req.body;

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		// Check idempotency
		if (idempotencyKey) {
			const existingJob = await getDb().collection('jobs').findOne({
				accountId: account._id,
				idempotencyKey
			});

			if (existingJob) {
				return res.json(ok({ job: existingJob }));
			}
		}

		// Build job document per API contract
		const jobDoc = {
			_id: new ObjectId(),
			accountId: account._id,
			fieldId: body.fieldId,
			type: body.type,
			template: body.template || null,
			machine: body.machine || null,
			attachment: body.attachment || null,
			tool: body.tool || null,
			batch: body.batch || null,
			cultivation: null, // Will be set based on job type
			startedAt: new Date(body.startedAt),
			endedAt: body.endedAt ? new Date(body.endedAt) : null,
			elapsedTime: body.elapsedTime || 0,
			status: body.status || 'completed',
			timestamps: body.timestamps || [],
			data: {
				sow: null,
				harvest: null,
				spray: null,
				irrigate: null
			},
			notes: body.notes || '',
			idempotencyKey: idempotencyKey || null
		};

		// Set type-specific data
		if (body.data) {
			if (body.type === 'sow' && body.data.sow) {
				jobDoc.data.sow = body.data.sow;
			}
			if (body.type === 'harvest' && body.data.harvest) {
				jobDoc.data.harvest = body.data.harvest;
			}
			if (body.type === 'spray' && body.data.spray) {
				jobDoc.data.spray = body.data.spray;
			}
			if (body.type === 'irrigate' && body.data.irrigate) {
				jobDoc.data.irrigate = body.data.irrigate;
			}
		}

		let response = { job: null };

		// Handle sow job: create cultivation
		if (body.type === 'sow') {
			const cultData = body.cultivation || {};
			const tempId = cultData.id && cultData.id.startsWith('temp_') ? cultData.id : null;

			const cultivation = {
				_id: new ObjectId(),
				accountId: account._id,
				tempId: tempId,
				fieldId: body.fieldId,
				crop: cultData.crop || '',
				variety: cultData.variety || '',
				eppoCode: cultData.eppoCode || body.data?.sow?.eppoCode || null,
				status: 'active',
				startTime: jobDoc.startedAt,
				startJobId: jobDoc._id,
				endTime: null,
				endJobId: null
			};

			await getDb().collection('cultivations').insertOne(cultivation);

			// Update field's currentCultivation in Fields collection
			const fieldUpdate = {
				currentCultivation: {
					id: cultivation._id.toString(),
					crop: cultivation.crop,
					variety: cultivation.variety,
					eppoCode: cultivation.eppoCode,
					startTime: cultivation.startTime
				}
			};

			await getDb().collection('Fields').updateOne(
				{
					_id: new ObjectId(body.fieldId),
					accountId: account._id
				},
				{
					$set: { currentCultivation: fieldUpdate.currentCultivation }
				}
			);

			// Set cultivation reference in job
			jobDoc.cultivation = {
				id: cultivation._id.toString(),
				crop: cultivation.crop,
				variety: cultivation.variety
			};

			response.cultivation = {
				_id: cultivation._id,
				tempId: cultivation.tempId,
				fieldId: cultivation.fieldId,
				crop: cultivation.crop,
				variety: cultivation.variety,
				status: cultivation.status,
				startTime: cultivation.startTime
			};
			response.fieldUpdate = fieldUpdate;

			// Backfill any jobs that were stored with temp_* ID before this sow job synced
			if (tempId) {
				await getDb().collection('jobs').updateMany(
					{
						accountId: account._id,
						'cultivation.id': tempId
					},
					{
						$set: { 'cultivation.id': cultivation._id.toString() }
					}
				);
			}
		}
		// Handle harvest job with isFinal
		else if (body.type === 'harvest' && body.data?.harvest?.isFinal) {
			// Resolve cultivation ID
			const resolvedCultId = await resolveCultivationId(account._id, body.cultivation);

			if (resolvedCultId && ObjectId.isValid(resolvedCultId)) {
				// Complete the cultivation
				const cultUpdateResult = await getDb().collection('cultivations').findOneAndUpdate(
					{ _id: new ObjectId(resolvedCultId), accountId: account._id },
					{
						$set: {
							status: 'completed',
							endTime: jobDoc.endedAt || jobDoc.startedAt,
							endJobId: jobDoc._id
						}
					},
					{ returnDocument: 'after' }
				);

				if (cultUpdateResult) {
					// Clear field's currentCultivation in Fields collection
					await getDb().collection('Fields').updateOne(
						{
							_id: new ObjectId(body.fieldId),
							accountId: account._id
						},
						{
							$set: { currentCultivation: null }
						}
					);

					response.cultivation = cultUpdateResult;
					response.fieldUpdate = { currentCultivation: null };
				}
			}

			// Set cultivation reference
			jobDoc.cultivation = body.cultivation ? {
				id: resolvedCultId || body.cultivation.id,
				crop: body.cultivation.crop,
				variety: body.cultivation.variety
			} : null;
		}
		// Other job types: resolve cultivation ID if temp_*
		else if (body.cultivation) {
			const resolvedCultId = await resolveCultivationId(account._id, body.cultivation);
			jobDoc.cultivation = {
				id: resolvedCultId || body.cultivation.id,
				crop: body.cultivation.crop,
				variety: body.cultivation.variety
			};
		}

		// Insert the job
		await getDb().collection('jobs').insertOne(jobDoc);
		response.job = jobDoc;

		// Update equipment powerOnTimeMs
		if (jobDoc.elapsedTime > 0) {
			await updateEquipmentPowerOnTime(account._id, jobDoc, jobDoc.elapsedTime);
		}

		res.json(ok(response));
	} catch (err) {
		console.error('Error creating job record:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// POST /job/record/update - Update an existing job record
router.post('/record/update', validate([
	body('_id').exists().withMessage('job.idRequired')
]), async (req, res) => {
	try {
		const body = req.body;

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		// Fetch existing job
		const existingJob = await getDb().collection('jobs').findOne({
			_id: new ObjectId(body._id),
			accountId: account._id
		});

		if (!existingJob) {
			return res.status(404).send(fail('RECORD_NOT_FOUND', { code: 'RECORD_NOT_FOUND' }));
		}

		// Build update object from allowed fields
		const updateFields = {};

		if (body.startedAt !== undefined) {
			updateFields.startedAt = new Date(body.startedAt);
		}
		if (body.endedAt !== undefined) {
			updateFields.endedAt = body.endedAt ? new Date(body.endedAt) : null;
		}
		if (body.elapsedTime !== undefined) {
			updateFields.elapsedTime = body.elapsedTime;
		}
		if (body.notes !== undefined) {
			updateFields.notes = body.notes;
		}

		// Handle partial data updates
		if (body.data) {
			if (body.data.harvest) {
				if (body.data.harvest.amount !== undefined) {
					updateFields['data.harvest.amount'] = body.data.harvest.amount;
				}
				if (body.data.harvest.isFinal !== undefined) {
					updateFields['data.harvest.isFinal'] = body.data.harvest.isFinal;
				}
			}
			if (body.data.sow) {
				Object.keys(body.data.sow).forEach(key => {
					updateFields[`data.sow.${key}`] = body.data.sow[key];
				});
			}
			if (body.data.spray) {
				Object.keys(body.data.spray).forEach(key => {
					updateFields[`data.spray.${key}`] = body.data.spray[key];
				});
			}
			if (body.data.irrigate) {
				Object.keys(body.data.irrigate).forEach(key => {
					updateFields[`data.irrigate.${key}`] = body.data.irrigate[key];
				});
			}
		}

		// Detect isFinalHarvest state change for harvest jobs
		const wasFinal = existingJob.data?.harvest?.isFinal === true;
		const willBeFinal = body.data?.harvest?.isFinal !== undefined
			? body.data.harvest.isFinal === true
			: wasFinal;
		const finalStateChanged = existingJob.type === 'harvest' && wasFinal !== willBeFinal;

		// Calculate elapsedTime delta for powerOnTimeMs updates
		const oldElapsedTime = existingJob.elapsedTime || 0;
		const newElapsedTime = body.elapsedTime !== undefined ? body.elapsedTime : oldElapsedTime;
		const elapsedTimeDelta = newElapsedTime - oldElapsedTime;

		// Update the job
		const updatedJob = await getDb().collection('jobs').findOneAndUpdate(
			{ _id: new ObjectId(body._id), accountId: account._id },
			{ $set: updateFields },
			{ returnDocument: 'after' }
		);

		if (!updatedJob) {
			return res.status(404).send(fail('RECORD_NOT_FOUND'));
		}

		let response = { job: updatedJob };

		// Handle cultivation state changes for harvest jobs
		if (finalStateChanged && existingJob.cultivation?.id) {
			const cultId = existingJob.cultivation.id;

			if (ObjectId.isValid(cultId)) {
				if (willBeFinal) {
					// false → true: Complete the cultivation
					const cultivation = await getDb().collection('cultivations').findOneAndUpdate(
						{ _id: new ObjectId(cultId), accountId: account._id },
						{
							$set: {
								status: 'completed',
								endTime: updatedJob.endedAt || new Date(),
								endJobId: updatedJob._id
							}
						},
						{ returnDocument: 'after' }
					);

					// Clear field's currentCultivation in Fields collection
					await getDb().collection('Fields').updateOne(
						{
							_id: new ObjectId(existingJob.fieldId),
							accountId: account._id
						},
						{ $set: { currentCultivation: null } }
					);

					// Return cultivation as 'completed' per contract
					response.cultivation = 'completed';
					response.fieldUpdate = { currentCultivation: null };
				} else {
					// true → false: Reopen the cultivation
					const cultivation = await getDb().collection('cultivations').findOneAndUpdate(
						{ _id: new ObjectId(cultId), accountId: account._id },
						{
							$set: { status: 'active' },
							$unset: { endTime: '', endJobId: '' }
						},
						{ returnDocument: 'after' }
					);

					if (cultivation) {
						// Restore field's currentCultivation
						const fieldUpdate = {
							currentCultivation: {
								id: cultivation._id.toString(),
								crop: cultivation.crop,
								variety: cultivation.variety,
								eppoCode: cultivation.eppoCode,
								startTime: cultivation.startTime
							}
						};

						await getDb().collection('Fields').updateOne(
							{
								_id: new ObjectId(existingJob.fieldId),
								accountId: account._id
							},
							{ $set: { currentCultivation: fieldUpdate.currentCultivation } }
						);

						// Return cultivation as 'reopened' per contract
						response.cultivation = 'reopened';
						response.fieldUpdate = fieldUpdate;
					}
				}
			}
		}

		// Update equipment powerOnTimeMs with delta
		if (elapsedTimeDelta !== 0) {
			await updateEquipmentPowerOnTime(account._id, existingJob, elapsedTimeDelta);
		}

		res.json(ok(response));
	} catch (err) {
		console.error('Error updating job record:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// DELETE /job/record/:_id - Delete a job record
router.delete('/record/:_id', validate([
	param('_id').isMongoId().withMessage('job.invalidId')
]), async (req, res) => {
	try {
		const jobId = req.params._id;

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		const job = await getDb().collection('jobs').findOne({
			_id: new ObjectId(jobId),
			accountId: account._id
		});

		if (!job) {
			return res.status(404).send(fail('RECORD_NOT_FOUND'));
		}

		let response = { deleted: job._id.toString() };

		// Handle sow job deletion
		if (job.type === 'sow' && job.cultivation?.id) {
			const cultId = job.cultivation.id;

			if (ObjectId.isValid(cultId)) {
				// Check for dependent jobs
				const dependentJobs = await getDb().collection('jobs').find({
					accountId: account._id,
					'cultivation.id': cultId,
					_id: { $ne: job._id }
				}).toArray();

				if (dependentJobs.length > 0) {
					return res.status(409).json({
						HEADERS: { STATUS_CODE: 'CULTIVATION_HAS_JOBS' },
						PAYLOAD: {
							code: 'CULTIVATION_HAS_JOBS',
							dependentJobIds: dependentJobs.map(j => j._id.toString())
						}
					});
				}

				// Delete the cultivation
				await getDb().collection('cultivations').deleteOne({
					_id: new ObjectId(cultId),
					accountId: account._id
				});

				// Clear field's currentCultivation in Fields collection
				await getDb().collection('Fields').updateOne(
					{
						_id: new ObjectId(job.fieldId),
						accountId: account._id
					},
					{ $set: { currentCultivation: null } }
				);

				response.cultivation = 'deleted';
				response.fieldUpdate = { currentCultivation: null };
			}
		}
		// Handle final harvest deletion: reopen cultivation
		else if (job.type === 'harvest' && job.data?.harvest?.isFinal && job.cultivation?.id) {
			const cultId = job.cultivation.id;

			if (ObjectId.isValid(cultId)) {
				// Reopen cultivation
				const cultivation = await getDb().collection('cultivations').findOneAndUpdate(
					{ _id: new ObjectId(cultId), accountId: account._id },
					{
						$set: { status: 'active' },
						$unset: { endTime: '', endJobId: '' }
					},
					{ returnDocument: 'after' }
				);

				if (cultivation) {
					// Restore field's currentCultivation
					const fieldUpdate = {
						currentCultivation: {
							id: cultivation._id.toString(),
							crop: cultivation.crop,
							variety: cultivation.variety,
							eppoCode: cultivation.eppoCode,
							startTime: cultivation.startTime
						}
					};

					await getDb().collection('Fields').updateOne(
						{
							_id: new ObjectId(job.fieldId),
							accountId: account._id
						},
						{ $set: { currentCultivation: fieldUpdate.currentCultivation } }
					);

					response.cultivation = 'reopened';
					response.fieldUpdate = fieldUpdate;
				}
			}
		}

		// Adjust powerOnTimeMs (decrement)
		if (job.elapsedTime > 0) {
			await updateEquipmentPowerOnTime(account._id, job, -job.elapsedTime);
		}

		// Delete the job
		await getDb().collection('jobs').deleteOne({ _id: job._id });

		res.json(ok(response));
	} catch (err) {
		console.error('Error deleting job record:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// GET /job/record/check?idempotencyKey=... - Check if job exists by idempotency key
// NOTE: This route MUST come before /record/:_id to avoid being caught by the param route
router.get('/record/check', validate([
	query('idempotencyKey').exists().withMessage('idempotencyKey.required')
]), async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		const job = await getDb().collection('jobs').findOne({
			accountId: account._id,
			idempotencyKey: req.query.idempotencyKey
		});

		if (!job) {
			return res.status(404).send(fail('RECORD_NOT_FOUND', { code: 'RECORD_NOT_FOUND' }));
		}

		res.json(ok(job));
	} catch (err) {
		console.error('Error checking job record:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// GET /job/record/:_id - Get a single job record
router.get('/record/:_id', validate([
	param('_id').isMongoId().withMessage('job.invalidId')
]), async (req, res) => {
	try {
		const jobId = req.params._id;

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		const job = await getDb().collection('jobs').findOne({
			_id: new ObjectId(jobId),
			accountId: account._id
		});

		if (!job) {
			return res.status(404).send(fail('RECORD_NOT_FOUND'));
		}

		// Optionally attach field data from Fields collection
		const response = { ...job };
		if (job.fieldId && ObjectId.isValid(job.fieldId)) {
			const field = await getDb().collection('Fields').findOne({
				_id: new ObjectId(job.fieldId),
				accountId: account._id
			});
			if (field) {
				response.field = {
					_id: field._id,
					name: field.name,
					area: field.area,
					color: field.color
				};
			}
		}

		res.json(ok(response));
	} catch (err) {
		console.error('Error fetching job record:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// GET /job/records - Get all job records with pagination and filtering
router.get('/records', async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		// Pagination
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Build query
		const query = { accountId: account._id };

		if (req.query.type && req.query.type !== 'all') {
			query.type = req.query.type;
		}
		// Support legacy jobType parameter
		if (req.query.jobType && req.query.jobType !== 'all') {
			query.type = req.query.jobType;
		}

		if (req.query.fieldId) {
			query.fieldId = req.query.fieldId;
		}

		if (req.query.cultivationId) {
			query['cultivation.id'] = req.query.cultivationId;
		}

		if (req.query.templateId) {
			query['template.id'] = req.query.templateId;
		}

		// Date range filter
		if (req.query.dateFrom || req.query.dateTo) {
			query.startedAt = {};
			if (req.query.dateFrom) {
				query.startedAt.$gte = new Date(req.query.dateFrom);
			}
			if (req.query.dateTo) {
				query.startedAt.$lte = new Date(req.query.dateTo);
			}
		}

		// Search filter
		if (req.query.search?.trim()) {
			const searchRegex = new RegExp(req.query.search.trim(), 'i');
			query.$or = [
				{ notes: searchRegex },
				{ 'cultivation.crop': searchRegex },
				{ 'cultivation.variety': searchRegex }
			];
		}

		const totalCount = await getDb().collection('jobs').countDocuments(query);
		const totalPages = Math.ceil(totalCount / limit);

		const records = await getDb().collection('jobs')
			.find(query)
			.sort({ startedAt: -1 })
			.skip(skip)
			.limit(limit)
			.toArray();

		res.json(ok({
			records,
			pagination: {
				currentPage: page,
				totalPages,
				totalJobs: totalCount,
				limit,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1
			}
		}));
	} catch (err) {
		console.error('Error fetching job records:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// GET /job/records/batch/:batchId - Get all jobs in a batch
router.get('/records/batch/:batchId', async (req, res) => {
	try {
		const batchId = req.params.batchId;

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		const jobs = await getDb().collection('jobs')
			.find({
				accountId: account._id,
				'batch.id': batchId
			})
			.sort({
				'data.spray.batch.fieldIndex': 1,
				'data.irrigate.batch.fieldIndex': 1
			})
			.toArray();

		if (jobs.length === 0) {
			return res.status(404).send(fail('BATCH_NOT_FOUND'));
		}

		// Calculate summary
		const summary = {
			totalFields: jobs[0].data?.spray?.batch?.totalFields ||
				jobs[0].data?.irrigate?.batch?.totalFields ||
				jobs.length,
			completedFields: jobs.length,
			totalArea: 0,
			totalWater: 0,
			totalElapsedTime: 0
		};

		jobs.forEach(job => {
			summary.totalElapsedTime += job.elapsedTime || 0;
			if (job.type === 'spray' && job.data?.spray) {
				summary.totalArea += job.data.spray.coveredArea || 0;
				summary.totalWater += job.data.spray.totalWater || 0;
			} else if (job.type === 'irrigate' && job.data?.irrigate) {
				summary.totalWater += job.data.irrigate.consumption || 0;
			}
		});

		res.json(ok({
			batchId,
			type: jobs[0].type,
			jobs,
			summary
		}));
	} catch (err) {
		console.error('Error fetching batch jobs:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

// GET /job/recent-sprays - Get recent spray jobs for fields
router.get('/recent-sprays', async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).send(fail('SIGNED_OUT'));
		}

		const fieldIdsParam = req.query.fieldIds;
		if (!fieldIdsParam) {
			return res.status(400).send(fail('FIELD_IDS_REQUIRED'));
		}

		const fieldIds = fieldIdsParam.split(',').map(id => id.trim());

		let sinceDate;
		if (req.query.since) {
			sinceDate = new Date(req.query.since);
			if (isNaN(sinceDate.getTime())) {
				return res.status(400).send(fail('INVALID_SINCE_DATE'));
			}
		} else {
			sinceDate = new Date();
			sinceDate.setDate(sinceDate.getDate() - 90);
		}

		const sprayJobs = await getDb().collection('jobs')
			.find({
				accountId: account._id,
				type: 'spray',
				fieldId: { $in: fieldIds },
				endedAt: { $gte: sinceDate }
			})
			.sort({ endedAt: -1 })
			.toArray();

		res.json(ok(sprayJobs));
	} catch (err) {
		console.error('Error fetching recent spray jobs:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
