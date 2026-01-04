/**
 * Validation Helpers
 *
 * Custom Yup validators that aren't provided out of the box.
 *
 * @deprecated For new code, use validators from './localeHelpers.js' with
 * FormInput numeric={true} for locale-aware number handling.
 */
import * as Yup from 'yup';
import { localeParser } from '../globals/locale/parser';

/**
 * Yup string schema that validates as a positive number.
 * Now uses locale-aware parsing for internationalization.
 *
 * @deprecated Use positiveNumber() from './localeHelpers.js' with FormInput numeric={true}
 */
export const positiveNumberString = (requiredMessage, invalidMessage) =>
	Yup.string()
		.required(requiredMessage)
		.test('is-positive-number', invalidMessage, value => {
			const num = localeParser.parse(value);
			return !isNaN(num) && num > 0;
		});

// Re-export new validators for convenience
export {
	positiveNumber,
	optionalPositiveNumber,
	nonNegativeNumber,
	optionalNonNegativeNumber,
} from './localeHelpers';
