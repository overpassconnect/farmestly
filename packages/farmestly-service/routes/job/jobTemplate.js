// routes/job/jobTemplate.js
// JobTemplates collection CRUD operations with dedicated MongoDB collection

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

const VALID_TEMPLATE_TYPES = ['sow', 'harvest', 'spray', 'irrigate', 'custom'];

// Validation rules for template creation/update
const templateRules = [
	body('type')
		.exists({ checkNull: true }).withMessage('template.typeRequired')
		.isIn(VALID_TEMPLATE_TYPES).withMessage('template.typeInvalid'),
	body('name')
		.exists({ checkNull: true }).withMessage('template.nameRequired')
		.notEmpty().withMessage('template.nameEmpty')
		.isLength({ max: 100 }).withMessage('template.nameTooLong')
		.trim(),
	body('machineId')
		.optional({ nullable: true })
		.custom((value) => {
			if (value === null) return true;
			return typeof value === 'string' || typeof value === 'number';
		}).withMessage('template.machineIdInvalid'),
	body('attachmentId')
		.optional({ nullable: true })
		.custom((value) => {
			if (value === null) return true;
			return typeof value === 'string' || typeof value === 'number';
		}).withMessage('template.attachmentIdInvalid'),
	body('toolId')
		.optional({ nullable: true })
		.custom((value) => {
			if (value === null) return true;
			return typeof value === 'string' || typeof value === 'number';
		}).withMessage('template.toolIdInvalid'),
	body('sprayConfig')
		.optional({ nullable: true })
		.isObject().withMessage('template.sprayConfigInvalid'),
	body('sprayConfig.overrides')
		.optional({ nullable: true })
		.isObject().withMessage('template.sprayConfigOverridesInvalid'),
	body('sprayConfig.overrides.carrierRate')
		.optional({ nullable: true })
		.isFloat({ gt: 0 }).withMessage('template.carrierRateInvalid'),
	body('sprayConfig.products')
		.optional({ nullable: true })
		.isArray().withMessage('template.productsInvalid'),
	body('sprayConfig.products.*.id')
		.optional()
		.custom((value) => {
			return typeof value === 'string' || typeof value === 'number';
		}).withMessage('template.productIdInvalid'),
	body('sprayConfig.products.*.overrides')
		.optional({ nullable: true })
		.custom((value) => {
			if (value === null) return true;
			return typeof value === 'object';
		}).withMessage('template.productOverridesInvalid'),
	body('sprayConfig.products.*.overrides.rate')
		.optional({ nullable: true })
		.isFloat({ gt: 0 }).withMessage('template.productRateInvalid')
];

// Helper function to validate spray template requirements
async function validateSprayTemplate(body, account) {
	if (body.type !== 'spray') {
		return { valid: true };
	}

	// Spray templates must have at least one product
	if (!body.sprayConfig || !body.sprayConfig.products || body.sprayConfig.products.length === 0) {
		return {
			valid: false,
			code: 'SPRAY_PRODUCTS_REQUIRED',
			message: 'Spray templates must include at least one product reference'
		};
	}

	// Query separate collections instead of reading from account.content.farmData
	const [products, machines, attachments] = await Promise.all([
		getDb().collection('Products').find({ accountId: account._id }).toArray(),
		getDb().collection('Machines').find({ accountId: account._id }).toArray(),
		getDb().collection('Attachments').find({ accountId: account._id }).toArray()
	]);

	// Validate that all referenced products exist
	const productIds = new Set(products.map(p => p._id.toString()));
	for (const productRef of body.sprayConfig.products) {
		if (!productIds.has(String(productRef.id))) {
			return {
				valid: false,
				code: 'SPRAY_PRODUCT_NOT_FOUND',
				message: `Product with ID ${productRef.id} not found`
			};
		}
	}

	// Spray templates must have a machine or attachment with usedFor:'spray'
	let hasSprayEquipment = false;

	if (body.machineId) {
		const machine = machines.find(m => m._id.toString() === String(body.machineId));
		if (machine && machine.usedFor === 'spray') {
			hasSprayEquipment = true;
		}
	}

	if (!hasSprayEquipment && body.attachmentId) {
		const attachment = attachments.find(a => a._id.toString() === String(body.attachmentId));
		if (attachment && attachment.usedFor === 'spray') {
			hasSprayEquipment = true;
		}
	}

	if (!hasSprayEquipment) {
		return {
			valid: false,
			code: 'SPRAY_EQUIPMENT_REQUIRED',
			message: 'Spray templates must have a machine or attachment with usedFor:spray'
		};
	}

	return { valid: true };
}

// Initialize collection index (call during app startup)
async function ensureIndexes() {
	try {
		await getDb().collection('JobTemplates').createIndex(
			{ accountId: 1, type: 1 },
			{ background: true }
		);
		console.log('JobTemplates indexes created');
	} catch (err) {
		console.error('Error creating JobTemplates indexes:', err);
	}
}

