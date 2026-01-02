/**
 * Validation Module Index
 *
 * Central export point for validation utilities and schemas.
 *
 * @example
 * // Import schemas
 * import { sprayJobSchema, irrigationJobSchema } from '../validation';
 *
 * // Import helpers
 * import { positiveNumberString, requiredSelection } from '../validation';
 *
 * // Or import everything
 * import * as validation from '../validation';
 */

// Re-export all schemas
export * from './schemas';

// Re-export all helpers
export * from './helpers';
