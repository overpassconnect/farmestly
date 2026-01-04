import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../../hooks/useApi';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Linking
} from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import ReportPollingService from '../../../services/ReportPollingService';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import RadioButton from '../../ui/core/RadioButton';
import ButtonStack from '../../ui/core/ButtonGroup';
import EmptyState from '../../ui/core/EmptyState';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import config from '../../../globals/config';
import DatePicker from 'react-native-date-picker';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate } from '../../../utils/dateHelpers';
const BASE_URL = config.BASE_URL;

// Report grouping options - labels will be translated in component
const REPORT_TYPE_IDS = [
	{ id: 'all', icon: require('../../../assets/icons/job_icon.png') },
	{ id: 'field', icon: require('../../../assets/icons/field.png') },
	{ id: 'job_type', icon: require('../../../assets/icons/job_icon_builtin.png') },
	{ id: 'machine', icon: require('../../../assets/icons/tractor_brown.png') },
	{ id: 'attachment', icon: require('../../../assets/icons/plow_brown.png') }
];

// Date range options - labels will be translated in component
const DATE_RANGE_IDS = [
	{ id: 'all' },
	{ id: 'month' },
	{ id: 'quarter' },
	{ id: 'year' },
	{ id: 'custom' }
];

// Delivery method options - labels will be translated in component
const DELIVERY_METHOD_IDS = [
	{ id: 'download' },
	{ id: 'email' },
	{ id: 'both' }
];

