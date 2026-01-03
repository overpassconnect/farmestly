/**
 * Locale-Aware Validation Helpers
 *
 * Yup validators that use the localeParser singleton for locale-aware
 * number parsing. These work with FormInput numeric={true} which stores
 * JS numbers in form state.
 */
import * as Yup from 'yup';
import { localeParser } from '../globals/locale/parser';

/**
 * Yup number schema for positive numbers.
 * Use with FormInput numeric={true} which stores JS numbers.
 *
 * @param {string} requiredMessage - Translation key for required error
 * @param {string} invalidMessage - Translation key for invalid/not positive error
 */
export const positiveNumber = (requiredMessage, invalidMessage) =>
  Yup.number()
    .required(requiredMessage)
    .positive(invalidMessage)
    .typeError(invalidMessage);

/**
 * Optional positive number (can be null/empty).
 * Use with FormInput numeric={true}.
 *
 * @param {string} invalidMessage - Translation key for invalid/not positive error
 */
export const optionalPositiveNumber = (invalidMessage) =>
  Yup.number()
    .positive(invalidMessage)
    .nullable()
    .transform((value, originalValue) =>
      originalValue === '' || originalValue === null ? null : value
    );

/**
 * Yup number schema for non-negative numbers (zero or greater).
 * Use with FormInput numeric={true}.
 *
 * @param {string} requiredMessage - Translation key for required error
 * @param {string} invalidMessage - Translation key for invalid/negative error
 */
export const nonNegativeNumber = (requiredMessage, invalidMessage) =>
  Yup.number()
    .required(requiredMessage)
    .min(0, invalidMessage)
    .typeError(invalidMessage);

/**
 * Optional non-negative number (can be null/empty, but if provided must be >= 0).
 *
 * @param {string} invalidMessage - Translation key for invalid/negative error
 */
export const optionalNonNegativeNumber = (invalidMessage) =>
  Yup.number()
    .min(0, invalidMessage)
    .nullable()
    .transform((value, originalValue) =>
      originalValue === '' || originalValue === null ? null : value
    );

/**
 * Legacy string-based positive number validator.
 * Parses using locale settings for backwards compatibility.
 *
 * @deprecated Use positiveNumber() with FormInput numeric={true} instead
 * @param {string} requiredMessage - Translation key for required error
 * @param {string} invalidMessage - Translation key for invalid error
 */
export const positiveNumberString = (requiredMessage, invalidMessage) =>
  Yup.string()
    .required(requiredMessage)
    .test('is-positive-number', invalidMessage, (value) => {
      if (!value) return false;
      const num = localeParser.parse(value);
      return !isNaN(num) && num > 0;
    });

/**
 * Legacy string-based optional positive number validator.
 *
 * @deprecated Use optionalPositiveNumber() with FormInput numeric={true} instead
 * @param {string} invalidMessage - Translation key for invalid error
 */
export const optionalPositiveNumberString = (invalidMessage) =>
  Yup.string()
    .nullable()
    .test('is-positive-number-or-empty', invalidMessage, (value) => {
      if (!value || value.trim() === '') return true;
      const num = localeParser.parse(value);
      return !isNaN(num) && num > 0;
    });
