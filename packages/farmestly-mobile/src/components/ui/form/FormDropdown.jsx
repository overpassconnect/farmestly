import React, { useRef, forwardRef, useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFormikContext } from 'formik';
import colors from '../../../globals/colors';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import { useFormikHelper } from './FormikHelperContext';
import { formStyles as styles } from './formStyles';
import ListItem from '../list/ListItem';
import SearchableListSheet from '../list/SearchableListSheet';

/**
 * FormDropdown - A dropdown component integrated with Formik and SearchableListSheet
 *
 * Uses SearchableListSheet for the selection UI, providing consistent search
 * functionality across all dropdowns.
 *
 * @param {string} name - Formik field name
 * @param {string} label - Label text
 * @param {string} description - Optional description text
 * @param {array} items - Array of items to select from
 * @param {object} value - Pre-selected value object
 * @param {string} placeholder - Placeholder text when nothing selected
 * @param {function} onSelect - Callback when item is selected
 * @param {function} renderItem - Custom render function for list items: (item, isSelected) => JSX
 * @param {function} keyExtractor - Extract unique key from item (default: item._id || item.id)
 * @param {function} labelExtractor - Extract display label from item (default: item.label || item.name)
 * @param {function} subLabelExtractor - Extract subtitle from item (optional)
 * @param {string[]} searchKeys - Keys to search in items (default: uses labelExtractor)
 * @param {string} searchPlaceholder - Placeholder for search input
 * @param {string} title - Title for the bottom sheet
 * @param {string} emptyTitle - Title when no results found
 * @param {string} emptySubtitle - Subtitle when no results found
 * @param {function} renderEmpty - Custom render function for empty state (overrides emptyTitle/emptySubtitle)
 * @param {boolean} isLast - Whether this is the last field (affects focus behavior)
 * @param {boolean} disabled - Whether the dropdown is disabled
 * @param {object} containerStyle - Additional container styles
 */