const CreateReportScreen = () => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const { farmData, account } = useGlobalContext();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const { api } = useApi();

	const route = useRoute();
	// Component state
	const [selectedReportType, setSelectedReportType] = useState('all');
	const [selectedDateRange, setSelectedDateRange] = useState('all');
	const [selectedDelivery, setSelectedDelivery] = useState('download');
	const [isGenerating, setIsGenerating] = useState(false);
	const [currentJobId, setCurrentJobId] = useState(null);
	const [latestReport, setLatestReport] = useState(null);
	const [loadingLatest, setLoadingLatest] = useState(true);
	const [customDateRange, setCustomDateRange] = useState({
		startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
		endDate: new Date()
	});
	const [datePickerVisible, setDatePickerVisible] = useState(false);
	const [currentDateSelection, setCurrentDateSelection] = useState('start'); // 'start' or 'end'
	const [isPrecheckLoading, setIsPrecheckLoading] = useState(false);
	const [precheckResult, setPrecheckResult] = useState({ canEmail: true, canDownload: true, recordCount: null });

	// Email verification status
	const hasEmail = !!account?.email;
	const emailVerified = account?.emailVerified === true;
	const hasVerifiedEmail = hasEmail && emailVerified;

	// Create translated report types
	const REPORT_TYPES = REPORT_TYPE_IDS.map(type => ({
		...type,
		label: t(`screens:createReport.${type.id === 'all' ? 'allJobRecords' : type.id === 'field' ? 'groupByField' : type.id === 'job_type' ? 'groupByJobType' : type.id === 'machine' ? 'groupByMachine' : 'groupByAttachment'}`)
	}));

	// Create translated date ranges
	const DATE_RANGES = DATE_RANGE_IDS.map(range => ({
		...range,
		label: t(`screens:createReport.${range.id === 'all' ? 'allTime' : range.id === 'month' ? 'lastMonth' : range.id === 'quarter' ? 'lastQuarter' : range.id === 'year' ? 'lastYear' : 'customRange'}`)
	}));

	// Create translated delivery methods
	const DELIVERY_METHODS = DELIVERY_METHOD_IDS.map(method => ({
		...method,
		label: t(`screens:createReport.${method.id === 'both' ? 'deliveryBoth' : method.id === 'email' ? 'deliveryEmail' : 'deliveryDownload'}`)
	}));

	useEffect(() => {
		if (route.params?.reportType) setSelectedReportType(route.params.reportType);
		if (route.params?.dateRange) setSelectedDateRange(route.params.dateRange);
		if (route.params?.customDateRange) {
			// Convert ISO strings back to Date objects
			setCustomDateRange({
				startDate: new Date(route.params.customDateRange.startDate),
				endDate: new Date(route.params.customDateRange.endDate)
			});
		}
	}, [route.params]);

	// Fetch latest report data
	const fetchLatestReport = useCallback(async () => {
		setLoadingLatest(true);
		const result = await api('/report/latest');

		if (result.ok && result.data?.report) {
			setLatestReport(result.data.report);
		} else {
			setLatestReport(null);
		}

		setLoadingLatest(false);
	}, [api]);

	// Handle screen focus - fetch latest report and cleanup on blur
	useFocusEffect(
		useCallback(() => {
			// Fetch latest report when screen comes into focus
			fetchLatestReport();

			// Cleanup function when screen loses focus
			return () => {
				ReportPollingService.stop();
			};
		}, [fetchLatestReport])
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			ReportPollingService.stop();
		};
	}, []);

	// Helper function to format report date
	const formatReportDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	// Helper function to get report type label
	const getReportTypeLabel = (reportType) => {
		switch (reportType) {
			case 'all':
				return t('screens:createReport.allJobRecords');
			case 'field':
				return t('screens:createReport.groupByField');
			case 'job_type':
				return t('screens:createReport.groupByJobType');
			case 'machine':
				return t('screens:createReport.groupByMachine');
			case 'attachment':
				return t('screens:createReport.groupByAttachment');
			default:
				return t('screens:createReport.allJobRecords');
		}
	};

	// Open latest report
	const handleOpenReport = () => {
		if (!latestReport?.downloadUrl) return;

		const fullUrl = `${BASE_URL}${latestReport.downloadUrl}`;
		Linking.openURL(fullUrl)
			.catch(err => {
				console.error('Error opening report:', err);
				Toast.show({
					type: 'error',
					text1: t('alerts:error'),
					text2: t('screens:createReport.errorOpeningReport'),
					position: 'top',
					visibilityTime: 3000,
					topOffset: insets.top + 20,
					autoHide: true
				});
			});
	};

	// Precheck if report generation is possible
	const performPrecheck = useCallback(async () => {
		setIsPrecheckLoading(true);
		const startTime = Date.now();

		// Build query params
		const params = new URLSearchParams({
			reportType: selectedReportType,
			dateRange: selectedDateRange
		});

		if (selectedDateRange === 'custom') {
			params.append('startDate', customDateRange.startDate.toISOString());
			params.append('endDate', customDateRange.endDate.toISOString());
		}

		const result = await api(`/report/precheck?${params.toString()}`);

		if (result.ok && result.data) {
			const payload = result.data;
			setPrecheckResult(payload);

			// Auto-adjust selected delivery if current selection is not available
			if (selectedDelivery === 'both' && (!payload.canEmail || !payload.canDownload)) {
				if (payload.canEmail) {
					setSelectedDelivery('email');
				} else if (payload.canDownload) {
					setSelectedDelivery('download');
				}
			} else if (selectedDelivery === 'email' && !payload.canEmail && payload.canDownload) {
				setSelectedDelivery('download');
			} else if (selectedDelivery === 'download' && !payload.canDownload && payload.canEmail) {
				setSelectedDelivery('email');
			}
		} else {
			// On error, assume all options are available
			setPrecheckResult({ canEmail: true, canDownload: true });
		}

		// Ensure loading state displays for at least 500ms to avoid flashing
		const elapsedTime = Date.now() - startTime;
		const remainingTime = Math.max(0, 500 - elapsedTime);

		setTimeout(() => {
			setIsPrecheckLoading(false);
		}, remainingTime);
	}, [api, selectedReportType, selectedDateRange, customDateRange, selectedDelivery]);

	// Run precheck whenever report parameters change
	useEffect(() => {
		performPrecheck();
	}, [performPrecheck]);

	// Generate report
	const handleGenerateReport = async () => {
		// Check if user has email - redirect to add it if not (only for email-based delivery)
		if (hasEmail === false && selectedDelivery !== 'download') {
			navigation.navigate('EmailSettingsScreen', {
				returnTo: 'CreateReportScreen',
				returnParams: {
					reportType: selectedReportType,
					dateRange: selectedDateRange,
					customDateRange: {
						startDate: customDateRange.startDate.toISOString(),
						endDate: customDateRange.endDate.toISOString()
					}
				}
			});
			return;
		}

		setIsGenerating(true);

		const reportData = {
			reportType: selectedReportType,
			dateRange: selectedDateRange,
			delivery: selectedDelivery
		};

		if (selectedDateRange === 'custom') {
			reportData.startDate = customDateRange.startDate.toISOString();
			reportData.endDate = customDateRange.endDate.toISOString();
		}

		const result = await api('/report', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(reportData)
		});

		if (result.ok && result.data?.jobId) {
			// Store job ID and start polling
			setCurrentJobId(result.data.jobId);

			ReportPollingService.start(result.data.jobId, api, {
				onProgress: (status) => {
					// Optional: could update UI with status
					// For now, just keep the spinner showing
				},
				onComplete: (jobResult) => {
					setIsGenerating(false);
					setCurrentJobId(null);

					Toast.show({
						type: 'success',
						text1: t('alerts:success'),
						text2: t('alerts:successes.REPORT_READY'),
						position: 'top',
						visibilityTime: 4500,
						topOffset: insets.top + 20,
						autoHide: true
					});

					// Refresh latest report to show new report
					fetchLatestReport();
				},
				onError: (error) => {
					setIsGenerating(false);
					setCurrentJobId(null);

					if (error === 'NO_RECORDS') {
						showNoRecordsMessage();
					} else if (error === 'EMAIL_REQUIRED') {
						navigation.navigate('EmailSettingsScreen', {
							returnTo: 'CreateReportScreen',
							returnParams: {
								reportType: selectedReportType,
								dateRange: selectedDateRange,
								customDateRange: {
									startDate: customDateRange.startDate.toISOString(),
									endDate: customDateRange.endDate.toISOString()
								}
							}
						});
					} else {
						Toast.show({
							type: 'error',
							text1: t('alerts:error'),
							text2: t('alerts:errors.REPORT_FAILED'),
							position: 'top',
							visibilityTime: 3000,
							topOffset: insets.top + 20,
							autoHide: true
						});
					}
				}
			});
		} else {
			// Initial API call failed
			setIsGenerating(false);

			if (result.code === 'EMAIL_REQUIRED') {
				navigation.navigate('EmailSettingsScreen', {
					returnTo: 'CreateReportScreen',
					returnParams: {
						reportType: selectedReportType,
						dateRange: selectedDateRange,
						customDateRange: {
							startDate: customDateRange.startDate.toISOString(),
							endDate: customDateRange.endDate.toISOString()
						}
					}
				});
			} else {
				Toast.show({
					type: 'error',
					text1: t('alerts:error'),
					text2: t('alerts:errors.REPORT_FAILED'),
					position: 'top',
					visibilityTime: 3000,
					topOffset: insets.top + 20,
					autoHide: true
				});
			}
		}
	};

	// Show no records message in bottom sheet
	const showNoRecordsMessage = () => {
		const content = (
			<EmptyState
				icon={require('../../../assets/icons/job_icon.png')}
				title={t('screens:createReport.noRecordsFound')}
				subtitle={t('screens:createReport.noRecordsDescription')}
				actionText={t('common:buttons.ok')}
				onAction={closeBottomSheet}
			/>
		);

		openBottomSheet(content, {
			snapPoints: ['40%'],
			enablePanDownToClose: true
		});
	};

	// Show error message in bottom sheet
	const showErrorMessage = (message) => {
		const content = (
			<EmptyState
				title={t('screens:createReport.error')}
				subtitle={message}
				actionText={t('common:buttons.ok')}
				onAction={closeBottomSheet}
			/>
		);

		openBottomSheet(content, {
			snapPoints: ['40%'],
			enablePanDownToClose: true
		});
	};

	// Show date picker for custom date range
	const showDatePicker = (type) => {
		setCurrentDateSelection(type);
		setDatePickerVisible(true);

		const content = (
			<BottomSheetView style={styles.datePickerContainer}>
				<Text style={styles.datePickerTitle}>
					{type === 'start' ? t('screens:createReport.selectStartDate') : t('screens:createReport.selectEndDate')}
				</Text>
				<DatePicker
					date={type === 'start' ? customDateRange.startDate : customDateRange.endDate}
					onDateChange={(date) => {
						if (type === 'start') {
							setCustomDateRange(prev => ({ ...prev, startDate: date }));
						} else {
							setCustomDateRange(prev => ({ ...prev, endDate: date }));
						}
					}}
					mode="date"
					androidVariant="nativeAndroid"
					textColor={colors.PRIMARY}
				/>
				<View style={styles.datePickerButtons}>
					<PrimaryButton
						text={t('screens:createReport.confirm')}
						onPress={() => {
							closeBottomSheet();
							setDatePickerVisible(false);
						}}
					/>
					<PrimaryButton
						text={t('common:buttons.cancel')}
						variant="outline"
						onPress={() => {
							closeBottomSheet();
							setDatePickerVisible(false);
						}}
					/>
				</View>
			</BottomSheetView>
		);

		openBottomSheet(content, {
			snapPoints: ['70%'],
			enablePanDownToClose: true
		});
	};


	return (
		<View style={styles.safeArea}>
			<ScrollView style={styles.scrollView}>
				<View style={styles.container}>
					<Text style={styles.title}>{t('screens:createReport.title')}</Text>

					{/* Latest Report Section */}
					{!loadingLatest && latestReport && (
						<View style={styles.latestSection}>
							<Text style={styles.latestTitle}>{t('screens:createReport.yourLastReport')}</Text>
							<TouchableOpacity style={styles.latestItem} onPress={handleOpenReport}>
								<View style={styles.latestInfo}>
									<Text style={styles.latestName}>
										{getReportTypeLabel(latestReport.reportType)}
									</Text>
									<Text style={styles.latestDate}>
										{formatReportDate(latestReport.createdAt)}
									</Text>
								</View>
								<Text style={styles.latestAction}>{t('screens:createReport.view')}</Text>
							</TouchableOpacity>
						</View>
					)}

					{/* Report Type Selection */}
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t('screens:createReport.reportType')}</Text>
						<Text style={styles.sectionDescription}>
							{t('screens:createReport.reportTypeDescription')}
						</Text>

						{REPORT_TYPES.map((type) => (
							<RadioButton
								key={type.id}
								label={type.label}
								icon={type.icon}
								selected={selectedReportType === type.id}
								onPress={() => setSelectedReportType(type.id)}
							/>
						))}
					</View>

					{/* Date Range Selection */}
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t('screens:createReport.dateRange')}</Text>
						<Text style={styles.sectionDescription}>
							{t('screens:createReport.dateRangeDescription')}
						</Text>

						{DATE_RANGES.map((range) => (
							<View key={range.id}>
								<RadioButton
									label={range.label}
									selected={selectedDateRange === range.id}
									onPress={() => setSelectedDateRange(range.id)}
								/>

								{range.id === 'custom' && selectedDateRange === 'custom' && (
									<View style={styles.customDateContainer}>
										<TouchableOpacity
											style={styles.dateSelector}
											onPress={() => showDatePicker('start')}
										>
											<Text style={styles.dateLabel}>{t('screens:createReport.startDate')}</Text>
											<Text style={styles.dateText}>
												{formatDate(customDateRange.startDate)}
											</Text>
										</TouchableOpacity>
										<Text style={styles.dateSeparator}>{t('screens:createReport.to')}</Text>
										<TouchableOpacity
											style={styles.dateSelector}
											onPress={() => showDatePicker('end')}
										>
											<Text style={styles.dateLabel}>{t('screens:createReport.endDate')}</Text>
											<Text style={styles.dateText}>
												{formatDate(customDateRange.endDate)}
												</Text>
										</TouchableOpacity>
									</View>
								)}
							</View>
						))}
					</View>

					{/* Delivery Method Selection */}
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t('screens:createReport.deliveryMethod')}</Text>
						<Text style={styles.sectionDescription}>
							{t('screens:createReport.deliveryMethodDescription')}
						</Text>

						{DELIVERY_METHODS.map((method) => {
							let isDisabled = false;
							// Disable email options if email is not verified
							if (method.id === 'both') {
								isDisabled = !hasVerifiedEmail || !precheckResult.canEmail || !precheckResult.canDownload;
							} else if (method.id === 'email') {
								isDisabled = !hasVerifiedEmail || !precheckResult.canEmail;
							} else if (method.id === 'download' && !precheckResult.canDownload) {
								isDisabled = true;
							}

							return (
								<RadioButton
									key={method.id}
									label={method.label}
									selected={selectedDelivery === method.id}
									onPress={() => setSelectedDelivery(method.id)}
									disabled={isDisabled}
								/>
							);
						})}

						{/* Email verification info text */}
						{!hasEmail && (
							<Text style={styles.emailInfoText}>
								Add an email address in Settings to enable email delivery.
							</Text>
						)}
						{hasEmail && !emailVerified && (
							<Text style={styles.emailInfoText}>
								Email delivery requires a verified email address.
							</Text>
						)}
					</View>

					{/* Button Container */}
					<View style={styles.buttonContainer}>
						{isGenerating ? (
							<View style={styles.progressContainer}>
								<ActivityIndicator size="large" color={colors.SECONDARY} />
								<Text style={styles.progressText}>
									{t('screens:createReport.generatingReport')}
								</Text>
							</View>
						) : isPrecheckLoading ? (
							<View style={styles.precheckContainer}>
								<ActivityIndicator size="small" color={colors.SECONDARY} />
							</View>
						) : !precheckResult.canEmail && !precheckResult.canDownload ? (
							<View style={styles.emptyStateContainer}>
								<EmptyState
									icon={require('../../../assets/icons/job_icon.png')}
									title={t('screens:createReport.cannotGenerateTitle')}
									subtitle={t('screens:createReport.cannotGenerateMessage')}
								/>
							</View>
						) : (
							<ButtonStack>
								<PrimaryButton
									text={t('screens:createReport.generateReport')}
									onPress={handleGenerateReport}
								/>
								<PrimaryButton
									text={t('common:buttons.cancel')}
									variant="outline"
									onPress={() => navigation.goBack()}
								/>
							</ButtonStack>
						)}
					</View>
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
		paddingBottom: 40,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		marginBottom: 24,
	},
	latestSection: {
		marginBottom: 24,
		padding: 16,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 12,
	},
	latestTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 14,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	latestItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: 'white',
		padding: 14,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: `${colors.PRIMARY_LIGHT}33`,
	},
	latestInfo: {
		flex: 1,
	},
	latestName: {
		fontFamily: 'Geologica-Medium',
		fontSize: 15,
		color: colors.PRIMARY,
	},
	latestDate: {
		fontFamily: 'Geologica-Regular',
		fontSize: 12,
		color: colors.PRIMARY_LIGHT,
		marginTop: 4,
	},
	latestAction: {
		fontFamily: 'Geologica-Bold',
		fontSize: 14,
		color: colors.SECONDARY,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 6,
	},
	sectionDescription: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 12,
		lineHeight: 20,
	},
	customDateContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 12,
		marginBottom: 12,
		paddingLeft: 36,
		gap: 12,
	},
	dateSelector: {
		backgroundColor: colors.SECONDARY_LIGHT,
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.PRIMARY_LIGHT,
		flex: 1,
	},
	dateLabel: {
		fontFamily: 'Geologica-Regular',
		fontSize: 12,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 4,
	},
	dateText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY,
	},
	dateSeparator: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
	},
	buttonContainer: {
		marginTop: 8,
		minHeight: 120,
		justifyContent: 'center',
	},
	progressContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
	},
	progressText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		marginTop: 16,
	},
	precheckContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
	},
	emptyStateContainer: {
		flex: 1,
		justifyContent: 'center',
	},
	noteContainer: {
		marginTop: 16,
		borderLeftColor: colors.SECONDARY,
		borderLeftWidth: 3,
		paddingLeft: 12,
	},
	noteTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	noteText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
	},
	datePickerContainer: {
		padding: 16,
		alignItems: 'center',
	},
	datePickerTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 20,
		color: colors.PRIMARY,
		marginBottom: 16,
	},
	datePickerButtons: {
		width: '100%',
		marginTop: 24,
		gap: 12,
	},
	emailInfoText: {
		fontSize: 12,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		marginTop: 8,
		marginLeft: 36,
	},
});

export default CreateReportScreen;