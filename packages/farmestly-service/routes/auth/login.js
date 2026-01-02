const express = require('express');
const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
	
const loginRules = [
	body('username')
		.exists({ checkNull: true }).withMessage('username.required')
		.notEmpty().withMessage('username.empty')
		.isLength({ min: 3, max: 63 }).withMessage('username.length')
		.custom(v => !/\s/.test(v)).withMessage('username.noWhitespace'),
	body('password')
		.exists({ checkNull: true }).withMessage('password.required')
		.notEmpty().withMessage('password.empty')
		.isLength({ min: 2, max: 64 }).withMessage('password.length')
		.custom(v => !/\s/.test(v)).withMessage('password.noWhitespace')
];

router.post('/', validate(loginRules), (req, res) => {
	const { username, password } = req.body;

	getDb().collection('Accounts').findOne({ 'metadata.username': username })
		.then(doc => {
			if (!doc) return res.status(401).json(fail('LOGIN_INCORRECT'));
			return bcrypt.compare(password, doc.metadata.password)
				.then(matches => {
					if (!matches) return res.status(401).json(fail('LOGIN_INCORRECT'));
					req.session.accountId = doc._id.toString();
					res.json(ok());
				});
		})
		.catch(err => {
			console.error(err);
			res.status(500).json(fail('INTERNAL_ERROR'));
		});
});

module.exports = router;