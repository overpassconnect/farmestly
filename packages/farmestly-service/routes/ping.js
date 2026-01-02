const express = require('express');
const router = express.Router();
const { ok } = require('../utils/response');

router.get('/', (req, res) => {
	res.json(ok({ message: 'HELLO' }));
});

module.exports = router;