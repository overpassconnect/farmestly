import React, { useRef, useEffect } from 'react';
import { View, TextInput, Text } from 'react-native';
import { useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import colors from '../../../globals/colors';
import { useFormikHelper } from './FormikHelperContext';
import { getNestedValue, setNestedValue } from './formUtils';
import { formStyles as styles } from './formStyles';

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
	const { t } = useTranslation('validation');
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
				<Text style={styles.errorText}>{t(serverError)}</Text>
			)}
			{fieldError && fieldTouched && !serverError && (
				<Text style={styles.errorText}>{t(fieldError)}</Text>
			)}
		</View>
	);
};

export default FormInput;
