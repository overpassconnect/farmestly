const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

const VALID_PRODUCT_TYPES = ['herbicide', 'fungicide', 'insecticide', 'adjuvant', 'fertilizer', 'other'];

const productRules = [
	body('name')
		.exists({ checkNull: true }).withMessage('product.nameRequired')
		.notEmpty().withMessage('product.nameEmpty')
		.trim(),
	body('type')
		.exists({ checkNull: true }).withMessage('product.typeRequired')
		.isIn(VALID_PRODUCT_TYPES).withMessage('product.typeInvalid'),
	body('activeIngredient')
		.optional({ nullable: true, checkFalsy: true })
		.trim(),
	body('defaultRate')
		.optional({ nullable: true, checkFalsy: true })
		.isFloat({ gt: 0 }).withMessage('product.defaultRateInvalid'),
	body('isVolume')
		.optional({ nullable: true })
		.isBoolean().withMessage('product.isVolumeInvalid'),
	body('rei')
		.optional({ nullable: true, checkFalsy: true })
		.isInt({ min: 0 }).withMessage('product.reiInvalid'),
	body('phi')
		.optional({ nullable: true, checkFalsy: true })
		.isInt({ min: 0 }).withMessage('product.phiInvalid'),
	body('notes')
		.optional({ nullable: true, checkFalsy: true })
		.isLength({ max: 500 }).withMessage('product.notesTooLong')
		.trim()
];

// POST /product/add - Create a new product
router.post('/add', validate(productRules), async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const productDoc = {
			_id: new ObjectId(),
			accountId: account._id,
			name: req.body.name.trim(),
			type: req.body.type,
			activeIngredient: req.body.activeIngredient || null,
			defaultRate: req.body.defaultRate ? Number(req.body.defaultRate) : null,
			isVolume: req.body.isVolume ?? true,
			rei: req.body.rei ? Number(req.body.rei) : null,
			phi: req.body.phi ? Number(req.body.phi) : null,
			notes: req.body.notes || null
		};

		await getDb().collection('Products').insertOne(productDoc);

		res.json(ok(productDoc));
	} catch (err) {
		console.error('[product/add]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// POST /product/update - Update an existing product
router.post('/update', validate([
	body('_id')
		.exists({ checkNull: true }).withMessage('product.idRequired')
		.notEmpty().withMessage('product.idEmpty'),
	...productRules
]), async (req, res) => {
	try {
		if (!ObjectId.isValid(req.body._id)) {
			return res.status(400).json(fail('INVALID_ID'));
		}

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const updateFields = {
			name: req.body.name.trim(),
			type: req.body.type,
			activeIngredient: req.body.activeIngredient || null,
			defaultRate: req.body.defaultRate ? Number(req.body.defaultRate) : null,
			isVolume: req.body.isVolume ?? true,
			rei: req.body.rei ? Number(req.body.rei) : null,
			phi: req.body.phi ? Number(req.body.phi) : null,
			notes: req.body.notes || null
		};

		const result = await getDb().collection('Products').findOneAndUpdate(
			{
				_id: new ObjectId(req.body._id),
				accountId: account._id
			},
			{ $set: updateFields },
			{ returnDocument: 'after' }
		);

		if (!result) {
			return res.status(404).json(fail('PRODUCT_NOT_FOUND'));
		}

		res.json(ok(result));
	} catch (err) {
		console.error('[product/update]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// DELETE /product/delete?_id=... - Delete a product
router.delete('/delete', validate([
	query('_id')
		.exists().withMessage('product.idRequired')
		.notEmpty().withMessage('product.idEmpty')
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

		const result = await getDb().collection('Products').deleteOne({
			_id: new ObjectId(req.query._id),
			accountId: account._id
		});

		if (result.deletedCount === 0) {
			return res.status(404).json(fail('PRODUCT_NOT_FOUND'));
		}

		res.json(ok({ deleted: req.query._id }));
	} catch (err) {
		console.error('[product/delete]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
