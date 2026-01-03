import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useApi } from '../../../hooks/useApi';
import { View, StyleSheet, Dimensions, Text, Image, BackHandler, TouchableOpacity } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetView, BottomSheetModalProvider, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import colors from '../../../globals/colors'
import PrimaryButton from '../../ui/core/PrimaryButton';
import config from '../../../globals/config'
import { phone } from 'phone';
import OTPTextInput from 'react-native-otp-textinput'
import flagIcons from '../../../globals/flagIcons';
import { FormikHelper, FormPhoneInput } from '../../ui/form';

const BASE_URL = config.BASE_URL;
const { width, height } = Dimensions.get('window');
const countries = [
	{ code: 'GR', name: 'Greece', placeholder: '6912345678' },
	{ code: 'CY', name: 'Cyprus', placeholder: '91234567' },
]

// Wizard pages will be defined after styles
let wizardPages;

const SignUpScreen = ({ navigation, route }) => {

	const { api } = useApi();

	let buttonText;
	if (route.params.for === 'login') buttonText = "Login"
	else if (route.params.for == 'signup') buttonText = "Sign Up";

	const [currentIndex, setCurrentIndex] = useState(0);

	const [phoneNumber, setPhoneNumber] = useState('');
	const [phoneIsValid, setPhoneIsValid] = useState(false);

	const [otp, setOtp] = useState('');
	const [otpIsValid, setOtpIsValid] = useState(false);
	const [isLoading, setIsLoading] = useState(false)

	const [country, setCountry] = useState(countries[0]);

	const flatlistRef = useRef();
	const bottomSheetRef = useRef(null);


	// useEffect(() => {
	// 	console.log('new params')
	// }, [route.params]);

	const renderBackdrop = useCallback(
		(props) => <BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} {...props} pressBehavior={'none'} />,
		[]);

	const handleCountrySelect = (country) => {
		setCountry(country);
		bottomSheetRef.current?.close();
	};

	// Shared submit logic for both button tap and keyboard submit
	const handlePageSubmit = useCallback(() => {
		const isValid = currentIndex === 0 ? phoneIsValid : otpIsValid;

		if (!isValid || isLoading) {
			return;
		}

		if (currentIndex === 0) {
			// Page 1: Request OTP
			setIsLoading(true);
			api('/phoneVerify?action=request&for=' + route.params.for, {
				method: 'POST',
				body: JSON.stringify({
					'phoneNumber': phoneNumber,
					'countryCode': country.code
				}),
				headers: { 'Content-Type': 'application/json' }
			}).then((result) => {
				if (result.ok) {
					setCurrentIndex(currentIndex + 1);
					flatlistRef.current.scrollToIndex({
						animated: true, index: currentIndex + 1
					});
				}
				setIsLoading(false);
				setPhoneIsValid(false);
			});
		} else if (currentIndex === 1) {
			// Page 2: Verify OTP
			setIsLoading(true);
			api('/phoneVerify?action=verify&for=' + route.params.for, {
				method: 'POST',
				body: JSON.stringify({
					'phoneNumber': phoneNumber,
					'countryCode': country.code,
					'verificationCode': otp
				}),
				headers: { 'Content-Type': 'application/json' }
			}).then(async (result) => {
				if (result.ok) {
					if (route.params.for === 'login') {
						// For login, navigate to Splash screen to properly load all data
						// This ensures the GlobalContext loads fresh data and sets up properly
						navigation.replace('Splash');
					} else if (route.params.for === 'signup') {
						// For signup, go directly to setup
						// The setup screen will handle its own navigation after completion
						navigation.replace('Setup');
					}

					// Reset form
					setOtp('');
					setPhoneNumber('');
					setIsLoading(false);
					flatlistRef.current.scrollToIndex({ animated: true, index: 0 });
					setCurrentIndex(0);
				} else {
					setIsLoading(false);
				}
			});
		}
	}, [currentIndex, phoneIsValid, otpIsValid, isLoading, phoneNumber, country, otp, route.params.for, navigation, api]);

	const backOverride = useCallback(() => {
		// console.log(isLoading)
		if (currentIndex > 0) {
			setCurrentIndex(currentIndex - 1);
			flatlistRef.current.scrollToIndex({
				// animated: true,
				index: currentIndex - 1
			});
			// Reset validation states when going back
			if (currentIndex === 1) {
				setPhoneIsValid(true); // Re-enable button for page 1
			}
			return true; // Prevent default behavior
		}
	}, [currentIndex]);

	useEffect(() => {
		// FIX: Use the return value from addEventListener and call remove() on cleanup
		const backHandler = BackHandler.addEventListener('hardwareBackPress', backOverride);
		return () => backHandler.remove(); // Fixed: use remove() instead of removeEventListener
	}, [currentIndex]);

	return (
		<View style={styles.container} >

			<FlatList
				ref={flatlistRef}
				scrollEnabled={false}
				overScrollMode='never'
				style={styles.wizard}
				horizontal
				data={wizardPages}
				keyExtractor={(_, index) => index.toString()}
				pagingEnabled={true}
				showsHorizontalScrollIndicator={false}
				bounces={false}

				renderItem={({ item, index }) => {
					if (item.name === "Page1") {
						return item({
							phoneNumber,
							setPhoneNumber,
							phoneIsValid,
							setPhoneIsValid,
							bottomSheetRef,
							country,
							setCountry,
							onSubmit: handlePageSubmit
						});
					}
					else if (item.name === "Page2") {
						return item({
							otp,
							setOtp,
							otpIsValid,
							setOtpIsValid,
							onSubmit: handlePageSubmit
						});
					}
				}}
			>

			</FlatList>
			<View style={styles.wizardButtonContainer}>
				<PrimaryButton
					onPress={handlePageSubmit}
					loading={isLoading}
					disabled={!(currentIndex === 0 ? phoneIsValid : otpIsValid)}
					text={(currentIndex < wizardPages.length - 1) ? "Next" : buttonText}
				>
				</PrimaryButton>

			</View>
			<BottomSheetModalProvider>
				<BottomSheetModal
					ref={bottomSheetRef}
					snapPoints={['20%', '50%']}
					// index={-1}
					enableDismissOnClose
					// backgroundStyle={styles.backdrop}
					backdropComponent={renderBackdrop}
					backgroundStyle={styles.bottomSheet}
				>
					<BottomSheetView
						style={styles.sheetInnerContainer}
					>
						<FlatList
							data={countries}
							keyExtractor={(item) => item.code}
							renderItem={({ item }) => (
								<TouchableOpacity
									style={styles.countryOption}
									onPress={() => handleCountrySelect(item)}
								>
									<Image source={flagIcons[item.code]} style={styles.flagIcon} />
									<Text style={styles.countryName}>{item.name}</Text>
								</TouchableOpacity>
							)}
						/>
					</BottomSheetView>
				</BottomSheetModal>

			</BottomSheetModalProvider>

		</View >
	);
};

