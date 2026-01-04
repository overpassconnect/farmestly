/**
 * BBCH Growth Stage Scale
 *
 * A standardized scale for describing crop development stages.
 * Used across agriculture for precise timing of treatments and observations.
 *
 * Each stage has:
 * - value: The numeric BBCH code (0-99)
 * - labelKey: Translation key for the stage description
 * - stageKey: Translation key for the main stage name (0-9)
 */

// Main growth stages (principal stages)
export const BBCH_PRINCIPAL_STAGES = [
	{ stage: 0, labelKey: 'bbch.stages.0.name' },  // Germination / Sprouting / Bud development
	{ stage: 1, labelKey: 'bbch.stages.1.name' },  // Leaf development
	{ stage: 2, labelKey: 'bbch.stages.2.name' },  // Tillering / Side shoot formation
	{ stage: 3, labelKey: 'bbch.stages.3.name' },  // Stem elongation / Rosette growth
	{ stage: 4, labelKey: 'bbch.stages.4.name' },  // Harvestable vegetative parts development
	{ stage: 5, labelKey: 'bbch.stages.5.name' },  // Inflorescence emergence / Heading
	{ stage: 6, labelKey: 'bbch.stages.6.name' },  // Flowering
	{ stage: 7, labelKey: 'bbch.stages.7.name' },  // Fruit development
	{ stage: 8, labelKey: 'bbch.stages.8.name' },  // Ripening of fruit and seed
	{ stage: 9, labelKey: 'bbch.stages.9.name' },  // Senescence / Dormancy
];

