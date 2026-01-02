const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
		
const checkUsernameRules = [
	body('username')
		.exists({ checkNull: true }).withMessage('username.required')
		.notEmpty().withMessage('username.empty')
		.isLength({ min: 3, max: 63 }).withMessage('username.length')
		.custom(v => !/\s/.test(v)).withMessage('username.noWhitespace')
];

router.post('/', validate(checkUsernameRules), (req, res) => {
	const filter = { 'metadata.username': req.body.username };

	getDb().collection('Accounts').findOne(filter)
		.then(doc => {
			if (!doc) res.json(ok());
			else res.json(fail('ALREADY_EXISTS'));
		})
		.catch(err => {
			console.error(err);
			res.status(500).json(fail('INTERNAL_ERROR'));
		});
});

module.exports = router;