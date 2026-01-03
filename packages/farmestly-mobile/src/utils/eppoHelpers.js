/**
 * EPPO Helpers
 *
 * Utility functions for working with EPPO (European and Mediterranean
 * Plant Protection Organization) data.
 */
import { getLanguage } from '../globals/locale/constants';


/**
 * Get EPPO-compatible language code from user's locale or language.
 * Handles both new BCP 47 locales (el-GR) and legacy i18n codes (gr).
 *
 * @param {string} localeOrLang - Either a BCP 47 locale or legacy language code
 * @returns {string} EPPO-compatible language code
 */
export const getEppoLanguage = (localeOrLang) => {
	// If it's a BCP 47 locale (contains hyphen), extract language
	if (localeOrLang && localeOrLang.includes('-')) {
		return getLanguage(localeOrLang);
	}
	// Legacy language code - use map for backwards compatibility
	return EPPO_LANG_MAP[localeOrLang] || localeOrLang || 'en';
};

/**
 * Transform string to Title Case (e.g., "COMMON WHEAT" -> "Common Wheat")
 * Works with any Unicode script (Greek, Cyrillic, etc.)
 */
export const toTitleCase = (str) => {
	if (!str) return '';
	// Split by spaces and capitalize first letter of each word
	return str
		.toLowerCase()
		.split(' ')
		.map(word => {
			if (word.length === 0) return word;
			// Use spread to handle Unicode characters properly
			const chars = [...word];
			return chars[0].toUpperCase() + chars.slice(1).join('');
		})
		.join(' ');
};

/**
 * Get the best fullname from EPPO search results based on user's language preference.
 * The API returns flat objects where each result has a single lang/fullname.
 * Multiple results can have the same eppocode but different languages.
 *
 * Priority: user's language > English > Latin (la) > first available
 *
 * @param {Array} results - Array of EPPO search results
 * @param {string} eppocode - The EPPO code to find the name for
 * @param {string} userLang - User's app language code (e.g., 'en', 'gr')
 * @returns {string} The best fullname found
 */
export const getBestFullnameFromResults = (results, eppocode, userLang) => {
	if (!results || !Array.isArray(results) || !eppocode) return '';

	const eppoLang = getEppoLanguage(userLang);

	// Filter to only results matching this eppocode
	const matchingResults = results.filter(r => r.eppocode === eppocode);

	if (matchingResults.length === 0) return '';

	// Try user's language first
	const userLangResult = matchingResults.find(r => r.lang === eppoLang);
	if (userLangResult?.fullname) return userLangResult.fullname;

	// Fallback to English
	const englishResult = matchingResults.find(r => r.lang === 'en');
	if (englishResult?.fullname) return englishResult.fullname;

	// Fallback to Latin (scientific name)
	const latinResult = matchingResults.find(r => r.lang === 'la');
	if (latinResult?.fullname) return latinResult.fullname;

	// Fallback to first available
	return matchingResults[0]?.fullname || '';
};

/**
 * Get the best fullname from a single EPPO item.
 * Used when we only have one result item (not the full results array).
 * Falls back to the item's own fullname since we can't check other languages.
 *
 * @param {object} item - Single EPPO result item
 * @param {string} userLang - User's app language code
 * @returns {string} The fullname (may not be in preferred language)
 */
export const getItemFullname = (item, userLang) => {
	if (!item) return '';
	return item.fullname || item.preferred || '';
};

/**
 * Deduplicate EPPO results by eppocode, keeping the best language match.
 *
 * @param {Array} results - Array of EPPO search results
 * @param {string} userLang - User's app language code
 * @returns {Array} Deduplicated results with best fullname for each eppocode
 */
export const deduplicateEppoResults = (results, userLang) => {
	if (!results || !Array.isArray(results)) return [];

	const eppoLang = getEppoLanguage(userLang);
	const seen = new Map();

	// First pass: collect all items by eppocode
	for (const item of results) {
		const code = item.eppocode;
		if (!seen.has(code)) {
			seen.set(code, []);
		}
		seen.get(code).push(item);
	}

	// Second pass: pick best item for each eppocode
	const deduplicated = [];
	for (const [code, items] of seen) {
		// Priority: user's language > English > Latin > first
		let best = items.find(r => r.lang === eppoLang)
			|| items.find(r => r.lang === 'en')
			|| items.find(r => r.lang === 'la')
			|| items[0];

		// Create a new item with the best fullname
		deduplicated.push({
			...best,
			// Store original fullname in case needed
			_originalFullname: best.fullname,
		});
	}

	return deduplicated;
};
