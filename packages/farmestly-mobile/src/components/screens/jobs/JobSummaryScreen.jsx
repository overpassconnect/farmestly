import React, { useEffect, useState } from 'react';
import { api } from '../../../globals/api';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	ActivityIndicator,
	Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import ButtonStack from '../../ui/core/ButtonGroup';
import JobService from '../../../utils/JobService';
import config from '../../../globals/config';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { FormikHelper, FormInput } from '../../ui/form';
import * as Yup from 'yup';
import { useUnits } from '../../../providers/UnitsProvider';
import { useTranslation } from 'react-i18next';

const BASE_URL = config.BASE_URL;

// Validation schema for harvest data
const harvestValidationSchema = Yup.object().shape({
	harvestedKg: Yup.number()
		.required('Harvested amount is required')
		.positive('Amount must be greater than 0')
		.typeError('Please enter a valid number'),
});

const JobSummaryScreen = () => {
	const { t } = useTranslation();
	const { farmData, setFarmData } = useGlobalContext();
	const { format, formatRate, formatProductRate, symbol, parse } = useUnits();
	const navigation = useNavigation();
	const route = useRoute();
	const { completedRecording, readOnly } = route.params;

	// Sync status: 'pending' | 'synced'
	// If job already has _id, it's synced. Otherwise listen to JobService.
	const [syncStatus, setSyncStatus] = useState(
		completedRecording._id || readOnly ? 'synced' : 'pending'
	);
	const [recordingWithId, setRecordingWithId] = useState(completedRecording);
	const [isSyncingKg, setIsSyncingKg] = useState(false);

	// Listen to JobService sync events
	useEffect(() => {
		// Already synced, no need to listen
		if (recordingWithId._id || readOnly) {
			return;
		}

		const unsubscribe = JobService.on((event, data) => {
			if (event === 'jobSynced' && data?.jobId === completedRecording.id) {
				console.log('[JobSummaryScreen] Job synced:', data);
				setSyncStatus('synced');
				if (data.serverJobId) {
					setRecordingWithId(prev => ({ ...prev, _id: data.serverJobId }));
				}
			}
		});

		return unsubscribe;
	}, [completedRecording.id, readOnly, recordingWithId._id]);

	const handleSubmitHarvest = async (values) => {
		if (syncStatus !== 'synced' || !recordingWithId._id) {
			// Store locally for later sync
			setIsSyncingKg(true);
			try {
				// Update the recording locally
				const updatedRecording = {
					...recordingWithId,
					harvestedKg: parse(values.harvestedKg, 'mass'),
					isFinalHarvest: recordingWithId.isFinalHarvest
				};

				// JobService has already saved this to pending queue when job was stopped
				// No manual intervention needed for sync

				setRecordingWithId(updatedRecording);
				setIsSyncingKg(false);
				handleClose();
			} catch (error) {
				console.error('Error saving harvest data locally:', error);
				setIsSyncingKg(false);
			}
		} else {
			// Sync directly to server
			setIsSyncingKg(true);
			try {
				const response = await api(`${BASE_URL}/job/record/update`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jobId: recordingWithId._id,
						harvestedKg: parse(values.harvestedKg, 'mass'),
						isFinalHarvest: recordingWithId.isFinalHarvest,
						cultivationId: recordingWithId.cultivationId
					})
				});

				if (response) {
					const data = await response.json();
					console.log(data);
					if (data.HEADERS.STATUS_CODE === 'OK') {
						// Update farm data if cultivation was ended
						if (data.PAYLOAD && data.PAYLOAD.farm) {
							setFarmData(data.PAYLOAD.farm);
						}
						setIsSyncingKg(false);
						handleClose();
					}
				} else {
					setIsSyncingKg(false);
					console.error('Server error updating harvest data');
				}
			} catch (error) {
				setIsSyncingKg(false);
				console.error('Error syncing harvest data:', error);
			}
		}
	};

	// Handle editing the job record
	const handleEditJob = () => {
		// Check if record has been synced - need server _id to edit
		if (!recordingWithId._id) {
			Alert.alert(
				t('screens:jobSummary.cannotEdit'),
				t('screens:jobSummary.cannotEditMessage')
			);
			return;
		}

		// Navigate to job detail screen
		navigation.navigate('JobDetailScreen', {
			jobRecord: recordingWithId
		});
	};

	// Handle closing the summary screen
	const handleClose = () => {
		// No need to refresh farm data - UPDATES mechanism handles state sync
		navigation.replace('Main');
	};

	// Get sync status display
	const renderSyncStatus = () => {
		if (syncStatus === 'synced') {
			return (
				<View style={styles.syncBanner}>
					<Text style={styles.syncedText}>
						{t('screens:jobSummary.syncedSuccess')}
					</Text>
				</View>
			);
		}

		// pending
		return (
			<View style={styles.syncingBanner}>
				<ActivityIndicator size="small" color="#2196F3" style={styles.syncingIndicator} />
				<Text style={styles.syncingText}>
					{t('screens:jobSummary.syncingImmediate')}
				</Text>
			</View>
		);
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' • ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const formatDuration = (ms) => {
		if (!ms) return 'N/A';
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	};

	const getJobTypeName = (jobType) => {
		switch (jobType) {
			case 'sow':
				return t('screens:jobSummary.sowing');
			case 'harvest':
				return t('screens:jobSummary.harvesting');
			case 'spray':
				return t('screens:jobSummary.spraying');
			case 'irrigate':
			case 'irrigation':
				return t('screens:jobSummary.irrigation');
			case 'custom':
				return recordingWithId.jobTitle || t('screens:jobSummary.customJob');
			default:
				return t('screens:jobSummary.job');
		}
	};

	// Support both old and new schema for job type and harvest data
	const jobType = recordingWithId.type || recordingWithId.jobType;
	const harvestedAmount = recordingWithId.data?.harvest?.amount || recordingWithId.harvestedKg;
	const needsHarvestData = (jobType === 'harvest') && !harvestedAmount;

	return (
		<View style={styles.container}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.title}>{getJobTypeName(jobType)}</Text>
					<Text style={styles.subtitle}>{recordingWithId.fieldName}</Text>
				</View>

				{/* Sync Status Banner */}
				{renderSyncStatus()}

				{/* Time & Duration Section */}
				<View style={styles.section}>
					<Text style={styles.sectionHeader}>{t('screens:jobSummary.timeAndDuration')}</Text>

					<View style={styles.row}>
						<Text style={styles.label}>{t('screens:jobSummary.startTime')}</Text>
						<Text style={styles.value}>{formatDate(recordingWithId.startedAt || recordingWithId.startTime)}</Text>
					</View>

					<View style={styles.row}>
						<Text style={styles.label}>{t('screens:jobSummary.endTime')}</Text>
						<Text style={styles.value}>{formatDate(recordingWithId.endedAt || recordingWithId.endTime)}</Text>
					</View>

					<View style={styles.row}>
						<Text style={styles.label}>{t('screens:jobSummary.duration')}</Text>
						<Text style={styles.value}>{formatDuration(recordingWithId.elapsedTime)}</Text>
					</View>
				</View>

				{/* Sowing Details Section */}
				{jobType === 'sow' && (
					<View style={styles.section}>
						<Text style={styles.sectionHeader}>{t('screens:jobSummary.sowingDetails')}</Text>

						<View style={styles.row}>
							<Text style={styles.label}>{t('screens:jobSummary.crop')}</Text>
							<Text style={styles.value}>{recordingWithId.cultivation?.crop || recordingWithId.crop}</Text>
						</View>

						{(recordingWithId.cultivation?.variety || recordingWithId.variety) && (
							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.variety')}</Text>
								<Text style={styles.value}>{recordingWithId.cultivation?.variety || recordingWithId.variety}</Text>
							</View>
						)}

						{recordingWithId.data?.sow?.eppoCode && (
							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.eppoCode')}</Text>
								<Text style={styles.value}>{recordingWithId.data.sow.eppoCode}</Text>
							</View>
						)}

						{recordingWithId.data?.sow?.lotNumber && (
							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.lotNumber')}</Text>
								<Text style={styles.value}>{recordingWithId.data.sow.lotNumber}</Text>
							</View>
						)}

						{recordingWithId.data?.sow?.seedManufacturer && (
							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.seedManufacturer')}</Text>
								<Text style={styles.value}>{recordingWithId.data.sow.seedManufacturer}</Text>
							</View>
						)}
					</View>
				)}

				{/* Harvest Details Section */}
				{jobType === 'harvest' && (
					<View style={styles.section}>
						<Text style={styles.sectionHeader}>{t('screens:jobSummary.harvestDetails')}</Text>

						<View style={styles.row}>
							<Text style={styles.label}>{t('screens:jobSummary.type')}</Text>
							<Text style={styles.value}>
								{(recordingWithId.data?.harvest?.isFinalHarvest ?? recordingWithId.isFinalHarvest) ? t('screens:jobSummary.finalHarvest') : t('screens:jobSummary.partialHarvest')}
							</Text>
						</View>

						{harvestedAmount && (
							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.harvested')}</Text>
								<Text style={styles.value}>{format(harvestedAmount, 'mass')}</Text>
							</View>
						)}
					</View>
				)}

				{/* Spray Details Section */}
				{jobType === 'spray' && (recordingWithId.data?.spray || recordingWithId.sprayData) && (() => {
					const sprayData = recordingWithId.data?.spray || recordingWithId.sprayData;
					return (
						<View style={styles.section}>
							<Text style={styles.sectionHeader}>{t('screens:jobSummary.sprayDetails')}</Text>

							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.sprayer')}</Text>
								<Text style={styles.value}>{sprayData.sprayerName}</Text>
							</View>

							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.carrierRate')}</Text>
								<Text style={styles.value}>{formatRate(sprayData.carrierRate, 'L')}</Text>
							</View>

							{sprayData.products && sprayData.products.length > 0 && (
								<>
									<Text style={styles.subsectionHeader}>{t('screens:jobSummary.productsApplied')}</Text>
									{sprayData.products.map((product, index) => (
										<View key={index} style={styles.row}>
											<Text style={styles.label}>{product.name}</Text>
											<Text style={styles.value}>{formatProductRate(product.rate, product.isVolume)}</Text>
										</View>
									))}
								</>
							)}

							{sprayData.complianceInfo && (sprayData.complianceInfo.maxREI > 0 || sprayData.complianceInfo.maxPHI > 0) && (
								<>
									<Text style={styles.subsectionHeader}>{t('screens:jobSummary.compliance')}</Text>
									{sprayData.complianceInfo.maxREI > 0 && (
										<View style={styles.complianceRow}>
											<Text style={styles.complianceLabel}>{t('screens:jobSummary.reentryInterval', { hours: sprayData.complianceInfo.maxREI })}</Text>
											{sprayData.complianceInfo.reentryDate && (
												<Text style={styles.complianceDate}>{t('screens:jobSummary.safeReentry', { date: formatDate(sprayData.complianceInfo.reentryDate) })}</Text>
											)}
										</View>
									)}
									{sprayData.complianceInfo.maxPHI > 0 && (
										<View style={styles.complianceRow}>
											<Text style={styles.complianceLabel}>{t('screens:jobSummary.preharvestInterval', { days: sprayData.complianceInfo.maxPHI })}</Text>
											{sprayData.complianceInfo.harvestDate && (
												<Text style={styles.complianceDate}>{t('screens:jobSummary.earliestHarvest', { date: formatDate(sprayData.complianceInfo.harvestDate) })}</Text>
											)}
										</View>
									)}
								</>
							)}
						</View>
					);
				})()}

				{/* Irrigation Details Section */}
				{(jobType === 'irrigate' || jobType === 'irrigation') && (recordingWithId.data?.irrigate || recordingWithId.irrigationData) && (() => {
					const irrigationData = recordingWithId.data?.irrigate || recordingWithId.irrigationData;
					return (
						<View style={styles.section}>
							<Text style={styles.sectionHeader}>{t('screens:jobSummary.irrigationDetails')}</Text>

							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.irrigator')}</Text>
								<Text style={styles.value}>{irrigationData.irrigatorName}</Text>
							</View>

							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.flowRate')}</Text>
								<Text style={styles.value}>{irrigationData.litersPerHour} {symbol('volume')}/hour</Text>
							</View>

							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.waterApplied')}</Text>
								<Text style={styles.value}>
									{format(
										(recordingWithId.elapsedTime / 3600000) * irrigationData.litersPerHour,
										'volume'
									)}
								</Text>
							</View>
						</View>
					);
				})()}

				{/* Equipment Section */}
				{(recordingWithId.machine || recordingWithId.attachment) && (
					<View style={styles.section}>
						<Text style={styles.sectionHeader}>{t('screens:jobSummary.equipment')}</Text>

						{recordingWithId.machine && (
							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.machine')}</Text>
								<Text style={styles.value}>{recordingWithId.machine.name}</Text>
							</View>
						)}

						{recordingWithId.attachment && (
							<View style={styles.row}>
								<Text style={styles.label}>{t('screens:jobSummary.attachment')}</Text>
								<Text style={styles.value}>{recordingWithId.attachment.name}</Text>
							</View>
						)}
					</View>
				)}

				{/* Notes Section */}
				{recordingWithId.notes && (
					<View style={styles.section}>
						<Text style={styles.sectionHeader}>{t('screens:jobSummary.notes')}</Text>
						<Text style={styles.notesText}>{recordingWithId.notes}</Text>
					</View>
				)}

				{/* Harvest Data Input */}
				{needsHarvestData && (
					<View style={styles.section}>
						<Text style={styles.sectionHeader}>{t('screens:jobSummary.enterHarvestDetails')}</Text>

						<FormikHelper
							initialValues={{ harvestedKg: '' }}
							validationSchema={harvestValidationSchema}
							onSubmit={handleSubmitHarvest}
						>
							{({ handleSubmit, isValid }) => (
								<>
									<FormInput
										name="harvestedKg"
										label={t('screens:jobSummary.totalAmountHarvested', { unit: symbol('mass') })}
										placeholder={t('screens:jobSummary.enterTotal', { unit: symbol('mass') })}
										numeric={true}
										isLast={true}
									/>

									<PrimaryButton
										text={isSyncingKg ? t('screens:jobSummary.saving') : t('screens:jobSummary.saveHarvestData')}
										onPress={handleSubmit}
										disabled={isSyncingKg || !isValid}
										style={{ marginTop: 12 }}
									/>
								</>
							)}
						</FormikHelper>
					</View>
				)}

				{/* Action Buttons */}
				{!needsHarvestData && (
					<ButtonStack style={{ marginTop: 8 }}>
						{syncStatus === 'synced' && recordingWithId._id && (
							<PrimaryButton
								text={t('screens:jobSummary.editJob')}
								variant="outline"
								onPress={handleEditJob}
							/>
						)}

						<PrimaryButton
							text={t('screens:jobSummary.close')}
							onPress={handleClose}
						/>
					</ButtonStack>
				)}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	scrollView: {
		flex: 1,
	},
	contentContainer: {
		padding: 20,
		paddingBottom: 40,
	},
	header: {
		marginBottom: 20,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.SECONDARY,
	},
	syncBanner: {
		backgroundColor: '#E8F5E9',
		padding: 12,
		marginBottom: 20,
		borderRadius: 8,
	},
	syncedText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 14,
		color: '#2E7D32',
		textAlign: 'center',
	},
	syncingBanner: {
		backgroundColor: '#E3F2FD',
		padding: 12,
		marginBottom: 20,
		borderRadius: 8,
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
	},
	syncingIndicator: {
		marginRight: 8,
	},
	syncingText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 14,
		color: '#1565C0',
	},
	section: {
		marginBottom: 24,
	},
	sectionHeader: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	subsectionHeader: {
		fontFamily: 'Geologica-Medium',
		fontSize: 16,
		color: colors.PRIMARY,
		marginTop: 16,
		marginBottom: 12,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	label: {
		fontFamily: 'Geologica-Medium',
		fontSize: 15,
		color: colors.PRIMARY,
	},
	value: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
		textAlign: 'right',
		flex: 1,
		marginLeft: 16,
	},
	complianceRow: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	complianceLabel: {
		fontFamily: 'Geologica-Medium',
		fontSize: 15,
		color: colors.PRIMARY,
	},
	complianceDate: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: colors.PRIMARY_LIGHT,
		marginTop: 4,
	},
	notesText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
		lineHeight: 22,
	},
});

export default JobSummaryScreen;
