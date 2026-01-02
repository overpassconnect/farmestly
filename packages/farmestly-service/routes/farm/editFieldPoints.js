const express = require('express');
const { body, query } = require('express-validator');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const calculatePolygonArea = require('../../shared/geo/calculatePolygonArea');
const { ObjectId } = require('mongodb');

const editFieldPointsRules = [
	query('_id')
		.exists().withMessage('id required')
		.notEmpty().withMessage('id empty'),
	body('points')
		.exists({ checkNull: true }).withMessage('points required')
		.isArray({ min: 3 }).withMessage('points must be array with at least 3 points')
];

router.post('/', validate(editFieldPointsRules), async (req, res) => {
	try {
		const fieldId = req.query._id;

		if (!ObjectId.isValid(fieldId)) {
			return res.status(400).json(fail('INVALID_ID'));
		}

		const { points } = req.body;
		const newArea = calculatePolygonArea(points);

		// Get current field to calculate area difference
		const currentField = await getDb().collection('Fields').findOne({
			_id: new ObjectId(fieldId),
			accountId: new ObjectId(req.session.accountId)
		});

		if (!currentField) {
			return res.status(404).json(fail('FIELD_NOT_FOUND'));
		}

		const oldArea = currentField.area || 0;
		const areaDifference = newArea - oldArea;

		// Update the field in Fields collection
		const updatedField = await getDb().collection('Fields').findOneAndUpdate(
			{
				_id: new ObjectId(fieldId),
				accountId: new ObjectId(req.session.accountId)
			},
			{
				$set: {
					points: points,
					area: newArea
				}
			},
			{ returnDocument: 'after' }
		);

		if (!updatedField) {
			return res.status(404).json(fail('FIELD_NOT_FOUND'));
		}

		// Update totalArea in Accounts
		await getDb().collection('Accounts').updateOne(
			{ _id: new ObjectId(req.session.accountId) },
			{ $inc: { 'content.farmData.totalArea': areaDifference } }
		);

		res.json(ok(updatedField));
	} catch (err) {
		console.error('[editFieldPoints.js]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
