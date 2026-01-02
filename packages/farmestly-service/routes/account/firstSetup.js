const express = require('express');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ObjectId } = require('mongodb');

const { ok, fail } = require('../../utils/response');
const calculatePolygonArea = require('../../shared/geo/calculatePolygonArea');

module.exports = router.post('/', async (req, res) => {
	try {
		console.log('firstSetup', req.header('x-session-id'));

		const accountId = new ObjectId(req.session.accountId);

		// Calculate total area and prepare field documents for Fields collection
		let totalArea = 0;
		const fieldDocs = [];

		for (const field of req.body.farmData.fields) {
			const fieldArea = calculatePolygonArea(field.points);
			totalArea += fieldArea;

			fieldDocs.push({
				_id: new ObjectId(),
				accountId: accountId,
				name: field.name || field.fieldName,
				points: field.points,
				area: fieldArea,
				color: field.color || '#FF6B6B',
				farmingType: field.farmingType || null,
				fieldLegalNumber: field.fieldLegalNumber || null,
				currentCultivation: null
			});
		}

		// Insert fields into Fields collection
		if (fieldDocs.length > 0) {
			await getDb().collection('Fields').insertMany(fieldDocs);
		}

		// Update account with farm name, total area, and setup completed flag
		// Do NOT store fields/machines/attachments/tools/products in embedded arrays
		await getDb().collection('Accounts').findOneAndUpdate(
			{ _id: accountId },
			{
				$set: {
					'content.farmData.farmName': req.body.farmData.farmName || '',
					'content.farmData.totalArea': totalArea,
					'metadata.setupCompleted': true
				}
			}
		);

		res.status(200).send(ok({ fields: fieldDocs }));
	} catch (err) {
		console.error('firstSetup error:', err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	}
});
