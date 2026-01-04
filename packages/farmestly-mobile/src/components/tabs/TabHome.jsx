import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ActivityIndicator,
	Dimensions,
	Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Storage } from '../../utils/storage';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

import colors from '../../globals/colors';
import PolygonDrawingMap from '../setup/PolygonDrawingMap/index.jsx';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useUnits } from '../../providers/UnitsProvider';
import PrimaryButton from '../ui/core/PrimaryButton';
import SlidingHeader from './SlidingHeader';
import { useBottomSheet } from '../sheets/BottomSheetContextProvider';
import RecordJobBottomSheet from '../sheets/RecordJobBottomSheet';
import JobService from '../../utils/JobService';
import ActiveRecordingSheet from '../sheets/ActiveRecordingSheet';
import JobConfirmationSheet from '../sheets/JobConfirmationSheet';
import OfflineFieldList from '../OfflineFieldList';
import { calculatePolygonsBounds } from '../setup/PolygonDrawingMap/utils';
import RecordingFAB from '../RecordingFAB';
import { getFieldCompliance } from '../../utils/compliance';
import ComplianceWarningSheet from '../sheets/ComplianceWarningSheet';
import MultiFieldJobBottomSheet from '../sheets/MultiFieldJobBottomSheet';

const { height: screenHeight } = Dimensions.get('window');

const FIELD_GROUPS_STORAGE_KEY = '@FieldGroups';
const SELECTED_GROUP_KEY = '@SelectedFieldGroup';

