import { StyleSheet } from 'react-native';
import colors from '../../../globals/colors';

export const formStyles = StyleSheet.create({
	formContainer: {
		width: '100%'
	},
	inputContainer: {
		marginBottom: 16
	},
	// Inline layout styles - same visual style as vertical FormInput but horizontal
	inlineContainer: {
		marginBottom: 16,
	},
	inlineRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	inlineLabel: {
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		fontSize: 17,
		marginRight: 12,
	},
	inlineInputWrapper: {
		position: 'relative',
		flexDirection: 'row',
		alignItems: 'center',
	},
	inlineInput: {
		minWidth: 100,
		height: 46,
		fontSize: 17,
		color: colors.PRIMARY,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontFamily: 'Geologica-Regular',
	},
	inlineInputWithUnit: {
		paddingRight: 60,
	},
	inlineInputFocused: {
		borderWidth: 1,
		borderColor: colors.SECONDARY,
	},
	inlineInputError: {
		borderWidth: 1.5,
		borderColor: 'red',
		backgroundColor: '#FFF2F2',
	},
	inlineUnitLabel: {
		position: 'absolute',
		right: 12,
		fontSize: 16,
		fontFamily: 'Geologica-Medium',
		color: colors.SECONDARY,
	},
	formLabel: {
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		fontSize: 19,
		marginBottom: 3,
	},
	formDescription: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 8,
		marginTop: -2,
	},
	input: {
		height: 46,
		fontSize: 17,
		color: colors.PRIMARY,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingBottom: 0,
		paddingTop: -10,
		lineHeight: 17,
		paddingVertical: 8,
		fontFamily: 'Geologica-Regular',
	},
	inputWithUnit: {
		paddingRight: 60,
	},
	inputWithUnitContainer: {
		position: 'relative',
		flexDirection: 'row',
		alignItems: 'center',
	},
	unitIndicator: {
		position: 'absolute',
		right: 12,
		fontSize: 16,
		fontFamily: 'Geologica-Medium',
		color: colors.SECONDARY,
	},
	inputFocused: {
		borderWidth: 1,
		borderColor: colors.SECONDARY,
	},
	inputError: {
		borderWidth: 1.5,
		borderColor: 'red',
		backgroundColor: '#FFF2F2',
	},
	errorText: {
		color: 'red',
		fontFamily: 'Geologica-Light',
		fontSize: 14,
		marginLeft: 1,
		marginTop: 2,
	},
	// Dropdown styles
	dropdown: {
		height: 42,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		paddingHorizontal: 15,
		justifyContent: 'space-between',
		alignItems: 'center',
		flexDirection: 'row',
		borderRadius: 10,
	},
	dropdownText: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
	},
	placeholderStyle: {
		color: colors.PRIMARY_LIGHT,
	},
	selectedValue: {
		color: colors.PRIMARY,
	},
	chevron: {
		fontSize: 22,
		color: colors.SECONDARY,
		fontWeight: 'bold',
	},
	// Bottom sheet styles
	bottomSheetContainer: {
		flex: 1,
		backgroundColor: '#fff',
		padding: 16,
		maxHeight: '100%',
	},
	bottomSheetContent: {
		flex: 1,
		backgroundColor: '#fff',
		paddingTop: 16,
		paddingHorizontal: 8,
	},
	dropdownItem: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 40,
	},
	emptyText: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
	},
	placeholderText: {
		color: colors.PRIMARY_LIGHT,
	},
	itemContainer: {
		marginBottom: 8,
		width: '100%',
	},
	itemText: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		padding: 12,
	},
	// Search functionality styles
	searchContainer: {
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
		marginBottom: 16,
	},
	searchInputWrapper: {
		backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 10,
		paddingHorizontal: 4,
	},
	searchInput: {
		height: 42,
		paddingHorizontal: 12,
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		backgroundColor: 'transparent',
	},
	noResultsContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 40,
	},
	noResultsText: {
		fontSize: 18,
		fontFamily: 'Geologica-Medium',
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 8,
	},
	noResultsSubText: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
	},
	// Phone input styles
	phoneInputContainer: {
		flexDirection: 'row',
		gap: 10,
	},
	compactCountryDropdown: {
		width: 80,
		height: 42,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 8,
	},
	flagIconCompact: {
		width: 32,
		height: 21,
		marginRight: 4,
	},
	flagIcon: {
		width: 32,
		height: 21,
		marginRight: 12,
	},
	chevronCompact: {
		fontSize: 12,
		color: colors.SECONDARY,
		fontWeight: 'bold',
	},
	phoneInput: {
		flex: 1,
		height: 42,
		fontSize: 17,
		color: colors.PRIMARY,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingBottom: 0,
		paddingTop: -10,
		paddingVertical: 8,
		paddingHorizontal: 12,
		fontFamily: 'Geologica-Regular',
	},
	countryItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
	},
	// Character count styles
	characterCount: {
		fontSize: 13,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'right',
		marginTop: 4,
	},
	characterCountError: {
		color: 'red',
	},
});

export default formStyles;
