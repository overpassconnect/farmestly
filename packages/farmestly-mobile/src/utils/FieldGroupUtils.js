/**
 * Field grouping utilities - functions for automatically generating field groups based on proximity
 */

import { calculateCentroid, calculatePolygonsBounds } from '../components/setup/PolygonDrawingMap/utils';

// Constants for automatic field grouping
const MAX_DISTANCE_THRESHOLD = 0.03; // Maximum distance between fields to be grouped (in degrees)

/**
 * Calculate distance between two points (in degrees)
 * @param {Object} point1 - First point with latitude and longitude properties
 * @param {Object} point2 - Second point with latitude and longitude properties
 * @returns {number} - Distance between points
 */
const calculateDistance = (point1, point2) => {
	const dx = point1.longitude - point2.longitude;
	const dy = point1.latitude - point2.latitude;
	return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate field centroid from points
 * @param {Object} field - Field object with points array
 * @returns {Object} - Centroid coordinates with latitude and longitude
 */
const getFieldCentroid = (field) => {
	return calculateCentroid(field.points);
};

/**
 * Create automatic field groups based on proximity
 * @param {Array} fieldList - Array of field objects
 * @returns {Array} - Array of field groups
 */
const createAutomaticFieldGroups = (fieldList) => {
	if (!fieldList || fieldList.length === 0) return [];

	console.log(`Creating groups for ${fieldList.length} fields`);

	// Calculate centroids for all fields
	const fieldCentroids = fieldList.map(field => ({
		id: field._id,
		field: field,
		centroid: getFieldCentroid(field)
	}));

	// First, create the "All fields" default group
	const groups = [{
		name: 'All fields',
		fieldIds: fieldList.map(field => field._id),
		centroid: calculatePolygonsBounds(fieldList)
	}];

	// Group fields based on proximity using a clustering approach
	const unassignedFields = [...fieldCentroids];
	const clusters = [];

	// Process fields until all are assigned to clusters
	while (unassignedFields.length > 0) {
		// Take the first unassigned field as a seed for a new cluster
		const currentCluster = [unassignedFields.shift()];

		// Find all close fields for this cluster
		let i = 0;
		while (i < unassignedFields.length) {
			let isClose = false;

			// Check if this field is close to ANY field in the current cluster
			for (const clusterField of currentCluster) {
				const distance = calculateDistance(
					clusterField.centroid,
					unassignedFields[i].centroid
				);

				if (distance <= MAX_DISTANCE_THRESHOLD) {
					isClose = true;
					break;
				}
			}

			if (isClose) {
				// Add to cluster and remove from unassigned
				currentCluster.push(unassignedFields[i]);
				unassignedFields.splice(i, 1);
			} else {
				// Move to next field
				i++;
			}
		}

		// Add this cluster to our list
		clusters.push(currentCluster);
	}

	// Convert clusters to groups
	for (let i = 0; i < clusters.length; i++) {
		const cluster = clusters[i];
		const clusterFields = cluster.map(item => item.field);

		// Create a group name based on the number of fields
		let groupName = '';

		if (cluster.length === 1) {
			// For single-field clusters, use the field name
			groupName = `${clusterFields[0].name} Group`;
		} else {
			groupName = `Group ${i + 1}`;
		}

		// Add this group
		groups.push({
			name: groupName,
			fieldIds: cluster.map(item => item.id),
			centroid: calculatePolygonsBounds(clusterFields)
		});
	}

	return groups;
};

export {
	createAutomaticFieldGroups
};