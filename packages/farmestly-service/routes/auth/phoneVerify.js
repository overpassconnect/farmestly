// routes/phoneVerify.js

const express = require('express');
const https = require('https');
const { phone } = require('phone');
const router = express.Router();

const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const G_DB_FIRST_STATE = require('../../db_first_state.json');

TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
TWILIO_SERVICE_SID = process.env.TWILIO_SERVICE_SID;
TWILIO_CODE_LENGTH = parseInt(process.env.TWILIO_CODE_LENGTH) || 6;
TWILIO_STATUS_APPROVED = process.env.TWILIO_STATUS_APPROVED || "approved";
TWILIO_STATUS_REJECTED = process.env.TWILIO_STATUS_REJECTED || "pending";
TWILIO_CODE_EXPIRED = parseInt(process.env.TWILIO_CODE_EXPIRED) || 20404;

const NO_PASSWORD = "NO_PASSWORD";

// Test phones that bypass Twilio
const TEST_PHONES = process.env.TEST_PHONES ? process.env.TEST_PHONES.split(',') : [];

const getOptions = (action) => {
	let twilioUrlAction = "Verifications";
	if (action === 'verify') twilioUrlAction = "VerificationCheck";
	return {
		hostname: 'verify.twilio.com',
		port: 443,
		path: '/v2/Services/' + TWILIO_SERVICE_SID + '/' + twilioUrlAction,
		method: 'POST',
		headers: {
			'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};
};

const isOnlyNumbers = (s) => !/\D/.test(s);
const validLength = (s) => s.length === TWILIO_CODE_LENGTH;

const doRegister = (req, res, body, queries) => {
	switch (queries.for) {
		case 'signup': {
			let db_entry = JSON.parse(JSON.stringify(G_DB_FIRST_STATE));
			db_entry.metadata.password = NO_PASSWORD;
			db_entry.metadata.username = body.phoneNumber;
			db_entry.metadata.country = body.countryCode;
			delete db_entry.metadata.latestSession; // No longer needed

			getDb().collection('Accounts').insertOne(db_entry)
				.then(result => {
					req.session.accountId = result.insertedId.toString();
					res.status(200).json(ok());
				})
				.catch(err => {
					console.log(err);
					res.status(500).json(fail('INTERNAL_ERROR'));
				});
			break;
		}
		case 'login': {
			getDb().collection('Accounts').findOne({ "metadata.username": body.phoneNumber })
				.then(doc => {
					if (!doc) {
						res.status(401).json(fail('INVALID_LOGIN'));
					} else {
						req.session.accountId = doc._id.toString();
						res.json(ok());
					}
				})
				.catch(err => {
					console.log(err);
					res.status(500).json(fail('INTERNAL_ERROR'));
				});
			break;
		}
		default:
			break;
	}
};

router.post('/', (req, res) => {
	if (!phone(req.body.phoneNumber, { country: req.body.countryCode }).isValid) {
		return res.json(fail('INVALID_PHONE_FORMAT'));
	}

	getDb().collection('Accounts').findOne({ "metadata.username": req.body.phoneNumber })
		.then(doc => {
			if (doc && req.query.for === "signup") {
				return res.status(400).json(fail('USER_EXISTS'));
			}
			if (!doc && req.query.for === "login") {
				return res.status(400).json(fail('USER_NOT_FOUND'));
			}

			switch (req.query.action) {
				case 'request': {
					// Test phone bypass
					if (TEST_PHONES.includes(req.body.phoneNumber)) {
						return res.json(ok());
					}

					const httpsRequest = https.request(getOptions(req.query.action), serverRes => {
						serverRes.on('data', d => {
							let serverData = JSON.parse(d.toString());
							console.log('##', serverData);
							res.json(ok());
						});
					});
					httpsRequest.on('error', error => {
						console.error('error', error);
						res.status(500).send();
					});
					httpsRequest.write(new URLSearchParams({
						'To': req.body.phoneNumber,
						'Channel': 'sms'
					}).toString());
					httpsRequest.end();
					break;
				}
				case 'verify': {
					// Test phone bypass
					if (TEST_PHONES.includes(req.body.phoneNumber)) {
						return doRegister(req, res, req.body, req.query);
					}

					if (!validLength(req.body.verificationCode) || !isOnlyNumbers(req.body.verificationCode)) {
						return res.json(fail('INVALID_CODE_FORMAT'));
					}

					const httpsRequest = https.request(getOptions(req.query.action), serverRes => {
						serverRes.on('data', d => {
							let twilioRes = JSON.parse(d.toString());
							console.log('twilio****', twilioRes);

							if (twilioRes.status === TWILIO_STATUS_APPROVED) {
								doRegister(req, res, req.body, req.query);
							} else if (twilioRes.status === TWILIO_STATUS_REJECTED) {
								res.json(fail('REJECTED'));
							} else if (twilioRes.code === TWILIO_CODE_EXPIRED) {
								res.json(fail('EXPIRED'));
							} else {
								res.status(500).send();
							}
						});
					});
					httpsRequest.on('error', error => {
						console.error(error);
						res.status(500).send();
					});
					httpsRequest.write(new URLSearchParams({
						'To': req.body.phoneNumber,
						'Code': req.body.verificationCode
					}).toString());
					httpsRequest.end();
					break;
				}
				default:
					break;
			}
		})
		.catch(error => {
			console.log(error);
			res.status(500).json(fail('INTERNAL_ERROR'));
		});
});

module.exports = router;