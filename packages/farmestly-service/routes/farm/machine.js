const express = require('express');
const { query, body } = require('express-validator');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

const notesValidation = body('notes')
	.optional({ nullable: true, checkFalsy: true })
	.isLength({ max: 500 }).withMessage('notes.tooLong')
	.trim();

// POST /machine/add - Create a new machine
router.post('/add', validate([notesValidation]), async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const machineDoc = {
			_id: new ObjectId(),
			accountId: account._id,
			name: req.body.name,
			make: req.body.make,
			licenceNo: req.body.licenceNo || null,
			powerOnTime: 0,  // seconds
			usedFor: null,
			tankCapacity: null,
			boomWidth: null,
			defaultCarrierRate: null,
			notes: req.body.notes || null
		};

		// Handle sprayer configuration
		if (req.body.usedFor === 'spray') {
			if (!req.body.tankCapacity || req.body.tankCapacity <= 0) {
				return res.status(400).json(fail('TANK_CAPACITY_REQUIRED'));
			}
			machineDoc.usedFor = 'spray';
			machineDoc.tankCapacity = Number(req.body.tankCapacity);
			if (req.body.boomWidth != null) {
				machineDoc.boomWidth = Number(req.body.boomWidth);
			}
			if (req.body.defaultCarrierRate != null) {
				machineDoc.defaultCarrierRate = Number(req.body.defaultCarrierRate);
			}
		}

		await getDb().collection('Machines').insertOne(machineDoc);

		res.json(ok(machineDoc));
	} catch (err) {
		console.error('[machine/add]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// POST /machine/update - Update an existing machine
router.post('/update', validate([notesValidation]), async (req, res) => {
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
			make: req.body.make,
			licenceNo: req.body.licenceNo || null,
			powerOnTime: req.body.powerOnTime != null ? Number(req.body.powerOnTime) : 0,
			usedFor: req.body.usedFor === 'spray' ? 'spray' : null,
			tankCapacity: req.body.usedFor === 'spray' ? Number(req.body.tankCapacity) : null,
			boomWidth: req.body.usedFor === 'spray' && req.body.boomWidth != null ? Number(req.body.boomWidth) : null,
			defaultCarrierRate: req.body.usedFor === 'spray' && req.body.defaultCarrierRate != null ? Number(req.body.defaultCarrierRate) : null,
			notes: req.body.notes || null
		};

		const result = await getDb().collection('Machines').findOneAndUpdate(
			{
				_id: new ObjectId(req.body._id),
				accountId: account._id
			},
			{ $set: updateFields },
			{ returnDocument: 'after' }
		);

		if (!result) {
			return res.status(404).json(fail('MACHINE_NOT_FOUND'));
		}

		res.json(ok(result));
	} catch (err) {
		console.error('[machine/update]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// DELETE /machine/delete?_id=... - Delete a machine
router.delete('/delete', validate([
	query('_id')
		.exists().withMessage('machine.idRequired')
		.notEmpty().withMessage('machine.idEmpty')
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

		const result = await getDb().collection('Machines').deleteOne({
			_id: new ObjectId(req.query._id),
			accountId: account._id
		});

		if (result.deletedCount === 0) {
			return res.status(404).json(fail('MACHINE_NOT_FOUND'));
		}

		res.json(ok({ deleted: req.query._id }));
	} catch (err) {
		console.error('[machine/delete]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
