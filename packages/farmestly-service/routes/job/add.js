
const express = require('express');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { ObjectId } = require('mongodb');


router.post('/', (req, res) => {
	getDb().collection("Accounts").findOne({ _id: new ObjectId(req.session.accountId) }, { projection: {} }
	).then((result) => {
		if (result === null) res.json(fail('SIGNED_OUT'))
		else {

			req.body.type = "CUSTOM"

			return getDb().collection('Accounts').findOneAndUpdate(
				{ _id: new ObjectId(req.session.accountId) },
				{ $push: { 'content.farmData.jobTemplates': req.body } },
				{ returnDocument: 'after', }
			)




		}


	}).then((result) => {

		res.json(ok(result.content.farmData));

	}).catch((err) => {
		console.log(err)
		res.status(500).send(fail('INTERNAL_ERROR'));
	})

});

module.exports = router;