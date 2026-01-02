const express = require('express');
const { body, query } = require('express-validator');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

const editFieldRules = [
	query('_id')
		.exists().withMessage('id.required')
		.notEmpty().withMessage('id.empty'),
	body('fieldName')
		.exists({ checkNull: true }).withMessage('field.nameRequired')
		.notEmpty().withMessage('field.nameEmpty'),
	body('fieldLegalNumber')
		.optional({ nullable: true, checkFalsy: true })
		.matches(/^\d+$/).withMessage('field.legalNumberMustBeNumbers'),
	body('farmingType')
		.optional({ nullable: true, checkFalsy: true })
];

router.post('/', validate(editFieldRules), async (req, res) => {
	try {
		const fieldId = req.query._id;

		if (!ObjectId.isValid(fieldId)) {
			return res.status(400).json(fail('INVALID_ID'));
		}

		const { fieldName, fieldLegalNumber, farmingType } = req.body;

		const updateFields = {
			name: fieldName
		};

		if (fieldLegalNumber !== undefined) {
			updateFields.fieldLegalNumber = fieldLegalNumber || null;
		}

		if (farmingType !== undefined) {
			updateFields.farmingType = farmingType || null;
		}

		const result = await getDb().collection('Fields').findOneAndUpdate(
			{
				_id: new ObjectId(fieldId),
				accountId: new ObjectId(req.session.accountId)
			},
			{ $set: updateFields },
			{ returnDocument: 'after' }
		);

		if (!result) {
			return res.status(404).json(fail('FIELD_NOT_FOUND'));
		}

		res.json(ok(result));
	} catch (err) {
		console.error('[editField.js]', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
