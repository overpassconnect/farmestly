/**
 * Shared date and time formatting utilities
 * Centralizes all date/time formatting logic to avoid duplication across components
 */

/**
 * Format a date string or Date object to a readable date format
 * @param {string|Date} dateString - The date to format
 * @param {object} options - Additional Intl.DateTimeFormat options
 * @returns {string} Formatted date string or 'N/A' if invalid
 */
export const formatDate = (dateString, options = {}) => {
	if (!dateString) return 'N/A';

	try {
		const date = dateString instanceof Date ? dateString : new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			...options
		});
	} catch (error) {
		return 'N/A';
	}
};

/**
 * Format a date string to include both date and time
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date-time string or 'N/A' if invalid
 */
export const formatDateTime = (dateString) => {
	if (!dateString) return 'N/A';

	try {
		const date = dateString instanceof Date ? dateString : new Date(dateString);
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch (error) {
		return 'N/A';
	}
};

/**
 * Format a duration in milliseconds to a human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2h 30m" or "45m")
 */
export const formatDuration = (ms) => {
	if (!ms || ms < 0) return 'N/A';

	const hours = Math.floor(ms / 3600000);
	const minutes = Math.floor((ms % 3600000) / 60000);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
};

/**
 * Calculate duration between two dates in milliseconds
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Duration in milliseconds
 */
export const calculateDuration = (startDate, endDate) => {
	if (!startDate || !endDate) return 0;

	try {
		const start = startDate instanceof Date ? startDate : new Date(startDate);
		const end = endDate instanceof Date ? endDate : new Date(endDate);
		return end.getTime() - start.getTime();
	} catch (error) {
		return 0;
	}
};
