/**
 * Locale System Constants
 * BCP 47 tags: language-COUNTRY (e.g., 'el-GR', 'en-US')
 */

// Supported locales with their characteristics
export const SUPPORTED_LOCALES = {
  'el-GR': {
    language: 'el',
    country: 'GR',
    displayName: 'Ελληνικά (Ελλάδα)',
    displayNameEnglish: 'Greek (Greece)',
    i18nCode: 'gr', // Maps to existing translation files
    decimalSeparator: ',',
    thousandsSeparator: '.',
    suggestedUnits: {
      area: 'stremma',
      length: 'm',
      volume: 'L',
      mass: 'kg',
    },
  },
  'en-US': {
    language: 'en',
    country: 'US',
    displayName: 'English (US)',
    displayNameEnglish: 'English (US)',
    i18nCode: 'en',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    suggestedUnits: {
      area: 'acres',
      length: 'ft',
      volume: 'gal',
      mass: 'lb',
    },
  },
  'en-GB': {
    language: 'en',
    country: 'GB',
    displayName: 'English (UK)',
    displayNameEnglish: 'English (UK)',
    i18nCode: 'en',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    suggestedUnits: {
      area: 'hectares',
      length: 'm',
      volume: 'L',
      mass: 'kg',
    },
  },
  'en-AU': {
    language: 'en',
    country: 'AU',
    displayName: 'English (Australia)',
    displayNameEnglish: 'English (Australia)',
    i18nCode: 'en',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    suggestedUnits: {
      area: 'hectares',
      length: 'm',
      volume: 'L',
      mass: 'kg',
    },
  },
};

export const DEFAULT_LOCALE = 'en-US';

export const DEFAULT_UNITS = {
  area: 'hectares',
  length: 'm',
  volume: 'L',
  mass: 'kg',
};

/**
 * Extract language code from BCP 47 tag
 * @param {string} locale - e.g., 'el-GR'
 * @returns {string} - e.g., 'el'
 */
export const getLanguage = (locale) => locale?.split('-')[0] || 'en';

/**
 * Extract country code from BCP 47 tag
 * @param {string} locale - e.g., 'el-GR'
 * @returns {string} - e.g., 'GR'
 */
export const getCountry = (locale) => locale?.split('-')[1] || 'US';

/**
 * Get i18n code for translation files (handles 'gr' legacy)
 * @param {string} locale - BCP 47 locale tag
 * @returns {string} - i18n language code
 */
export const getI18nCode = (locale) => {
  return SUPPORTED_LOCALES[locale]?.i18nCode || 'en';
};

/**
 * Get suggested units for a locale (for first-time setup)
 * @param {string} locale - BCP 47 locale tag
 * @returns {object} - suggested unit preferences
 */
export const getSuggestedUnits = (locale) => {
  return SUPPORTED_LOCALES[locale]?.suggestedUnits || DEFAULT_UNITS;
};

/**
 * Countries where phone sign-up is supported.
 * This is separate from SUPPORTED_LOCALES - users can sign up from these countries
 * and then choose any locale for their UI language preference.
 */
export const SUPPORTED_COUNTRIES = [
  { code: 'GR', name: 'Greece', nameLocal: 'Ελλάδα', phonePlaceholder: '6912345678' },
  { code: 'CY', name: 'Cyprus', nameLocal: 'Κύπρος', phonePlaceholder: '91234567' },
];
