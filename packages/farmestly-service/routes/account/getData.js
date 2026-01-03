// routes/account/getData.js

const express = require('express');
const router = express.Router();
const { getDb } = require('../../utils/db');
const { ok, fail } = require('../../utils/response');
const { ObjectId } = require('mongodb');

router.get('/', async (req, res) => {
	try {
		if (!req.session.accountId) {
			return res.status(401).json(fail('NO_SESSION'));
		}

		const doc = await getDb().collection('Accounts').findOne({
			_id: new ObjectId(req.session.accountId)
		});

		if (!doc) {
			req.session.destroy();
			return res.status(401).json(fail('INVALID_SESSION'));
		}

		const farmData = doc.content.farmData || {};

		// Fetch data from separate collections
		const [fields, machines, attachments, tools, products, jobTemplates] = await Promise.all([
			getDb().collection('Fields').find({ accountId: doc._id }).toArray(),
			getDb().collection('Machines').find({ accountId: doc._id }).toArray(),
			getDb().collection('Attachments').find({ accountId: doc._id }).toArray(),
			getDb().collection('Tools').find({ accountId: doc._id }).toArray(),
			getDb().collection('Products').find({ accountId: doc._id }).toArray(),
			getDb().collection('JobTemplates').find({ accountId: doc._id }).sort({ createdAt: -1 }).toArray()
		]);

		res.json(ok({
			account: {
				username: doc.metadata.username,
				email: doc.metadata.email || null,
				emailVerified: doc.metadata.emailVerified || false,
				emailPending: doc.metadata.emailVerification?.pendingEmail || null,
				phone: doc.metadata.phone || null,
				setupCompleted: doc.metadata.setupCompleted || false,
				preferences: doc.metadata.preferences || {
					units: { area: 'hectares', length: 'm', volume: 'L', mass: 'kg' },
					language: 'en'
				}
			},
			farm: {
				name: farmData.farmName || '',
				totalArea: farmData.totalArea || 0,
				fields: fields,
				machines: machines,
				attachments: attachments,
				tools: tools,
				products: products,
				jobTemplates: jobTemplates
			}
		}));
	} catch (err) {
		console.error('getAccountData error:', err);
		res.status(500).json(fail('INTERNAL_ERROR'));
	}
});

module.exports = router;