const styles = StyleSheet.create({
	sheetBackdrop: {
		backgroundColor: '#999',
		position: 'absolute'
	},
	sheetInnerContainer: {
		// flex: 1,
		// alignItems: 'center',
		paddingLeft: 24,
		paddingTop: 12

	},
	bottomSheet: {
		borderWidth: 2.5,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		borderColor: colors.PRIMARY,
	},
	container: {
		flex: 1,
		// padding: 34,
		// flexWrap: 'wrap'
		// justifyContent: 'center',
		// alignItems: 'center',
		// justifyContent: 'flex-start',
	},
	wizard: {

	},
	wizardPageContainer: {
		// backgroundColor: 'grey',
		width: width,
		// padding: 16
		// marginRight: 10
		padding: 34
	},
	buttonText: {

		fontFamily: 'Geologica-Bold',
		color: '#fff',
		fontSize: 20,
		lineHeight: 22,
		textAlign: 'center',
	},
	wizardButtonContainer: {
		// flex: 1,
		flexDirection: 'row',
		marginTop: 12,
		justifyContent: 'center',
		// marginLeft: 15,
		marginBottom: 22,
		// backgroundColor:'none'

	},


	titleContainer: {
		// padding: 16,
		// marginTop: 5,
		// justifyContent:''
		// height: 150,
		// flex: 1
		marginBottom: 20,
		marginTop: 15,
	},
	titleIcon: {
		resizeMode: 'contain',
		width: 70,
		height: 60
	},
	titleText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 28,
		color: colors.PRIMARY
	},
	titleDesc: {
		color: colors.PRIMARY_LIGHT,
		fontSize: 19,
		fontFamily: 'Geologica-Regular'
	},
	switchModePressable: {
		// marginTop: 50
	},
	switchModePressableText: {
		fontFamily: 'Geologica-Regular',
		textDecorationLine: 'underline',
		fontSize: 15,
		color: colors.PRIMARY,
	}
});

