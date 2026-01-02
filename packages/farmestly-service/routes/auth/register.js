
const express = require('express');
const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { validate } = require('../../middleware/validation');
const G_DB_FIRST_STATE = require('../../db_first_state.json');

const registerRules = [
	body('username')
		.exists({ checkNull: true }).withMessage('username.required')
		.notEmpty().withMessage('username.empty')
		.isLength({ min: 1, max: 100 }).withMessage('username.length')
		.custom(v => !/\s/.test(v)).withMessage('username.noWhitespace'),
	body('password')
		.exists({ checkNull: true }).withMessage('password.required')
		.notEmpty().withMessage('password.empty')
		.isLength({ min: 1, max: 64 }).withMessage('password.length')
		.custom(v => !/\s/.test(v)).withMessage('password.noWhitespace'),
	body('email')
		.optional({ nullable: true, checkFalsy: true })
		.isEmail().withMessage('email.invalid')
		.normalizeEmail()
];

router.post('/', validate(registerRules), (req, res) => {
	const { username, password, countryCode } = req.body;
	const db_entry = JSON.parse(JSON.stringify(G_DB_FIRST_STATE));

	bcrypt.hash(password, 10)
		.then(hash => {
			db_entry.metadata.password = hash;
			db_entry.metadata.username = username;
			db_entry.metadata.country = countryCode;
			db_entry.metadata.email = email || null; // Add email

			// Remove latestSession fields - no longer needed
			delete db_entry.metadata.latestSession;
			return getDb().collection('Accounts').insertOne(db_entry);
		})
		.then(result => {
			req.session.accountId = result.insertedId.toString();
			res.json(ok());
		})
		.catch(err => {
			console.error(err);
			res.status(500).json(fail('INTERNAL_ERROR'));
		});
});

module.exports = router;