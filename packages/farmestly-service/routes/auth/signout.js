const express = require('express');
const router = express.Router();
const { ok, fail } = require('../../utils/response');
	
router.post('/', (req, res) => {
	req.session.destroy(err => {
		if (err) {
			console.error(err);
			return res.status(500).json(fail('INTERNAL_ERROR'));
		}
		res.clearCookie('connect.sid');
		res.json(ok());
	});
});

module.exports = router;