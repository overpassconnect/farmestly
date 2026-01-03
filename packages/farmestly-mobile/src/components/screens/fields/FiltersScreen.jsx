import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../../hooks/useApi';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Image
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DatePicker from 'react-native-date-picker';
import colors from '../../../globals/colors';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import PrimaryButton from '../../ui/core/PrimaryButton';
import SearchableListSheet from '../../ui/list/SearchableListSheet';
import ListItem from '../../ui/list/ListItem';
import { useTranslation } from 'react-i18next';

import config from '../../../globals/config';
const BASE_URL = config.BASE_URL;


const FiltersScreen = () => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const route = useRoute();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const { farmData } = useGlobalContext();
	const { api } = useApi();


	// Get initial filters from route params
	const initialFilters = route.params?.currentFilters || {
		jobType: 'all',
		fieldId: null,
		cultivationId: null,
		dateFrom: null,
		dateTo: null,
		templateId: null
	};

	const [filters, setFilters] = useState(initialFilters);
	const [jobTypeFilters, setJobTypeFilters] = useState([]);
	const [cultivations, setCultivations] = useState([]);

	// Date picker states
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [datePickerType, setDatePickerType] = useState('from'); // 'from' or 'to'

	// Load cultivations from all fields
	const loadCultivations = useCallback(async () => {
		if (!farmData?.fields || farmData.fields.length === 0) {
			setCultivations([]);
			return;
		}

		const allCultivations = [];

		const fieldCultivations = await Promise.all(
			farmData.fields.map(async field => {
				const result = await api(`${BASE_URL}/cultivation/field/${field._id}`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					}
				});

				if (result.ok) {
					return result.data.map(cult => ({
						...cult,
						fieldName: field.name
					}));
				}
				return [];
			})
		);

		// Flatten all cultivations from all fields
		fieldCultivations.forEach(fieldCults => {
			allCultivations.push(...fieldCults);
		});
		setCultivations(allCultivations);
	}, [farmData, api]);

	// Load cultivations on component mount
	useEffect(() => {
		loadCultivations();
	}, [loadCultivations]);

	// Initialize job type filters when farmData changes
	useEffect(() => {
		// Build filters from templates
		const templateFilters = (farmData?.jobTemplates || []).map(template => ({
			id: template.id,
			label: template.name,
			isCustom: true,
			templateId: template.id
		}));

		const allFilters = [
			{ id: 'all', label: t('screens:filters.allJobs') },
			{ id: 'sow', label: t('screens:filters.sow') },
			{ id: 'harvest', label: t('screens:filters.harvest') },
			{ id: 'spray', label: t('screens:filters.spray') },
			{ id: 'irrigate', label: t('screens:filters.irrigate') || 'Irrigate' },
			...templateFilters
		];

		setJobTypeFilters(allFilters);
	}, [farmData, t]);

	// Show field filter options
	const showFieldFilter = () => {
		if (!farmData?.fields || farmData.fields.length === 0) {
			return;
		}

		const fieldOptions = [
			{ _id: null, name: t('screens:filters.allFields'), isAllOption: true },
			...farmData.fields.map(field => ({
				_id: field._id,
				name: field.name,
				area: field.area
			}))
		];

		const renderFieldItem = ({ item, onSelect }) => (
			<TouchableOpacity
				style={[
					styles.filterOption,
					filters.fieldId === item._id && styles.filterOptionSelected
				]}
				onPress={() => onSelect(item)}
			>
				<ListItem
					title={item.name}
					subTitle1={item.isAllOption ? '' : `${item.area ? item.area.toFixed(2) : '0'} ha`}
					simple={true}
					showChevron={false}
				/>
				{filters.fieldId === item._id && <Text style={styles.checkmark}>✓</Text>}
			</TouchableOpacity>
		);

		const content = (
			<SearchableListSheet
				localData={fieldOptions}
				searchKeys={['name']}
				searchPlaceholder={t('screens:filters.searchFields')}
				title={t('screens:filters.selectField')}
				onSelect={(item) => {
					setFilters(prev => ({ ...prev, fieldId: item._id }));
					closeBottomSheet();
				}}
				renderItem={renderFieldItem}
				keyExtractor={(item) => item._id || 'all'}
				emptyTitle={t('screens:filters.noFieldsFound')}
				emptySubtitle={t('screens:filters.tryDifferentSearch')}
			/>
		);

		openBottomSheet(content, {
			snapPoints: ['60%', '90%'],
			enablePanDownToClose: true
		});
	};

	// Show cultivation filter options
	const showCultivationFilter = () => {
		const cultivationOptions = [
			{ _id: null, crop: t('screens:filters.allCultivations'), isAllOption: true },
			...cultivations.map(cult => ({
				_id: cult._id,
				crop: cult.crop,
				variety: cult.variety,
				fieldName: cult.fieldName
			}))
		];

		const renderCultivationItem = ({ item, onSelect }) => (
			<TouchableOpacity
				style={[
					styles.filterOption,
					filters.cultivationId === item._id && styles.filterOptionSelected
				]}
				onPress={() => onSelect(item)}
			>
				<ListItem
					title={item.variety ? `${item.crop} (${item.variety})` : item.crop}
					subTitle1={item.isAllOption ? '' : item.fieldName}
					simple={true}
					showChevron={false}
				/>
				{filters.cultivationId === item._id && <Text style={styles.checkmark}>✓</Text>}
			</TouchableOpacity>
		);

		const content = (
			<SearchableListSheet
				localData={cultivationOptions}
				searchKeys={['crop', 'variety', 'fieldName']}
				searchPlaceholder={t('screens:filters.searchCultivations')}
				title={t('screens:filters.selectCultivation')}
				onSelect={(item) => {
					setFilters(prev => ({ ...prev, cultivationId: item._id }));
					closeBottomSheet();
				}}
				renderItem={renderCultivationItem}
				keyExtractor={(item) => item._id || 'all'}
				emptyTitle={t('screens:filters.noCultivationsFound')}
				emptySubtitle={t('screens:filters.tryDifferentSearch')}
			/>
		);

		openBottomSheet(content, {
			snapPoints: ['60%', '90%'],
			enablePanDownToClose: true
		});
	};

	// Handle apply filters
	const handleApplyFilters = () => {
		// Navigate back and pass filters
		navigation.navigate('Main', {
			screen: 'Jobs',
			params: {
				updatedFilters: filters
			}
		});
	};

	// Handle clear all filters
	const handleClearAll = () => {
		const resetFilters = {
			jobType: 'all',
			fieldId: null,
			cultivationId: null,
			dateFrom: null,
			dateTo: null,
			templateId: null
		};
		setFilters(resetFilters);
	};

	return (
		<View style={styles.safeArea}>
			<View style={[styles.container,]}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						{/* <Image
							source={require('../../../assets/icons/back.png')}
							style={styles.backIcon}
							resizeMode="contain"
						/> */}
					</TouchableOpacity>
					<Text style={styles.headerTitle}>{t('screens:filters.title')}</Text>
					<TouchableOpacity
						style={styles.clearButton}
						onPress={handleClearAll}
					>
						<Text style={styles.clearButtonText}>{t('screens:filters.clearAll')}</Text>
					</TouchableOpacity>
				</View>

				<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
					{/* Date Range Section */}
					<View style={styles.filterSection}>
						<Text style={styles.filterSectionTitle}>{t('screens:filters.dateRange')}</Text>
						<View style={styles.dateRangeContainer}>
							<TouchableOpacity
								style={styles.datePickerButton}
								onPress={() => {
									setDatePickerType('from');
									setDatePickerOpen(true);
								}}
							>
								<View style={styles.calendarEmoji}><Image style={{ width: 22, height: 22 }} source={require('../../../assets/icons/date_input_icon.png')}></Image></View>
								<Text style={styles.datePickerText}>
									{filters.dateFrom ? filters.dateFrom.toLocaleDateString() : t('screens:filters.startDate')}
								</Text>
								<Text style={styles.dropdownIcon}>▼</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.datePickerButton}
								onPress={() => {
									setDatePickerType('to');
									setDatePickerOpen(true);
								}}
							>
								<View style={styles.calendarEmoji}><Image style={{ width: 22, height: 22 }} source={require('../../../assets/icons/date_input_icon.png')}></Image></View>
								<Text style={styles.datePickerText}>
									{filters.dateTo ? filters.dateTo.toLocaleDateString() : t('screens:filters.endDate')}
								</Text>
								<Text style={styles.dropdownIcon}>▼</Text>
							</TouchableOpacity>
						</View>
					</View>

					{/* Job Type Section */}
					<View style={styles.filterSection}>
						<Text style={styles.filterSectionTitle}>{t('screens:filters.jobType')}</Text>
						<View style={styles.chipContainer}>
							{jobTypeFilters.map(jobType => (
								<TouchableOpacity
									key={jobType.id}
									style={[
										styles.filterChip,
										((jobType.isCustom && filters.templateId === jobType.templateId) ||
											(!jobType.isCustom && filters.jobType === jobType.id && !filters.templateId)) && styles.filterChipSelected
									]}
									onPress={() => {
										if (jobType.isCustom) {
											// For custom templates, set templateId and reset jobType
											setFilters(prev => ({
												...prev,
												jobType: 'all',
												templateId: jobType.templateId
											}));
										} else {
											// For built-in job types, set jobType and reset templateId
											setFilters(prev => ({
												...prev,
												jobType: jobType.id,
												templateId: null
											}));
										}
									}}
								>
									<Text style={[
										styles.filterChipText,
										((jobType.isCustom && filters.templateId === jobType.templateId) ||
											(!jobType.isCustom && filters.jobType === jobType.id && !filters.templateId)) && styles.filterChipTextSelected
									]}>
										{jobType.label}
									</Text>
									{((jobType.isCustom && filters.templateId === jobType.templateId) ||
										(!jobType.isCustom && filters.jobType === jobType.id && !filters.templateId)) && (
											<Text style={styles.chipCheckmark}>✓</Text>
										)}
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* Field Section */}
					<View style={styles.filterSection}>
						<Text style={styles.filterSectionTitle}>{t('screens:filters.field')}</Text>
						<TouchableOpacity
							style={styles.dropdownButton}
							onPress={showFieldFilter}
						>
							<Text style={styles.dropdownButtonText}>
								{filters.fieldId
									? farmData?.fields?.find(f => f._id === filters.fieldId)?.name || t('screens:filters.selectField')
									: t('screens:filters.allFields')
								}
							</Text>
							<Text style={styles.dropdownIcon}>▼</Text>
						</TouchableOpacity>
					</View>

					{/* Cultivation Section */}
					<View style={styles.filterSection}>
						<Text style={styles.filterSectionTitle}>{t('screens:filters.cultivation')}</Text>
						<TouchableOpacity
							style={styles.dropdownButton}
							onPress={showCultivationFilter}
						>
							<Text style={styles.dropdownButtonText}>
								{filters.cultivationId
									? cultivations.find(c => c._id === filters.cultivationId)?.crop || t('screens:filters.selectCultivation')
									: t('screens:filters.allCultivations')
								}
							</Text>
							<Text style={styles.dropdownIcon}>▼</Text>
						</TouchableOpacity>
					</View>
				</ScrollView>

				{/* Apply Button */}
				<View style={styles.buttonContainer}>
					<PrimaryButton
						text={t('screens:filters.applyFilters')}
						onPress={handleApplyFilters}
					/>
				</View>

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
						setFilters(prev => ({
							...prev,
							[datePickerType === 'from' ? 'dateFrom' : 'dateTo']: selectedDate
						}));
					}}
					onCancel={() => setDatePickerOpen(false)}
					title={datePickerType === 'from' ? t('screens:filters.selectStartDate') : t('screens:filters.selectEndDate')}
				/>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: 'white',
	},
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
	},
	backButton: {
		padding: 8,
		width: 40,
	},
	headerTitle: {
		fontSize: 18,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		flex: 1,
		textAlign: 'center',
	},
	clearButton: {
		padding: 8,
	},
	clearButtonText: {
		fontSize: 16,
		fontFamily: 'Geologica-Medium',
		color: colors.ACCENT,
	},
	content: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	filterSection: {
		marginVertical: 12,
	},
	filterSectionTitle: {
		fontSize: 15,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	dateRangeContainer: {
		gap: 8,
	},
	datePickerButton: {
		flexDirection: 'row',
		alignItems: 'center',
		// backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 8,
		padding: 12,
		gap: 10,
	},
	calendarEmoji: {
		fontSize: 20,
	},
	datePickerText: {
		flex: 1,
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
	},
	dropdownIcon: {
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
	},
	chipContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	filterChip: {
		// backgroundColor: colors.SECONDARY_LIGHT,
		borderWidth: 1,
		borderColor: colors.PRIMARY,
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 6,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	filterChipSelected: {
		backgroundColor: colors.PRIMARY,
	},
	filterChipText: {
		fontSize: 13,
		fontFamily: 'Geologica-Medium',
		color: colors.PRIMARY,
	},
	filterChipTextSelected: {
		color: 'white',
	},
	chipCheckmark: {
		fontSize: 12,
		color: 'white',
		fontFamily: 'Geologica-Bold',
	},
	dropdownButton: {
		flexDirection: 'row',
		alignItems: 'center',
		// backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 8,
		padding: 12,
		justifyContent: 'space-between',
	},
	dropdownButtonText: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		flex: 1,
	},
	buttonContainer: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderTopWidth: 1,
		borderTopColor: colors.SECONDARY_LIGHT,
		backgroundColor: 'white',
	},
	filterOption: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		marginBottom: 4,
	},
	filterOptionSelected: {
		backgroundColor: colors.ACCENT,
	},
	checkmark: {
		fontSize: 18,
		color: 'white',
		fontFamily: 'Geologica-Bold',
	},
});

export default FiltersScreen;