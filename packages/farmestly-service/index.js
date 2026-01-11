process.env.NODE_ENV !== 'production' && require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const db = require('./utils/db');
const PuppeteerService = require('./utils/PuppeteerService');
const { ensureIndexes: ensureJobTemplateIndexes } = require('./routes/job/jobTemplate');
const { ReportJobManager } = require('./utils/ReportJobManager');
const cron = require('node-cron');
const { initializeRedisClient } = require('./middleware/rateLimiter');

const app = express();

const G_DB__DATABASE_NAME = "appdb";
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-in-production';
const WEB_URL = process.env.WEB_URL || 'https://my.farmestly.dev-staging.overpassconnect.com';

// CORS configuration
const corsOptions = {
	origin: [
		WEB_URL,
		'http://localhost:3001',
		'http://localhost:8080'
	],
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};


// app.use((req, res, next) => {
// 	const originalEnd = res.end;
// 	res.end = function (chunk, encoding) {
// 		console.log('=== Response Headers Being Sent ===');
// 		console.log('Set-Cookie:', res.getHeader('set-cookie'));
// 		console.log('===================================');
// 		return originalEnd.call(this, chunk, encoding);
// 	};
// 	next();
// });



app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use((req, res, next) => {
	console.log(`[${req.method}] ${req.originalUrl} - Body:`, JSON.stringify(req.body, null, 2));
	next();

});
db.connect()
	.then(client => {

		app.use(session({
			secret: SESSION_SECRET,
			resave: false,
			saveUninitialized: false,
			rolling: true,
			store: MongoStore.create({
				client: client,
				dbName: G_DB__DATABASE_NAME,
				collectionName: 'sessions',
				ttl: 30 * 24 * 60 * 60
			}),
			cookie: {
				maxAge: 30 * 24 * 60 * 60 * 1000,
				httpOnly: true,
				sameSite: 'none',
				secure: true
			},
			proxy: true
		}));

		// Initialize EmailQueue using SMTP config from environment
		try {
			const EmailQueue = require('./utils/EmailQueue');
			EmailQueue.getInstance().initialize({
				storage: { type: 'mongodb', db: db.getDb() },
				smtp: {
					host: process.env.SMTP_HOST,
					port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
					user: process.env.SMTP_USER,
					pass: process.env.SMTP_PASS,
					requireTLS: String(process.env.SMTP_IS_STARTTLS).toLowerCase() === 'true',
					from: process.env.SMTP_FROM || process.env.SMTP_USER
				}
			}).then(() => {
				console.log('EmailQueue initialized');
			}).catch(err => {
				console.error('EmailQueue initialization failed:', err);
			});
		} catch (err) {
			console.error('Error requiring EmailQueue module:', err);
		}

		// Initialize PuppeteerService with Redis config
		return PuppeteerService.getInstance().initialize({
			host: process.env.REDIS_HOST || 'localhost',
			port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
			password: undefined,
			db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0
		});
	}).then(() => {
		console.log('PuppeteerService initialized');

		// Initialize Redis client for rate limiting
		return initializeRedisClient();
	}).then(() => {
		console.log('Rate limiting Redis client initialized');

		// Initialize rate limiters for routes that need them
		const { initializeLimiters: initEmailLimiters } = require('./routes/settings/email');
		const { initializeLimiters: initPhoneLimiters } = require('./routes/auth/phoneVerify');
		const { initializeLimiters: initReportLimiters } = require('./routes/report');

		initEmailLimiters();
		initPhoneLimiters();
		initReportLimiters();

		// Initialize JobTemplates collection indexes
		return ensureJobTemplateIndexes();
	}).then(() => {
		app.use('/', require('./routes'));
	}).then(() => {
		app.listen(3000, '127.0.0.1', () => {
			console.log('Server is running on port 3000');

			// Initialize report cleanup scheduler using node-cron
			const cleanupIntervalMinutes = parseInt(process.env.REPORT_CLEANUP_INTERVAL_MINUTES, 10) || 5;

			const runCleanup = async () => {
				console.log('[Cleanup] Running cleanup task');
				try {
					const result = await ReportJobManager.getInstance().cleanupExpiredJobs();
					console.log(`[Cleanup] Deleted ${result.deletedFiles} files, ${result.deletedRecords} job records`);
				} catch (err) {
					console.error('[Cleanup] Error during cleanup:', err);
				}
			};

			cron.schedule(`*/${cleanupIntervalMinutes} * * * *`, runCleanup, { noOverlap: true });
			runCleanup();
		});

		process.on('SIGINT', async () => {
			console.log('Shutting down...');
			try {
				await PuppeteerService.getInstance().shutdown();
				// Close rate limiting Redis client
				const { getRedisClient } = require('./middleware/rateLimiter');
				const rateLimitRedis = getRedisClient();
				if (rateLimitRedis) {
					await rateLimitRedis.quit();
				}
				await db.getClient().close();
				console.log('Graceful shutdown complete');
				process.exit(0);
			} catch (err) {
				console.error('Error during shutdown:', err);
				process.exit(1);
			}
		});
	}).catch(err => {
		console.error('Failed to connect to MongoDB', err);
		process.exit(1);
	});