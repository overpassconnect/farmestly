/**
 * Irrigation Job Validation Schema
 *
 * Validates irrigation job form fields.
 * Currently requires only irrigator selection, but structured for future expansion
 * (e.g., target water amount, duration estimates).
 */
import * as Yup from 'yup';

/**
 * Irrigation job validation schema
 *
 * Fields:
 * - irrigatorId: Selected irrigator attachment ID
 */
export const irrigationJobSchema = Yup.object().shape({
	irrigatorId: Yup.string().required('irrigation.irrigatorRequired'),
});

export default irrigationJobSchema;
