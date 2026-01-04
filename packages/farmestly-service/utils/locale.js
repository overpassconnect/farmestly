// utils/locale.js
// Locale utilities for BCP 47 locale handling

/**
 * Map of country codes to BCP 47 locale tags.
 * Used for deriving locale from phone country codes during registration.
 */
const COUNTRY_TO_LOCALE = {
	'GR': 'el-GR',
	'US': 'en-US',
	'GB': 'en-GB',
	'DE': 'de-DE',
	'FR': 'fr-FR',
	'ES': 'es-ES',
	'IT': 'it-IT',
	'PT': 'pt-PT',
	'NL': 'nl-NL',
	'PL': 'pl-PL',
	'RO': 'ro-RO',
	'BG': 'bg-BG',
	'AT': 'de-AT',
	'CH': 'de-CH',
	'BE': 'fr-BE',
	'IE': 'en-IE',
	'CY': 'el-CY',
	'AU': 'en-AU',
	'NZ': 'en-NZ',
	'CA': 'en-CA',
};

const DEFAULT_LOCALE = 'en-US';

/**
 * Derive a BCP 47 locale tag from a country code.
 * Falls back to 'en-US' if country is unknown.
 *
 * @param {string} countryCode - Two-letter country code (e.g., 'GR', 'US')
 * @returns {string} - BCP 47 locale tag
 */
function deriveLocaleFromCountry(countryCode) {
	if (!countryCode || typeof countryCode !== 'string') {
		return DEFAULT_LOCALE;
	}
	return COUNTRY_TO_LOCALE[countryCode.toUpperCase()] || DEFAULT_LOCALE;
}

/**
 * Extract language code from a BCP 47 locale tag.
 * E.g., 'el-GR' -> 'el', 'en-US' -> 'en'
 *
 * @param {string} locale - BCP 47 locale tag
 * @returns {string} - Two-letter language code
 */
function getLanguageFromLocale(locale) {
	if (!locale || typeof locale !== 'string') {
		return 'en';
	}
	return locale.split('-')[0] || 'en';
}

/**
 * Get the locale for an account, with fallback logic.
 * Priority: metadata.locale > derive from metadata.country > 'en-US'
 *
 * @param {object} account - Account document
 * @returns {string} - BCP 47 locale tag
 */
function getAccountLocale(account) {
	if (!account || !account.metadata) {
		return DEFAULT_LOCALE;
	}
	if (account.metadata.locale) {
		return account.metadata.locale;
	}
	if (account.metadata.country) {
		return deriveLocaleFromCountry(account.metadata.country);
	}
	return DEFAULT_LOCALE;
}

module.exports = {
	COUNTRY_TO_LOCALE,
	DEFAULT_LOCALE,
	deriveLocaleFromCountry,
	getLanguageFromLocale,
	getAccountLocale,
};
