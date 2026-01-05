const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

// Valid 2-letter product type codes
const VALID_TYPE_CODES = ['HB', 'FU', 'IN', 'AC', 'AT', 'PG', 'NE', 'RO', 'RE', 'BA', 'OT', 'MO', 'DE', 'EL', 'ST', 'XX'];

const productRules = [
	body('name')
		.exists({ checkNull: true }).withMessage('product.nameRequired')
		.notEmpty().withMessage('product.nameEmpty')
		.trim(),
	body('type')
		.exists({ checkNull: true }).withMessage('product.typeRequired'),
	body('type.code')
		.exists({ checkNull: true }).withMessage('product.typeCodeRequired')
		.isIn(VALID_TYPE_CODES).withMessage('product.typeCodeInvalid')
		.trim(),
	body('type.name')
		.exists({ checkNull: true }).withMessage('product.typeNameRequired')
		.isLength({ min: 1, max: 50 }).withMessage('product.typeNameInvalid')
		.trim(),
	body('activeIngredient')
		.optional({ nullable: true }),
	body('activeIngredient.provider')
		.optional({ nullable: true, checkFalsy: true })
		.isIn(['ingredientseu']).withMessage('product.activeIngredientProviderInvalid')
		.trim(),
	body('activeIngredient.id')
		.optional({ nullable: true, checkFalsy: true })
		.isInt({ min: 1 }).withMessage('product.activeIngredientIdInvalid'),
	body('activeIngredient.code')
		.optional({ nullable: true, checkFalsy: true })
		.isLength({ min: 2, max: 2 }).withMessage('product.activeIngredientCodeInvalid')
		.trim(),
	body('activeIngredient.name')
		.optional({ nullable: true, checkFalsy: true })
		.isLength({ max: 200 }).withMessage('product.activeIngredientNameTooLong')
		.trim(),
	body('activeIngredient.cas')
		.optional({ nullable: true, checkFalsy: true })
		.matches(/^\d{2,7}-\d{2}-\d$/).withMessage('product.activeIngredientCasInvalid')
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

		// Build activeIngredient object if provided
		let activeIngredient = null;
		const ai = req.body.activeIngredient;
		if (ai && (ai.name || ai.id)) {
			activeIngredient = {
				provider: ai.provider?.trim() || null,   // 'ingredientseu' or null for custom
				id: ai.id ? Number(ai.id) : null,        // EU substance_id
				code: ai.code?.trim() || null,           // 2-letter category code
				name: ai.name?.trim() || null,           // Substance name
				cas: ai.cas?.trim() || null              // CAS number
			};
		}

		const productDoc = {
			_id: new ObjectId(),
			accountId: account._id,
			name: req.body.name.trim(),
			type: {
				code: req.body.type.code.trim(),
				name: req.body.type.name.trim()
			},
			activeIngredient,
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

		// Build activeIngredient object if provided
		let activeIngredient = null;
		const ai = req.body.activeIngredient;
		if (ai && (ai.name || ai.id)) {
			activeIngredient = {
				provider: ai.provider?.trim() || null,   // 'ingredientseu' or null for custom
				id: ai.id ? Number(ai.id) : null,        // EU substance_id
				code: ai.code?.trim() || null,           // 2-letter category code
				name: ai.name?.trim() || null,           // Substance name
				cas: ai.cas?.trim() || null              // CAS number
			};
		}

		const updateFields = {
			name: req.body.name.trim(),
			type: {
				code: req.body.type.code.trim(),
				name: req.body.type.name.trim()
			},
			activeIngredient,
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
