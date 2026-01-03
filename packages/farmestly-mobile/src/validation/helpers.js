/**
 * Validation Helpers
 *
 * Custom Yup validators that aren't provided out of the box.
 */
import * as Yup from 'yup';

/**
 * Yup string schema that validates as a positive number.
 *
 * Needed because TextInput stores values as strings, but we need to validate
 * they represent positive numbers. Yup.number() would coerce the type.
 */
export const positiveNumberString = (requiredMessage, invalidMessage) =>
	Yup.string()
		.required(requiredMessage)
		.test('is-positive-number', invalidMessage, value => {
			const num = parseFloat(value);
			return !isNaN(num) && num > 0;
		});
