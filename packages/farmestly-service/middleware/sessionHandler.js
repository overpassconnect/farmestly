// middleware/sessionHandler.js

const { fail } = require('../utils/response');

module.exports = (req, res, next) => {
	if (!req.session.accountId) {
		return res.status(401).json(fail('NO_SESSION'));
	}
	next();
};