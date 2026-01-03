import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import { FormikHelper, FormInput } from '../../ui/form';
import { resolveEquipment, buildCultivation } from '../../../utils/jobHelpers';

const HarvestJobScreen = () => {
	const { t } = useTranslation(['screens', 'common']);
	const navigation = useNavigation();
	const route = useRoute();
	const { field, templateId } = route.params || {};
	const { farmData } = useGlobalContext();

	const [isFinalHarvest, setIsFinalHarvest] = useState(true);

	const handleSubmit = (values) => {
		const template = templateId ? farmData.jobTemplates?.find(t => t._id === templateId) : null;
		const equipment = template ? resolveEquipment(farmData, template) : { machine: null, attachment: null, tool: null };
		const cultivation = buildCultivation(field);

		navigation.navigate('Main', {
			screen: 'Home',
			params: {
				startJobRecording: {
					type: 'harvest',
					fieldId: field._id,
					template: template ? { id: template._id, name: template.name } : null,
					machine: equipment.machine,
					attachment: equipment.attachment,
					tool: equipment.tool,
					cultivation: cultivation,
					data: {
						harvest: {
							isFinal: isFinalHarvest
						}
					},
					notes: values.notes.trim()
				}
			}
		});
	};

	return (
		<KeyboardAwareScrollView
			style={styles.safeArea}
			contentContainerStyle={styles.container}
			bottomOffset={100}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={styles.title}>
				{t('screens:harvestJob.title')} {field.currentCultivation.crop}
			</Text>
			<Text style={styles.fieldName}>{field.name}</Text>

			<View style={styles.cultivationInfo}>
				<Text style={styles.infoLabel}>{t('common:labels.crop')}:</Text>
				<Text style={styles.infoValue}>{field.currentCultivation.crop}</Text>

				{field.currentCultivation.variety && (
					<>
						<Text style={styles.infoLabel}>{t('common:labels.variety')}:</Text>
						<Text style={styles.infoValue}>{field.currentCultivation.variety}</Text>
					</>
				)}
			</View>

			<FormikHelper
				initialValues={{ notes: '' }}
				onSubmit={handleSubmit}
			>
				{({ handleSubmit }) => (
					<>
						<FormInput
							name="notes"
							label={t('common:labels.notesOptional')}
							placeholder={t('common:placeholders.enterHarvestNotes')}
							isLast={true}
						/>

						<View style={styles.optionContainer}>
							<Text style={styles.optionLabel}>{t('screens:harvestJob.isFinalHarvest')}</Text>
							<View style={styles.optionButtons}>
								<PrimaryButton
									text={t('common:buttons.yes')}
									variant={isFinalHarvest ? 'filled' : 'outline'}
									style={{ width: 150 }}
									onPress={() => setIsFinalHarvest(true)}
								/>
								<PrimaryButton
									text={t('common:buttons.no')}
									variant={!isFinalHarvest ? 'filled' : 'outline'}
									style={{ width: 150 }}
									onPress={() => setIsFinalHarvest(false)}
								/>
							</View>
						</View>

						<View style={styles.buttonsContainer}>
							<PrimaryButton
								text={t('common:buttons.start')}
								onPress={handleSubmit}
							/>
						</View>
					</>
				)}
			</FormikHelper>
		</KeyboardAwareScrollView>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#fff',
	},
	keyboardAvoid: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	container: {
		flex: 1,
		padding: 20,
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		color: colors.PRIMARY,
		marginBottom: 8,
		fontFamily: 'Geologica-Bold',
	},
	fieldName: {
		fontSize: 18,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 24,
		fontFamily: 'Geologica-Regular',
	},
	cultivationInfo: {
		backgroundColor: '#F8F9FA',
		padding: 16,
		borderRadius: 12,
		marginBottom: 20,
	},
	infoLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: colors.PRIMARY,
		marginBottom: 4,
		fontFamily: 'Geologica-Medium',
	},
	infoValue: {
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 12,
		fontFamily: 'Geologica-Regular',
	},
	optionContainer: {
		marginVertical: 20,
	},
	optionLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.PRIMARY,
		marginBottom: 12,
		textAlign: 'center',
		fontFamily: 'Geologica-Medium',
	},
	optionButtons: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		marginTop: 8,
	},
	buttonsContainer: {
		marginTop: 32,
		alignItems: 'center',
	},
});

export default HarvestJobScreen;