const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const sessionHandler = require('../middleware/sessionHandler');

// ============================================
// PUBLIC ROUTES (no auth)
// ============================================
router.use('/ping', require('./ping'));
router.use('/login', require('./auth/login'));
router.use('/register', require('./auth/register'));
router.use('/signout', require('./auth/signout'));
router.use('/phoneVerify', require('./auth/phoneVerify'));
router.use('/checkUsername', require('./auth/checkUsername'));
router.use('/auth/verifyEmail', require('./auth/verifyEmail'));

// ============================================
// PROTECTED ROUTES (auth required)
// ============================================
router.use(sessionHandler);

// Account
router.use('/getAccountData', require('./account/getData'));
router.use('/deleteAccount', require('./account/delete'));
router.use('/firstSetup', require('./account/firstSetup'));

// Farm data
router.use('/addField', require('./farm/addField'));
router.use('/editField', require('./farm/editField'));
router.use('/editFieldPoints', require('./farm/editFieldPoints'));

// Equipment
router.use('/machine', require('./farm/machine'));
router.use('/attachment', require('./farm/attachment'));
router.use('/tool', require('./farm/tool'));
router.use('/product', require('./farm/product'));

// Jobs
router.use('/job', require('./job/index'));
router.use('/jobTemplate', require('./job/jobTemplate'));
router.use('/jobTemplates', require('./job/jobTemplate')); // Alias for GET /jobTemplates/all

// Other
router.use('/cultivation', require('./cultivation'));
router.use('/report', require('./report'));
router.use('/eppo', require('./eppo'));

// Settings
router.use('/settings/email', require('./settings/email'));
router.use('/settings/preferences', require('./settings/preferences'));


// Static report files
router.get('/reports/:filename', (req, res) => {
	const filePath = path.join(__dirname, '../reports', req.params.filename);
	if (fs.existsSync(filePath)) {
		res.sendFile(filePath);
	} else {
		res.status(404).send('File not found');
	}
});

module.exports = router;