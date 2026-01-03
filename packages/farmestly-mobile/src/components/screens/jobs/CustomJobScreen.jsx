import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { FormikHelper, FormInput } from '../../ui/form';
import { resolveEquipment, buildCultivation } from '../../../utils/jobHelpers';

const CustomJobScreen = () => {
	const { t } = useTranslation(['common']);
	const navigation = useNavigation();
	const route = useRoute();
	const { field, jobTemplate } = route.params;
	const { farmData } = useGlobalContext();

	// Initial form values
	const initialValues = {
		notes: ''
	};

	// Resolve equipment from template
	const equipment = resolveEquipment(farmData, jobTemplate);
	const cultivation = buildCultivation(field);

	// Handle start recording
	const handleStartRecording = (values) => {
		const recordingData = {
			type: 'custom',
			fieldId: field._id,
			template: { id: jobTemplate._id, name: jobTemplate.name },
			machine: equipment.machine,
			attachment: equipment.attachment,
			tool: equipment.tool,
			cultivation: cultivation,
			data: {},
			notes: values.notes.trim(),
		};

		navigation.navigate('Main', {
			screen: 'Home',
			params: {
				startJobRecording: recordingData
			}
		});
	};

	return (
		<KeyboardAwareScrollView
			style={styles.safeArea}
			contentContainerStyle={styles.container}
			bottomOffset={50}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={styles.title}>{jobTemplate.name}</Text>
			<Text style={styles.fieldName}>{field.name}</Text>

			{/* Equipment Summary */}
			{(equipment.machine || equipment.attachment || equipment.tool) && (
				<View style={styles.equipmentContainer}>
					<Text style={styles.equipmentTitle}>Equipment:</Text>
					{equipment.machine && <Text style={styles.equipmentText}>{t('common:general.machinery')}: {equipment.machine.name}</Text>}
					{equipment.attachment && <Text style={styles.equipmentText}>{t('common:general.attachments')}: {equipment.attachment.name}</Text>}
					{equipment.tool && <Text style={styles.equipmentText}>{t('common:general.tools')}: {equipment.tool.name}</Text>}
				</View>
			)}

			<FormikHelper
				initialValues={initialValues}
				onSubmit={handleStartRecording}
			>
				{(formikProps) => (
					<>
						<FormInput
							name="notes"
							label={t('common:labels.notesOptional')}
							placeholder={t('common:placeholders.enterNotes')}
							multiline={true}
							numberOfLines={3}
						/>

						<ButtonStack>
							<PrimaryButton
								text={t('common:buttons.start')}
								onPress={formikProps.handleSubmit}
								fullWidth
							/>
							<PrimaryButton
								variant="outline"
								text={t('common:buttons.cancel')}
								onPress={() => navigation.goBack()}
								fullWidth
							/>
						</ButtonStack>
					</>
				)}
			</FormikHelper>
		</KeyboardAwareScrollView>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: 'white',
	},
	keyboardAvoid: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	container: {
		padding: 24,
		flex: 1,
	},
	title: {
		fontSize: 28,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	fieldName: {
		fontSize: 18,
		fontFamily: 'Geologica-Regular',
		color: colors.SECONDARY,
		marginBottom: 24,
	},
	equipmentContainer: {
		backgroundColor: colors.SECONDARY_LIGHT,
		padding: 16,
		borderRadius: 12,
		marginBottom: 24,
	},
	equipmentTitle: {
		fontSize: 16,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	equipmentText: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	buttonsContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		gap: 15,
		marginTop: 30,
	},
});

export default CustomJobScreen;