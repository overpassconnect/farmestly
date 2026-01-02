/**
 * Parse a nested field path like "products[0].rate" into path segments
 * @param {string} path - The field path (e.g., "products[0].rate", "user.address.city")
 * @returns {Array<string|number>} - Array of path segments
 */
export const parseFieldPath = (path) => {
	if (!path) return [];

	const segments = [];
	// Match either: property name, or [index]
	const regex = /([^[\].]+)|\[(\d+)\]/g;
	let match;

	while ((match = regex.exec(path)) !== null) {
		if (match[1] !== undefined) {
			// Property name
			segments.push(match[1]);
		} else if (match[2] !== undefined) {
			// Array index
			segments.push(parseInt(match[2], 10));
		}
	}

	return segments;
};

/**
 * Get a nested value from an object using a path like "products[0].rate"
 * @param {object} obj - The object to get the value from
 * @param {string} path - The field path
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} - The value at the path
 */
export const getNestedValue = (obj, path, defaultValue = undefined) => {
	if (!obj || !path) return defaultValue;

	// Fast path for simple field names (no dots or brackets)
	if (!path.includes('.') && !path.includes('[')) {
		return obj[path] !== undefined ? obj[path] : defaultValue;
	}

	const segments = parseFieldPath(path);
	let current = obj;

	for (const segment of segments) {
		if (current === null || current === undefined) {
			return defaultValue;
		}
		current = current[segment];
	}

	return current !== undefined ? current : defaultValue;
};

/**
 * Set a nested value in an object using a path like "products[0].rate"
 * Returns a new object (immutable)
 * @param {object} obj - The object to set the value in
 * @param {string} path - The field path
 * @param {*} value - The value to set
 * @returns {object} - A new object with the value set
 */
export const setNestedValue = (obj, path, value) => {
	if (!path) return obj;

	// Fast path for simple field names (no dots or brackets)
	if (!path.includes('.') && !path.includes('[')) {
		return { ...obj, [path]: value };
	}

	const segments = parseFieldPath(path);

	// Recursive helper to create new objects/arrays along the path
	const setAt = (current, idx) => {
		if (idx === segments.length) {
			return value;
		}

		const segment = segments[idx];
		const nextSegment = segments[idx + 1];
		const isNextArray = typeof nextSegment === 'number';

		if (typeof segment === 'number') {
			// Array index
			const arr = Array.isArray(current) ? [...current] : [];
			arr[segment] = setAt(arr[segment] ?? (isNextArray ? [] : {}), idx + 1);
			return arr;
		} else {
			// Object property
			const result = current && typeof current === 'object' ? { ...current } : {};
			result[segment] = setAt(result[segment] ?? (isNextArray ? [] : {}), idx + 1);
			return result;
		}
	};

	return setAt(obj, 0);
};
