const express = require('express');
const router = express.Router();
	

router.post('/add', require('./add'));
router.use('/', require('./record'));


module.exports = router;