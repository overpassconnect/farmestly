import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import colors from '../../globals/colors';
import config from '../../globals/config';
import ListItem from '../ui/list/ListItem';

const SelectJobTypeBottomSheet = ({ onSelectType }) => {
	const { t } = useTranslation(['common', 'screens']);

	const jobTypes = [
		{
			key: 'sow',
			label: t('common:jobTypes.sow') || 'Sow',
			description: 'Planting seeds or crops in your field'
		},
		{
			key: 'harvest',
			label: t('common:jobTypes.harvest') || 'Harvest',
			description: 'Gathering mature crops from the field'
		},
		{
			key: 'spray',
			label: t('common:jobTypes.spray') || 'Spray',
			description: 'Applying pesticides, herbicides, or fertilizers'
		},
		{
			key: 'irrigate',
			label: t('common:jobTypes.irrigate') || 'Irrigate',
			description: 'Watering crops or field irrigation'
		},
		{
			key: 'custom',
			label: t('common:jobTypes.custom') || 'Custom',
			description: 'Create your own custom job type'
		}
	];

	return (
		<BottomSheetScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
			<Text style={styles.title}>{t('screens:templateWizard.selectType') || 'Select Job Type'}</Text>
			<Text style={styles.subtitle}>{t('screens:templateWizard.selectTypeSubtitle') || 'Choose the type of job template you want to create'}</Text>

			<View style={styles.listContainer}>
				{jobTypes.map((jobType) => (
					<ListItem
						key={jobType.key}
						icon={config.JOB_TYPE_ICONS[jobType.key]}
						title={jobType.label}
						subTitle1={jobType.description}
						simple={true}
						onPress={() => onSelectType(jobType.key)}
					/>
				))}
			</View>
		</BottomSheetScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white'
	},
	contentContainer: {
		padding: 20,
		paddingBottom: 40
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		marginBottom: 8
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 24
	},
	listContainer: {
		gap: 12
	}
});

export default SelectJobTypeBottomSheet;
