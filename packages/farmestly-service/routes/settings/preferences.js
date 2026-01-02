// routes/settings/preferences.js

const express = require('express');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { ObjectId } = require('mongodb');

router.post('/', async (req, res) => {
	try {
		const updates = {};

		// Build $set object for whatever is passed
		if (req.body.units) {
			updates['metadata.preferences.units'] = req.body.units;
		}
		if (req.body.language) {
			updates['metadata.preferences.language'] = req.body.language;
		}

		if (Object.keys(updates).length === 0) {
			return res.status(400).json(fail('NO_UPDATES'));
		}

		const result = await getDb().collection('Accounts').updateOne(
			{ _id: new ObjectId(req.session.accountId) },
			{ $set: updates }
		);

		if (result.matchedCount === 0) {
			return res.status(401).json(fail('SIGNED_OUT'));
		}

		res.json(ok());
	} catch (err) {
		console.error('preferences update error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
