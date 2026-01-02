import React, { useEffect, useState, useRef } from 'react';
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
// JobService handles sync automatically - no manual intervention needed
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

	const [syncStatus, setSyncStatus] = useState('checking');
	const syncInterval = useRef(null);
	const [recordingWithId, setRecordingWithId] = useState(completedRecording);
	const [isSyncingKg, setIsSyncingKg] = useState(false);

	// Initial connectivity check
	useEffect(() => {
		checkServerConnectivity();
	}, []);

	// Check server connectivity
	const checkServerConnectivity = async () => {
		try {
			const response = await api(`${BASE_URL}/ping`, {
				method: 'GET',
				timeout: 5000
			});

			if (response.ok) {
				setSyncStatus(recordingWithId._id ? 'synced' : 'ready');
			} else {
				setSyncStatus('offline');
			}
		} catch (error) {
			console.error('Server ping error:', error);
			setSyncStatus('offline');
		}
	};

	// Monitor sync status
	useEffect(() => {
		// If already synced or in read-only mode, nothing to do
		if (recordingWithId._id || readOnly) {
			setSyncStatus('synced');
			return;
		}

		// If server is not reachable, mark as offline
		if (syncStatus === 'offline') {
			// Check connectivity again every 10 seconds
			syncInterval.current = setInterval(checkServerConnectivity, 10000);
		} else if (syncStatus === 'ready') {
			// Check if our recording exists on the server
			checkSyncStatus();
		} else if (syncStatus === 'pending') {
			// Keep checking every 3 seconds until synced
			syncInterval.current = setInterval(checkSyncStatus, 3000);
		}

		return () => {
			if (syncInterval.current) {
				clearInterval(syncInterval.current);
			}
		};
	}, [syncStatus, readOnly, recordingWithId._id]);

	// Function to check if the recording has been synced
	const checkSyncStatus = async () => {
		try {
			// Use the idempotencyKey to efficiently find the specific job
			const idempotencyKey = completedRecording.idempotencyKey;
			if (!idempotencyKey) {
				console.log('No idempotencyKey found, cannot check sync status efficiently');
				setSyncStatus('pending');
				return;
			}

			console.log('Checking sync status for idempotencyKey:', idempotencyKey);
			const response = await api(`${BASE_URL}/job/records?idempotencyKey=${idempotencyKey}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (response.ok) {
				const data = await response.json();
				if (data.HEADERS.STATUS_CODE === 'OK') {
					// Found it! It's synced
					const serverRecord = data.PAYLOAD;
					console.log('Job found on server:', serverRecord._id);
					setSyncStatus('synced');
					setRecordingWithId({ ...completedRecording, _id: serverRecord._id });

					// Stop checking
					if (syncInterval.current) {
						clearInterval(syncInterval.current);
						syncInterval.current = null;
					}
				} else if (data.HEADERS.STATUS_CODE === 'RECORD_NOT_FOUND') {
					// Not found yet, keep checking
					setSyncStatus('pending');
				}
			} else if (response.status === 404) {
				// Not found yet, keep checking
				setSyncStatus('pending');
			} else {
				// Server error, consider offline
				setSyncStatus('offline');
			}
		} catch (error) {
			console.error('Error checking sync status:', error);
			setSyncStatus('offline');
		}
	};

	const handleSubmitHarvest = async (values) => {
		if (syncStatus === 'offline') {
			// Store locally for later sync
			setIsSyncingKg(true);
			try {
				// Update the recording locally
				const updatedRecording = {
					...recordingWithId,
					harvestedKg: parse(values.harvestedKg, 'mass'),
					isFinalHarvest: isFinalHarvest
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
					console.log(data)
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
				setSyncStatus('offline');
			}
		}
	};
	// Handle editing the job record
	const handleEditJob = () => {
		// Check if record has been synced
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

	// Handle closing the summary screen and refreshing farm data
	const handleClose = async () => {
		// If job is synced and online, refresh farm data
		if (syncStatus === 'synced' || syncStatus === 'ready') {
			try {
				const response = await api(`${BASE_URL}/getAccountData`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				if (response.ok) {
					const data = await response.json();
					if (data.HEADERS.STATUS_CODE === 'OK') {
						// Update farm data in global context
						setFarmData(data.PAYLOAD.farm);
					}
				}
			} catch (error) {
				console.error('Error refreshing farm data:', error);
				// Continue navigation even if refresh fails
			}
		}

		// Navigate back to main screen
		navigation.replace('Main');
	};

	// Get sync status display
	const renderSyncStatus = () => {
		switch (syncStatus) {
			case 'checking':
				return (
					<View style={styles.syncingContainer}>
						<ActivityIndicator size="small" color={colors.SECONDARY} style={styles.syncingIndicator} />
						<Text style={[styles.syncStatusText]}>
							{t('screens:jobSummary.checkingConnection')}
						</Text>
					</View>
				);
			case 'synced':
				return (
					<Text style={[styles.syncStatusText, styles.syncedStatusText]}>
						{t('screens:jobSummary.syncedSuccess')}
					</Text>
				);
			case 'ready':
				return (
					<View style={styles.syncingContainer}>
						<ActivityIndicator size="small" color={colors.SECONDARY} style={styles.syncingIndicator} />
						<Text style={[styles.syncStatusText, styles.syncingStatusText]}>
							{t('screens:jobSummary.syncingImmediate')}
						</Text>
					</View>
				);
			case 'offline':
				return (
					<Text style={[styles.syncStatusText, styles.pendingStatusText]}>
						{t('screens:jobSummary.syncWhenOnline')}
					</Text>
				);
			default:
				return null;
		}
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			hour12: true
		});
	};

	const formatDuration = (ms) => {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		let result = '';
		if (hours > 0) {
			result += `${hours} ${t('screens:jobSummary.hours', { plural: hours !== 1 ? 's' : '' })} `;
		}
		if (minutes > 0 || hours > 0) {
			result += `${minutes} ${t('screens:jobSummary.minutes', { plural: minutes !== 1 ? 's' : '' })} `;
		}
		result += `${seconds} ${t('screens:jobSummary.seconds', { plural: seconds !== 1 ? 's' : '' })}`;

		return result;
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
		<View style={styles.safeArea}>
			<ScrollView style={styles.scrollView}>
				<View style={[styles.container,]}>
					<Text style={styles.title}>{t('screens:jobSummary.title')}</Text>

					<View style={styles.card}>
						<Text style={styles.cardTitle}>{getJobTypeName(jobType)}</Text>
						<Text style={styles.fieldName}>{recordingWithId.fieldName}</Text>

						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>{t('screens:jobSummary.startTime')}</Text>
							<Text style={styles.detailValue}>{formatDate(recordingWithId.startedAt || recordingWithId.startTime)}</Text>
						</View>

						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>{t('screens:jobSummary.endTime')}</Text>
							<Text style={styles.detailValue}>{formatDate(recordingWithId.endedAt || recordingWithId.endTime)}</Text>
						</View>

						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>{t('screens:jobSummary.duration')}</Text>
							<Text style={styles.detailValue}>{formatDuration(recordingWithId.elapsedTime)}</Text>
						</View>

						{jobType === 'sow' && (
							<>
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>{t('screens:jobSummary.crop')}</Text>
									<Text style={styles.detailValue}>{recordingWithId.data?.sow?.crop || recordingWithId.crop}</Text>
								</View>

								{(recordingWithId.data?.sow?.variety || recordingWithId.variety) && (
									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>{t('screens:jobSummary.variety')}</Text>
										<Text style={styles.detailValue}>{recordingWithId.data?.sow?.variety || recordingWithId.variety}</Text>
									</View>
								)}
							</>
						)}

						{jobType === 'harvest' && (
							<>
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>{t('screens:jobSummary.type')}</Text>
									<Text style={styles.detailValue}>
										{(recordingWithId.data?.harvest?.isFinalHarvest ?? recordingWithId.isFinalHarvest) ? t('screens:jobSummary.finalHarvest') : t('screens:jobSummary.partialHarvest')}
									</Text>
								</View>

								{harvestedAmount && (
									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>{t('screens:jobSummary.harvested')}</Text>
										<Text style={styles.detailValue}>{format(harvestedAmount, 'mass')}</Text>
									</View>
								)}
							</>
						)}

						{jobType === 'spray' && (recordingWithId.data?.spray || recordingWithId.sprayData) && (() => {
							const sprayData = recordingWithId.data?.spray || recordingWithId.sprayData;
							return (
								<>
									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>{t('screens:jobSummary.sprayer')}</Text>
										<Text style={styles.detailValue}>{sprayData.sprayerName}</Text>
									</View>

									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>{t('screens:jobSummary.carrierRate')}</Text>
										<Text style={styles.detailValue}>
											{formatRate(sprayData.carrierRate, 'L')}
										</Text>
									</View>

									{sprayData.products && sprayData.products.length > 0 && (
										<View style={styles.sprayProductsContainer}>
											<Text style={styles.sprayProductsTitle}>{t('screens:jobSummary.productsApplied')}</Text>
											{sprayData.products.map((product, index) => (
												<View key={index} style={styles.sprayProductRow}>
													<Text style={styles.sprayProductName}>• {product.name}</Text>
													<Text style={styles.sprayProductRate}>
														{formatProductRate(product.rate, product.isVolume)}
													</Text>
												</View>
											))}
										</View>
									)}

									{sprayData.complianceInfo && (sprayData.complianceInfo.maxREI > 0 || sprayData.complianceInfo.maxPHI > 0) && (
										<View style={styles.complianceContainer}>
											{sprayData.complianceInfo.maxREI > 0 && (
												<View style={styles.complianceRow}>
													<Text style={styles.complianceText}>
														• {t('screens:jobSummary.reentryInterval', { hours: sprayData.complianceInfo.maxREI })}
													</Text>
													{sprayData.complianceInfo.reentryDate && (
														<Text style={styles.complianceSubtext}>
															{t('screens:jobSummary.safeReentry', { date: formatDate(sprayData.complianceInfo.reentryDate) })}
														</Text>
													)}
												</View>
											)}

											{sprayData.complianceInfo.maxPHI > 0 && (
												<View style={styles.complianceRow}>
													<Text style={styles.complianceText}>
														• {t('screens:jobSummary.preharvestInterval', { days: sprayData.complianceInfo.maxPHI })}
													</Text>
													{sprayData.complianceInfo.harvestDate && (
														<Text style={styles.complianceSubtext}>
															{t('screens:jobSummary.earliestHarvest', { date: formatDate(sprayData.complianceInfo.harvestDate) })}
														</Text>
													)}
												</View>
											)}
										</View>
									)}
								</>
							);
						})()}

						{(jobType === 'irrigate' || jobType === 'irrigation') && (recordingWithId.data?.irrigate || recordingWithId.irrigationData) && (() => {
							const irrigationData = recordingWithId.data?.irrigate || recordingWithId.irrigationData;
							return (
								<>
									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>{t('screens:jobSummary.irrigator')}</Text>
										<Text style={styles.detailValue}>{irrigationData.irrigatorName}</Text>
									</View>

									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>{t('screens:jobSummary.flowRate')}</Text>
										<Text style={styles.detailValue}>
											{irrigationData.litersPerHour} {symbol('volume')}/hour
										</Text>
									</View>

									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>{t('screens:jobSummary.waterApplied')}</Text>
										<Text style={styles.detailValue}>
											{format(
												(recordingWithId.elapsedTime / 3600000) * irrigationData.litersPerHour,
												'volume'
											)}
										</Text>
									</View>
								</>
							);
						})()}

						{recordingWithId.machine && (
							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>{t('screens:jobSummary.machine')}</Text>
								<Text style={styles.detailValue}>{recordingWithId.machine.name}</Text>
							</View>
						)}

						{recordingWithId.attachment && (
							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>{t('screens:jobSummary.attachment')}</Text>
								<Text style={styles.detailValue}>{recordingWithId.attachment.name}</Text>
							</View>
						)}

						{recordingWithId.notes && (
							<View style={styles.notesContainer}>
								<Text style={styles.notesLabel}>{t('screens:jobSummary.notes')}</Text>
								<Text style={styles.notesText}>{recordingWithId.notes}</Text>
							</View>
						)}
					</View>

					{needsHarvestData && (
						<View style={styles.harvestInputContainer}>
							<Text style={styles.harvestTitle}>{t('screens:jobSummary.enterHarvestDetails')}</Text>

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
											keyboardType="numeric"
											isLast={true}
										/>

										<PrimaryButton
											text={isSyncingKg ? t('screens:jobSummary.saving') : t('screens:jobSummary.saveHarvestData')}
											onPress={handleSubmit}
											disabled={isSyncingKg || !isValid}
										/>
									</>
								)}
							</FormikHelper>
						</View>
					)}

					<View style={styles.syncStatus}>
						{renderSyncStatus()}
					</View>

					{!needsHarvestData && (
						<ButtonStack>
							{syncStatus === 'synced' && (
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
				</View>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: 'white',
	},
	scrollView: {
		flex: 1,
	},
	container: {
		padding: 24,
		flex: 1,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		marginBottom: 24,
		textAlign: 'center',
	},
	card: {
		marginBottom: 15
	},
	cardTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 22,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	fieldName: {
		fontFamily: 'Geologica-Medium',
		fontSize: 18,
		color: colors.SECONDARY,
		marginBottom: 16,
	},
	detailRow: {
		flexDirection: 'row',
		marginBottom: 8,
	},
	detailLabel: {
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
		color: colors.PRIMARY,
		width: 100,
	},
	detailValue: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		flex: 1,
	},
	notesContainer: {
		marginTop: 8,
	},
	notesLabel: {
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	notesText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
	},
	syncStatus: {
		marginBottom: 24,
	},
	syncingContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
	},
	syncingIndicator: {
		marginRight: 8,
	},
	syncStatusText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		textAlign: 'center',
		fontStyle: 'italic',
	},
	syncedStatusText: {
		color: '#4CAF50', // Green for synced
	},
	syncingStatusText: {
		color: '#2196F3', // Blue for syncing
	},
	pendingStatusText: {
		color: '#FFA000', // Amber for pending
	},
	harvestInputContainer: {
		marginBottom: 24,
	},
	harvestTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	sprayProductsContainer: {
		marginTop: 12,
		marginBottom: 8,
	},
	sprayProductsTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	sprayProductRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
		paddingLeft: 8,
	},
	sprayProductName: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
		flex: 1,
	},
	sprayProductRate: {
		fontFamily: 'Geologica-Medium',
		fontSize: 15,
		color: colors.SECONDARY,
	},
	complianceContainer: {
		marginTop: 12,
	},
	complianceRow: {
		marginBottom: 8,
	},
	complianceText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 15,
		color: colors.PRIMARY,
	},
	complianceSubtext: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.SECONDARY,
		marginLeft: 24,
		marginTop: 2,
	}
});

export default JobSummaryScreen;