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
			console.log('[SplashScreen] Starting init...');
			const data = await loadData();
			console.log('[SplashScreen] loadData returned:', data ? 'data' : 'null', 'account:', !!data?.account);

			if (!data?.account) {
				console.log('[SplashScreen] No data/account, going to Entry');
				navigation.replace('Entry');
				return;
			}

			if (!data.account.setupCompleted) {
				console.log('[SplashScreen] Setup not completed, going to Setup');
				navigation.replace('Setup');
				return;
			}

			console.log('[SplashScreen] All good, going to Main');
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