export const FormDropdown = forwardRef(({
	name,
	label,
	description,
	items = [],
	value,
	placeholder = 'Select an item',
	onSelect,
	renderItem,
	keyExtractor = item => item._id || item.id,
	labelExtractor = item => item.name || item.label,
	subLabelExtractor,
	searchKeys,
	searchPlaceholder = 'Search...',
	title,
	emptyTitle = 'No items found',
	emptySubtitle = 'Try a different search term',
	renderEmpty,
	containerStyle,
	dropdownStyle,
	selectedValueStyle,
	bottomSheetProps = {},
	isLast = false,
	disabled = false,
	showChevron = true,
}, externalRef) => {
	const internalRef = useRef(null);
	const ref = externalRef || internalRef;

	const { values, errors, touched, setFieldValue, handleBlur } = useFormikContext();
	const { registerField, focusNextField, currentFocusedField, setCurrentFocusedField, serverErrors, clearServerError } = useFormikHelper();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();

	const isFocused = currentFocusedField === name;

	const findSelectedItem = useCallback(() => {
		if (!values[name] || !items || items.length === 0) return null;
		return items.find(item => keyExtractor(item) === values[name]);
	}, [values, name, items, keyExtractor]);

	const [selectedItem, setSelectedItem] = useState(() => findSelectedItem());

	// Update selected item when values change
	useEffect(() => {
		setSelectedItem(findSelectedItem());
	}, [values[name], items, findSelectedItem]);

	// Handle external value prop
	useEffect(() => {
		if (value && value !== selectedItem) {
			const itemId = keyExtractor(value);
			setFieldValue(name, itemId);
			setSelectedItem(value);
		}
	}, [value, name, setFieldValue, keyExtractor, selectedItem]);

	const serverError = serverErrors[name];
	const hasError = (errors[name] && touched[name]) || serverError;

	const handleClose = useCallback(() => {
		handleBlur(name);
		if (currentFocusedField === name) {
			setCurrentFocusedField(null);
		}
	}, [handleBlur, name, currentFocusedField, setCurrentFocusedField]);

	const handleItemSelect = useCallback((item) => {
		const itemId = keyExtractor(item);
		setFieldValue(name, itemId);
		setSelectedItem(item);

		if (serverError) {
			clearServerError(name);
		}

		if (onSelect) {
			onSelect(item);
		}

		closeBottomSheet();
		handleClose();

		// Focus next field if not last
		if (!isLast) {
			setTimeout(() => focusNextField(name), 100);
		}
	}, [keyExtractor, setFieldValue, name, serverError, clearServerError, onSelect, closeBottomSheet, handleClose, isLast, focusNextField]);

	const handleOpen = useCallback(() => {
		if (disabled) return;

		setCurrentFocusedField(name);

		// Default renderItem using ListItem
		const defaultRenderItem = ({ item, onSelect: selectHandler }) => {
			const isItemSelected = selectedItem && keyExtractor(selectedItem) === keyExtractor(item);

			return (
				<ListItem
					title={labelExtractor(item)}
					subTitle1={subLabelExtractor ? subLabelExtractor(item) : undefined}
					onPress={() => selectHandler(item)}
					simple={true}
					showChevron={false}
					showRadio={true}
					isSelected={isItemSelected}
				/>
			);
		};

		// Custom renderItem wrapper to pass isSelected
		const customRenderItem = renderItem
			? ({ item, onSelect: selectHandler }) => {
				const isItemSelected = selectedItem && keyExtractor(selectedItem) === keyExtractor(item);
				return (
					<TouchableOpacity onPress={() => selectHandler(item)}>
						{renderItem(item, isItemSelected)}
					</TouchableOpacity>
				);
			}
			: defaultRenderItem;

		openBottomSheet(
			<SearchableListSheet
				isBottomSheet={true}
				localData={items}
				searchKeys={searchKeys}
				keyExtractor={keyExtractor}
				renderItem={customRenderItem}
				onSelect={handleItemSelect}
				onCancel={() => {
					closeBottomSheet();
					handleClose();
				}}
				title={title || label}
				searchPlaceholder={searchPlaceholder}
				emptyTitle={emptyTitle}
				emptySubtitle={emptySubtitle}
				renderEmpty={renderEmpty}
			/>,
			{
				snapPoints: ['50%', '90%'],
				enablePanDownToClose: true,
				...bottomSheetProps,
				onChange: (index) => {
					if (index === -1) {
						handleClose();
					}
					if (bottomSheetProps.onChange) {
						bottomSheetProps.onChange(index);
					}
				}
			}
		);
	}, [disabled, name, setCurrentFocusedField, items, searchKeys, keyExtractor, selectedItem,
		labelExtractor, subLabelExtractor, renderItem, handleItemSelect, closeBottomSheet,
		handleClose, title, label, searchPlaceholder, emptyTitle, emptySubtitle, renderEmpty,
		bottomSheetProps, openBottomSheet]);

	// Register field for focus management
	useEffect(() => {
		const focusableRef = {
			current: {
				focus: () => handleOpen(),
				blur: () => handleClose()
			}
		};
		registerField(name, focusableRef, isLast);
	}, [registerField, name, isLast, handleOpen, handleClose]);

	const getDisplayText = () => {
		if (selectedItem) {
			return labelExtractor(selectedItem);
		}
		return placeholder;
	};

	return (
		<View style={[styles.inputContainer, containerStyle]}>
			{label && <Text style={styles.formLabel}>{label}:</Text>}
			{description && <Text style={styles.formDescription}>{description}</Text>}

			<TouchableOpacity
				ref={ref}
				style={[
					styles.dropdown,
					dropdownStyle,
					isFocused && { borderColor: colors.SECONDARY, borderWidth: 2 },
					hasError && styles.inputError
				]}
				onPress={handleOpen}
				disabled={disabled}
				activeOpacity={0.7}
			>
				<Text
					style={[
						styles.dropdownText,
						!selectedItem ? styles.placeholderText : selectedValueStyle
					]}
					numberOfLines={1}
				>
					{getDisplayText()}
				</Text>
				{showChevron && (
					<Text style={styles.chevron}>▼</Text>
				)}
			</TouchableOpacity>

			{serverError && (
				<Text style={styles.errorText}>{serverError}</Text>
			)}
			{errors[name] && touched[name] && !serverError && (
				<Text style={styles.errorText}>{errors[name]}</Text>
			)}
		</View>
	);
});

export default FormDropdown;
