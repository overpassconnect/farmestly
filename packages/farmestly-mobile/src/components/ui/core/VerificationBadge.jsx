import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '../../../globals/colors';

const VerificationBadge = ({ verified, size = 'small' }) => {
	const { t } = useTranslation(['common']);
	const isSmall = size === 'small';

	return (
		<View style={styles.container}>
			<Image
				source={verified
					? require('../../../assets/icons/check_outlined_brown.png')
					: require('../../../assets/icons/exclamation_circle_orange.png')
				}
				style={isSmall ? styles.iconSmall : styles.iconLarge}
			/>
			<Text style={
				isSmall
					? (verified ? styles.textSmallVerified : styles.textSmallPending)
					: (verified ? styles.textLargeVerified : styles.textLargePending)
			}>
				{verified ? t('common:verification.verified') : t('common:verification.pendingVerification')}
			</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	iconSmall: {
		width: 14,
		height: 14,
		marginRight: 4,
	},
	iconLarge: {
		width: 16,
		height: 16,
		marginRight: 6,
	},
	textSmallPending: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.SECONDARY,
	},
	textSmallVerified: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
	},
	textLargePending: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.SECONDARY,
	},
	textLargeVerified: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
	},
});

export default VerificationBadge;