const Page1 = ({ phoneNumber, setPhoneNumber, phoneIsValid, setPhoneIsValid, bottomSheetRef, country, setCountry, onSubmit }) => {
	return (
		<View style={styles.wizardPageContainer}>
			<View style={styles.titleContainer}>
				<Image style={styles.titleIcon} source={require('../../../assets/icon_login.png')} />
				<Text style={styles.titleText}>Enter your phone number.</Text>
				<Text style={styles.titleDesc}>You will receive a short 6-digit code via SMS.</Text>
			</View>
			<FormikHelper
				initialValues={{
					phoneNumber_country: country.code,
					phoneNumber_phone: phoneNumber
				}}
				onSubmit={onSubmit}
			>
				{({ values }) => {
					// Validate phone whenever it changes
					useEffect(() => {
						const phoneValidation = phone(values.phoneNumber_phone, { country: values.phoneNumber_country });
						setPhoneIsValid(phoneValidation.isValid);
						if (phoneValidation.isValid) {
							setPhoneNumber(phoneValidation.phoneNumber);
						} else {
							setPhoneNumber(values.phoneNumber_phone);
						}
					}, [values.phoneNumber_phone, values.phoneNumber_country]);

					// Get current country for dynamic placeholder
					const currentCountry = countries.find(c => c.code === values.phoneNumber_country) || country;

					return (
						<FormPhoneInput
							name="phoneNumber"
							label="Phone Number"
							placeholder={'e.g. ' + currentCountry.placeholder}
							countries={countries}
							flagIcons={flagIcons}
							isLast={true}
							onCountryChange={(selectedCountry) => {
								setCountry(selectedCountry);
							}}
						/>
					);
				}}
			</FormikHelper>
		</View>
	)
}

const Page2 = ({ otp, setOtp, otpIsValid, setOtpIsValid, onSubmit }) => {
	return (
		<View style={styles.wizardPageContainer}>
			<View style={styles.titleContainer}>
				<Image style={styles.titleIcon} source={require('../../../assets/icon_login.png')} />
				<Text style={styles.titleText}>Enter the verification code.</Text>
				<Text style={styles.titleDesc}>You have received this code via SMS</Text>
			</View>
			<OTPTextInput
				inputCount={6}
				handleTextChange={(value) => {
					if (value.length < 6) {
						setOtpIsValid(false);
					} else {
						setOtpIsValid(true);
						setOtp(value);
						// Auto-submit when OTP is complete
						setTimeout(() => {
							if (onSubmit) {
								onSubmit();
							}
						}, 100);
					}
				}}
				tintColor={colors.SECONDARY}
				offTintColor={colors.PRIMARY}
				textInputStyle={{
					borderWidth: 2,
					borderRadius: 10,
					height: 50,
					width: 45,
					fontSize: 20,
					fontFamily: 'Geologica-Medium',
					color: colors.PRIMARY
				}}
			/>
		</View>
	)
}

// Assign wizard pages after they are defined
wizardPages = [Page1, Page2];

export default SignUpScreen;