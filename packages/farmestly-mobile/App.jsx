import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Linking } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, ActivityIndicator, View, StyleSheet, Text, Image } from 'react-native';
import Toast from 'react-native-toast-message';

// Initialize i18n BEFORE any components that use translations
import './src/globals/i18n';

// JobService initializes lazily via GlobalContextProvider - no early init needed

// Import screens
import { SplashScreen, EntryScreen, SignUpScreen } from './src/components/screens/auth';
import { FirstSetupScreen, SettingsScreen, EmailSettingsScreen } from './src/components/screens/settings';
import { SowJobScreen, HarvestJobScreen, CustomJobScreen, SprayJobScreen, IrrigationJobScreen, JobSummaryScreen, JobDetailScreen } from './src/components/screens/jobs';
import { FieldGroupsScreen, EditFieldGroupScreen, FieldRedrawScreen, CultivationScreen, FiltersScreen } from './src/components/screens/fields';
import { CreateReportScreen } from './src/components/screens/reports';
import { EditEntityScreen } from './src/components/screens/entities';

// Core components
import Field from './src/components/Field';
import { BottomSheetContextProvider } from './src/components/sheets/BottomSheetContextProvider';
import { GlobalContextProvider, useGlobalContext } from './src/components/context/GlobalContextProvider';
import { LocaleProvider } from './src/providers/LocaleProvider';
import TabNavigator from './src/components/TabNavigator';
import { UnitsWrapper } from './src/components/UnitsWrpper';
import TemplateWizardScreen from './src/components/templateWizard/TemplateWizardScreen';
import colors from './src/globals/colors';

// Create stack navigator
const Stack = createNativeStackNavigator();

// Deep link configuration
const linking = {
	prefixes: ['farmestly://'],
	config: {
		screens: {
			// Map deep link paths to screens
			// farmestly://emailVerified?status=success will be handled via onStateChange
		}
	}
};

// Component to handle deep links with access to GlobalContext
const DeepLinkHandler = ({ children }) => {
	const { refresh } = useGlobalContext();

	const handleDeepLink = useCallback(async (url) => {
		if (!url) return;

		try {
			// Parse URL manually since URL API isn't fully supported in React Native
			// Expected format: farmestly://emailVerified?status=success
			const [scheme, rest] = url.split('://');
			if (!rest || scheme !== 'farmestly') return;

			const [path, queryString] = rest.split('?');
			const params = {};
			if (queryString) {
				queryString.split('&').forEach(pair => {
					const [key, value] = pair.split('=');
					if (key) params[key] = decodeURIComponent(value || '');
				});
			}

			// Handle farmestly://emailVerified?status=...
			if (path === 'emailVerified') {
				const status = params.status;

				if (status === 'success') {
					// Refresh data to get updated emailVerified status
					await refresh();
					Toast.show({
						type: 'success',
						text1: 'Email Verified',
						text2: 'Your email address has been successfully verified.',
						position: 'top',
						visibilityTime: 4000,
						topOffset: 60,
						autoHide: true
					});
				} else if (status === 'error') {
					Toast.show({
						type: 'error',
						text1: 'Verification Failed',
						text2: 'There was a problem verifying your email. Please try again.',
						position: 'top',
						visibilityTime: 4000,
						topOffset: 60,
						autoHide: true
					});
				} else if (status === 'expired') {
					Toast.show({
						type: 'error',
						text1: 'Link Expired',
						text2: 'This verification link has expired. Please request a new one.',
						position: 'top',
						visibilityTime: 4000,
						topOffset: 60,
						autoHide: true
					});
				}
			}
		} catch (error) {
			console.error('Error handling deep link:', error);
		}
	}, [refresh]);

	useEffect(() => {
		// Handle deep link when app is opened from a link
		Linking.getInitialURL().then(handleDeepLink);

		// Handle deep link when app is already open
		const subscription = Linking.addEventListener('url', ({ url }) => {
			handleDeepLink(url);
		});

		return () => {
			subscription.remove();
		};
	}, [handleDeepLink]);

	return children;
};

