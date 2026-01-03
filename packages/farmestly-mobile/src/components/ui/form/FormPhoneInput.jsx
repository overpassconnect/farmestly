import React, { useRef, useEffect, useCallback } from 'react';
import { View, TextInput, Text, TouchableOpacity, Image } from 'react-native';
import { useFormikContext } from 'formik';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import colors from '../../../globals/colors';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import { useFormikHelper } from './FormikHelperContext';
import { formStyles as styles } from './formStyles';

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

export default FormPhoneInput;
