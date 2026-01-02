import { Dimensions } from "react-native";

const calculatePolygonsBounds = (polygons) => {
	// console.log('HHHHHHHHHHHHHHHHH', polygons)
	// Initialize bounds with first coordinate of first polygon
	let minLat = Infinity;
	let maxLat = -Infinity;
	let minLng = Infinity;
	let maxLng = -Infinity;

	// Iterate through all polygons
	polygons.forEach(polygon => {
		// Each polygon is an array of coordinate arrays
		polygon.points.forEach(coord => {
			const { latitude, longitude } = coord;
			minLat = Math.min(minLat, latitude);
			maxLat = Math.max(maxLat, latitude);
			minLng = Math.min(minLng, longitude);
			maxLng = Math.max(maxLng, longitude);
		});
	});

	// Calculate center point
	const centerLat = (minLat + maxLat) / 2;
	const centerLng = (minLng + maxLng) / 2;

	// Calculate deltas
	const latDelta = (maxLat - minLat);
	const lngDelta = (maxLng - minLng);

	// Ensure the aspect ratio matches the screen
	const { width, height } = Dimensions.get('window');
	const aspectRatio = width / height;

	// Adjust deltas to maintain aspect ratio
	if (lngDelta / latDelta > aspectRatio) {
		// Width is the limiting factor
		const newLatDelta = lngDelta / aspectRatio;
		return {
			latitude: centerLat,
			longitude: centerLng,
			latitudeDelta: newLatDelta,
			longitudeDelta: lngDelta,
		};
	} else {
		// Height is the limiting factor
		const newLngDelta = latDelta * aspectRatio;
		return {
			latitude: centerLat,
			longitude: centerLng,
			latitudeDelta: latDelta,
			longitudeDelta: newLngDelta,
		};
	}
};

const calculateCentroid = (points, withDeltas) => {
	let centroid = {};
	// let aspectRatio;



	if (points.length === 0) {
		centroid = { latitude: 0, longitude: 0 };
		if (withDeltas === true) {
			centroid = { ...centroid, latitudeDelta: 0, longitudeDelta: 0 }
			// aspectRatio = Dimensions.get('window').width / Dimensions.get('window').height;
		}
	}

	const sum = points.reduce((acc, point) => ({
		latitude: acc.latitude + point.latitude,
		longitude: acc.longitude + point.longitude
	}), { latitude: 0, longitude: 0 });

	centroid = {
		latitude: sum.latitude / points.length,
		longitude: sum.longitude / points.length
	};
	if (withDeltas === true) {
		const latDelta = centroid.latitude * 0.7;
		const lngDelta = centroid.longitude * 0.7;

		// Ensure the aspect ratio matches the screen
		const { width, height } = Dimensions.get('window');
		const aspectRatio = width / height;

		// Adjust deltas to maintain aspect ratio
		if (lngDelta / latDelta > aspectRatio) {
			// Width is the limiting factor
			const newLatDelta = lngDelta / aspectRatio;
			centroid = {
				...centroid,
				latitudeDelta: newLatDelta,
				longitudeDelta: lngDelta
			}
		} else {
			// Height is the limiting factor
			const newLngDelta = latDelta * aspectRatio;
			centroid = {
				...centroid,
				latitudeDelta: latDelta / 8000,
				longitudeDelta: newLngDelta / 8000,
			};
		}
	}
	return centroid;
}

// Helper function to calculate distance from point to line segment
const distanceToLineSegment = (point, start, end) => {
	const A = point.longitude - start.longitude;
	const B = point.latitude - start.latitude;
	const C = end.longitude - start.longitude;
	const D = end.latitude - start.latitude;

	const dot = A * C + B * D;
	const lenSq = C * C + D * D;
	let param = -1;

	if (lenSq !== 0) param = dot / lenSq;

	let xx, yy;

	if (param < 0) {
		xx = start.longitude;
		yy = start.latitude;
	} else if (param > 1) {
		xx = end.longitude;
		yy = end.latitude;
	} else {
		xx = start.longitude + param * C;
		yy = start.latitude + param * D;
	}

	const dx = point.longitude - xx;
	const dy = point.latitude - yy;

	return Math.sqrt(dx * dx + dy * dy);
};


const isPointInPolygonWithBuffer = (point, polygonPoints, buffer = 0.0001) => {
	// return true
	const bounds = polygonPoints.reduce((acc, coord) => ({
		minLat: Math.min(acc.minLat, coord.latitude),
		maxLat: Math.max(acc.maxLat, coord.latitude),
		minLng: Math.min(acc.minLng, coord.longitude),
		maxLng: Math.max(acc.maxLng, coord.longitude)
	}), {
		minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity
	});

	if (point.latitude < bounds.minLat - buffer || point.latitude > bounds.maxLat + buffer ||
		point.longitude < bounds.minLng - buffer || point.longitude > bounds.maxLng + buffer) {
		return false;
	}

	let inside = false;
	for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
		const distToSegment = distanceToLineSegment(point, polygonPoints[i], polygonPoints[j]);
		if (distToSegment < buffer) return true;

		const intersect = ((polygonPoints[i].latitude > point.latitude) !== (polygonPoints[j].latitude > point.latitude)) &&
			(point.longitude < (polygonPoints[j].longitude - polygonPoints[i].longitude) *
				(point.latitude - polygonPoints[i].latitude) / (polygonPoints[j].latitude - polygonPoints[i].latitude) +
				polygonPoints[i].longitude);
		if (intersect) inside = !inside;
	}
	return inside;
}
export { calculateCentroid, calculatePolygonsBounds, distanceToLineSegment, isPointInPolygonWithBuffer };