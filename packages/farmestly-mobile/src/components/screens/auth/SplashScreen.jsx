import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import colors from '../../../globals/colors';
import { useGlobalContext } from '../../context/GlobalContextProvider';

const SplashScreen = ({ navigation }) => {
	const { loadData } = useGlobalContext();

	useEffect(() => {
		init();
	}, []);

	const init = async () => {
		try {
			const data = await loadData();

			if (!data) {
				// No session, no cache
				navigation.replace('Entry');
				return;
			}

			if (!data.account.setupCompleted) {
				navigation.replace('Setup');
				return;
			}

			navigation.replace('Main');
		} catch (err) {
			console.error('[SplashScreen] init error:', err);
			navigation.replace('Entry');
		}
	};

	return (
		<View style={styles.container}>
			<ActivityIndicator size="large" color={colors.SECONDARY} />
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: colors.PRIMARY,
	},
});

export default SplashScreen;