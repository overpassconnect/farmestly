import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useGlobalContext } from './context/GlobalContextProvider';
import colors from '../globals/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../providers/LocaleProvider';

import TabHome from './tabs/TabHome';
import TabJobs from './tabs/TabJobs';
import TabEquipment from './tabs/TabEquipment';
import TabCultivations from './tabs/TabCultivations';
import TabInputs from './tabs/TabInputs';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

const TabNavigator = () => {
	const insets = useSafeAreaInsets();

	const { t } = useTranslation();

	const { hasAnyActiveRecording } = useGlobalContext();

	const { locale } = useLocale();

	return (
		<View style={{ flex: 1 }}>
			<Tab.Navigator
				key={locale}
				initialRouteName="Home"
				screenOptions={({ route: tabRoute }) => ({
					lazy: false,
					unmountOnBlur: false,
					headerShown: false,
					sceneStyle: { backgroundColor: colors.PRIMARY },
					tabBarIcon: ({ focused }) => {
						let iconSource;
						if (tabRoute.name === 'Jobs') {
							iconSource = focused
								? require('../assets/icons/tabicon_0_active.png')
								: require('../assets/icons/tabicon_0_inactive.png');
						} else if (tabRoute.name === 'Home') {
							iconSource = focused
								? require('../assets/icons/tabicon_1_active.png')
								: require('../assets/icons/tabicon_1_inactive.png');
						} else if (tabRoute.name === 'Equipment') {
							iconSource = focused
								? require('../assets/icons/tabicon_2_active.png')
								: require('../assets/icons/tabicon_2_inactive.png');
						} else if (tabRoute.name === 'Cultivations') {
							iconSource = focused
								? require('../assets/icons/cultivation_orange.png')
								: require('../assets/icons/cultivation.png');
						} else if (tabRoute.name === 'Inputs') {
							// Temporarily reusing tool icon until proper icon is created
							iconSource = focused
								? require('../assets/icons/inputs_orange.png')
								: require('../assets/icons/inputs.png');
						}

						return (
							<Image
								source={iconSource}
								style={styles.tabIcon}
								resizeMode="contain"
							/>
						);
					},
					tabBarButton: (props) => (
						<TouchableOpacity {...props} android_ripple={false} />
					),
					tabBarStyle: styles.tabBar,
					tabBarLabelStyle: styles.tabBarLabel,
					tabBarActiveTintColor: colors.SECONDARY,
					tabBarInactiveTintColor: 'white',
					tabBarShowLabel: true,
					tabBarLabelPosition: 'below-icon',
					// Use translated labels from the `screens:tabs` namespace, fallback to route name
					// tabBarLabel: t(`screens:tabs.${tabRoute.name.toLowerCase()}`, {
					// 	defaultValue: tabRoute.name,
					// }),
					tabBarLabel: "•" 
				})}
			>
				<Tab.Screen name="Jobs" component={TabJobs} />
				<Tab.Screen name="Home" component={TabHome} />
				<Tab.Screen name="Cultivations" component={TabCultivations} />
				<Tab.Screen name="Equipment" component={TabEquipment} />
				<Tab.Screen name="Inputs" component={TabInputs} />
			</Tab.Navigator>
		</View>
	);
};

const styles = StyleSheet.create({
	tabBar: {
		position: 'absolute',
		bottom: 30,
		marginHorizontal: 15,
		backgroundColor: colors.PRIMARY,
		borderRadius: 18,
		height: 70,
		shadowOpacity: 0.15,
		shadowRadius: 16,
		elevation: 5,
		zIndex: 10,
		borderTopWidth: 0,
		paddingTop: 8,
		paddingBottom: 8,
	},
	tabIcon: {
		width: 26,
		height: 26,
	},
	tabBarLabel: {
		marginTop: 4,
		marginBottom: 0,
		fontSize: 11,
		fontFamily: 'Geologica-Bold',
	},
});

export default TabNavigator;