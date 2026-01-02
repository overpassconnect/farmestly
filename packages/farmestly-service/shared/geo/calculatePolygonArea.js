function calculatePolygonArea(coordinates) {
    // Validate input
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
        throw new Error('Input must be an array of at least 3 coordinates');
    }

    if (!coordinates.every(coord =>
        typeof coord === 'object' &&
        'latitude' in coord &&
        'longitude' in coord &&
        typeof coord.latitude === 'number' &&
        typeof coord.longitude === 'number')) {
        throw new Error('Each coordinate must be an object with numeric latitude and longitude properties');
    }

    // Ensure the polygon is closed (first point equals last point)
    if (coordinates[0].latitude !== coordinates[coordinates.length - 1].latitude ||
        coordinates[0].longitude !== coordinates[coordinates.length - 1].longitude) {
        coordinates = [...coordinates, coordinates[0]];
    }

    // Earth's radius in meters
    const R = 6371000;

    // Convert coordinates to radians
    const coordsInRadians = coordinates.map(coord => ({
        lon: (coord.longitude * Math.PI) / 180,
        lat: (coord.latitude * Math.PI) / 180
    }));

    let area = 0;

    // Calculate area using Shoelace formula
    for (let i = 0; i < coordsInRadians.length - 1; i++) {
        const coord1 = coordsInRadians[i];
        const coord2 = coordsInRadians[i + 1];

        // Calculate the area contribution of this vertex pair
        area += coord1.lon * Math.sin(coord2.lat) - coord2.lon * Math.sin(coord1.lat);
    }

    // Complete the calculation and convert to square meters
    area = Math.abs(area * R * R / 2);

    return area;
}


module.exports = calculatePolygonArea;