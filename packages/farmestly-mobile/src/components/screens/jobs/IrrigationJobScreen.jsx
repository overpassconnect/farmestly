import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useUnits } from '../../../providers/UnitsProvider';
import { FormikHelper, FormDropdown } from '../../ui/form';
import { irrigationJobSchema } from '../../../validation';
import JobService from '../../../utils/JobService';
import { demuxIrrigationJob } from '../../../utils/jobDemux';
import { resolveTemplate, getTemplateErrorMessage } from '../../../utils/templateResolver';
import { resolveEquipment, buildCultivation } from '../../../utils/jobHelpers';

const IrrigationJobScreen = () => {
	const { t } = useTranslation(['screens', 'common']);
	const navigation = useNavigation();
	const route = useRoute();
	const { field, fields, templateId } = route.params || {};
	const targetFields = fields || (field ? [field] : []);
	const isMultiField = targetFields.length > 1;
	const totalArea = targetFields.reduce((sum, f) => sum + (f.area || 0), 0);
	const { farmData } = useGlobalContext();
	const { symbol, format } = useUnits();

	// Get irrigation attachments only
	const irrigationAttachments = useMemo(() => {
		if (!farmData?.attachments) return [];
		return farmData.attachments.filter(a => a.usedFor === 'irrigate' && a.litersPerHour > 0);
	}, [farmData?.attachments]);

	// Initial form values - will be updated from template if provided
	const [initialValues, setInitialValues] = useState({
		irrigatorId: ''
	});

	// Template resolution effect
	useEffect(() => {
		if (templateId && farmData) {
			const template = farmData.jobTemplates?.find(t => t.id === templateId || t._id === templateId);
			if (!template) {
				Alert.alert('Error', 'Template not found', [
					{ text: 'OK', onPress: () => navigation.goBack() }
				]);
				return;
			}

			const resolved = resolveTemplate(template, farmData);

			if (!resolved.isValid) {
				const errorMessage = getTemplateErrorMessage(resolved);
				Alert.alert(
					'Template Issues',
					errorMessage,
					[
						{ text: 'Cancel', onPress: () => navigation.goBack() },
						{ text: 'Continue Anyway' }
					]
				);
			} else if (resolved.attachment) {
				// Pre-populate irrigator from template
				setInitialValues({ irrigatorId: resolved.attachment.id });
			}
		}
	}, [templateId, farmData]);

	// Handle start irrigation
	const handleStartIrrigation = (values) => {
		const selectedIrrigator = irrigationAttachments.find(a => a._id === values.irrigatorId);

		if (!selectedIrrigator) {
			return;
		}

		// Get template and resolve equipment
		const template = templateId
			? farmData.jobTemplates?.find(t => t.id === templateId || t._id === templateId)
			: null;

		// Build embedded equipment snapshots
		const machineSnapshot = template?.machineId
			? (() => {
					const m = farmData.machines?.find(m => m._id === template.machineId);
					return m ? { id: m._id, name: m.name, make: m.make } : null;
				})()
			: null;

		const attachmentSnapshot = template?.attachmentId
			? (() => {
					const a = farmData.attachments?.find(a => a._id === template.attachmentId);
					return a ? { id: a._id, name: a.name, type: a.type } : null;
				})()
			: null;

		const toolSnapshot = template?.toolId
			? (() => {
					const t = farmData.tools?.find(t => t._id === template.toolId);
					return t ? { id: t._id, name: t.name, brand: t.brand } : null;
				})()
			: null;

		const templateSnapshot = template
			? { id: template._id || template.id, name: template.name }
			: null;

		// Build shared configuration with ALL required fields
		const sharedConfig = {
			// Equipment snapshots for job record
			template: templateSnapshot,
			machine: machineSnapshot,
			attachment: attachmentSnapshot,
			tool: toolSnapshot,

			// Irrigator info
			irrigator: {
				id: selectedIrrigator._id,
				name: selectedIrrigator.name,
				litersPerHour: selectedIrrigator.litersPerHour
			}
		};

		if (isMultiField) {
			// Multi-field batch mode: demux and start batch
			const payloads = demuxIrrigationJob(targetFields, sharedConfig);
			JobService.startBatch(payloads)
				.then(() => {
					navigation.navigate('Main', { screen: 'Home' });
				})
				.catch(error => {
					console.error('Error starting batch irrigation:', error);
				});
		} else {
			// Single-field mode: build complete job payload and navigate
			const singleField = targetFields[0];

			// Resolve equipment from template
			const equipment = template ? resolveEquipment(farmData, template) : {};

			// Build cultivation object
			const cultivation = buildCultivation(singleField);

			// Build complete job payload with new schema
			const jobPayload = {
				type: 'irrigate',
				fieldId: singleField._id,
				template: templateSnapshot,
				machine: equipment.machine || null,
				attachment: equipment.attachment || null,
				tool: equipment.tool || null,
				cultivation,
				data: {
					irrigate: {
						irrigatorId: sharedConfig.irrigator.id,
						irrigatorName: sharedConfig.irrigator.name,
						litersPerHour: sharedConfig.irrigator.litersPerHour
					}
				},
				notes: ''
			};

			// Navigate to TabHome with job payload
			navigation.navigate('Main', {
				screen: 'Home',
				params: {
					startJobRecording: jobPayload
				}
			});
		}
	};

	return (
		<KeyboardAwareScrollView
			style={styles.safeArea}
			contentContainerStyle={styles.container}
			bottomOffset={100}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={styles.title}>{t('common:jobTypeDisplays.irrigation')}</Text>
			{isMultiField ? (
				<Text style={styles.fieldName}>
					{targetFields.length} fields • {format(totalArea, 'area')}
				</Text>
			) : (
				<Text style={styles.fieldName}>{targetFields[0]?.name}</Text>
			)}

			{/* Current Cultivation Info (single field only) */}
			{!isMultiField && targetFields[0]?.currentCultivation && (
				<View style={styles.cultivationInfo}>
					<Text style={styles.infoLabel}>{t('common:labels.crop')}:</Text>
					<Text style={styles.infoValue}>{targetFields[0].currentCultivation.crop}</Text>

					{targetFields[0].currentCultivation.variety && (
						<>
							<Text style={styles.infoLabel}>{t('common:labels.variety')}:</Text>
							<Text style={styles.infoValue}>{targetFields[0].currentCultivation.variety}</Text>
						</>
					)}
				</View>
			)}

			<FormikHelper
				initialValues={initialValues}
				validationSchema={irrigationJobSchema}
				onSubmit={handleStartIrrigation}
				enableReinitialize={true}
			>
				{({ handleSubmit, isValid, values }) => {
					const selectedIrrigator = irrigationAttachments.find(a => a._id === values.irrigatorId);

					return (
						<>
							{/* Irrigator Selection */}
							{irrigationAttachments.length > 0 ? (
								<>
									<FormDropdown
										name="irrigatorId"
										label={t('common:labels.selectIrrigator')}
										placeholder={t('common:placeholders.chooseIrrigator')}
										items={irrigationAttachments}
										keyExtractor={item => item._id}
										labelExtractor={item => item.name}
										subLabelExtractor={item => `${t('common:labels.flowRate')}: ${item.litersPerHour} ${symbol('volume')}/hour`}
										searchKeys={['name']}
										isLast={true}
									/>

									{/* Info Note */}
									{selectedIrrigator && (
										<View style={styles.noteContainer}>
											<Text style={styles.noteTitle}>{t('common:general.information')}</Text>
											<Text style={styles.noteText}>
												{t('common:descriptions.waterUsageCalculation', {
													flowRate: selectedIrrigator.litersPerHour,
													unit: symbol('volume')
												})}
											</Text>
										</View>
									)}

									{/* Start Button */}
									<View style={styles.buttonsContainer}>
										<PrimaryButton
											text={t('common:buttons.start')}
											onPress={handleSubmit}
											disabled={!isValid}
										/>
									</View>
								</>
							) : (
								<>
									<View style={styles.emptyContainer}>
										<Text style={styles.emptyText}>
											{t('common:messages.noIrrigationAttachments')}
										</Text>
										<Text style={styles.emptySubText}>
											{t('common:messages.addIrrigationAttachment')}
										</Text>
									</View>

									<View style={styles.buttonsContainer}>
										<PrimaryButton
											text={t('common:buttons.goToAttachments')}
											onPress={() => {
												navigation.navigate('EditEntityScreen', {
													entityType: 'attachment',
													isAdding: true
												});
											}}
										/>
									</View>
								</>
							)}
						</>
					);
				}}
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
	noteContainer: {
		backgroundColor: '#F0F9FF',
		padding: 16,
		borderRadius: 12,
		marginVertical: 20,
		borderLeftWidth: 4,
		borderLeftColor: colors.SECONDARY,
	},
	noteTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.PRIMARY,
		marginBottom: 4,
		fontFamily: 'Geologica-Medium',
	},
	noteText: {
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		lineHeight: 20,
		fontFamily: 'Geologica-Regular',
	},
	emptyContainer: {
		alignItems: 'center',
		paddingVertical: 40,
		paddingHorizontal: 20,
	},
	emptyText: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 8,
		fontFamily: 'Geologica-Medium',
	},
	emptySubText: {
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		fontFamily: 'Geologica-Regular',
	},
	buttonsContainer: {
		marginTop: 32,
		alignItems: 'center',
	},
});

export default IrrigationJobScreen;
