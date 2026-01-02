const express = require('express');
const { body } = require('express-validator');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const calculatePolygonArea = require('../../shared/geo/calculatePolygonArea');
const { ObjectId } = require('mongodb');

const addFieldRules = [
	body('fieldName')
		.exists({ checkNull: true }).withMessage('field.nameRequired')
		.notEmpty().withMessage('field.nameEmpty'),
	body('points')
		.exists({ checkNull: true }).withMessage('field.pointsRequired')
		.isArray({ min: 3 }).withMessage('field.pointsMinLength'),
	body('fieldLegalNumber')
		.optional({ nullable: true, checkFalsy: true })
		.matches(/^\d+$/).withMessage('field.legalNumberMustBeNumbers')
];

// POST /addField - Create a new field
router.post('/', validate(addFieldRules), async (req, res) => {
	try {
		const account = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!account) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		const { fieldName, points, fieldLegalNumber, farmingType, color } = req.body;
		const area = calculatePolygonArea(points);

		const fieldDoc = {
			_id: new ObjectId(),
			accountId: account._id,
			name: fieldName,
			points: points,
			area: area,
			color: color || '#FF6B6B',
			farmingType: farmingType || null,
			fieldLegalNumber: fieldLegalNumber || null,
			currentCultivation: null
		};

		await getDb().collection('Fields').insertOne(fieldDoc);

		// Update account's total area
		await getDb().collection('Accounts').updateOne(
			{ _id: account._id },
			{ $inc: { 'content.farmData.totalArea': area } }
		);

		res.json(ok(fieldDoc));
	} catch (err) {
		console.error('[addField]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
