const express = require('express');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { ObjectId } = require('mongodb');
router.post('/', (req, res) => {
	getDb().collection("Accounts").findOne(
		{ _id: new ObjectId(req.session.accountId) },
		{ projection: {} }
	).then((result) => {
		if (result === null) {
			res.json(fail('SIGNED_OUT'));
			return null;
		} else {
			// Check if the job template already exists
			return getDb().collection('Accounts').findOne(
				{
					_id: new ObjectId(req.session.accountId),
					'content.farmData.jobTemplates': { $elemMatch: { id: req.body.id } }
				}
			).then(templateExists => {
				if (templateExists) {
					// Template exists, update it
					return getDb().collection('Accounts').findOneAndUpdate(
						{
							_id: new ObjectId(req.session.accountId),
							'content.farmData.jobTemplates.id': req.body.id
						},
						{
							$set: {
								'content.farmData.jobTemplates.$.name': req.body.name,
								'content.farmData.jobTemplates.$.machine': req.body.machine,
								'content.farmData.jobTemplates.$.attachment': req.body.attachment,
								'content.farmData.jobTemplates.$.tool': req.body.tool
							}
						},
						{ returnDocument: 'after' }
					);
				} else {
					// Template doesn't exist, add it (this covers built-in templates being configured for first time)
					return getDb().collection('Accounts').findOneAndUpdate(
						{ _id: new ObjectId(req.session.accountId) },
						{
							$push: { 'content.farmData.jobTemplates': req.body }
						},
						{ returnDocument: 'after' }
					);
				}
			});
		}
	}).then((result) => {
		// Skip processing if result is null (user was signed out)
		if (result === null) {
			return;
		}

		if (result) {
			res.json(ok(result.content.farmData));
		} else {
			res.status(500).send(fail('INTERNAL_ERROR'));
		}
	}).catch((err) => {
		console.log(err);
		res.status(500).send(fail('INTERNAL_ERROR'));
	});
});

module.exports = router;