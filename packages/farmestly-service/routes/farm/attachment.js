const express = require('express');
const { query } = require('express-validator');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

// POST /attachment/add - Create a new attachment
router.post('/add', async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const attachmentDoc = {
			_id: new ObjectId(),
			accountId: account._id,
			name: req.body.name,
			make: req.body.make || null,
			type: req.body.type,
			powerOnTime: 0,  // seconds
			usedFor: null,
			tankCapacity: null,
			boomWidth: null,
			defaultCarrierRate: null,
			litersPerHour: null
		};

		// Handle sprayer configuration
		if (req.body.usedFor === 'spray') {
			if (!req.body.tankCapacity || req.body.tankCapacity <= 0) {
				return res.status(400).json(fail('TANK_CAPACITY_REQUIRED'));
			}
			attachmentDoc.usedFor = 'spray';
			attachmentDoc.tankCapacity = Number(req.body.tankCapacity);
			if (req.body.boomWidth != null) {
				attachmentDoc.boomWidth = Number(req.body.boomWidth);
			}
			if (req.body.defaultCarrierRate != null) {
				attachmentDoc.defaultCarrierRate = Number(req.body.defaultCarrierRate);
			}
			if (req.body.litersPerHour != null) {
				attachmentDoc.litersPerHour = Number(req.body.litersPerHour);
			}
		}

		await getDb().collection('Attachments').insertOne(attachmentDoc);

		res.json(ok(attachmentDoc));
	} catch (err) {
		console.error('[attachment/add]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// POST /attachment/update - Update an existing attachment
router.post('/update', async (req, res) => {
	try {
		if (!req.body._id || !ObjectId.isValid(req.body._id)) {
			return res.status(400).json(fail('INVALID_ID'));
		}

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		// Handle sprayer validation
		if (req.body.usedFor === 'spray') {
			if (!req.body.tankCapacity || req.body.tankCapacity <= 0) {
				return res.status(400).json(fail('TANK_CAPACITY_REQUIRED'));
			}
		}

		const updateFields = {
			name: req.body.name,
			make: req.body.make || null,
			type: req.body.type,
			usedFor: req.body.usedFor === 'spray' ? 'spray' : null,
			tankCapacity: req.body.usedFor === 'spray' ? Number(req.body.tankCapacity) : null,
			boomWidth: req.body.usedFor === 'spray' && req.body.boomWidth != null ? Number(req.body.boomWidth) : null,
			defaultCarrierRate: req.body.usedFor === 'spray' && req.body.defaultCarrierRate != null ? Number(req.body.defaultCarrierRate) : null,
			litersPerHour: req.body.usedFor === 'spray' && req.body.litersPerHour != null ? Number(req.body.litersPerHour) : null
		};

		const result = await getDb().collection('Attachments').findOneAndUpdate(
			{
				_id: new ObjectId(req.body._id),
				accountId: account._id
			},
			{ $set: updateFields },
			{ returnDocument: 'after' }
		);

		if (!result) {
			return res.status(404).json(fail('ATTACHMENT_NOT_FOUND'));
		}

		res.json(ok(result));
	} catch (err) {
		console.error('[attachment/update]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// DELETE /attachment/delete?_id=... - Delete an attachment
router.delete('/delete', validate([
	query('_id')
		.exists().withMessage('attachment.idRequired')
		.notEmpty().withMessage('attachment.idEmpty')
]), async (req, res) => {
	try {
		if (!ObjectId.isValid(req.query._id)) {
			return res.status(400).json(fail('INVALID_ID'));
		}

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const result = await getDb().collection('Attachments').deleteOne({
			_id: new ObjectId(req.query._id),
			accountId: account._id
		});

		if (result.deletedCount === 0) {
			return res.status(404).json(fail('ATTACHMENT_NOT_FOUND'));
		}

		res.json(ok({ deleted: req.query._id }));
	} catch (err) {
		console.error('[attachment/delete]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
