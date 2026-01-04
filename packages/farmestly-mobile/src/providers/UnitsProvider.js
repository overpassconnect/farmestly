// UnitsProvider.js
import React, { createContext, useContext, useCallback } from 'react';
import { unit, createUnit } from 'mathjs';

// Define stremma as a custom unit (1 stremma = 1000 m² = 0.1 ha)
createUnit('stremma', '1000 m^2');

// Map preference keys to mathjs unit names
const UNIT_MAP = {
	area: { m2: 'm^2', hectares: 'hectare', acres: 'acre', stremma: 'stremma' },
	length: { m: 'm', ft: 'ft', yd: 'yard' },
	volume: { L: 'L', mL: 'mL', gal: 'gallon' },
	mass: { kg: 'kg', g: 'g', lb: 'lb' },
};

const SYMBOLS = {
	area: { m2: 'm²', hectares: 'ha', acres: 'ac', stremma: 'στρ' },
	length: { m: 'm', ft: 'ft', yd: 'yd' },
	volume: { L: 'L', mL: 'mL', gal: 'gal' },
	mass: { kg: 'kg', g: 'g', lb: 'lb' },
	time: 'h',  // Always display in hours
};

const DEFAULTS = { area: 'hectares', length: 'm', volume: 'L', mass: 'kg' };

const UnitsContext = createContext(null);

export const UnitsProvider = ({ children, preferences = {}, onPreferenceChange }) => {
	const prefs = { ...DEFAULTS, ...preferences };

	// Get mathjs unit string for a category
	const getUnit = useCallback((category) => {
		return UNIT_MAP[category][prefs[category]];
	}, [prefs]);

	// ============ SIMPLE VALUES ============

	const parse = useCallback((value, category) => {
		const num = parseFloat(value);
		if (isNaN(num)) return null;

		// Special handling for time: convert hours to seconds
		if (category === 'time') {
			return Math.round(num * 3600);
		}

		return unit(num, getUnit(category)).to(UNIT_MAP[category].m2 ? 'm^2' :
			category === 'length' ? 'm' :
				category === 'volume' ? 'L' : 'kg').toNumber();
	}, [getUnit]);

	const formatValue = useCallback((value, category, decimals = 2) => {
		if (value == null || isNaN(value)) return null;

		// Special handling for time: convert seconds to hours
		if (category === 'time') {
			return parseFloat((value / 3600).toFixed(decimals));
		}

		const baseUnit = category === 'area' ? 'm^2' :
			category === 'length' ? 'm' :
				category === 'volume' ? 'L' : 'kg';
		return parseFloat(unit(value, baseUnit).to(getUnit(category)).toNumber().toFixed(decimals));
	}, [getUnit]);

	const format = useCallback((value, category, decimals = 2) => {
		const converted = formatValue(value, category, decimals);
		if (converted == null) return '—';

		// Special handling for time: no nested symbol lookup
		if (category === 'time') {
			return `${converted} ${SYMBOLS.time}`;
		}

		return `${converted} ${SYMBOLS[category][prefs[category]]}`;
	}, [formatValue, prefs]);

	// ============ RATES (THE EASY PART NOW) ============

	const parseRate = useCallback((value) => {
		const num = parseFloat(value);
		if (isNaN(num)) return null;
		const rateUnit = `${getUnit('volume')}/${getUnit('area')}`;
		return unit(num, rateUnit).to('L/m^2').toNumber();
	}, [getUnit]);

	const formatRateValue = useCallback((value, decimals = 2) => {
		if (value == null || isNaN(value)) return null;
		const rateUnit = `${getUnit('volume')}/${getUnit('area')}`;
		return parseFloat(unit(value, 'L/m^2').to(rateUnit).toNumber().toFixed(decimals));
	}, [getUnit]);

	const formatRate = useCallback((value, decimals = 2) => {
		const converted = formatRateValue(value, decimals);
		if (converted == null) return '—';
		return `${converted} ${SYMBOLS.volume[prefs.volume]}/${SYMBOLS.area[prefs.area]}`;
	}, [formatRateValue, prefs]);

	const parseProductRate = useCallback((value, isVolume = true) => {
		const num = parseFloat(value);
		if (isNaN(num)) return null;
		const unitType = isVolume ? getUnit('volume') : getUnit('mass');
		const baseType = isVolume ? 'L' : 'kg';
		const rateUnit = `${unitType}/${getUnit('area')}`;
		return unit(num, rateUnit).to(`${baseType}/m^2`).toNumber();
	}, [getUnit]);

	const formatProductRate = useCallback((value, isVolume = true, decimals = 2) => {
		if (value == null || isNaN(value)) return '—';
		const unitType = isVolume ? getUnit('volume') : getUnit('mass');
		const baseType = isVolume ? 'L' : 'kg';
		const rateUnit = `${unitType}/${getUnit('area')}`;
		const converted = unit(value, `${baseType}/m^2`).to(rateUnit).toNumber();
		const sym = isVolume ? SYMBOLS.volume[prefs.volume] : SYMBOLS.mass[prefs.mass];
		return `${converted.toFixed(decimals)} ${sym}/${SYMBOLS.area[prefs.area]}`;
	}, [getUnit, prefs]);

	const formatProductRateValue = useCallback((value, isVolume = true, decimals = 2) => {
		if (value == null || isNaN(value)) return null;
		const unitType = isVolume ? getUnit('volume') : getUnit('mass');
		const baseType = isVolume ? 'L' : 'kg';
		const rateUnit = `${unitType}/${getUnit('area')}`;
		return parseFloat(unit(value, `${baseType}/m^2`).to(rateUnit).toNumber().toFixed(decimals));
	}, [getUnit]);

	// ============ UTILITIES ============

	const symbol = useCallback((category) => {
		// Special handling for time: no nested lookup
		if (category === 'time') {
			return SYMBOLS.time;
		}
		return SYMBOLS[category][prefs[category]];
	}, [prefs]);

	const rateSymbol = useCallback((isVolume = true) => {
		const unitSym = isVolume ? SYMBOLS.volume[prefs.volume] : SYMBOLS.mass[prefs.mass];
		return `${unitSym}/${SYMBOLS.area[prefs.area]}`;
	}, [prefs]);

	return (
		<UnitsContext.Provider value={{
			prefs,
			format, formatValue, parse,
			formatRate, formatRateValue, parseRate,
			formatProductRate, formatProductRateValue, parseProductRate,
			symbol, rateSymbol,
			unit: (category) => prefs[category],
			setUnit: (category, newUnit) => onPreferenceChange?.(category, newUnit),
			getAvailableUnits: (category) => Object.keys(UNIT_MAP[category]).map(key => ({
				key, symbol: SYMBOLS[category][key]
			})),
		}}>
			{children}
		</UnitsContext.Provider>
	);
};

export const useUnits = () => {
	const context = useContext(UnitsContext);
	if (!context) throw new Error('useUnits must be used within UnitsProvider');
	return context;
};