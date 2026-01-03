/**
 * Locale Parser Singleton
 * Wraps @internationalized/number for locale-aware number parsing/formatting
 *
 * IMPORTANT: This is a singleton that works OUTSIDE React context
 * Used by Yup validation, utility functions, etc.
 */
import { NumberParser, NumberFormatter } from '@internationalized/number';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './constants';

class LocaleParser {
  constructor() {
    this._locale = DEFAULT_LOCALE;
    this._numberParser = null;
    this._numberFormatter = null;
    this._initFormatters();
  }

  _initFormatters() {
    // NumberParser for parsing localized input strings to numbers
    this._numberParser = new NumberParser(this._locale, { style: 'decimal' });

    // NumberFormatter for formatting numbers to localized strings
    this._numberFormatter = new NumberFormatter(this._locale, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  }

  /**
   * Set the active locale (called by LocaleProvider on mount/change)
   * @param {string} locale - BCP 47 locale tag
   */
  setLocale(locale) {
    if (locale !== this._locale && SUPPORTED_LOCALES[locale]) {
      this._locale = locale;
      this._initFormatters();
    }
  }

  /**
   * Get current locale
   * @returns {string} Current BCP 47 locale tag
   */
  getLocale() {
    return this._locale;
  }

  /**
   * Parse a localized string to a JavaScript number
   * e.g., "1.234,56" (el-GR) -> 1234.56
   * @param {string|number} value - Localized number string
   * @returns {number} Parsed number or NaN if parsing fails
   */
  parse(value) {
    if (value === null || value === undefined || value === '') {
      return NaN;
    }

    // If already a number, return it
    if (typeof value === 'number') {
      return value;
    }

    const str = String(value).trim();
    if (str === '') return NaN;

    try {
      return this._numberParser.parse(str);
    } catch (e) {
      return NaN;
    }
  }

  /**
   * Format a JavaScript number to a localized string
   * e.g., 1234.56 -> "1.234,56" (el-GR)
   * @param {number} value - JavaScript number
   * @param {object} options - Formatting options
   * @param {number} options.minDecimals - Minimum fraction digits
   * @param {number} options.maxDecimals - Maximum fraction digits
   * @returns {string} Localized number string
   */
  format(value, options = {}) {
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    const formatter = new NumberFormatter(this._locale, {
      style: 'decimal',
      minimumFractionDigits: options.minDecimals ?? 0,
      maximumFractionDigits: options.maxDecimals ?? 4,
      ...options,
    });

    return formatter.format(value);
  }

  /**
   * Check if a partial input string is valid for the current locale
   * Used during typing to allow intermediate states like "123," or "1.234"
   * @param {string} value - Partial input string
   * @returns {boolean} True if the string could become a valid number
   */
  isValidPartial(value) {
    if (!value || value === '') return true;

    const str = String(value).trim();
    if (str === '') return true;

    const config = SUPPORTED_LOCALES[this._locale];
    const decimal = config?.decimalSeparator || '.';
    const thousands = config?.thousandsSeparator || ',';

    // Allow: digits, one decimal separator, thousands separators, leading minus
    const validChars = new RegExp(
      `^-?[0-9${this._escapeRegex(thousands)}]*[${this._escapeRegex(decimal)}]?[0-9]*$`
    );

    if (!validChars.test(str)) return false;

    // Don't allow multiple decimal separators
    const decimalCount = (
      str.match(new RegExp(this._escapeRegex(decimal), 'g')) || []
    ).length;
    return decimalCount <= 1;
  }

  /**
   * Escape special regex characters
   * @private
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Format a date to a localized string
   * @param {Date|string} date - Date object or ISO string
   * @param {object} options - Intl.DateTimeFormat options
   * @returns {string} Localized date string
   */
  formatDate(date, options = {}) {
    if (!date) return 'N/A';

    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return 'N/A';

      return d.toLocaleDateString(this._locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
      });
    } catch (e) {
      return 'N/A';
    }
  }

  /**
   * Format a date and time to a localized string
   * @param {Date|string} date - Date object or ISO string
   * @param {object} options - Intl.DateTimeFormat options
   * @returns {string} Localized date and time string
   */
  formatDateTime(date, options = {}) {
    if (!date) return 'N/A';

    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return 'N/A';

      return d.toLocaleString(this._locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
      });
    } catch (e) {
      return 'N/A';
    }
  }

  /**
   * Format a time to a localized string
   * @param {Date|string} date - Date object or ISO string
   * @param {object} options - Intl.DateTimeFormat options
   * @returns {string} Localized time string
   */
  formatTime(date, options = {}) {
    if (!date) return 'N/A';

    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return 'N/A';

      return d.toLocaleTimeString(this._locale, {
        hour: '2-digit',
        minute: '2-digit',
        ...options,
      });
    } catch (e) {
      return 'N/A';
    }
  }

  /**
   * Get locale metadata
   * @returns {object} Locale configuration
   */
  getLocaleConfig() {
    return SUPPORTED_LOCALES[this._locale] || SUPPORTED_LOCALES[DEFAULT_LOCALE];
  }

  /**
   * Get the decimal separator for current locale
   * @returns {string} Decimal separator character
   */
  getDecimalSeparator() {
    return this.getLocaleConfig().decimalSeparator;
  }

  /**
   * Get the thousands separator for current locale
   * @returns {string} Thousands separator character
   */
  getThousandsSeparator() {
    return this.getLocaleConfig().thousandsSeparator;
  }
}

// Export singleton instance
export const localeParser = new LocaleParser();

// Export class for testing
export { LocaleParser };
