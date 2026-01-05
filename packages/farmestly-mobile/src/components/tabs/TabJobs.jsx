import React, { useMemo, useState, useEffect } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import SwipeableTabs from '../ui/core/SwipableTabs';
import PrimaryButton from '../ui/core/PrimaryButton';
import colors from '../../globals/colors';
import { useBottomSheet } from '../sheets/BottomSheetContextProvider';
import { useGlobalContext } from '../context/GlobalContextProvider';
import ListItem from '../ui/list/ListItem';
import SelectJobTypeBottomSheet from '../sheets/SelectJobTypeBottomSheet';
import SearchableListSheet from '../ui/list/SearchableListSheet';
import JobService from '../../utils/JobService';
import config from '../../globals/config';

const TabJobs = () => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const { farmData, isOffline } = useGlobalContext();

	// Local cached jobs for offline mode
	const [cachedJobs, setCachedJobs] = useState([]);

	// Load cached jobs when offline or on mount
	useEffect(() => {
		const loadCachedJobs = async () => {
			try {
				const jobs = await JobService.getAllCachedJobs({ limit: 100 });
				setCachedJobs(jobs);
			} catch (err) {
				console.error('[TabJobs] Failed to load cached jobs:', err);
			}
		};
		loadCachedJobs();
	}, []);

	// Format date and time for records
	const formatDateTime = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return 'N/A';
		return date.toLocaleDateString() + ' • ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const formatDuration = (elapsedTime) => {
		if (!elapsedTime) return 'N/A';
		const totalSeconds = Math.floor(elapsedTime / 1000);
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
		navigation.navigate('JobDetailScreen', { jobRecord: record });
	};

	// Render job record item
	const renderJobRecordItem = ({ item, onSelect }) => {
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
				onPress={() => onSelect(item)}
			/>
		);
	};

	// Prepared job templates data with computed fields
	const preparedTemplates = useMemo(() => {
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
	}, [farmData?.jobTemplates, farmData?.machines, farmData?.attachments, farmData?.tools, t]);

	return (
		<SwipeableTabs
			initialTab={0}
			tabs={[
				{
					key: 'jobRecords',
					title: 'Job Records',
					content: (
						<View style={styles.container}>
							<SearchableListSheet
								isBottomSheet={false}
								isOnline={!isOffline}
								localData={cachedJobs}
								endpoint="/job/records"
								paginatedEndpoint={true}
								pageSize={10}
								responseDataKey="records"
								paginationDataKey="pagination"
								searchKeys={['template.name', 'type']}
								searchPlaceholder={t('screens:tabJobs.searchJobRecords') || 'Search job records...'}
								onSelect={handleJobRecordPress}
								renderItem={renderJobRecordItem}
								keyExtractor={(item, index) => item._id ? `${item._id}-${index}` : `local-${item.id || index}`}
								emptyTitle={t('screens:tabJobs.noJobRecords')}
								emptySubtitle={isOffline ? t('screens:tabJobs.offlineNoCache') || 'No cached jobs available' : t('screens:tabJobs.startRecordingJobs')}
								style={styles.listContainer}
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
								localData={preparedTemplates}
								searchKeys={['name', '_typeLabel', '_equipmentSubtitle']}
								searchPlaceholder={t('screens:tabJobs.searchTemplates')}
								showHeader={true}
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
	listContainer: {
		flex: 1,
		paddingTop: 8,
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
