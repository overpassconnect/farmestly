import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContextProvider';
import SearchableListSheet from '../ui/list/SearchableListSheet';
import colors from '../../globals/colors';

/**
 * Product type / Ingredient category codes
 * These are used for both product.type and activeIngredient.code
 */
export const PRODUCT_TYPE_CODES = {
	HB: { code: 'HB', name: 'Herbicide' },
	FU: { code: 'FU', name: 'Fungicide' },
	IN: { code: 'IN', name: 'Insecticide' },
	AC: { code: 'AC', name: 'Acaricide' },
	AT: { code: 'AT', name: 'Attractant' },
	PG: { code: 'PG', name: 'Plant growth regulator' },
	NE: { code: 'NE', name: 'Nematicide' },
	RO: { code: 'RO', name: 'Rodenticide' },
	RE: { code: 'RE', name: 'Repellent' },
	BA: { code: 'BA', name: 'Bactericide' },
	OT: { code: 'OT', name: 'Other' },
	MO: { code: 'MO', name: 'Molluscicide' },
	DE: { code: 'DE', name: 'Desiccant' },
	EL: { code: 'EL', name: 'Elicitor' },
	ST: { code: 'ST', name: 'Soil treatment' },
	XX: { code: 'XX', name: 'Custom' }, // For custom user entries
};

// Alias for backwards compatibility
export const INGREDIENT_CATEGORIES = PRODUCT_TYPE_CODES;

/**
 * Get category filter code from product type
 * Used to pre-filter ingredients based on selected product type
 * @param {object|string} type - Product type (new { code, name } format or legacy string)
 * @returns {string|null} - 2-letter category code or null
 */
export const getCategoryFilterFromType = (type) => {
	if (!type) return null;
	// New format: { code: 'HB', name: 'Herbicide' }
	if (typeof type === 'object' && type.code) {
		return type.code;
	}
	// Legacy string format mapping
	const legacyMapping = {
		'herbicide': 'HB',
		'fungicide': 'FU',
		'insecticide': 'IN',
		'adjuvant': null,
		'fertilizer': null,
		'other': null,
	};
	return legacyMapping[type] || null;
};

// Legacy export for backwards compatibility
export const PRODUCT_TYPE_TO_CATEGORY = {
	'herbicide': 'HB',
	'fungicide': 'FU',
	'insecticide': 'IN',
	'adjuvant': null,
	'fertilizer': null,
	'other': null,
};

/**
 * Get the full category name from abbreviation
 */
const getCategoryName = (category) => {
	// Handle both "IN" and "IN - Insecticide" formats
	const code = category?.substring(0, 2);
	return INGREDIENT_CATEGORIES[code]?.name || category;
};

/**
 * Extract 2-letter code from substance_category
 * Handles both "IN" and "IN - Insecticide" formats
 */
const extractCategoryCode = (category) => {
	return category?.substring(0, 2) || null;
};

/**
 * Transform search result to activeIngredient schema
 * @param {object} item - Search result item from EU database
 * @returns {object} - Formatted activeIngredient object
 */
export const transformToActiveIngredient = (item) => {
	if (item.isCustom) {
		// Custom entry from user
		return {
			provider: null,
			id: null,
			code: null,
			name: item.substance_name,
			cas: null
		};
	}
	// EU database result
	return {
		provider: 'ingredientseu',
		id: item.substance_id,
		code: extractCategoryCode(item.substance_category),
		name: item.substance_name,
		cas: item.as_cas_number || null
	};
};

/**
 * IngredientsEUSearchSheet - Wraps SearchableListSheet for EU active substances/pesticides searching.
 * Users can search by substance name or CAS number.
 *
 * @param {object} props
 * @param {function} props.onSelect - Callback when a substance is selected
 * @param {function} props.onCancel - Callback to close the sheet
 * @param {string} props.statusFilter - Optional filter: 'Approved' or 'Not approved'
 * @param {string} props.categoryFilter - Optional filter: 'FU', 'IN', 'HB', 'AC', etc.
 */
