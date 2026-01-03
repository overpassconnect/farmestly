/**
 * compliance.js
 * 
 * Compliance checking utilities for spray jobs (REI/PHI).
 * Works with the unified JobService.
 * 
 * This is the ONLY module that knows about REI/PHI.
 * JobService is generic and knows nothing about compliance.
 */

import JobService from './JobService';

// ============================================================
// CORE COMPLIANCE CHECK
// ============================================================

/**
 * Get active compliance restrictions for a field.
 * Calculates maximum remaining REI/PHI across all spray jobs.
 * 
 * @param {string|number} fieldId
 * @returns {Promise<{ rei: object|null, phi: object|null }>}
 */
export async function getFieldCompliance(fieldId) {
	const sprays = await JobService.getHistory(fieldId, { 
		type: 'spray',
		since: new Date(Date.now() - 90 * 86400000) // Last 90 days
	});

	if (!sprays.length) {
		return { rei: null, phi: null };
	}

	const now = Date.now();
	let maxREI = { remaining: 0, endDate: null, source: null };
	let maxPHI = { remaining: 0, endDate: null, source: null };

	for (const job of sprays) {
		const sprayData = job.data?.sprayData || job.sprayData;
		if (!sprayData?.products) continue;

		const sprayTime = new Date(job.endTime).getTime();

		for (const product of sprayData.products) {
			// REI (hours)
			if (product.rei > 0) {
				const reiEndMs = sprayTime + product.rei * 3600000;
				if (reiEndMs > now) {
					const remaining = Math.ceil((reiEndMs - now) / 3600000);
					if (remaining > maxREI.remaining) {
						maxREI = {
							remaining,
							endDate: new Date(reiEndMs),
							source: { job, product },
						};
					}
				}
			}

			// PHI (days)
			if (product.phi > 0) {
				const phiEndMs = sprayTime + product.phi * 86400000;
				if (phiEndMs > now) {
					const remaining = Math.ceil((phiEndMs - now) / 86400000);
					if (remaining > maxPHI.remaining) {
						maxPHI = {
							remaining,
							endDate: new Date(phiEndMs),
							source: { job, product },
						};
					}
				}
			}
		}
	}

	return {
		rei: maxREI.remaining > 0 ? { isActive: true, ...maxREI } : null,
		phi: maxPHI.remaining > 0 ? { isActive: true, ...maxPHI } : null,
	};
}

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Check if field has active REI
 */
export async function hasActiveREI(fieldId) {
	const { rei } = await getFieldCompliance(fieldId);
	return rei?.isActive || false;
}

/**
 * Check if field has active PHI
 */
export async function hasActivePHI(fieldId) {
	const { phi } = await getFieldCompliance(fieldId);
	return phi?.isActive || false;
}

/**
 * Get badge display data for UI
 */
export async function getBadgeData(fieldId) {
	const { rei, phi } = await getFieldCompliance(fieldId);

	return {
		showREI: rei?.isActive || false,
		reiRemaining: rei?.remaining || 0,
		reiEndDate: rei?.endDate || null,
		showPHI: phi?.isActive || false,
		phiRemaining: phi?.remaining || 0,
		phiEndDate: phi?.endDate || null,
	};
}

/**
 * Subscribe to compliance changes.
 * Re-calls callback when spray jobs are added/removed.
 */
export function onComplianceChange(callback) {
	return JobService.on((event, data) => {
		if (event === 'ready') {
			callback();
		}
		// Check both 'type' (new schema) and 'jobType' (old schema)
		if (event === 'change' && (data?.job?.type === 'spray' || data?.job?.jobType === 'spray')) {
			callback();
		}
		if (event === 'sync') {
			callback();
		}
	});
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

/**
 * Format compliance end date for display
 */
export function formatComplianceDate(date) {
	if (!date) return '';
	try {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return '';
	}
}

/**
 * Format remaining time as human-readable string
 */
export function formatRemaining(value, isREI = true) {
	if (!value || value <= 0) return '';

	if (isREI) {
		// REI is in hours
		if (value < 24) return `${value}h`;
		const days = Math.floor(value / 24);
		const hours = value % 24;
		return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	} else {
		// PHI is in days
		return `${value}d`;
	}
}