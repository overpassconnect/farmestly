/**
 * Idempotency Key Generator for Job Records
 * Simple random ID generation for efficient job lookup and deduplication
 */

/**
 * Generate a random idempotency key for job records
 * Format: job_[timestamp]_[random8chars]
 * Example: job_1703123456789_a7b3c2f9
 */
export const generateIdempotencyKey = () => {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 10); // 8 chars

	return `job_${timestamp}_${random}`;
};

/**
 * Validate if a string looks like an idempotency key
 */
export const isValidIdempotencyKey = (id) => {
	if (!id || typeof id !== 'string') return false;
	return /^job_\d+_[a-z0-9]+$/.test(id);
};

export default {
	generateIdempotencyKey,
	isValidIdempotencyKey
};
