/**
 * Spray Job Validation Schema
 *
 * Validates spray job form fields including sprayer selection, carrier rate,
 * and product configuration.
 *
 * Note: carrierRate and product rates are validated as strings with custom tests
 * because FormInput stores string values from TextInput. Converting to number
 * in the schema would cause type coercion issues.
 */
import * as Yup from 'yup';
import { positiveNumberString } from '../helpers';

/**
 * Schema for individual spray product entries
 */
const sprayProductSchema = Yup.object().shape({
	productId: Yup.string().required('spray.productIdRequired'),
	name: Yup.string().required(),
	rate: positiveNumberString('spray.productRateRequired', 'spray.productRateInvalid'),
	isVolume: Yup.boolean(),
	rei: Yup.number().nullable(),
	phi: Yup.number().nullable(),
});

/**
 * Main spray job validation schema
 *
 * Fields:
 * - sprayer: Selected sprayer object (machine or attachment with tank)
 * - sprayerType: 'machine' or 'attachment'
 * - carrierRate: Water/carrier rate as string (e.g., "200" for 200 L/ha)
 * - products: Array of products with rates
 */
export const sprayJobSchema = Yup.object().shape({
	sprayer: Yup.object().nullable().required('spray.sprayerRequired'),
	sprayerType: Yup.string()
		.oneOf(['machine', 'attachment'], 'spray.sprayerTypeInvalid')
		.required('spray.sprayerTypeRequired'),
	carrierRate: positiveNumberString('spray.carrierRateRequired', 'spray.carrierRateInvalid'),
	products: Yup.array()
		.min(1, 'spray.productsEmpty')
		.of(sprayProductSchema),
});

export default sprayJobSchema;
