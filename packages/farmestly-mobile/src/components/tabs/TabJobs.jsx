import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../../globals/api';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	FlatList,
	ActivityIndicator,
	TextInput,
	Image,
	Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DatePicker from 'react-native-date-picker';
import SwipeableTabs from '../ui/core/SwipableTabs';
import PrimaryButton from '../ui/core/PrimaryButton';
import colors from '../../globals/colors';
import { useBottomSheet } from '../sheets/BottomSheetContextProvider';
import { useGlobalContext } from '../context/GlobalContextProvider';
import ListItem from '../ui/list/ListItem';
import SelectJobTypeBottomSheet from '../sheets/SelectJobTypeBottomSheet';
import SearchableListSheet from '../ui/list/SearchableListSheet';

const { width } = Dimensions.get('window');

import config from '../../globals/config'
const BASE_URL = config.BASE_URL;


const TabJobs = () => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const route = useRoute();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const { farmData } = useGlobalContext();

	const [jobRecords, setJobRecords] = useState([]);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [pagination, setPagination] = useState({
		currentPage: 1,
		totalPages: 1,
		totalJobs: 0,
		hasNextPage: false
	});

	// Filter states
	const [filters, setFilters] = useState({
		jobType: 'all',
		fieldId: null,
		cultivationId: null,
		dateFrom: null,
		dateTo: null,
		templateId: null
	});
	const [searchQuery, setSearchQuery] = useState('');

	// Date picker states
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [datePickerType, setDatePickerType] = useState('from'); // 'from' or 'to'

	// Refs for tracking pagination
	const currentPageRef = useRef(1);
	const isLoadingRef = useRef(false);
	// const cameFromFiltersScreen = typeof route.params !== undefined && typeof route.params?.updatedFilters !== undefined

	useEffect(() => {
		//Important for running only the first time we go into JobsTab
		//Detect when navigated to the TabJobs NOT from filtersscreen which we do care about.
		if (!route.params && !route.params?.updatedFilters) {
			loadJobRecords({
				jobType: 'all',
				fieldId: null,
				cultivationId: null,
				dateFrom: null,
				dateTo: null,
				templateId: null
			});
		}
	}, []);


	useEffect(() => {
		if (route.params?.updatedFilters) {
			loadJobRecords(route.params?.updatedFilters, false);
			setFilters(route.params?.updatedFilters)
		}
	}, [route]);

	// Load job records with pagination
	const loadJobRecords = useCallback((filtersObject, reset = false) => {
		if (isLoadingRef.current) return;
		isLoadingRef.current = true;

		const isFirstLoad = reset || currentPageRef.current === 1;
		setLoading(isFirstLoad);
		setLoadingMore(!isFirstLoad);

		const page = reset ? 1 : currentPageRef.current;

		// Build query parameters
		const queryParams = new URLSearchParams({
			page: page.toString(),
			limit: '10',
			search: searchQuery || '',
			jobType: filtersObject.jobType || 'all',
			fieldId: filtersObject.fieldId || '',
			cultivationId: filtersObject.cultivationId || '',
			templateId: filtersObject.templateId || ''
		});

		if (filtersObject.dateFrom) {
			queryParams.append('dateFrom', filtersObject.dateFrom.toISOString());
		}
		if (filtersObject.dateTo) {
			queryParams.append('dateTo', filtersObject.dateTo.toISOString());
		}

		api(`${BASE_URL}/job/records?${queryParams}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',

			}
		})
			.then(res => res.json())
			.then(data => {
				if (data.HEADERS.STATUS_CODE === 'OK') {
					const newRecords = data.PAYLOAD.records || [];
					const newPagination = data.PAYLOAD.pagination || {
						currentPage: 1,
						totalPages: 1,
						totalJobs: 0,
						hasNextPage: false
					};

					if (reset || page === 1) {
						setJobRecords(newRecords);
					} else {
						setJobRecords(prev => [...prev, ...newRecords]);
					}

					setPagination(newPagination);
					currentPageRef.current = newPagination.currentPage;
				}
			})
			.catch(err => {
				console.error('Error loading job records:', err);
			})
			.finally(() => {
				setLoading(false);
				setLoadingMore(false);
				setRefreshing(false);
				isLoadingRef.current = false;
			});
	});

	// Handle pull to refresh
	const handleRefresh = () => {
		setRefreshing(true);
		currentPageRef.current = 1;
		loadJobRecords(true);
	};

	// Handle load more
	const handleLoadMore = () => {
		if (pagination.hasNextPage && !isLoadingRef.current) {
			currentPageRef.current += 1;
			loadJobRecords(false);
		}
	};

	// Handle filter changes
	// const handleFilterChange = (newFilters) => {
	// 	setFilters(newFilters);
	// 	currentPageRef.current = 1;
	// 	// Data will reload due to useFocusEffect dependency
	// };

	// Show filters screen
	const showFiltersScreen = () => {
		navigation.navigate('FiltersScreen', {
			currentFilters: filters
		});
	};

	// Get active filter count for badge
	const getActiveFilterCount = () => {
		let count = 0;
		if (filters.jobType && filters.jobType !== 'all') count++;
		if (filters.fieldId) count++;
		if (filters.cultivationId) count++;
		if (filters.dateFrom) count++;
		if (filters.dateTo) count++;
		if (filters.templateId) count++;
		return count;
	};

	// Get applied filters text
	const getAppliedFiltersText = () => {
		const appliedFilters = [];

		if (searchQuery) {
			appliedFilters.push(`Search: "${searchQuery}"`);
		}

		if (filters.templateId && farmData?.jobTemplates) {
			const template = farmData.jobTemplates.find(t => t._id === filters.templateId);
			if (template) {
				appliedFilters.push(`Template: ${template.name}`);
			}
		} else if (filters.jobType && filters.jobType !== 'all') {
			appliedFilters.push(`Job Type: ${filters.jobType}`);
		}

		if (filters.fieldId && farmData?.fields) {
			const field = farmData.fields.find(f => f._id === filters.fieldId);
			if (field) {
				appliedFilters.push(`Field: ${field.name}`);
			}
		}

		if (filters.cultivationId && farmData?.cultivations) {
			const cultivation = farmData.cultivations.find(c => c._id === filters.cultivationId);
			if (cultivation) {
				appliedFilters.push(`Cultivation: ${cultivation.crop}${cultivation.variety ? ` (${cultivation.variety})` : ''}`);
			}
		}

		if (filters.dateFrom) {
			appliedFilters.push(`From: ${filters.dateFrom.toLocaleDateString()}`);
		}

		if (filters.dateTo) {
			appliedFilters.push(`To: ${filters.dateTo.toLocaleDateString()}`);
		}

		if (appliedFilters.length === 0) {
			return 'No filters applied';
		}

		return `Filters: ${appliedFilters.join(', ')}`;
	};

	// Format date and time for records
	const formatDateTime = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return 'N/A';
		return date.toLocaleDateString() + ' • ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const formatDuration = (elapsedTime) => {
		if (!elapsedTime) return 'N/A';
		const totalSeconds = Math.floor(elapsedTime / 1000); // Convert milliseconds to seconds
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	};

	// Get job type icon
	const getJobTypeIcon = (jobType) => {
		return config.JOB_TYPE_ICONS[jobType] || config.JOB_TYPE_ICONS.custom;
	};

	// Handle job record press - navigate to JobDetailScreen
const handleJobRecordPress = (record) => {
	console.log('Job record pressed:', JSON.stringify(record, null, 2));
	navigation.navigate('JobDetailScreen', { jobRecord: record });
};

	// Render job record item
	const renderJobRecordItem = ({ item }) => {
		const title = item.template?.name || t(`common:jobTypes.${item.type}`);

		const getFieldName = () => {
			if (item.fieldId && farmData?.fields) {
				const field = farmData.fields.find(f => String(f._id) === String(item.fieldId));
				const fieldName = field?.name || item.fieldId;

				// Check if this is part of a batch job
				const batchFieldCount = item.batch?.fieldIds?.length || item.batch?.totalFields || 0;
				if (batchFieldCount > 1) {
					const otherFields = batchFieldCount - 1;
					return `${fieldName} and ${otherFields} more`;
				}

				return fieldName;
			}
			return item.fieldId || null;
		};



		// Support both 'type' (new schema) and 'jobType' (old schema)
		const itemType = item.type || item.jobType || 'custom';

		const isSynced = item._id !== undefined;

		return (
			<ListItem
				icon={getJobTypeIcon(itemType)}
				// title={title + ' ➜ ' + getFieldName()}
				title={(
					<View style={{ display: 'flex', flexDirection: 'row' }}>
						<Text style={{
							display: 'flex',
							flexDirection: 'row',
							fontSize: 16,
							fontFamily: 'Geologica-Bold',
						}}>{title}</Text>
						<Text style={{
							display: 'flex',
							flexDirection: 'row',
							fontSize: 12,
							paddingTop: 5,
						}}> ➜ </Text>
						<Text style={{
							display: 'flex',
							flexDirection: 'row',
							fontSize: 16,
							fontFamily: 'Geologica-Bold',
							color: colors.SECONDARY,
						}}>{getFieldName()}</Text>
					</View>
				)}
				subTitle1={formatDateTime(item.startedAt || item.startTime)}
				subTitle2={`Duration: ${formatDuration(item.elapsedTime)}`}
				showChevron={true}
				syncStatus={isSynced ? 'synced' : 'pending'}
				onPress={() => handleJobRecordPress(item)}
			/>
		);
	};

	// Render load more footer
	const renderFooter = () => {
		if (!loadingMore) return null;

		return (
			<View style={styles.loadMoreContainer}>
				<ActivityIndicator size="small" color={colors.SECONDARY} />
				<Text style={styles.loadMoreText}>Loading more...</Text>
			</View>
		);
	};

	// Render empty state
	const renderEmptyState = () => {
		if (loading) {
			return (
				<View style={styles.emptyContainer}>
					<ActivityIndicator size="large" color={colors.SECONDARY} />
				</View>
			);
		}

		return (
			<View style={styles.emptyContainer}>
				<Image
					source={require('../../assets/icons/job_icon.png')}
					style={styles.emptyIcon}
					resizeMode="contain"
				/>
				<Text style={styles.emptyText}>{t('screens:tabJobs.noJobRecords')}</Text>
				<Text style={styles.emptyTextSub}>
					{Object.values(filters).some(f => f && f !== 'all') || searchQuery
						? t('screens:tabJobs.tryChangingFilters')
						: t('screens:tabJobs.startRecordingJobs')}
				</Text>
			</View>
		);
	};


	return (
		<SwipeableTabs
			initialTab={0}
			tabs={[
				{
					key: 'jobRecords',
					title: 'Job Records',
					content: (
						<View style={styles.container}>
							<View style={styles.searchContainer}>
								<TextInput
									style={styles.searchInput}
									placeholder="Search job records..."
									value={searchQuery}
									onChangeText={setSearchQuery}
									placeholderTextColor={colors.PRIMARY_LIGHT}
								/>
								<TouchableOpacity
									style={styles.filterIconContainer}
									onPress={showFiltersScreen}
								>
									<Image
										source={require('../../assets/icons/filter.png')}
										style={styles.filterIcon}
										resizeMode="contain"
									/>
									{getActiveFilterCount() > 0 && (
										<View style={styles.filterBadge}>
											<Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
										</View>
									)}
								</TouchableOpacity>
							</View>

							{/* Applied Filters Text */}
							<View style={styles.appliedFiltersContainer}>
								<Text style={styles.appliedFiltersText}>
									{getAppliedFiltersText()}
								</Text>
							</View>

							<FlatList
								key={`jobRecords-${JSON.stringify(filters)}-${searchQuery}`}
								data={jobRecords}
								renderItem={renderJobRecordItem}
								keyExtractor={(item, index) => item._id ? `${item._id}-${index}` : `local-${index}`}
								ListEmptyComponent={renderEmptyState}
								ListFooterComponent={renderFooter}
								contentContainerStyle={[
									jobRecords.length === 0 ? { flex: 1 } : null,
									{ paddingBottom: 150 }
								]}
								showsVerticalScrollIndicator={false}
								onRefresh={handleRefresh}
								refreshing={refreshing}
								onEndReached={handleLoadMore}
								onEndReachedThreshold={0.1}
								style={styles.recordsList}
							/>

							{/* Date Picker */}
							<DatePicker
								modal
								open={datePickerOpen}
								date={
									datePickerType === 'from'
										? filters.dateFrom || new Date()
										: filters.dateTo || new Date()
								}
								mode="date"
								onConfirm={(selectedDate) => {
									setDatePickerOpen(false);
									const newFilters = {
										...filters,
										[datePickerType === 'from' ? 'dateFrom' : 'dateTo']: selectedDate
									};
									handleFilterChange(newFilters);
								}}
								onCancel={() => setDatePickerOpen(false)}
								title={`Select ${datePickerType === 'from' ? 'start' : 'end'} date`}
							/>
						</View>
					)
				},
				{
					key: 'jobTemplates',
					title: 'Job Templates',
					content: (
						<View style={styles.container}>
							<View style={styles.fixedAddButtonContainer}>
								<PrimaryButton
									text="Add Job Template"
									style={{ width: 260 }}
									onPress={() => {
										openBottomSheet(
											<SelectJobTypeBottomSheet onSelectType={(type) => {
												closeBottomSheet();
												navigation.navigate('TemplateWizardScreen', { selectedType: type });
											}} />,
											{
												snapPoints: ['85%'],
												isDismissible: true,
												borderColor: colors.PRIMARY
											}
										);
									}}
								/>
							</View>
							<SearchableListSheet
								isBottomSheet={false}
								localData={useMemo(() => {
									return (farmData?.jobTemplates || []).map(template => {
										const machineName = template.machine?.name ||
											(template.machine || template.machineId ?
												(farmData.machines?.find(m => m._id === (template.machine || template.machineId))?.name || '') : '');

										const attachmentName = template.attachment?.name ||
											(template.attachment || template.attachmentId ?
												(farmData.attachments?.find(a => a._id === (template.attachment || template.attachmentId))?.name || '') : '');

										const toolName = template.tool?.name ||
											(template.tool || template.toolId ?
												(farmData.tools?.find(tl => tl._id === (template.tool || template.toolId))?.name || '') : '');

										const typeLabel = template.type ? t(`common:jobTypes.${template.type}`) || template.type : 'Template';

										const equipmentSubtitle = [
											machineName && `${machineName}`,
											attachmentName && `${attachmentName}`,
											toolName && `${toolName}`
										].filter(Boolean).join(' • ') || 'Tap to configure equipment';

										return {
											...template,
											_typeLabel: typeLabel,
											_equipmentSubtitle: equipmentSubtitle
										};
									});
								}, [farmData?.jobTemplates, farmData?.machines, farmData?.attachments, farmData?.tools, t])}
								searchKeys={['name', '_typeLabel', '_equipmentSubtitle']}
								searchPlaceholder={t('screens:tabJobs.searchTemplates')}
								showHeader={false}
								onSelect={(template) => {
									navigation.navigate('TemplateWizardScreen', { template });
								}}
								renderItem={({ item, onSelect }) => (
									<TouchableOpacity
										style={styles.templateItem}
										onPress={() => onSelect(item)}
									>
										<ListItem
											icon={config.JOB_TYPE_ICONS[item.type] || require('../../assets/icons/job_icon.png')}
											subTitle1={item._typeLabel}
											title={item.name}
											subTitle2={item._equipmentSubtitle}
											simple={false}
											showChevron={true}
										/>
									</TouchableOpacity>
								)}
								keyExtractor={(item) => item._id || item.id}
								emptyTitle={t('screens:tabJobs.noTemplates')}
								emptySubtitle={t('screens:tabJobs.createTemplateToStart')}
								style={styles.templatesListContainer}
							/>
						</View>
					)
				}
			]}
		/>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
		position: 'relative',
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 8,
		width: '88%',
		gap: 12,
	},
	searchInput: {
		flex: 1,
		height: 46,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontSize: 17,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
	},
	filterIconContainer: {
		position: 'relative',
		padding: 8,
	},
	filterIcon: {
		width: 24,
		height: 24,
		tintColor: colors.SECONDARY,
	},
	filterBadge: {
		position: 'absolute',
		top: 0,
		right: 0,
		backgroundColor: colors.ACCENT,
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: 'center',
		alignItems: 'center',
	},
	filterBadgeText: {
		color: 'white',
		fontSize: 12,
		fontFamily: 'Geologica-Bold',
	},
	appliedFiltersContainer: {
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	appliedFiltersText: {
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		fontFamily: 'Geologica-Regular',
		fontStyle: 'italic',
	},
	recordsList: {
		flex: 1,
		paddingHorizontal: 16,
	},
	loadMoreContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 16,
		gap: 8,
	},
	loadMoreText: {
		color: colors.SECONDARY,
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
	},
	emptyIcon: {
		width: 80,
		height: 80,
		opacity: 0.3,
		marginBottom: 16,
	},
	emptyText: {
		fontSize: 18,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginBottom: 8,
	},
	emptyTextSub: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
	},
	templatesListContainer: {
		flex: 1,
		paddingTop: 16,
	},
	templateItem: {
		marginBottom: 8,
	},
	fixedAddButtonContainer: {
		position: 'absolute',
		bottom: 120,
		left: 0,
		right: 0,
		alignItems: 'center',
		zIndex: 99,
	},
});

export default TabJobs;