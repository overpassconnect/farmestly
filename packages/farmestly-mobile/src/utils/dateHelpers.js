/**
 * Shared date and time formatting utilities
 * Centralizes all date/time formatting logic to avoid duplication across components
 *
 * NOTE: These functions now use the localeParser singleton for locale-aware formatting.
 * For React components, prefer using useLocale().formatDate() from LocaleProvider.
 */
import { localeParser } from '../globals/locale/parser';

/**
 * Format a date string or Date object to a readable date format.
 * Uses the current locale from localeParser singleton.
 *
 * @param {string|Date} dateString - The date to format
 * @param {object} options - Additional Intl.DateTimeFormat options
 * @returns {string} Formatted date string or 'N/A' if invalid
 */
export const formatDate = (dateString, options = {}) => {
	return localeParser.formatDate(dateString, options);
};

/**
 * Format a date string to include both date and time.
 * Uses the current locale from localeParser singleton.
 *
 * @param {string|Date} dateString - The date to format
 * @param {object} options - Additional Intl.DateTimeFormat options
 * @returns {string} Formatted date-time string or 'N/A' if invalid
 */
export const formatDateTime = (dateString, options = {}) => {
	return localeParser.formatDateTime(dateString, options);
};

/**
 * Format a time from a date string or Date object.
 * Uses the current locale from localeParser singleton.
 *
 * @param {string|Date} dateString - The date to format
 * @param {object} options - Additional Intl.DateTimeFormat options
 * @returns {string} Formatted time string or 'N/A' if invalid
 */
export const formatTime = (dateString, options = {}) => {
	return localeParser.formatTime(dateString, options);
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
