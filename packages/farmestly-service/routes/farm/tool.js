const express = require('express');
const { query } = require('express-validator');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

// POST /tool/add - Create a new tool
router.post('/add', async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const toolDoc = {
			_id: new ObjectId(),
			accountId: account._id,
			name: req.body.name,
			type: req.body.type || null,
			brand: req.body.brand || null,
			model: req.body.model || null,
			powerOnTime: 0  // seconds
		};

		await getDb().collection('Tools').insertOne(toolDoc);

		res.json(ok(toolDoc));
	} catch (err) {
		console.error('[tool/add]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// POST /tool/update - Update an existing tool
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

		const updateFields = {
			name: req.body.name,
			type: req.body.type || null,
			brand: req.body.brand || null,
			model: req.body.model || null
		};

		const result = await getDb().collection('Tools').findOneAndUpdate(
			{
				_id: new ObjectId(req.body._id),
				accountId: account._id
			},
			{ $set: updateFields },
			{ returnDocument: 'after' }
		);

		if (!result) {
			return res.status(404).json(fail('TOOL_NOT_FOUND'));
		}

		res.json(ok(result));
	} catch (err) {
		console.error('[tool/update]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// DELETE /tool/delete?_id=... - Delete a tool
router.delete('/delete', validate([
	query('_id')
		.exists().withMessage('tool.idRequired')
		.notEmpty().withMessage('tool.idEmpty')
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

		const result = await getDb().collection('Tools').deleteOne({
			_id: new ObjectId(req.query._id),
			accountId: account._id
		});

		if (result.deletedCount === 0) {
			return res.status(404).json(fail('TOOL_NOT_FOUND'));
		}

		res.json(ok({ deleted: req.query._id }));
	} catch (err) {
		console.error('[tool/delete]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