const TabHome = () => {
	const { farmData, setFarmData, activeRecordings, isOffline, loadFromServer } = useGlobalContext();
	const navigation = useNavigation();
	const route = useRoute();
	const insets = useSafeAreaInsets();
	const { openBottomSheet, closeBottomSheet, isOpen: isBottomSheetOpen } = useBottomSheet();
	const { format, formatValue, symbol } = useUnits();

	// Refs
	const mapRef = useRef();
	const headerRef = useRef();

	// Core state
	const [currentGroup, setCurrentGroup] = useState(null);
	const [selectedField, setSelectedField] = useState(null);
	const [currentViewIndex, setCurrentViewIndex] = useState(0);
	const [groupsLoaded, setGroupsLoaded] = useState(false);
	const [multiSelectedFields, setMultiSelectedFields] = useState([]);

	// Derived data
	const allFields = farmData?.fields || [];

	const visibleFields = useMemo(() => {
		if (!currentGroup || currentGroup.name === 'All fields') {
			return allFields;
		}
		return allFields.filter(f => currentGroup.fieldIds?.includes(f._id));
	}, [allFields, currentGroup]);

	const views = useMemo(() => {
		const fieldViews = visibleFields.map(field => ({
			title: field.name,
			subtitle: `${format(field.area, 'area')} • ${field.farmingType || 'N/A'} • ${field.currentCultivation ? 'Active' : 'Inactive'}`,
			fieldId: field._id
		}));

		const overviewTitle = currentGroup && currentGroup.name !== 'All fields'
			? `${visibleFields.length} Fields in ${currentGroup.name}`
			: `${visibleFields.length} Fields in total`;

		const totalArea = visibleFields.reduce((acc, f) => acc + (f.area || 0), 0);
		const totalAreaFormatted = format(totalArea, 'area');

		return [
			{ title: overviewTitle, subtitle: `Total area: ${totalAreaFormatted}` },
			...fieldViews
		];
	}, [visibleFields, currentGroup, format]);

	// Recording state
	const recordingFieldIds = Object.keys(activeRecordings);
	const hasActiveRecording = recordingFieldIds.length > 0;
	const selectedFieldHasRecording = selectedField && activeRecordings[selectedField._id];
	const currentViewFieldId = views[currentViewIndex]?.fieldId;
	const currentViewHasRecording = currentViewFieldId && activeRecordings[currentViewFieldId];
	const fabFieldId = currentViewHasRecording ? currentViewFieldId : recordingFieldIds[0];
	const showFAB = hasActiveRecording && !isBottomSheetOpen && currentViewIndex !== 0 && currentViewHasRecording;


	// Multi-select state
	const isMultiSelectActive = multiSelectedFields.length > 0;
	const multiSelectTotalArea = multiSelectedFields.reduce((sum, f) => sum + (f.area || 0), 0);
	// console.log('FAB debug:', {
	// 	hasActiveRecording,
	// 	isBottomSheetOpen,
	// 	currentViewIndex,
	// 	currentViewFieldId,
	// 	currentViewHasRecording,
	// 	recordingFieldIds,
	// 	fabFieldId,
	// 	showFAB,
	// 	'activeRecordings': activeRecordings
	// });
	// Layout constants
	const BOTTOM_OFFSET = 80; // base offset from bottom (excluding safe-area inset)
	const fitPadding = {
		top: 190,
		bottom: 180 + insets.bottom,
		left: 40,
		right: 40,
	};

	// ===== EFFECTS =====

	// Initialize recording service once
	useEffect(() => {
		JobService.initialize();
		// return () => JobService.cleanup();
	}, []);

	// Function to load groups from Storage
	const loadGroups = useCallback(() => {
		if (allFields.length === 0) return;

		Promise.all([
			Storage.getItem(SELECTED_GROUP_KEY),
			Storage.getItem(FIELD_GROUPS_STORAGE_KEY)
		]).then(([groupIndex, groupsJson]) => {
			if (!groupsJson) {
				// Create default group
				const defaultGroup = {
					name: 'All fields',
					fieldIds: allFields.map(f => f._id),
					centroid: calculatePolygonsBounds(allFields)
				};
				Storage.setItem(FIELD_GROUPS_STORAGE_KEY, JSON.stringify([defaultGroup]));
				Storage.setItem(SELECTED_GROUP_KEY, '0');
				setCurrentGroup(defaultGroup);
			} else {
				const groups = JSON.parse(groupsJson);
				const idx = parseInt(groupIndex || '0');
				setCurrentGroup(groups[idx] || groups[0]);
			}
			setGroupsLoaded(true);
		});
	}, [allFields]);

	// Load saved group on mount
	useEffect(() => {
		loadGroups();
	}, [loadGroups]);

	// Reload groups when screen comes into focus (after field redraw, etc.)
	useFocusEffect(
		useCallback(() => {
			if (groupsLoaded) {
				loadGroups();
			}
		}, [groupsLoaded, loadGroups])
	);

	// Handle startJobRecording param
	// useEffect(() => {
	// 	const jobConfig = route.params?.startJobRecording;
	// 	if (!jobConfig) return;

	// 	const field = allFields.find(f => f.id === jobConfig.fieldId);
	// 	if (field) {
	// 		setSelectedField(field);
	// 		JobRecordingService.startRecording({
	// 			...jobConfig,
	// 			fieldName: field.name,
	// 			fieldArea: field.area,
	// 		})
	// 			.then(() => openRecordingSheet(field.id))
	// 			.catch(err => Alert.alert("Recording Error", err.message));
	// 	}
	// 	navigation.setParams({ startJobRecording: undefined });
	// }, [route.params?.startJobRecording]);
	// Handle startJobRecording param
	useEffect(() => {
		const jobConfig = route.params?.startJobRecording;
		if (!jobConfig || !groupsLoaded) return;

		const field = allFields.find(f => f._id === jobConfig.fieldId);
		if (!field) return;

		const viewIndex = visibleFields.findIndex(f => f._id === field._id) + 1;
		if (viewIndex < 1) return;

		navigation.setParams({ startJobRecording: undefined });

		// Optimistically update field.currentCultivation for sow jobs
		if (jobConfig.type === 'sow' && jobConfig.cultivation) {
			setFarmData(prev => ({
				...prev,
				fields: prev.fields.map(f =>
					f._id === jobConfig.fieldId
						? {
							...f,
							currentCultivation: {
								id: jobConfig.cultivation.id,
								crop: jobConfig.cultivation.crop,
								variety: jobConfig.cultivation.variety,
								startTime: new Date().toISOString()
							}
						}
						: f
				)
			}));
		}

		// JobService.start() now expects (fieldId, type, jobData)
		// where jobData contains: fieldName, fieldArea, template, machine, attachment, tool, cultivation, data, notes
		JobService.start(field._id, jobConfig.type, {
			fieldName: field.name,
			fieldArea: field.area,
			template: jobConfig.template,
			machine: jobConfig.machine,
			attachment: jobConfig.attachment,
			tool: jobConfig.tool,
			cultivation: jobConfig.cultivation,
			data: jobConfig.data,
			notes: jobConfig.notes
		})
			.then(() => {
				openRecordingSheet(field._id, () => {
					// Called after bottom sheet animation completes
					headerRef.current?.slideToIndex(viewIndex);
				});
			})
			.catch(err => Alert.alert("Recording Error", err.message));
	}, [route.params?.startJobRecording, groupsLoaded, allFields, visibleFields]);
	// ===== HANDLERS =====
	const handleStopRecording = useCallback((fieldId) => {
		const recording = JobService.getActive(fieldId);
		if (!recording) return;

		const openRecordingSheetForField = (fId) => {
			openBottomSheet(
				<ActiveRecordingSheet fieldId={fId} onStop={handleStopRecording} />,
				{
					snapPoints: ['38%', '60%'],
					enablePanDownToClose: false,
					enableBackdrop: false,
				}
			);
		};

		// Check if this is part of a batch
		const isBatch = JobService.isBatchActive();

		openBottomSheet(
			<JobConfirmationSheet
				recording={recording}
				onConfirm={() => {
					closeBottomSheet();
					// Use completeBatch for batch jobs, stop for single jobs
					const stopPromise = isBatch
						? JobService.completeBatch()
						: JobService.stop(fieldId);

					stopPromise.then(finished => {
						if (finished) {
							navigation.navigate('JobSummaryScreen', { completedRecording: finished });
							loadFromServer();
						}
					}).catch(error => {
						console.error('[TabHome] Error stopping recording:', error);
						// If batch completion fails, try to clear stuck state
						if (isBatch) {
							JobService.clearBatchPending();
						}
					});
				}}
				onCancel={() => {
					closeBottomSheet();
					openRecordingSheetForField(fieldId);
				}}
			/>,
			{ snapPoints: ['60%'], enablePanDownToClose: false }
		);
	}, [openBottomSheet, closeBottomSheet, navigation, loadFromServer]);

	const openRecordingSheet = useCallback((fieldId, onOpened = null) => {
		openBottomSheet(
			<ActiveRecordingSheet fieldId={fieldId} onStop={handleStopRecording} />,
			{
				snapPoints: ['38%', '60%'],
				enablePanDownToClose: false,
				enableBackdrop: false,
				onOpened  // Pass through
			}
		);
	}, [handleStopRecording, openBottomSheet]);

	const handleViewChange = useCallback((index, view) => {
		// Prevent infinite loops - ignore if same index
		if (index === currentViewIndex && view?.fieldId === selectedField?._id) {
			return;
		}

		// Hide labels immediately
		mapRef.current?.hideLabels();

		setCurrentViewIndex(index);
		mapRef.current?.clearSelection();
		setSelectedField(null);

		if (view?.isGroup && view.fieldIds) {
			mapRef.current?.fitToFields(view.fieldIds);
			// Show labels after map animation completes
			setTimeout(() => {
				mapRef.current?.showLabels();
			}, 400);
			return;
		}

		if (index === 0) {
			mapRef.current?.fitToAll();
			// Show labels after map animation completes
			setTimeout(() => {
				mapRef.current?.showLabels();
			}, 400);
		} else if (view?.fieldId) {
			const field = visibleFields.find(f => f._id === view.fieldId);
			if (field) {
				setSelectedField(field);
				mapRef.current?.selectField(view.fieldId);
				// Show labels after map animation completes
				setTimeout(() => {
					mapRef.current?.showLabels();
				}, 400);
			}
		}
	}, [visibleFields, currentViewIndex, selectedField?._id]);

	const handlePolygonSelect = useCallback((polygonId) => {
		const field = visibleFields.find(f => f._id === polygonId);
		if (field) {
			setSelectedField(field);
			const viewIndex = views.findIndex(v => v.fieldId === polygonId);
			if (viewIndex >= 0) {
				headerRef.current?.slideToIndex(viewIndex);
			}
		}
	}, [visibleFields, views]);

	const handleMultiSelectChange = useCallback((selectedIds, isMultiMode) => {
		if (isMultiMode && selectedIds.size > 0) {
			const fields = allFields.filter(f => selectedIds.has(f._id));
			setMultiSelectedFields(fields);
		} else {
			setMultiSelectedFields([]);
		}
	}, [allFields]);

	const navigateToJobScreen = useCallback((jobData, field) => {
		if (!field) {
			console.error('navigateToJobScreen called without field');
			return;
		}

		// Support both jobType and type fields
		const type = jobData.type || jobData.jobType;
		const templateId = jobData.templateId;

		const screenMap = {
			sow: 'SowJobScreen',
			harvest: 'HarvestJobScreen',
			spray: 'SprayJobScreen',
			irrigate: 'IrrigationJobScreen',  // Changed from 'irrigation' to 'irrigate'
			irrigation: 'IrrigationJobScreen', // Keep old name for backward compatibility
		};

		if (type === 'custom') {
			const template = farmData.jobTemplates?.find(t => t.id === templateId || t._id === templateId);
			if (template) {
				navigation.navigate('CustomJobScreen', { field, jobTemplate: template, templateId });
			}
		} else if (screenMap[type]) {
			navigation.navigate(screenMap[type], { field, templateId });
		} else {
			console.error('[TabHome] Unknown job type:', type);
		}
	}, [farmData?.jobTemplates, navigation]);

	const handleJobSelect = useCallback((jobData, field) => {
		closeBottomSheet();
		navigateToJobScreen(jobData, field);
	}, [closeBottomSheet, navigateToJobScreen]);

	const showMultiFieldJobOptions = useCallback(() => {
		openBottomSheet(
			<MultiFieldJobBottomSheet
				fields={multiSelectedFields}
				onSelectJob={(jobType, fields, templateId) => {
					closeBottomSheet();
					mapRef.current?.clearSelection();
					setMultiSelectedFields([]);
					if (jobType === 'spray') {
						navigation.navigate('SprayJobScreen', { fields, templateId });
					} else if (jobType === 'irrigate') {
						navigation.navigate('IrrigationJobScreen', { fields, templateId });
					}
				}}
				onClose={closeBottomSheet}
			/>,
			{ snapPoints: ['95%'], enablePanDownToClose: true }
		);
	}, [multiSelectedFields, openBottomSheet, closeBottomSheet, navigation]);

	const showJobOptions = useCallback(async () => {
		if (!selectedField) return;

		// Capture field NOW - don't rely on closure later
		const fieldForJob = selectedField;

		// Check compliance BEFORE showing job options
		const { rei, phi } = await getFieldCompliance(fieldForJob._id);

		// REI warning blocks ALL jobs (can't enter field during REI)
		if (rei?.isActive) {
			openBottomSheet(
				<ComplianceWarningSheet
					type="rei"
					field={fieldForJob}
					endDate={rei.endDate}
					remaining={rei.remaining}
					onProceed={() => {
						// closeBottomSheet();
						// Show job options after user acknowledges
						openBottomSheet(
							<RecordJobBottomSheet
								field={fieldForJob}
								jobTemplates={farmData?.jobTemplates || []}
								onSelectJob={(jobData) => handleJobSelect(jobData, fieldForJob)}
								onClose={closeBottomSheet}
							/>,
							{ snapPoints: ['100%'], enablePanDownToClose: true }
						);
					}}
					onCancel={closeBottomSheet}
				/>,
				{ snapPoints: ['85%', '90%'], enablePanDownToClose: true }
			);
			return;
		}

		// PHI warning is informational only (show job options after)
		if (phi?.isActive) {
			openBottomSheet(
				<ComplianceWarningSheet
					type="phi"
					field={fieldForJob}
					endDate={phi.endDate}
					remaining={phi.remaining}
					onProceed={() => {
						// closeBottomSheet();
						// Show job options after user acknowledges
						openBottomSheet(
							<RecordJobBottomSheet
								field={fieldForJob}
								jobTemplates={farmData?.jobTemplates || []}
								onSelectJob={(jobData) => handleJobSelect(jobData, fieldForJob)}
								onClose={closeBottomSheet}
							/>,
							{ snapPoints: ['85%', '100%'], enablePanDownToClose: true }
						);
					}}
					onCancel={closeBottomSheet}
				/>,
				{ snapPoints: ['85%', '90%'], enablePanDownToClose: true }
			);
			return;
		}

		// No warnings - show job options directly
		openBottomSheet(
			<RecordJobBottomSheet
				field={fieldForJob}
				jobTemplates={farmData?.jobTemplates || []}
				onSelectJob={(jobData) => handleJobSelect(jobData, fieldForJob)}
				onClose={closeBottomSheet}
			/>,
			{ snapPoints: ['100%'], enablePanDownToClose: true }
		);
	}, [selectedField, farmData?.jobTemplates, handleJobSelect, openBottomSheet, closeBottomSheet]);


	// ===== RENDER =====

	if (!farmData || !groupsLoaded) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator size="large" color={colors.PRIMARY} />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<SlidingHeader
				ref={headerRef}
				title={farmData.name || farmData.farmData?.farmName || farmData.farmName}
				farmName={farmData.name || farmData.farmData?.farmName || farmData.farmName}
				views={views}
				fields={visibleFields}
				onViewChange={handleViewChange}
				activeRecordingCount={recordingFieldIds.length}
				onSettingsPress={() => navigation.navigate('Settings')}
				onNotificationsPress={() => { }}
				onEditField={isOffline ? null : (id) => {
					const field = allFields.find(f => f._id === id);
					if (field) navigation.navigate('Field', { forFirstSetup: false, polygonId: id, selectedFieldData: field });
				}}
				onReportsPress={() => navigation.navigate('CreateReportScreen')}
				onGroupChange={(group) => {
					setCurrentGroup(group);
					setCurrentViewIndex(0);
					if (headerRef.current) {
						headerRef.current.slideToIndex(0);
					}
					// Center map on the group's fields
					if (mapRef.current) {
						mapRef.current.hideLabels();
						mapRef.current.clearSelection();
						if (group.fieldIds && group.fieldIds.length > 0) {
							mapRef.current.fitToFields(group.fieldIds);
						} else {
							mapRef.current.fitToAll();
						}
						setTimeout(() => {
							mapRef.current?.showLabels();
						}, 400);
					}
					setSelectedField(null);
				}}
			/>

			{isOffline ? (
				<View style={[styles.offlineContainer, { paddingTop: 80 }]}>
					<OfflineFieldList
						fields={visibleFields}
						selectedFieldId={selectedField?._id}
						onFieldSelect={(f) => setSelectedField(selectedField?._id === f._id ? null : f)}
					/>
				</View>
			) : (
				visibleFields.length > 0 && (
					<PolygonDrawingMap
						// key={currentGroup?.name || 'All fields'}
						ref={mapRef}
						hideAllButtons
						valueSetter={() => { }}
						defaultPolygons={visibleFields}
						fitPadding={fitPadding}
						onPolygonSelect={handlePolygonSelect}
						onPolygonDeselect={() => setSelectedField(null)}
						onMultiSelectChange={handleMultiSelectChange}
					/>
				)
			)}

			{showFAB && (
				<RecordingFAB
					fieldId={fabFieldId}
					onPress={() => openRecordingSheet(fabFieldId)}
					bottom={BOTTOM_OFFSET + insets.bottom}
					batch={activeRecordings[fabFieldId]?.batch || null}
				/>
			)}

			{isMultiSelectActive && !hasActiveRecording && (
				<>
					<View style={styles.multiSelectIndicator}>
						<Text style={styles.multiSelectText}>
							{multiSelectedFields.length} field{multiSelectedFields.length !== 1 ? 's' : ''} selected • {format(multiSelectTotalArea, 'area')}
						</Text>
					</View>
					<View style={styles.multiSelectActions}>
						<PrimaryButton
							text="Clear"
							variant="outline"
							onPress={() => {
								mapRef.current?.clearSelection();
								setMultiSelectedFields([]);
							}}
							style={{ flex: 1, marginRight: 8 }}
						/>
						<PrimaryButton
							text="Start Job"
							onPress={showMultiFieldJobOptions}
							disabled={multiSelectedFields.length < 2}
							style={{ flex: 2 }}
						/>
					</View>
				</>
			)}

			{selectedField && !selectedFieldHasRecording && !isMultiSelectActive && !JobService.isFieldInActiveBatch(selectedField._id) && (
				<Animated.View
					entering={SlideInDown.duration(200)}
					exiting={SlideOutDown.duration(200)}
					style={[styles.bottomButtonContainer, { bottom: BOTTOM_OFFSET + insets.bottom }]}
				>
					<PrimaryButton
						text="Record Job"
						onPress={showJobOptions}
						style={{ width: 280 }}
					/>
				</Animated.View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	centered: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	offlineContainer: {
		flex: 1,
		backgroundColor: '#f5f5f5',
	},
	bottomButtonContainer: {
		position: 'absolute',
		alignSelf: 'center',
	},
	multiSelectIndicator: {
		position: 'absolute',
		top: 180,
		left: 0,
		right: 0,
		alignItems: 'center',
		paddingVertical: 12,
		backgroundColor: 'rgba(0, 0, 0, 0.3)',
		zIndex: 10,
	},
	multiSelectText: {
		color: 'white',
		fontSize: 16,
		fontWeight: '600',
		fontFamily: 'Geologica-SemiBold',
	},
	multiSelectActions: {
		position: 'absolute',
		bottom: 120,
		left: 20,
		right: 20,
		flexDirection: 'row',
		zIndex: 10,
	},
});

export default TabHome;