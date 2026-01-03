import React, { useRef, createContext, useContext, useState, forwardRef, useEffect, useCallback } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Formik, useFormikContext } from 'formik';
import colors from '../globals/colors';
import { useBottomSheet } from '../components/sheets/BottomSheetContextProvider';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import i18n from '../globals/i18n';
import ListItem from '../components/ui/list/ListItem';
import SearchableListSheet from '../components/ui/list/SearchableListSheet';

/**
 * Parse a nested field path like "products[0].rate" into path segments
 * @param {string} path - The field path (e.g., "products[0].rate", "user.address.city")
 * @returns {Array<string|number>} - Array of path segments
 */
const parseFieldPath = (path) => {
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
const getNestedValue = (obj, path, defaultValue = undefined) => {
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
const setNestedValue = (obj, path, value) => {
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

// Create a context for form field registration
const FormikHelperContext = createContext({
	registerField: () => { },
	focusNextField: () => { },
	submitForm: () => { },
	fields: [],
	currentFocusedField: null,
	setCurrentFocusedField: () => { },
	serverErrors: {},
	clearServerError: () => { },
});

// Custom hook to access FormikHelper context
export const useFormikHelper = () => useContext(FormikHelperContext);

// FormInput component that automatically handles field registration and focus navigation
export const FormInput = ({
	name,
	label,
	description,
	placeholder,
	isLast = false,
	unit,
	inline = false,
	inputStyle,
	containerStyle,
	...props
}) => {
	const inputRef = useRef(null);
	const { registerField, focusNextField, submitForm, currentFocusedField, setCurrentFocusedField, serverErrors, clearServerError } = useFormikHelper();
	const { values, errors, touched, handleBlur, setFieldValue, setValues } = useFormikContext();

	// Get nested values for array field support (e.g., "products[0].rate")
	const rawValue = getNestedValue(values, name);
	// Convert to string for TextInput - handle numbers, null, undefined
	const fieldValue = rawValue != null ? String(rawValue) : '';
	const fieldError = getNestedValue(errors, name);
	const fieldTouched = getNestedValue(touched, name);

	useEffect(() => {
		if (inputRef.current) {
			registerField(name, inputRef, isLast);
		}
	}, [registerField, name, isLast]);

	// Derive isFocused from context
	const isFocused = currentFocusedField === name;

	// Get server error for this field
	const serverError = serverErrors[name];
	const hasError = (fieldError && fieldTouched) || serverError;

	const handleSubmitEditing = () => {
		if (isLast) {
			submitForm();
		} else {
			focusNextField(name);
		}
	};

	const handleChangeText = (text) => {
		// Support nested paths like "products[0].rate"
		if (name.includes('.') || name.includes('[')) {
			// Use setValues with nested path helper for array fields
			setValues(prev => setNestedValue(prev, name, text));
		} else {
			setFieldValue(name, text);
		}
		// Clear server error when user starts typing
		if (serverError) {
			clearServerError(name);
		}
	};

	// Inline layout: horizontal row with label left, input right
	if (inline) {
		return (
			<View style={[styles.inlineContainer, containerStyle]}>
				<View style={styles.inlineRow}>
					{label && <Text style={styles.inlineLabel}>{label}</Text>}
					<View style={styles.inlineInputWrapper}>
						<TextInput
							ref={inputRef}
							style={[
								styles.inlineInput,
								unit && styles.inlineInputWithUnit,
								isFocused && styles.inlineInputFocused,
								hasError && styles.inlineInputError,
								inputStyle,
							]}
							placeholderTextColor={colors.PRIMARY_LIGHT}
							onFocus={() => setCurrentFocusedField(name)}
							onBlur={() => {
								if (currentFocusedField === name) {
									setCurrentFocusedField(null);
								}
								handleBlur(name);
							}}
							value={fieldValue}
							onChangeText={handleChangeText}
							onSubmitEditing={handleSubmitEditing}
							returnKeyType={isLast ? "done" : "next"}
							placeholder={placeholder}
							cursorColor={colors.PRIMARY}
							selectionColor={colors.SECONDARY}
							{...props}
						/>
						{unit && <Text style={styles.inlineUnitLabel}>{unit}</Text>}
					</View>
				</View>
				{serverError && (
					<Text style={styles.errorText}>{serverError}</Text>
				)}
				{fieldError && fieldTouched && !serverError && (
					<Text style={styles.errorText}>{fieldError}</Text>
				)}
			</View>
		);
	}

	// Default vertical layout
	const inputElement = (
		<TextInput
			ref={inputRef}
			style={[
				styles.input,
				isFocused && styles.inputFocused,
				hasError && styles.inputError,
				unit && styles.inputWithUnit,
				inputStyle,
			]}
			placeholderTextColor={colors.PRIMARY_LIGHT}
			onFocus={() => setCurrentFocusedField(name)}
			onBlur={() => {
				if (currentFocusedField === name) {
					setCurrentFocusedField(null);
				}
				handleBlur(name);
			}}
			value={fieldValue}
			onChangeText={handleChangeText}
			onSubmitEditing={handleSubmitEditing}
			returnKeyType={isLast ? "done" : "next"}
			placeholder={placeholder}
			cursorColor={colors.PRIMARY}
			selectionColor={colors.SECONDARY}
			{...props}
		/>
	);

	return (
		<View style={[styles.inputContainer, containerStyle]}>
			{label && <Text style={styles.formLabel}>{label}:</Text>}
			{description && <Text style={styles.formDescription}>{description}</Text>}
			{unit ? (
				<View style={styles.inputWithUnitContainer}>
					{inputElement}
					<Text style={styles.unitIndicator}>{unit}</Text>
				</View>
			) : (
				inputElement
			)}
			{serverError && (
				<Text style={styles.errorText}>{serverError}</Text>
			)}
			{fieldError && fieldTouched && !serverError && (
				<Text style={styles.errorText}>{fieldError}</Text>
			)}
		</View>
	);
};

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

// FormPhoneInput component - combines country dropdown with phone number input
export const FormPhoneInput = ({
	name,
	label,
	placeholder,
	countries = [],
	flagIcons = {},
	isLast = false,
	onCountryChange,
	...props
}) => {
	const { values, errors, touched, setFieldValue } = useFormikContext();
	const { registerField, focusNextField, currentFocusedField, setCurrentFocusedField, serverErrors, clearServerError } = useFormikHelper();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const phoneInputRef = useRef(null);

	const countryFieldName = `${name}_country`;
	const phoneFieldName = `${name}_phone`;

	// Register the phone input field for focus navigation
	useEffect(() => {
		if (phoneInputRef.current) {
			registerField(phoneFieldName, phoneInputRef, isLast);
		}
	}, [registerField, phoneFieldName, isLast]);

	const selectedCountry = countries.find(c => c.code === values[countryFieldName]) || countries[0];
	const isFocused = currentFocusedField === phoneFieldName;

	const serverError = serverErrors[phoneFieldName];
	const hasError = (errors[phoneFieldName] && touched[phoneFieldName]) || serverError;

	const handleCountryPress = useCallback(() => {
		setCurrentFocusedField(countryFieldName);

		const CountrySelectorContent = () => (
			<BottomSheetView style={styles.bottomSheetContainer}>
				<BottomSheetFlatList
					data={countries}
					keyExtractor={item => item.code}
					renderItem={({ item }) => (
						<TouchableOpacity
							style={styles.countryItem}
							onPress={() => {
								setFieldValue(countryFieldName, item.code);
								closeBottomSheet();
								setCurrentFocusedField(null);
								// Notify parent of country change
								if (onCountryChange) {
									onCountryChange(item);
								}
								// Focus phone input after selection
								setTimeout(() => phoneInputRef.current?.focus(), 100);
							}}
						>
							<Image
								source={flagIcons[item.code]}
								style={styles.flagIcon}
							/>
							<Text style={styles.itemText}>{item.name}</Text>
						</TouchableOpacity>
					)}
					showsVerticalScrollIndicator={true}
				/>
			</BottomSheetView>
		);

		openBottomSheet(<CountrySelectorContent />, {
			snapPoints: ['50%'],
			enablePanDownToClose: true,
			onChange: (index) => {
				if (index === -1) {
					setCurrentFocusedField(null);
				}
			}
		});
	}, [countries, countryFieldName, setFieldValue, closeBottomSheet, setCurrentFocusedField, phoneInputRef, openBottomSheet, flagIcons, onCountryChange]);

	return (
		<View style={styles.inputContainer}>
			{label && <Text style={styles.formLabel}>{label}:</Text>}
			<View style={styles.phoneInputContainer}>
				{/* Country Dropdown - Compact version */}
				<TouchableOpacity
					style={[
						styles.compactCountryDropdown,
						currentFocusedField === countryFieldName && { borderColor: colors.SECONDARY, borderWidth: 2 }
					]}
					onPress={handleCountryPress}
				>
					<Image
						source={flagIcons[selectedCountry?.code] || flagIcons['GR']}
						style={styles.flagIconCompact}
					/>
					<Text style={styles.chevronCompact}>▼</Text>
				</TouchableOpacity>

				{/* Phone Number Input */}
				<TextInput
					ref={phoneInputRef}
					style={[
						styles.phoneInput,
						isFocused && styles.inputFocused,
						hasError && styles.inputError
					]}
					placeholder={placeholder || selectedCountry?.placeholder || 'Phone number'}
					placeholderTextColor={colors.PRIMARY_LIGHT}
					onFocus={() => setCurrentFocusedField(phoneFieldName)}
					onBlur={() => {
						if (currentFocusedField === phoneFieldName) {
							setCurrentFocusedField(null);
						}
					}}
					value={values[phoneFieldName]}
					onChangeText={text => {
						setFieldValue(phoneFieldName, text);
						if (serverError) {
							clearServerError(phoneFieldName);
						}
					}}
					onSubmitEditing={() => {
						if (isLast) {
							// Submit form
						} else {
							focusNextField(phoneFieldName);
						}
					}}
					returnKeyType={isLast ? "done" : "next"}
					keyboardType="phone-pad"
					cursorColor={colors.PRIMARY}
					numberOfLines={1}

					selectionColor={colors.SECONDARY}
					{...props}
					multiline={false}
					scrollEnabled={false}
				/>
			</View>
			{serverError && (
				<Text style={styles.errorText}>{serverError}</Text>
			)}
			{errors[phoneFieldName] && touched[phoneFieldName] && !serverError && (
				<Text style={styles.errorText}>{errors[phoneFieldName]}</Text>
			)}
		</View>
	);
};

// FormikHelper component that manages form fields and provides automatic navigation
export const FormikHelper = ({
	children,
	initialValues,
	validationSchema,
	onSubmit,
	enableReinitialize = false
}) => {
	const fieldsRef = useRef({});
	const [currentFocusedField, setCurrentFocusedField] = useState(null);
	const [serverErrors, setServerErrors] = useState({});

	const registerField = useCallback((name, ref, isLast) => {
		fieldsRef.current[name] = { ref, isLast };
	}, []);

	const focusNextField = useCallback((currentFieldName) => {
		const fieldNames = Object.keys(fieldsRef.current);
		const currentIndex = fieldNames.indexOf(currentFieldName);

		if (currentIndex < fieldNames.length - 1) {
			const nextFieldName = fieldNames[currentIndex + 1];
			const nextField = fieldsRef.current[nextFieldName];
			if (nextField?.ref?.current?.focus) {
				nextField.ref.current.focus();
			}
		}
	}, []);

	const clearServerError = useCallback((fieldName) => {
		setServerErrors(prev => {
			const newErrors = { ...prev };
			delete newErrors[fieldName];
			return newErrors;
		});
	}, []);

	const handleSubmit = useCallback(async (values, formikBag) => {
		// Clear all server errors on new submission
		setServerErrors({});

		// Call the user's onSubmit function
		const response = await onSubmit(values, formikBag);

		// Check if response contains validation errors
		// Support both raw API response format (HEADERS.VALIDATION) and useApi format (validation)
		const validationArray = response?.HEADERS?.VALIDATION || response?.validation;

		if (validationArray && Array.isArray(validationArray)) {
			// Parse validation array: [{ path: 'fieldName', msg: 'errorCode' }]
			// Translate error codes and convert to: { fieldName: 'translated message' }
			const validationErrors = {};
			validationArray.forEach(error => {
				if (error.path && error.msg) {
					// Attempt to translate the error code
					// Falls back to raw message if translation key not found
					const translated = i18n.t(`validation:${error.msg}`, {
						defaultValue: error.msg
					});
					validationErrors[error.path] = translated;
				}
			});

			// Update server errors state
			setServerErrors(validationErrors);
		}

		return response;
	}, [onSubmit]);

	const contextValue = {
		registerField,
		focusNextField,
		submitForm: () => { },
		fields: fieldsRef.current,
		currentFocusedField,
		setCurrentFocusedField,
		serverErrors,
		clearServerError,
	};

	return (
		<Formik
			initialValues={initialValues}
			validationSchema={validationSchema}
			onSubmit={handleSubmit}
			enableReinitialize={enableReinitialize}
		>
			{(formikProps) => (
				<FormikHelperContext.Provider value={{
					...contextValue,
					submitForm: formikProps.handleSubmit
				}}>
					{typeof children === 'function' ? children(formikProps) : children}
				</FormikHelperContext.Provider>
			)}
		</Formik>
	);
};

const styles = StyleSheet.create({
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
		// marginLeft: -5
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
		// paddingBottom: 2,
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
		// transform: [{ rotate: '90deg' }],
	},
	// Bottom sheet styles
	bottomSheetContainer: {
		flex: 1,
		backgroundColor: '#fff',
		padding: 16,
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
	searchContainer: {
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
		marginBottom: 16,
	},
	searchInput: {
		height: 42,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 10,
		paddingHorizontal: 12,
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
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

	// Update existing bottomSheetContainer
	bottomSheetContainer: {
		flex: 1,
		backgroundColor: '#fff',
		padding: 16,
		maxHeight: '100%', // Ensure it doesn't overflow
	},
	// Add these styles to your existing styles object in FormikHelper.js
	// Find the StyleSheet.create({ ... }) and add these inside:

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
		// paddingBottom: 2,
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
});

export default FormikHelper;