const IngredientsEUSearchSheet = ({ onSelect, onCancel, statusFilter, categoryFilter }) => {
	const { t } = useTranslation('common');
	const { isOffline } = useGlobalContext();

	const handleSelect = (item) => {
		onSelect(item);
		onCancel();
	};

	// Build endpoint with optional filters
	let endpoint = '/data/ingredientseu/search';
	const queryParams = [];
	if (statusFilter) {
		queryParams.push(`status=${encodeURIComponent(statusFilter)}`);
	}
	if (categoryFilter) {
		queryParams.push(`category=${encodeURIComponent(categoryFilter)}`);
	}
	// Note: SearchableListSheet will append ?search=<query> automatically
	// We need to handle the base endpoint differently if we have filters
	if (queryParams.length > 0) {
		endpoint = `${endpoint}?${queryParams.join('&')}`;
	}

	const renderItem = ({ item, onSelect: selectHandler }) => {
		const isApproved = item.substance_status === 'Approved';
		const statusColor = isApproved ? colors.SUCCESS : colors.ERROR;
		const statusLabel = isApproved
			? (t('status.approved') || 'Approved')
			: (t('status.notApproved') || 'Not Approved');

		return (
			<TouchableOpacity
				style={styles.itemContainer}
				onPress={() => selectHandler(item)}
				activeOpacity={0.7}
			>
				<Image
					source={require('../../assets/icons/inputs_brown.png')}
					style={styles.icon}
					resizeMode="contain"
				/>
				<View style={styles.contentContainer}>
					<View style={styles.titleRow}>
						<Text style={styles.title} numberOfLines={1}>
							{item.substance_name}
						</Text>
						<View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
							<Text style={styles.statusText}>{statusLabel}</Text>
						</View>
					</View>
					<Text style={styles.subtitle} numberOfLines={1}>
						{getCategoryName(item.substance_category)}
						{item.as_cas_number ? ` • CAS: ${item.as_cas_number}` : ''}
					</Text>
				</View>
			</TouchableOpacity>
		);
	};

	return (
		<SearchableListSheet
			isBottomSheet={true}
			isOnline={!isOffline}
			endpoint={endpoint}
			responseDataKey="results"
			keyExtractor={(item) => item.substance_id.toString()}
			renderItem={renderItem}
			onSelect={handleSelect}
			onCancel={onCancel}
			title={t('titles.searchActiveSubstances') || 'Search Active Substances'}
			searchPlaceholder={t('placeholders.searchActiveSubstance') || 'Search by name or CAS number...'}
			cancelLabel={t('buttons.cancel')}
			emptyTitle={t('messages.noSubstanceResults') || 'No substances found'}
			emptySubtitle={t('messages.tryDifferentSubstanceSearch') || 'Try a different search term'}
			debounceMs={400}
			allowCustomEntry={true}
			customEntryLabel={t('buttons.useCustomIngredient') || 'Use "{query}" as custom ingredient'}
			onCustomEntry={(query) => {
				// Allow user to enter custom ingredient name with XX (custom) category code
				onSelect({
					substance_name: query,
					substance_category: 'XX',
					isCustom: true
				});
				onCancel();
			}}
		/>
	);
};

const styles = StyleSheet.create({
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 4,
		borderBottomWidth: 1,
		borderBottomColor: colors.PRIMARY_LIGHT,
	},
	icon: {
		width: 32,
		height: 32,
		marginRight: 12,
	},
	contentContainer: {
		flex: 1,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 2,
	},
	title: {
		flex: 1,
		fontFamily: 'Geologica-Bold',
		fontSize: 15,
		color: colors.PRIMARY,
		marginRight: 8,
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: colors.PRIMARY_LIGHT,
	},
	statusBadge: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 4,
	},
	statusText: {
		color: 'white',
		fontSize: 11,
		fontFamily: 'Geologica-Medium',
	},
});

export default IngredientsEUSearchSheet;