// POST /jobTemplate - Create a new template
router.post('/', validate(templateRules), async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		// Validate spray template requirements
		const sprayValidation = await validateSprayTemplate(req.body, account);
		if (!sprayValidation.valid) {
			return res.status(400).json(fail(sprayValidation.code, [{ msg: sprayValidation.message }]));
		}

		const templateDoc = {
			accountId: new ObjectId(account._id),
			type: req.body.type,
			name: req.body.name.trim(),
			machineId: req.body.machineId || null,
			attachmentId: req.body.attachmentId || null,
			toolId: req.body.toolId || null,
			sprayConfig: req.body.type === 'spray' ? {
				overrides: req.body.sprayConfig?.overrides?.carrierRate ? {
					carrierRate: req.body.sprayConfig.overrides.carrierRate
				} : null,
				products: (req.body.sprayConfig?.products || []).map(p => ({
					id: p.id,
					overrides: p.overrides || null
				}))
			} : null,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		const result = await getDb().collection('JobTemplates').insertOne(templateDoc);
		const insertedTemplate = { ...templateDoc, _id: result.insertedId };

		res.json(ok(insertedTemplate));
	} catch (err) {
		console.error('[jobTemplate/create]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// GET /jobTemplates - Get all templates for the account
router.get('/all', async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const templates = await getDb().collection('JobTemplates')
			.find({ accountId: account._id })
			.sort({ createdAt: -1 })
			.toArray();

		res.json(ok(templates));
	} catch (err) {
		console.error('[jobTemplate/list]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// PUT /jobTemplate/:id - Update a template
router.put('/:id', validate([
	param('id')
		.exists().withMessage('template.idRequired')
		.custom((value) => ObjectId.isValid(value)).withMessage('template.idInvalid'),
	...templateRules
]), async (req, res) => {
	try {
		const templateId = req.params.id;

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		// Verify template exists and belongs to account
		const existingTemplate = await getDb().collection('JobTemplates').findOne({
			_id: new ObjectId(templateId)
		});

		if (!existingTemplate) {
			return res.status(404).json(fail('TEMPLATE_NOT_FOUND'));
		}

		if (existingTemplate.accountId.toString() !== account._id.toString()) {
			return res.status(403).json(fail('ACCESS_DENIED'));
		}

		// Validate spray template requirements
		const sprayValidation = await validateSprayTemplate(req.body, account);
		if (!sprayValidation.valid) {
			return res.status(400).json(fail(sprayValidation.code, [{ msg: sprayValidation.message }]));
		}

		const updateDoc = {
			type: req.body.type,
			name: req.body.name.trim(),
			machineId: req.body.machineId || null,
			attachmentId: req.body.attachmentId || null,
			toolId: req.body.toolId || null,
			sprayConfig: req.body.type === 'spray' ? {
				overrides: req.body.sprayConfig?.overrides?.carrierRate ? {
					carrierRate: req.body.sprayConfig.overrides.carrierRate
				} : null,
				products: (req.body.sprayConfig?.products || []).map(p => ({
					id: p.id,
					overrides: p.overrides || null
				}))
			} : null,
			updatedAt: new Date()
		};

		const result = await getDb().collection('JobTemplates').findOneAndUpdate(
			{ _id: new ObjectId(templateId) },
			{ $set: updateDoc },
			{ returnDocument: 'after' }
		);

		res.json(ok(result));
	} catch (err) {
		console.error('[jobTemplate/update]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// DELETE /jobTemplate/:id - Delete a template
router.delete('/:id', validate([
	param('id')
		.exists().withMessage('template.idRequired')
		.custom((value) => ObjectId.isValid(value)).withMessage('template.idInvalid')
]), async (req, res) => {
	try {
		const templateId = req.params.id;

		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		// Verify template exists and belongs to account
		const existingTemplate = await getDb().collection('JobTemplates').findOne({
			_id: new ObjectId(templateId)
		});

		if (!existingTemplate) {
			return res.status(404).json(fail('TEMPLATE_NOT_FOUND'));
		}

		if (existingTemplate.accountId.toString() !== account._id.toString()) {
			return res.status(403).json(fail('ACCESS_DENIED'));
		}

		await getDb().collection('JobTemplates').deleteOne({
			_id: new ObjectId(templateId)
		});

		res.json(ok({ deleted: templateId }));
	} catch (err) {
		console.error('[jobTemplate/delete]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

// Helper function to check if equipment is used by any templates
async function checkEquipmentDependencies(accountId, equipmentType, equipmentId) {
	let query = { accountId: new ObjectId(accountId) };

	// Convert equipmentId to string for comparison since template stores IDs as strings
	const eqIdStr = String(equipmentId);

	switch (equipmentType) {
		case 'machine':
			query.machineId = eqIdStr;
			break;
		case 'attachment':
			query.attachmentId = eqIdStr;
			break;
		case 'tool':
			query.toolId = eqIdStr;
			break;
		case 'product':
			query['sprayConfig.products.id'] = eqIdStr;
			break;
		default:
			return { inUse: false, templates: [] };
	}

	const templates = await getDb().collection('JobTemplates')
		.find(query, { projection: { _id: 1, name: 1 } })
		.toArray();

	return {
		inUse: templates.length > 0,
		templates: templates.map(t => ({ _id: t._id, name: t.name }))
	};
}

module.exports = router;
module.exports.ensureIndexes = ensureIndexes;
module.exports.checkEquipmentDependencies = checkEquipmentDependencies;
