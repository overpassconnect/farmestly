/**
 * Sow Job Validation Schema
 *
 * Validates sow job form fields including crop name, variety,
 * EPPO code, lot number, and seed manufacturer.
 */
import * as Yup from 'yup';

/**
 * Main sow job validation schema
 *
 * Fields:
 * - crop: Required crop name
 * - variety: Optional variety name
 * - eppoCode: Optional EPPO code (5-6 uppercase characters if provided)
 * - lotNumber: Optional lot number
 * - seedManufacturer: Optional seed manufacturer
 */
export const sowJobSchema = Yup.object().shape({
	crop: Yup.string()
		.trim()
		.required('sow.cropRequired'),
	variety: Yup.string()
		.trim()
		.nullable(),
	eppoCode: Yup.string()
		.nullable()
		.test('eppo-format', 'sow.eppoCodeInvalid', value => {
			if (!value || value === '') return true;
			// EPPO codes are 5-6 uppercase alphanumeric characters
			return /^[A-Z0-9]{5,6}$/.test(value);
		}),
	lotNumber: Yup.string()
		.trim()
		.nullable(),
	seedManufacturer: Yup.string()
		.nullable(),
});

export default sowJobSchema;
