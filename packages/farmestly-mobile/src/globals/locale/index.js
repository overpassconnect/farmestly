/**
 * Locale Module Exports
 */
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_UNITS,
  SUPPORTED_COUNTRIES,
  getLanguage,
  getCountry,
  getI18nCode,
  getSuggestedUnits,
} from './constants';

export {
  getDeviceLocale,
  getDeviceCountry,
} from './deviceLocale';

export { localeParser, LocaleParser } from './parser';
