import React, { useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';

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
import { SowJobScreen, HarvestJobScreen, CustomJobScreen, SprayJobScreen, IrrigationJobScreen, JobSummaryScreen, EditJobScreen, JobDetailScreen } from './src/components/screens/jobs';
import { FieldGroupsScreen, EditFieldGroupScreen, FieldRedrawScreen, CultivationScreen, FiltersScreen } from './src/components/screens/fields';
import { CreateReportScreen } from './src/components/screens/reports';
import { EditEntityScreen } from './src/components/screens/entities';

// Core components
import Field from './src/components/Field';
import { BottomSheetContextProvider } from './src/components/sheets/BottomSheetContextProvider';
import { GlobalContextProvider } from './src/components/context/GlobalContextProvider';
import { LanguageContextProvider } from './src/components/context/LanguageContextProvider';
import TabNavigator from './src/components/TabNavigator';
import { UnitsWrapper } from './src/components/UnitsWrpper';
import TemplateWizardScreen from './src/components/templateWizard/TemplateWizardScreen';
import colors from './src/globals/colors';

// Create stack navigator
const Stack = createNativeStackNavigator();

const App = () => {

	return (
		<SafeAreaProvider>
			<GlobalContextProvider>
				<LanguageContextProvider>
					<UnitsWrapper>
						<StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
						<SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}  >
							<KeyboardProvider
								statusBarTranslucent
								navigationBarTranslucent
							>
								<NavigationContainer>
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
											<Stack.Screen name="EditJobScreen" component={EditJobScreen} />
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
					</UnitsWrapper>
				</LanguageContextProvider>
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