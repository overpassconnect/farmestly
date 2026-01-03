/**
 * Spray Calculations Utility
 * All inputs should be in consistent units (user's preferred area unit)
 */

/**
 * Calculate tank mixing instructions
 *
 * @param {number} params.fieldArea - Field area in user's preferred unit
 * @param {number} params.tankCapacity - Tank capacity in liters
 * @param {number} params.carrierRate - Carrier rate in L per user's area unit
 * @param {Array} params.products - Products with {rate, isVolume} in user's area unit
 */
export const calculateSprayMixing = ({ fieldArea, tankCapacity, carrierRate, products }) => {
	if (!fieldArea || fieldArea <= 0) throw new Error('Field area must be greater than 0');
	if (!tankCapacity || tankCapacity <= 0) throw new Error('Tank capacity must be greater than 0');
	if (!carrierRate || carrierRate <= 0) throw new Error('Carrier rate must be greater than 0');
	if (!products || !Array.isArray(products)) throw new Error('Products must be an array');

	// Area covered per tank (in user's area unit)
	const areaPerTank = tankCapacity / carrierRate;
	const tanksRequired = Math.ceil(fieldArea / areaPerTank);

	const tanks = [];
	let remainingArea = fieldArea;

	for (let tankNum = 1; tankNum <= tanksRequired; tankNum++) {
		const areaThisTank = Math.min(areaPerTank, remainingArea);
		const fillRatio = areaThisTank / areaPerTank;

		const tankProducts = products.map(product => {
			const volumeOrMass = product.rate * areaThisTank;

			return {
				productId: product.productId,
				name: product.name,
				volume: volumeOrMass,
				isVolume: product.isVolume
			};
		});

		// Calculate total product volume (assume 1kg ≈ 1L for solids)
		const totalProductVolume = tankProducts.reduce((sum, p) => sum + p.volume, 0);
		const waterVolume = (tankCapacity * fillRatio) - totalProductVolume;

		tanks.push({
			tankNumber: tankNum,
			isFull: fillRatio >= 0.99,
			fillRatio,
			areaCovered: areaThisTank,
			waterVolume,
			products: tankProducts,
			totalVolume: tankCapacity * fillRatio
		});

		remainingArea -= areaThisTank;
	}

	const totalQuantities = products.map(product => {
		const totalVolume = product.rate * fieldArea;
		return {
			productId: product.productId,
			name: product.name,
			totalVolume,
			isVolume: product.isVolume
		};
	});

	const totalWater = tanks.reduce((sum, t) => sum + t.waterVolume, 0);

	return {
		fieldArea,
		tankCapacity,
		carrierRate,
		areaPerTank,
		tanksRequired,
		tanks,
		totalQuantities,
		totalWater
	};
};

export const calculateComplianceDates = (products) => {
	const now = new Date();
	let maxREI = 0;
	let maxPHI = 0;

	products.forEach(p => {
		if (p.rei && p.rei > maxREI) maxREI = p.rei;
		if (p.phi && p.phi > maxPHI) maxPHI = p.phi;
	});

	// Return ISO strings instead of Date objects to ensure serializability for navigation params
	const reentryDate = maxREI > 0 ? new Date(now.getTime() + maxREI * 60 * 60 * 1000).toISOString() : null;
	const harvestDate = maxPHI > 0 ? new Date(now.getTime() + maxPHI * 24 * 60 * 60 * 1000).toISOString() : null;

	return { maxREI, maxPHI, reentryDate, harvestDate };
};

export const formatVolume = (volume, decimals = 2) => {
	if (volume == null || isNaN(volume)) return '—';
	return volume.toFixed(decimals);
};