const App = () => {

	return (
		<SafeAreaProvider>
			<GlobalContextProvider>
				<LocaleProvider>
					<UnitsWrapper>
						<DeepLinkHandler>
							<StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
							<SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}  >
								<KeyboardProvider
									statusBarTranslucent
									navigationBarTranslucent
								>
									<NavigationContainer linking={linking}>
										<BottomSheetContextProvider>
										<Stack.Navigator
											initialRouteName="Splash"
											screenOptions={{
												headerShown: false,
												gestureEnabled: false,
												animation: 'slide_from_right',
												contentStyle: { backgroundColor: 'white' },
											}}

										>
											<Stack.Screen name="Splash" component={SplashScreen} />
											<Stack.Screen name="Entry" component={EntryScreen} />
											<Stack.Screen name="SignUp" component={SignUpScreen} />
											<Stack.Screen name="Setup" component={FirstSetupScreen} />
											<Stack.Screen name="Main" component={TabNavigator} />
											<Stack.Screen name="Field" component={Field} />
											<Stack.Screen name="Settings" component={SettingsScreen} />
											<Stack.Screen name="SowJobScreen" component={SowJobScreen} />
											<Stack.Screen name="SprayJobScreen" component={SprayJobScreen} />
											<Stack.Screen name="HarvestJobScreen" component={HarvestJobScreen} />
											<Stack.Screen name="IrrigationJobScreen" component={IrrigationJobScreen} />
											<Stack.Screen name="CustomJobScreen" component={CustomJobScreen} />
											<Stack.Screen name="JobSummaryScreen" component={JobSummaryScreen} />
											<Stack.Screen name="FieldGroupsScreen" component={FieldGroupsScreen} />
											<Stack.Screen name="EditFieldGroupScreen" component={EditFieldGroupScreen} />
											<Stack.Screen name="FieldRedrawScreen" component={FieldRedrawScreen} />
											<Stack.Screen name="EditEntityScreen" component={EditEntityScreen} />
											<Stack.Screen name="CreateReportScreen" component={CreateReportScreen} />
											<Stack.Screen name="JobDetailScreen" component={JobDetailScreen} />
											<Stack.Screen name="CultivationScreen" component={CultivationScreen} />
											<Stack.Screen name="EmailSettingsScreen" component={EmailSettingsScreen} />
											<Stack.Screen name="FiltersScreen" component={FiltersScreen} />
											<Stack.Screen name="TemplateWizardScreen" component={TemplateWizardScreen} />
										</Stack.Navigator>
										</BottomSheetContextProvider>
									</NavigationContainer>
								</KeyboardProvider>
							</SafeAreaView>
						</DeepLinkHandler>
					</UnitsWrapper>
				</LocaleProvider>
			</GlobalContextProvider>
			<Toast
				config={{
					success: ({ text1, text2 }) => (
						<View style={toastStyles.container}>
							<View style={toastStyles.titleContainer}>
								<Image
									source={require('./src/assets/icons/check_brown.png')}
									style={toastStyles.icon}
								/>
								<Text style={toastStyles.title}>{text1}</Text>
							</View>
							<Text style={toastStyles.message}>{text2}</Text>
						</View>
					)
				}}
			/>
		</SafeAreaProvider>
	);
};

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: colors.PRIMARY,
	},
});

const toastStyles = StyleSheet.create({
	container: {
		width: '90%',
		// backgroundColor: '#fff',
		backgroundColor: colors.SECONDARY_LIGHT,
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: colors.SECONDARY,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 15,
	},
	titleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 7
	},
	icon: {
		width: 18,
		height: 18,
		marginBottom: -2,
	},
	title: {
		fontSize: 18,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
	},
	message: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		lineHeight: 22,
	},
});

export default App;