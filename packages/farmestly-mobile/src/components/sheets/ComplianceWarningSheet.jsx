import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import colors from '../../globals/colors';
import PrimaryButton from '../ui/core/PrimaryButton';
import { formatComplianceDate } from '../../utils/compliance';
import { useTranslation } from 'react-i18next';

const ComplianceWarningSheet = ({ type, field, endDate, remaining, onProceed, onCancel }) => {
	const { t } = useTranslation();
	const isREI = type === 'rei';

	const config = isREI ? {
		title: t('common:compliance.reiTitle'),
		description: t('common:compliance.reiDescription'),
		remainingLabel: t('common:compliance.timeRemaining'),
		remainingValue: `${remaining} ${t('common:compliance.hours')}`,
		safeLabel: t('common:compliance.safeReEntry'),
	} : {
		title: t('common:compliance.phiTitle'),
		description: t('common:compliance.phiDescription'),
		remainingLabel: t('common:compliance.daysRemaining'),
		remainingValue: `${remaining} ${t('common:compliance.days')}`,
		safeLabel: t('common:compliance.safeHarvest'),
	};

	return (
		<BottomSheetView style={styles.container}>
			<Text style={styles.icon}>!</Text>

			<Text style={styles.title}>{config.title}</Text>

			<Text style={styles.description}>{config.description}</Text>

			<View style={styles.infoContainer}>
				<View style={styles.infoRow}>
					<Text style={styles.infoLabel}>{t('common:compliance.field')}</Text>
					<Text style={styles.infoValue}>{field.name}</Text>
				</View>

				<View style={styles.infoRow}>
					<Text style={styles.infoLabel}>{config.remainingLabel}</Text>
					<Text style={styles.infoValue}>{config.remainingValue}</Text>
				</View>

				<View style={styles.infoRow}>
					<Text style={styles.infoLabel}>{config.safeLabel}</Text>
					<Text style={styles.infoValue}>{formatComplianceDate(endDate)}</Text>
				</View>
			</View>

			<Text style={styles.question}>{t('common:compliance.proceedQuestion')}</Text>

			<View style={styles.buttonContainer}>
				<PrimaryButton
					text={t('common:compliance.proceedAnyway')}
					onPress={onProceed}
				/>
				<PrimaryButton
					text={t('common:buttons.cancel')}
					variant="outline"
					onPress={onCancel}
				/>
			</View>
		</BottomSheetView>
	);
};

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 24,
	},
	icon: {
		fontFamily: 'Geologica-Bold',
		fontSize: 48,
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 16,
		marginTop: -6
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 16,
	},
	description: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		textAlign: 'center',
		lineHeight: 22,
		marginBottom: 24,
	},
	infoContainer: {
		marginBottom: 24,
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	infoLabel: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.SECONDARY,
	},
	infoValue: {
		fontFamily: 'Geologica-Medium',
		fontSize: 16,
		color: colors.PRIMARY,
	},
	question: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 24,
	},
	buttonContainer: {
		gap: 12,
	},
});

export default ComplianceWarningSheet;
