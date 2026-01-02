const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../../utils/db');
const router = express.Router();
const { ok, fail } = require('../../utils/response');



router.get('/', (req, res) => {
	getDb().collection('Accounts')
		.findOneAndDelete({ _id: new ObjectId(req.session.accountId) })
		.then(() => {
			req.session.destroy(err => {
				if (err) console.error(err);
				res.clearCookie('connect.sid');
				res.json(ok());
			});
		})
		.catch(err => {
			console.error(err);
			res.status(500).json(fail('INTERNAL_ERROR'));
		});
});

module.exports = router;