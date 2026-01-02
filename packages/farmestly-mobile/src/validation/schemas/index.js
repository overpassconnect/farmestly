/**
 * Validation Schemas Index
 *
 * Central export point for all Yup validation schemas.
 * Import schemas from here for cleaner imports throughout the app.
 *
 * @example
 * import { sprayJobSchema, irrigationJobSchema } from '../validation/schemas';
 */

// Job schemas
export { sprayJobSchema } from './sprayJob';
export { irrigationJobSchema } from './irrigationJob';

// Future schemas can be added here:
// export { sowJobSchema } from './sowJob';
// export { harvestJobSchema } from './harvestJob';
// export { editJobSchema } from './editJob';
// export { customJobSchema } from './customJob';
