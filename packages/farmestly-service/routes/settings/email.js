const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const { ObjectId } = require('mongodb');

router.put('/', validate([
	body('email').isEmail().withMessage('email.invalid').normalizeEmail()
]), (req, res) => {
	getDb().collection('Accounts')
		.updateOne(
			{ _id: new ObjectId(req.session.accountId) },
			{ $set: { 'metadata.email': req.body.email } }
		)
		.then(result => {
			if (result.matchedCount === 0) return res.status(401).json(fail('SIGNED_OUT'));
			res.json(ok());
		})
		.catch(err => {
			console.error(err);
			res.status(500).json(fail('INTERNAL_ERROR'));
		});
});

module.exports = router;
