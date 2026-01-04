/**
 * Rate Limiting Middleware
 *
 * Centralized rate limiting using express-rate-limit with Redis store.
 * Provides pre-configured limiters for different endpoint categories.
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');

// Redis client singleton
let redisClient = null;

/**
 * Initialize Redis client for rate limiting
 * Call this once during app startup
 */
async function initializeRedisClient() {
	if (redisClient) return redisClient;

	const host = process.env.REDIS_HOST || 'localhost';
	const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
	const password = process.env.REDIS_PASSWORD || undefined;
	const db = process.env.REDIS_RATE_LIMIT_DB
		? parseInt(process.env.REDIS_RATE_LIMIT_DB, 10)
		: (process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) + 1 : 1);

	redisClient = createClient({
		socket: { host, port },
		password,
		database: db
	});

	redisClient.on('error', (err) => {
		console.error('[RateLimiter] Redis client error:', err);
	});

	await redisClient.connect();
	console.log(`[RateLimiter] Redis connected (db: ${db})`);

	return redisClient;
}

/**
 * Get the Redis client (must be initialized first)
 */
function getRedisClient() {
	return redisClient;
}

/**
 * Create a Redis store for rate limiting
 */
function createRedisStore(prefix) {
	if (!redisClient) {
		throw new Error('Redis client not initialized. Call initializeRedisClient() first.');
	}

	return new RedisStore({
		sendCommand: (...args) => redisClient.sendCommand(args),
		prefix: `rl:${prefix}:`
	});
}

/**
 * Standard response for rate limit exceeded
 * Sets Retry-After header per RFC 6585 / RFC 7231
 */
function rateLimitResponse(req, res) {
	return res.status(429).json({
		HEADERS: { STATUS_CODE: 'RATE_LIMITED', VALIDATION: null },
		PAYLOAD: null
	});
}

/**
 * Key generator using session accountId (for authenticated routes)
 * Falls back to IP using ipKeyGenerator for proper IPv6 handling
 */
function keyByAccountId(req, res) {
	return req.session?.accountId || ipKeyGenerator(req, res);
}

/**
 * Key generator using phone number (for phone verification)
 * Falls back to IP using ipKeyGenerator for proper IPv6 handling
 */
function keyByPhoneNumber(req, res) {
	return req.body?.phoneNumber || ipKeyGenerator(req, res);
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

/**
 * Email Resend Verification Limiter
 * Limits how often a user can request verification email resends
 * Default: 3 requests per 5 minutes per account
 */
function createEmailResendLimiter() {
	const windowMs = parseInt(process.env.RATE_LIMIT_EMAIL_RESEND_WINDOW_MS, 10) || 5 * 60 * 1000;
	const max = parseInt(process.env.RATE_LIMIT_EMAIL_RESEND_MAX, 10) || 3;

	return rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		store: createRedisStore('email-resend'),
		keyGenerator: keyByAccountId,
		handler: rateLimitResponse,
		skip: (req) => process.env.NODE_ENV === 'test'
	});
}

/**
 * Phone Verification Request Limiter
 * Limits SMS verification requests per phone number
 * Default: 3 requests per 10 minutes per phone number
 */
function createPhoneVerifyRequestLimiter() {
	const windowMs = parseInt(process.env.RATE_LIMIT_PHONE_VERIFY_WINDOW_MS, 10) || 10 * 60 * 1000;
	const max = parseInt(process.env.RATE_LIMIT_PHONE_VERIFY_MAX, 10) || 3;

	return rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		store: createRedisStore('phone-verify'),
		keyGenerator: keyByPhoneNumber,
		handler: rateLimitResponse,
		skip: (req) => {
			// Skip rate limiting for test phones
			const testPhones = process.env.TEST_PHONES ? process.env.TEST_PHONES.split(',') : [];
			return testPhones.includes(req.body?.phoneNumber) || process.env.NODE_ENV === 'test';
		}
	});
}

/**
 * Phone Verification Code Attempt Limiter
 * Limits verification code attempts per phone number
 * Default: 5 attempts per 15 minutes per phone number
 */
function createPhoneVerifyAttemptLimiter() {
	const windowMs = parseInt(process.env.RATE_LIMIT_PHONE_ATTEMPT_WINDOW_MS, 10) || 15 * 60 * 1000;
	const max = parseInt(process.env.RATE_LIMIT_PHONE_ATTEMPT_MAX, 10) || 5;

	return rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		store: createRedisStore('phone-attempt'),
		keyGenerator: keyByPhoneNumber,
		handler: rateLimitResponse,
		skip: (req) => {
			const testPhones = process.env.TEST_PHONES ? process.env.TEST_PHONES.split(',') : [];
			return testPhones.includes(req.body?.phoneNumber) || process.env.NODE_ENV === 'test';
		}
	});
}

/**
 * Email Change Limiter
 * Limits how often a user can change their email address
 * Default: 1 change per 5 minutes (for immediate rate limiting)
 * Note: 6-month restriction is handled separately in the endpoint logic
 */
function createEmailChangeLimiter() {
	const windowMs = parseInt(process.env.RATE_LIMIT_EMAIL_CHANGE_WINDOW_MS, 10) || 5 * 60 * 1000;
	const max = parseInt(process.env.RATE_LIMIT_EMAIL_CHANGE_MAX, 10) || 1;

	return rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		store: createRedisStore('email-change'),
		keyGenerator: keyByAccountId,
		handler: rateLimitResponse,
		skip: (req) => process.env.NODE_ENV === 'test'
	});
}

/**
 * Report Generation Limiter
 * Limits how often a user can generate reports
 * Default: 5 reports per 15 minutes per account
 */
function createReportGenerationLimiter() {
	const windowMs = parseInt(process.env.RATE_LIMIT_REPORT_WINDOW_MS, 10) || 15 * 60 * 1000;
	const max = parseInt(process.env.RATE_LIMIT_REPORT_MAX, 10) || 5;

	return rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		store: createRedisStore('report-gen'),
		keyGenerator: keyByAccountId,
		handler: rateLimitResponse,
		skip: (req) => process.env.NODE_ENV === 'test'
	});
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
	// Initialization
	initializeRedisClient,
	getRedisClient,

	// Limiter factories
	createEmailResendLimiter,
	createPhoneVerifyRequestLimiter,
	createPhoneVerifyAttemptLimiter,
	createEmailChangeLimiter,
	createReportGenerationLimiter,

	// Utilities
	createRedisStore,
	keyByAccountId,
	keyByPhoneNumber
};