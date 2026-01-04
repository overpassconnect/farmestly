import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, TextInput, Text } from 'react-native';
import { useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import colors from '../../../globals/colors';
import { useFormikHelper } from './FormikHelperContext';
import { getNestedValue, setNestedValue } from './formUtils';
import { formStyles as styles } from './formStyles';
import { localeParser } from '../../../globals/locale/parser';

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
	multiline = false,
	numberOfLines = 1,
	maxLength,
	showCharacterCount = false,
	numeric = false,
	numericOptions = {},
	...props
}) => {
	const inputRef = useRef(null);
	const { t } = useTranslation('validation');
	const { registerField, focusNextField, submitForm, currentFocusedField, setCurrentFocusedField, serverErrors, clearServerError } = useFormikHelper();
	const { values, errors, touched, handleBlur, setFieldValue, setValues } = useFormikContext();

	// Get nested values for array field support (e.g., "products[0].rate")
	const rawValue = getNestedValue(values, name);

	// For numeric fields, maintain separate display state (localized string)
	// while form state holds the JS number
	const [displayValue, setDisplayValue] = useState(() => {
		if (numeric && rawValue != null && !isNaN(rawValue)) {
			return localeParser.format(rawValue, numericOptions);
		}
		return '';
	});

	// Sync display value when rawValue changes externally (e.g., form reset, initial values)
	const prevRawValueRef = useRef(rawValue);
	useEffect(() => {
		if (numeric) {
			// Only update display if the raw value actually changed (not from our own input)
			if (prevRawValueRef.current !== rawValue) {
				if (rawValue != null && !isNaN(rawValue)) {
					setDisplayValue(localeParser.format(rawValue, numericOptions));
				} else {
					setDisplayValue('');
				}
			}
			prevRawValueRef.current = rawValue;
		}
	}, [rawValue, numeric, numericOptions]);

	// Determine the value to display in the TextInput
	const fieldValue = numeric
		? displayValue
		: (rawValue != null ? String(rawValue) : '');

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

	// Update form value helper
	const updateFormValue = useCallback((value) => {
		if (name.includes('.') || name.includes('[')) {
			setValues(prev => setNestedValue(prev, name, value));
		} else {
			setFieldValue(name, value);
		}
	}, [name, setFieldValue, setValues]);

	const handleChangeText = (text) => {
		if (numeric) {
			// For numeric fields, validate partial input and maintain dual state
			if (text === '' || localeParser.isValidPartial(text)) {
				// Update display value
				setDisplayValue(text);

				// Parse to number and update form state
				if (text === '') {
					updateFormValue(null);
				} else {
					const parsed = localeParser.parse(text);
					// Only update form value if we got a valid number
					// (partial inputs like "123," will parse to NaN, which is fine during typing)
					if (!isNaN(parsed)) {
						updateFormValue(parsed);
					}
				}
			}
			// If invalid partial, ignore the input (don't update state)
		} else {
			// Original string handling for non-numeric fields
			updateFormValue(text);
		}

		// Clear server error when user starts typing
		if (serverError) {
			clearServerError(name);
		}
	};

	// Handle blur for numeric fields - reformat the display value
	const handleBlurNumeric = useCallback(() => {
		if (numeric && displayValue) {
			const parsed = localeParser.parse(displayValue);
			if (!isNaN(parsed)) {
				// Reformat to clean localized display
				setDisplayValue(localeParser.format(parsed, numericOptions));
				// Ensure form value is in sync
				updateFormValue(parsed);
			} else if (displayValue.trim() === '') {
				updateFormValue(null);
			}
		}
	}, [numeric, displayValue, numericOptions, updateFormValue]);

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
								handleBlurNumeric();
								handleBlur(name);
							}}
							value={fieldValue}
							onChangeText={handleChangeText}
							onSubmitEditing={handleSubmitEditing}
							returnKeyType={isLast ? "done" : "next"}
							placeholder={placeholder}
							cursorColor={colors.PRIMARY}
							selectionColor={colors.SECONDARY}
							keyboardType={numeric ? 'decimal-pad' : props.keyboardType}
							{...props}
						/>
						{unit && <Text style={styles.inlineUnitLabel}>{unit}</Text>}
					</View>
				</View>
				{serverError && (
					<Text style={styles.errorText}>{t(serverError)}</Text>
				)}
				{fieldError && fieldTouched && !serverError && (
					<Text style={styles.errorText}>{t(fieldError)}</Text>
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
				multiline && {
					height: undefined,
					minHeight: 46 * numberOfLines,
					textAlignVertical: 'top',
					paddingTop: 12,
				},
				inputStyle,
			]}
			placeholderTextColor={colors.PRIMARY_LIGHT}
			onFocus={() => setCurrentFocusedField(name)}
			onBlur={() => {
				if (currentFocusedField === name) {
					setCurrentFocusedField(null);
				}
				handleBlurNumeric();
				handleBlur(name);
			}}
			value={fieldValue}
			onChangeText={handleChangeText}
			onSubmitEditing={handleSubmitEditing}
			returnKeyType={multiline ? "default" : (isLast ? "done" : "next")}
			placeholder={placeholder}
			cursorColor={colors.PRIMARY}
			selectionColor={colors.SECONDARY}
			multiline={multiline}
			numberOfLines={numberOfLines}
			keyboardType={numeric ? 'decimal-pad' : props.keyboardType}
			{...props}
		/>
	);

	// Show character count when maxLength is set (works for both single and multiline)
	const shouldShowCharCount = maxLength != null;
	// Use Array.from to count grapheme clusters for better international support
	const charCount = fieldValue ? [...fieldValue].length : 0;

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
			{shouldShowCharCount && (
				<Text style={[
					styles.characterCount,
					charCount > maxLength && styles.characterCountError
				]}>
					{charCount}/{maxLength}
				</Text>
			)}
			{serverError && (
				<Text style={styles.errorText}>{t(serverError)}</Text>
			)}
			{fieldError && fieldTouched && !serverError && (
				<Text style={styles.errorText}>{t(fieldError)}</Text>
			)}
		</View>
	);
};

export default FormInput;