// Individual BBCH stages with translation keys
export const BBCH_STAGES = [
	// Stage 0: Germination / Sprouting / Bud development
	{ value: 0, labelKey: 'bbch.codes.00' },
	{ value: 1, labelKey: 'bbch.codes.01' },
	{ value: 3, labelKey: 'bbch.codes.03' },
	{ value: 5, labelKey: 'bbch.codes.05' },
	{ value: 6, labelKey: 'bbch.codes.06' },
	{ value: 7, labelKey: 'bbch.codes.07' },
	{ value: 8, labelKey: 'bbch.codes.08' },
	{ value: 9, labelKey: 'bbch.codes.09' },

	// Stage 1: Leaf development
	{ value: 10, labelKey: 'bbch.codes.10' },
	{ value: 11, labelKey: 'bbch.codes.11' },
	{ value: 12, labelKey: 'bbch.codes.12' },
	{ value: 13, labelKey: 'bbch.codes.13' },
	{ value: 14, labelKey: 'bbch.codes.14' },
	{ value: 15, labelKey: 'bbch.codes.15' },
	{ value: 16, labelKey: 'bbch.codes.16' },
	{ value: 17, labelKey: 'bbch.codes.17' },
	{ value: 18, labelKey: 'bbch.codes.18' },
	{ value: 19, labelKey: 'bbch.codes.19' },

	// Stage 2: Tillering / Side shoot formation
	{ value: 20, labelKey: 'bbch.codes.20' },
	{ value: 21, labelKey: 'bbch.codes.21' },
	{ value: 22, labelKey: 'bbch.codes.22' },
	{ value: 23, labelKey: 'bbch.codes.23' },
	{ value: 24, labelKey: 'bbch.codes.24' },
	{ value: 25, labelKey: 'bbch.codes.25' },
	{ value: 26, labelKey: 'bbch.codes.26' },
	{ value: 27, labelKey: 'bbch.codes.27' },
	{ value: 28, labelKey: 'bbch.codes.28' },
	{ value: 29, labelKey: 'bbch.codes.29' },

	// Stage 3: Stem elongation / Rosette growth
	{ value: 30, labelKey: 'bbch.codes.30' },
	{ value: 31, labelKey: 'bbch.codes.31' },
	{ value: 32, labelKey: 'bbch.codes.32' },
	{ value: 33, labelKey: 'bbch.codes.33' },
	{ value: 34, labelKey: 'bbch.codes.34' },
	{ value: 35, labelKey: 'bbch.codes.35' },
	{ value: 36, labelKey: 'bbch.codes.36' },
	{ value: 37, labelKey: 'bbch.codes.37' },
	{ value: 38, labelKey: 'bbch.codes.38' },
	{ value: 39, labelKey: 'bbch.codes.39' },

	// Stage 4: Harvestable vegetative parts development
	{ value: 40, labelKey: 'bbch.codes.40' },
	{ value: 41, labelKey: 'bbch.codes.41' },
	{ value: 42, labelKey: 'bbch.codes.42' },
	{ value: 43, labelKey: 'bbch.codes.43' },
	{ value: 44, labelKey: 'bbch.codes.44' },
	{ value: 45, labelKey: 'bbch.codes.45' },
	{ value: 46, labelKey: 'bbch.codes.46' },
	{ value: 47, labelKey: 'bbch.codes.47' },
	{ value: 48, labelKey: 'bbch.codes.48' },
	{ value: 49, labelKey: 'bbch.codes.49' },

	// Stage 5: Inflorescence emergence / Heading
	{ value: 50, labelKey: 'bbch.codes.50' },
	{ value: 51, labelKey: 'bbch.codes.51' },
	{ value: 52, labelKey: 'bbch.codes.52' },
	{ value: 53, labelKey: 'bbch.codes.53' },
	{ value: 54, labelKey: 'bbch.codes.54' },
	{ value: 55, labelKey: 'bbch.codes.55' },
	{ value: 56, labelKey: 'bbch.codes.56' },
	{ value: 57, labelKey: 'bbch.codes.57' },
	{ value: 58, labelKey: 'bbch.codes.58' },
	{ value: 59, labelKey: 'bbch.codes.59' },

	// Stage 6: Flowering
	{ value: 60, labelKey: 'bbch.codes.60' },
	{ value: 61, labelKey: 'bbch.codes.61' },
	{ value: 62, labelKey: 'bbch.codes.62' },
	{ value: 63, labelKey: 'bbch.codes.63' },
	{ value: 64, labelKey: 'bbch.codes.64' },
	{ value: 65, labelKey: 'bbch.codes.65' },
	{ value: 66, labelKey: 'bbch.codes.66' },
	{ value: 67, labelKey: 'bbch.codes.67' },
	{ value: 68, labelKey: 'bbch.codes.68' },
	{ value: 69, labelKey: 'bbch.codes.69' },

	// Stage 7: Fruit development
	{ value: 70, labelKey: 'bbch.codes.70' },
	{ value: 71, labelKey: 'bbch.codes.71' },
	{ value: 72, labelKey: 'bbch.codes.72' },
	{ value: 73, labelKey: 'bbch.codes.73' },
	{ value: 74, labelKey: 'bbch.codes.74' },
	{ value: 75, labelKey: 'bbch.codes.75' },
	{ value: 76, labelKey: 'bbch.codes.76' },
	{ value: 77, labelKey: 'bbch.codes.77' },
	{ value: 78, labelKey: 'bbch.codes.78' },
	{ value: 79, labelKey: 'bbch.codes.79' },

	// Stage 8: Ripening of fruit and seed
	{ value: 80, labelKey: 'bbch.codes.80' },
	{ value: 81, labelKey: 'bbch.codes.81' },
	{ value: 82, labelKey: 'bbch.codes.82' },
	{ value: 83, labelKey: 'bbch.codes.83' },
	{ value: 84, labelKey: 'bbch.codes.84' },
	{ value: 85, labelKey: 'bbch.codes.85' },
	{ value: 86, labelKey: 'bbch.codes.86' },
	{ value: 87, labelKey: 'bbch.codes.87' },
	{ value: 88, labelKey: 'bbch.codes.88' },
	{ value: 89, labelKey: 'bbch.codes.89' },

	// Stage 9: Senescence / Dormancy
	{ value: 90, labelKey: 'bbch.codes.90' },
	{ value: 91, labelKey: 'bbch.codes.91' },
	{ value: 92, labelKey: 'bbch.codes.92' },
	{ value: 93, labelKey: 'bbch.codes.93' },
	{ value: 94, labelKey: 'bbch.codes.94' },
	{ value: 95, labelKey: 'bbch.codes.95' },
	{ value: 96, labelKey: 'bbch.codes.96' },
	{ value: 97, labelKey: 'bbch.codes.97' },
	{ value: 98, labelKey: 'bbch.codes.98' },
	{ value: 99, labelKey: 'bbch.codes.99' },
];

// Generate wheel picker data (increments of 5 for quick selection)
export const BBCH_WHEEL_DATA = Array.from({ length: 20 }, (_, i) => ({
	value: i * 5,
	label: (i * 5).toString().padStart(2, '0'),
}));

// Helper to get principal stage from BBCH code
export const getPrincipalStage = (bbchCode) => {
	return Math.floor(bbchCode / 10);
};

// Helper to get stage description key
export const getStageDescriptionKey = (bbchCode) => {
	const stage = BBCH_STAGES.find(s => s.value === bbchCode);
	return stage?.labelKey || `bbch.codes.${bbchCode.toString().padStart(2, '0')}`;
};

// Helper to get principal stage name key
export const getPrincipalStageNameKey = (bbchCode) => {
	const principalStage = getPrincipalStage(bbchCode);
	return `bbch.stages.${principalStage}.name`;
};
