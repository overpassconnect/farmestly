import React, { useCallback, useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
	StyleSheet,
	View,
	Text,
	Pressable,
	Dimensions,
	Image,
	TouchableOpacity,
} from 'react-native';
import Animated, {
	useAnimatedStyle,
	withSpring,
	withTiming,
	useSharedValue,
	runOnJS,
	interpolate,
	Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import WheelPicker from '@quidone/react-native-wheel-picker';
import colors from '../../globals/colors';
import { useNavigation } from '@react-navigation/native';
import RecordingDot from '../ui/core/RecordingDot';
import { Storage } from '../../utils/storage';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { getBadgeData, onComplianceChange } from '../../utils/compliance';
import { useTranslation } from 'react-i18next';
import ComplianceBadge from '../ui/core/ComplianceBadge';
import PrimaryButton from '../ui/core/PrimaryButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MARGIN = 16;
const COMPONENT_WIDTH = SCREEN_WIDTH - (MARGIN * 2);
const COLLAPSED_HEIGHT = 84; // bottomHeader height without border
const TOP_HEADER_HEIGHT = 50;
const TOP_HEADER_MARGIN = 8;
const TAB_BAR_HEIGHT = 110;

// BBCH stages in increments of 5 (0, 5, 10, 15... 95)
const BBCH_DATA = Array.from({ length: 20 }, (_, i) => ({
	value: i * 5,
	label: (i * 5).toString().padStart(2, '0'),
}));

// Get BBCH stage description
const getBBCHDescription = (stage) => {
	if (stage < 10) return 'Germination / Sprouting';
	if (stage < 20) return 'Leaf development';
	if (stage < 30) return 'Formation of side shoots';
	if (stage < 40) return 'Stem elongation';
	if (stage < 50) return 'Vegetative propagation';
	if (stage < 60) return 'Inflorescence emergence';
	if (stage < 70) return 'Flowering';
	if (stage < 80) return 'Development of fruit';
	if (stage < 90) return 'Ripening of fruit';
	return 'Senescence';
};

// Helper to format date
const formatDate = (dateString) => {
	if (!dateString) return '-';
	const date = new Date(dateString);
	return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Animation timing config - gentle, non-jarring expansion
const SPRING_CONFIG = {
	damping: 28,
	stiffness: 70,
	mass: 0.5,
};

// Timing config for collapse and subtle elements
const TIMING_CONFIG = {
	duration: 450,
	easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

const OfflineIndicator = () => {
	const { t } = useTranslation();

	return (
		<View style={[styles.offlineIndicator]}>
			<View style={styles.offlineIndicatorContent}>
				<View style={styles.offlineDot} />
				<Text style={styles.offlineIndicatorText}>{t('common:general.offlineMode')}</Text>
			</View>
		</View>
	);
};

const SlidingHeader = forwardRef(({
	views,
	initialIndex = 0,
	onViewChange,
	onSettingsPress,
	onReportsPress,
	onEditField,
	farmName,
	fields = [],
	onGestureStart,
	onGestureEnd,
	onGroupChange,
}, ref) => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const { isOffline, activeRecordings } = useGlobalContext();

	// Horizontal sliding animation
	const translateX = useSharedValue(-initialIndex * COMPONENT_WIDTH);
	const currentIndex = useSharedValue(initialIndex);

	// Expansion animation
	const expandProgress = useSharedValue(0); // 0 = collapsed, 1 = expanded

	// State
	const [showLeftArrow, setShowLeftArrow] = useState(false);
	const [showRightArrow, setShowRightArrow] = useState(true);
	const [currentViewIndex, setCurrentViewIndex] = useState(initialIndex);
	const [selectedGroupName, setSelectedGroupName] = useState(null);
	const [selectedGroupFields, setSelectedGroupFields] = useState([]);
	const [badgeData, setBadgeData] = useState({});
	const [isExpanded, setIsExpanded] = useState(false);
	const [bbchStages, setBbchStages] = useState({}); // fieldId -> bbchStage
	const [fieldGroups, setFieldGroups] = useState([]); // All field groups for wheel picker
	const [selectedGroupIndex, setSelectedGroupIndex] = useState(0); // Currently selected group index

	// Calculate expanded height - stop at top of tab bar
	const EXPANDED_HEIGHT = SCREEN_HEIGHT - MARGIN - insets.top - TOP_HEADER_HEIGHT - TOP_HEADER_MARGIN - TAB_BAR_HEIGHT - insets.bottom;

	// console.log(fields)
	// Check for selected field group on mount
	useEffect(() => {
		// Load all field groups first
		Storage.getItem('@FieldGroups')
			.then(groups => {
				if (groups) {
					const parsedGroups = JSON.parse(groups);
					setFieldGroups(parsedGroups);

					// Then check for selected group
					return Storage.getItem('@SelectedFieldGroup')
						.then(groupIndex => {
							if (groupIndex) {
								const index = parseInt(groupIndex);
								setSelectedGroupIndex(index);
								if (parsedGroups[index]) {
									setSelectedGroupName(parsedGroups[index].name);

									// Get field IDs in this group
									const fieldIds = parsedGroups[index].fieldIds || [];

									// Filter views to only include those fields
									if (fieldIds.length > 0 && fields.length > 0) {
										// Create filtered fields
										const groupFields = fields.filter(field => fieldIds.includes(field._id));
										setSelectedGroupFields(groupFields);

										// Apply group to map if onViewChange is available
										if (onViewChange && parsedGroups[index].centroid) {
											// onViewChange(-1, {
											// 	title: parsedGroups[index].name,
											// 	subtitle: `${parsedGroups[index].fieldIds.length} fields`,
											// 	isGroup: true,
											// 	centroid: parsedGroups[index].centroid,
											// 	fieldIds: parsedGroups[index].fieldIds
											// });
										}
									}
								}
							}
						});
				}
				return null;
			})
			.catch(err => console.error('Error loading selected group:', err));
	}, [fields]);

	const updateArrowsVisibility = useCallback((index) => {
		setShowLeftArrow(index > 0);
		setShowRightArrow(index < views.length - 1);
		setCurrentViewIndex(index);
	}, [views.length]);

	useEffect(() => {
		updateArrowsVisibility(initialIndex);
	}, [initialIndex, updateArrowsVisibility]);

	// Load badge data for all fields when fields change
	useEffect(() => {
		if (fields.length === 0) return;

		const loadBadgeDataForFields = async () => {
			const newBadgeData = {};
			for (const field of fields) {
				if (field?._id) {
					try {
						const data = await getBadgeData(field._id);
						newBadgeData[field._id] = data;
					} catch (err) {
						console.error(`Failed to load badge data for field ${field._id}:`, err);
					}
				}
			}
			setBadgeData(newBadgeData);
		};

		// Load immediately
		loadBadgeDataForFields();

		// Reload when compliance changes (spray jobs added/removed)
		return onComplianceChange(loadBadgeDataForFields);
	}, [fields]);

	const animateToIndex = useCallback((newIndex, velocity = 0) => {
		'worklet';
		const finalPosition = -newIndex * COMPONENT_WIDTH;

		if (newIndex !== currentIndex.value) {
			currentIndex.value = newIndex;
			if (onViewChange) {
				runOnJS(onViewChange)(newIndex, views[newIndex]);
			}
			runOnJS(updateArrowsVisibility)(newIndex);
		}

		translateX.value = withSpring(finalPosition, {
			velocity,
			damping: 50,
			stiffness: 400,
			mass: 0.5,
			restDisplacementThreshold: 0.01,
		});
	}, [onViewChange, updateArrowsVisibility]);

	// Expose methods via ref
	useImperativeHandle(ref, () => ({
		slideToIndex: (index) => {
			if (index < 0 || index >= views.length) return;
			const boundedIndex = Math.max(0, Math.min(index, views.length - 1));
			animateToIndex(boundedIndex);
		},
		getCurrentIndex: () => currentIndex.value,
		collapse: handleCollapse,
		expand: () => {
			if (currentViewIndex > 0 && !isExpanded) {
				expandProgress.value = withTiming(1, TIMING_CONFIG);
				setIsExpanded(true);
			}
		},
		isExpanded: () => isExpanded,
	}), [animateToIndex, views.length, currentViewIndex, isExpanded, handleCollapse]);

	const handleArrowPress = useCallback((direction) => {
		const newIndex = direction === 'left'
			? Math.max(0, currentIndex.value - 1)
			: Math.min(views.length - 1, currentIndex.value + 1);
		animateToIndex(newIndex);
	}, [views.length, animateToIndex]);

	// Toggle expand/collapse on tap
	const handleToggleExpand = useCallback(() => {
		if (isExpanded) {
			// Collapse with timing (no bounce on collapse)
			expandProgress.value = withTiming(0, TIMING_CONFIG);
			setIsExpanded(false);
		} else {
			// Expand with spring for bouncy effect
			expandProgress.value = withSpring(1, SPRING_CONFIG);
			setIsExpanded(true);
		}
	}, [isExpanded]);

	// Collapse handler (for drag handle and other triggers)
	const handleCollapse = useCallback(() => {
		if (isExpanded) {
			expandProgress.value = withTiming(0, TIMING_CONFIG);
			setIsExpanded(false);
		}
	}, [isExpanded]);

	// Handle BBCH change - store locally and send to server
	const handleBBCHChange = useCallback((fieldId, stage) => {
		setBbchStages(prev => ({ ...prev, [fieldId]: stage }));
		console.log('[SlidingHeader] BBCH stage changed:', fieldId, stage);
		// TODO: Send to server when backend is ready
		// api.post('/cultivation/bbch', { fieldId, stage });
	}, []);

	// Get BBCH stage for a field (local state or from cultivation)
	const getBBCHStage = useCallback((fieldId, cultivation) => {
		if (bbchStages[fieldId] !== undefined) {
			return bbchStages[fieldId];
		}
		// Round to nearest 5 for the picker
		const stage = cultivation?.bbchStage || 0;
		return Math.round(stage / 5) * 5;
	}, [bbchStages]);

	// Pan gesture for horizontal sliding
	// Uses activeOffsetX to only activate when horizontal movement is detected
	// This allows the wheel picker to capture vertical touches
	const panGesture = Gesture.Pan()
		.activeOffsetX([-20, 20]) // Only activate after 20px horizontal movement
		.failOffsetY([-15, 15]) // Fail if vertical movement exceeds 15px first (let wheel picker handle it)
		.onStart(() => {
			if (onGestureStart) {
				runOnJS(onGestureStart)();
			}
		})
		.onUpdate((e) => {
			const basePosition = -currentIndex.value * COMPONENT_WIDTH;
			const rubberBandedDx =
				currentIndex.value === 0 && e.translationX > 0 ? e.translationX * 0.3 :
					currentIndex.value === views.length - 1 && e.translationX < 0 ? e.translationX * 0.3 :
						e.translationX;
			translateX.value = basePosition + rubberBandedDx;
		})
		.onEnd((e) => {
			let newIndex = currentIndex.value;
			if (Math.abs(e.velocityX) > 500) {
				newIndex = e.velocityX > 0 ?
					Math.max(0, currentIndex.value - 1) :
					Math.min(views.length - 1, currentIndex.value + 1);
			} else {
				if (Math.abs(e.translationX) > COMPONENT_WIDTH * 0.4) {
					newIndex = e.translationX > 0 ?
						Math.max(0, currentIndex.value - 1) :
						Math.min(views.length - 1, currentIndex.value + 1);
				}
			}

			animateToIndex(newIndex, e.velocityX);

			if (onGestureEnd) {
				runOnJS(onGestureEnd)();
			}
		});

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}));

	// Animated styles for expansion - gentle and smaller
	const bottomHeaderAnimatedStyle = useAnimatedStyle(() => {
		// Smaller expanded height - 70% of full available space
		const height = interpolate(
			expandProgress.value,
			[0, 1],
			[COLLAPSED_HEIGHT + 6, COLLAPSED_HEIGHT + 6 + (EXPANDED_HEIGHT - COLLAPSED_HEIGHT - 6) * 0.65],
			'clamp'
		);

		// Border radius stays consistent
		const borderRadius = interpolate(
			expandProgress.value,
			[0, 1],
			[18, 20],
			'clamp'
		);

		// Subtle shadow growth
		const shadowOpacity = interpolate(
			expandProgress.value,
			[0, 1],
			[0.05, 0.12],
			'clamp'
		);

		const elevation = interpolate(
			expandProgress.value,
			[0, 1],
			[2, 6],
			'clamp'
		);

		return {
			height,
			borderRadius,
			shadowOpacity,
			elevation,
		};
	});

	// Expanded content fades in gently
	const expandedContentAnimatedStyle = useAnimatedStyle(() => {
		// Smooth fade starting earlier
		const opacity = interpolate(expandProgress.value, [0.1, 0.4], [0, 1], 'clamp');

		// Minimal slide - just 12px
		const translateY = interpolate(
			expandProgress.value,
			[0, 1],
			[12, 0],
			'clamp'
		);

		return {
			opacity,
			transform: [{ translateY }],
		};
	});


	const renderView = (view, index) => {
		const isFieldView = index > 0 && view.fieldId;

		// Parse overview title for first slide: "5 Fields in All fields" -> count + group name
		let fieldCount = null;
		let groupName = null;
		if (index === 0) {
			const match = view.title.match(/^(\d+)\s+Fields\s+in\s+(.+)$/);
			if (match) {
				fieldCount = match[1]; // e.g., "5" (just the number)
				groupName = match[2]; // e.g., "All fields" or "total"
			}
		}

		// Use farmName for overview, fallback to groupName
		const displayTitle = index === 0 && farmName ? farmName : (groupName || view.title);

		const viewContent = (
			<View style={styles.content}>
				{fieldCount && groupName ? (
					// Overview slide with farm name
					<>
						<View style={styles.groupedTitleRow}>
							<View style={styles.titleWithGroup}>
								<Text style={styles.title}>{displayTitle}</Text>
								{selectedGroupName && selectedGroupName !== 'All fields' && (
									<Text> *</Text>
								)}
								{/* {selectedGroupName && selectedGroupName !== 'All fields' && (
									<Text style={styles.selectedGroupText}> ({selectedGroupName})</Text>
								)} */}
							</View>
						</View>
						<View style={[styles.subtitleContainer, styles.subtitleRow]}>
							{Object.keys(activeRecordings || {}).length > 0 ? (
								(() => {
									const recordings = Object.values(activeRecordings || {});
									const pausedCount = recordings.filter(r => r.status === 'paused').length;
									const activeCount = recordings.length - pausedCount;
									const allPaused = pausedCount > 0 && activeCount === 0;

									return (
										<>
											<RecordingDot size={10} color={allPaused ? "#FFA500" : "#FF3B30"} />
											<Text style={styles.activeJobsText}>
												{allPaused ? t('common:general.paused') : t('common:general.activeJobs')}
											</Text>
											<Text style={styles.counterText}>
												{allPaused ? pausedCount : activeCount > 0 && pausedCount > 0 ? `${activeCount}` : recordings.length}
											</Text>
											{activeCount > 0 && pausedCount > 0 && (
												<>
													<Text style={styles.separator}> • </Text>
													<Text style={styles.pausedJobsText}>{t('common:general.pausedJobs')} {pausedCount}</Text>
												</>
											)}
											<Text style={styles.separator}> • </Text>
										</>
									);
								})()
							) : (
								<>
									<View style={styles.noActiveJobsContainer}>
										<Image source={require('../../assets/icons/check_outlined_brown.png')} style={styles.checkIcon} />
										<Text style={styles.noActiveJobsText}>{t('common:general.noActiveJobs')} </Text>
									</View>

									<Text style={styles.separator}> • </Text>
								</>
							)}
							<Text style={styles.noActiveJobsText} numberOfLines={1} ellipsizeMode="tail">{fieldCount} {t('common:general.fields', { count: parseInt(fieldCount) })}</Text>
							<Text style={styles.separator}> • </Text>
							<Text style={styles.noActiveJobsText} numberOfLines={1} ellipsizeMode="tail">{view.subtitle?.replace(/^Total area:\s*/i, '')}</Text>
						</View>
					</>
				) : (
					// Regular field view
					<>
						<View style={styles.titleRow}>
							{/* REI/PHI badges before field name */}
							{(() => {
								const field = fields.find(f => f._id === view.fieldId);
								if (!field) return null;

								const data = badgeData[field._id];
								if (!data || (!data.showREI && !data.showPHI)) return null;

								return (
									<View style={styles.badgeContainer}>
										{data.showREI && (
											<ComplianceBadge
												type="rei"
												remaining={data.reiRemaining}
											/>
										)}
										{data.showPHI && (
											<ComplianceBadge
												type="phi"
												remaining={data.phiRemaining}
											/>
										)}
									</View>
								);
							})()}
							<Text style={styles.title}>{view.title}</Text>
						</View>
						<Text style={styles.subtitle}>{view.subtitle}</Text>
					</>
				)}
			</View>
		);

		// Get field data for expanded content
		const field = isFieldView ? fields.find(f => f._id === view.fieldId) : null;
		const cultivation = field?.currentCultivation;

		// Calculate overview stats for first slide
		const isOverview = index === 0;
		const overviewStats = isOverview ? {
			totalFields: fields.length,
			activeFields: fields.filter(f => f.currentCultivation).length,
			totalArea: fields.reduce((sum, f) => sum + (f.area || 0), 0),
			activeJobs: Object.keys(activeRecordings || {}).length,
		} : null;

		return (
			<View key={index} style={[styles.view, { width: COMPONENT_WIDTH }]}>
				{/* Header content - always visible */}
				<View style={styles.headerContent}>
					{viewContent}
				</View>

				{/* Expanded content for overview (first slide) */}
				{isOverview && (
					<Animated.View style={[styles.slideExpandedContent, expandedContentAnimatedStyle]}>
						<LinearGradient
							colors={['transparent', `${colors.PRIMARY}08`, `${colors.PRIMARY}15`]}
							style={styles.gradientBackground}
						/>
						<View style={styles.overviewExpandedContent}>
							{/* Stat cards in a grid */}
							<View style={styles.statsGrid}>
								<View style={styles.statCard}>
									<Text style={styles.statValue}>{overviewStats.totalFields}</Text>
									<Text style={styles.statLabel}>{t('common:general.fields', { count: overviewStats.totalFields })}</Text>
								</View>
								<View style={styles.statCard}>
									<Text style={styles.statValue}>{overviewStats.activeFields}</Text>
									<Text style={styles.statLabel}>{t('common:general.activeCultivations', 'Active')}</Text>
								</View>
								<View style={styles.statCard}>
									<Text style={[styles.statValue, overviewStats.activeJobs > 0 && styles.statValueActive]}>
										{overviewStats.activeJobs}
									</Text>
									<Text style={styles.statLabel}>{t('common:general.runningJobs', 'Running')}</Text>
								</View>
							</View>

							{/* Group name badge */}
							{groupName && groupName !== 'total' && (
								<View style={styles.groupBadge}>
									<Text style={styles.groupBadgeText}>{groupName}</Text>
								</View>
							)}
						</View>
					</Animated.View>
				)}

				{/* Expanded content for field views */}
				{isFieldView && field && (
					<Animated.View style={[styles.slideExpandedContent, expandedContentAnimatedStyle]}>
						{/* Gradient background */}
						<LinearGradient
							colors={['transparent', `${colors.PRIMARY}08`, `${colors.PRIMARY}15`]}
							style={styles.gradientBackground}
						/>

						{/* Edit button - top right */}
						<TouchableOpacity
							style={styles.editButton}
							onPress={() => {
								if (onEditField) {
									handleCollapse();
									setTimeout(() => onEditField(field._id), 200);
								}
							}}
						>
							<Text style={styles.editButtonText}>✏️</Text>
						</TouchableOpacity>

						{cultivation ? (
							<View style={styles.expandedContent}>
								{/* Crop name - clean typography */}
								<Text style={styles.cropName}>{cultivation.crop}</Text>
								{cultivation.variety && (
									<Text style={styles.varietyName}>{cultivation.variety}</Text>
								)}
								{(cultivation.eppoCode || cultivation.preferredName) && (
									<View style={styles.eppoRow}>
										{cultivation.eppoCode && (
											<Text style={styles.eppoCode}>{cultivation.eppoCode}</Text>
										)}
										{cultivation.preferredName && (
											<Text style={styles.preferredName}>{cultivation.preferredName}</Text>
										)}
									</View>
								)}

								{/* BBCH Section - minimal */}
								<View style={styles.bbchSection}>
									<Text style={styles.bbchLabel}>BBCH</Text>
									<View style={styles.wheelPickerWrapper}>
										<WheelPicker
											data={BBCH_DATA}
											value={getBBCHStage(field._id, cultivation)}
											onValueChanged={({ item }) => handleBBCHChange(field._id, item.value)}
											itemHeight={48}
											width={90}
											visibleItemCount={3}
											selectedIndicatorStyle={styles.wheelSelectedIndicator}
											itemTextStyle={styles.wheelItemText}
										/>
									</View>
									<Text style={styles.bbchDescription}>
										{getBBCHDescription(getBBCHStage(field._id, cultivation))}
									</Text>
								</View>

								{/* Start date badge - bottom */}
								{cultivation.startTime && (
									<View style={styles.startBadge}>
										<Text style={styles.startBadgeText}>Started {formatDate(cultivation.startTime)}</Text>
									</View>
								)}
							</View>
						) : (
							<View style={styles.noCultivationContainer}>
								<Text style={styles.noCultivationEmoji}>🌾</Text>
								<Text style={styles.noCultivation}>{t('common:field.noCultivation', 'No active cultivation')}</Text>
							</View>
						)}
					</Animated.View>
				)}
			</View>
		);
	};

	const renderViewCounter = (currentIdx) => {
		const recordingCount = Object.keys(activeRecordings || {}).length;

		// First slide - show recording count if any
		if (currentIdx === 0) {
			return null;
			// if (recordingCount === 0) return null;
			// return (
			// 		<View style={styles.counterContainer}>
			// 			<View style={styles.recordingCountContainer}>
			// 				<RecordingDot size={10} color="#FF3B30" />
			// 				<Text style={styles.activeJobsText}>Active jobs:</Text>
			// 				<Text style={styles.counterText}>{recordingCount}</Text>
			// 			</View>
			// 		</View>
			// );
		}

		// Other slides - show field counter
		return (
			<View style={styles.counterContainer}>
				<Text style={styles.counterText}>
					{`${currentIdx}/${views.length - 1}`}
				</Text>
			</View>
		);
	};

	// Navigate to field groups screen
	const navigateToFieldGroups = () => {
		navigation.navigate('FieldGroupsScreen');
	};

	// Handle group change from wheel picker
	const handleGroupChange = useCallback((index) => {
		setSelectedGroupIndex(index);
		Storage.setItem('@SelectedFieldGroup', index.toString());

		if (fieldGroups[index]) {
			setSelectedGroupName(fieldGroups[index].name);

			// Get field IDs in this group
			const fieldIds = fieldGroups[index].fieldIds || [];

			// Filter views to only include those fields
			if (fieldIds.length > 0 && fields.length > 0) {
				const groupFields = fields.filter(field => fieldIds.includes(field._id));
				setSelectedGroupFields(groupFields);
			}

			// Notify parent (TabHome) of the group change
			if (onGroupChange) {
				onGroupChange(fieldGroups[index]);
			}
		}
	}, [fieldGroups, fields, onGroupChange]);

	// Prepare wheel picker data for groups
	const groupWheelData = useMemo(() => {
		return fieldGroups.map((group, index) => ({
			value: index,
			label: group.name || t('common:general.allFields', 'All Fields'),
		}));
	}, [fieldGroups, t]);

	return (
		<View style={[
			styles.outerContainer,
			{ top: MARGIN }
		]}>
			{isOffline ? (
				<OfflineIndicator />
			) : (
				<>
					<View style={styles.topHeader}>
						<View style={styles.titleContainer}>
							<Image
								source={require('../../assets/icons/updown.png')}
								style={styles.updownIcon}
								resizeMode="contain"
							/>
							<View style={styles.groupWheelContainer}>
								{groupWheelData.length > 0 ? (
									<WheelPicker
										data={groupWheelData}
										value={selectedGroupIndex}
										onValueChanged={({ item }) => handleGroupChange(item.value)}
										itemHeight={36}
										width={COMPONENT_WIDTH - 230}
										visibleItemCount={3}
										selectedIndicatorStyle={styles.groupWheelSelectedIndicator}
										itemTextStyle={styles.groupWheelItemText}
									/>
								) : (
									<Text style={styles.topHeaderTitleText} numberOfLines={1} ellipsizeMode="tail">
										{t('common:general.groups', 'Groups')}
									</Text>
								)}
							</View>
						</View>
						{/* <PrimaryButton
							text="✏️"
							style={styles.groupEditButton}
							textStyle={styles.groupEditButtonText}
							color={colors.PRIMARY}
							onPress={navigateToFieldGroups}
						/> */}
						<TouchableOpacity style={styles.topHeaderButton} onPress={navigateToFieldGroups}>
							<Image style={styles.topHeaderButtonImage} resizeMethod='contain' source={require('../../assets/icons/editfull.png')} />
						</TouchableOpacity>
						<TouchableOpacity style={styles.topHeaderButton} onPress={onReportsPress}>
							<Image style={styles.topHeaderButtonImage} resizeMethod='contain' source={require('../../assets/icons/report_white.png')} />
						</TouchableOpacity>
						<TouchableOpacity style={styles.topHeaderButton} onPress={onSettingsPress}>
							<Image style={styles.topHeaderButtonImage} resizeMethod='contain' source={require('../../assets/icons/gear_white.png')} />
						</TouchableOpacity>
					</View>

					<Animated.View style={[styles.bottomHeader, bottomHeaderAnimatedStyle]}>
						<LinearGradient
							colors={['#fff', colors.SECONDARY_LIGHT]}
							start={{ x: 1, y: 0 }}
							end={{ x: 0, y: 1 }}
							style={styles.bottomHeaderGradient}
						>
							{/* Slider container - fills the whole card minus drag handle */}
							<View style={styles.sliderContainer}>
								{showLeftArrow && (
									<Pressable
										onPress={handleArrowPress.bind(null, 'left')}
										style={styles.leftArrowContainer}
									>
										<Image style={styles.arrow} resizeMode="contain" source={require('../../assets/icons/arrow_left.png')} />
									</Pressable>
								)}

								<GestureDetector gesture={panGesture}>
									<Animated.View style={[styles.slider, { width: COMPONENT_WIDTH * views.length }, animatedStyle]}>
										{views.map(renderView)}
									</Animated.View>
								</GestureDetector>

								{renderViewCounter(currentViewIndex)}

								{showRightArrow && (
									<Pressable
										onPress={handleArrowPress.bind(null, 'right')}
										style={styles.rightArrowContainer}
									>
										<Image style={styles.arrow} resizeMode="contain" source={require('../../assets/icons/arrow_right.png')} />
									</Pressable>
								)}

								{/* Tap overlay for header area only - to expand/collapse */}
								<Pressable
									style={styles.headerTapOverlay}
									onPress={handleToggleExpand}
								/>
							</View>
						</LinearGradient>
					</Animated.View>

				</>
			)}
		</View>
	);
});


const styles = StyleSheet.create({
	outerContainer: {
		position: 'absolute',
		left: MARGIN,
		right: MARGIN,
		zIndex: 1000,
	},
	topHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	titleContainer: {
		backgroundColor: colors.PRIMARY,
		height: 50,
		justifyContent: 'flex-start',
		borderRadius: 14,
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		overflow: 'hidden',
	},
	topHeaderTitleText: {
		color: "white",
		fontSize: 18,
		fontFamily: 'Geologica-Bold',
		marginLeft: 16,
		flex: 1,
	},
	dropdownIcon: {
		height: 16,
		width: 16,
		marginRight: 16,
		tintColor: 'white',
		transform: [{ rotate: '90deg' }],
	},
	topHeaderButton: {
		width: 50,
		height: 50,
		marginLeft: 8,
		justifyContent: 'center',
		backgroundColor: colors.PRIMARY,
		borderRadius: 10,
	},
	topHeaderButtonImage: {
		alignSelf: 'center',
		height: 22,
		width: 22,
		// tintColor: 'white'
	},
	bottomHeader: {
		marginTop: 8,
		borderRadius: 18,
		borderColor: colors.PRIMARY,
		borderWidth: 3,
		overflow: 'hidden',
		// Shadow base properties (animated values will override)
		shadowColor: colors.PRIMARY,
		shadowOffset: { width: 0, height: 4 },
		shadowRadius: 8,
		backgroundColor: 'white',
	},
	bottomHeaderGradient: {
		flex: 1,
		borderRadius: 15,
	},
	sliderContainer: {
		flex: 1,
		overflow: 'hidden',
	},
	headerTapOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: COLLAPSED_HEIGHT,
		zIndex: 1,
	},
	slider: {
		flexDirection: 'row',
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	view: {
		flex: 1,
	},
	headerContent: {
		height: COLLAPSED_HEIGHT,
		justifyContent: 'center',
	},
	slideExpandedContent: {
		flex: 1,
		marginTop: 0,
	},
	content: {
		paddingHorizontal: 50,
		paddingTop: 10,
		paddingBottom: 6,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 6,
	},
	fieldCountContainer: {
		fontSize: 14,
		lineHeight: 16,
		flexShrink: 1,
	},
	fieldCount: {
		fontFamily: 'Geologica-Bold',
		fontSize: 14,
		color: colors.SECONDARY,
	},
	fieldsText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		fontSize: 22,
		lineHeight: 24,
	},
	titleWithGroup: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
	},
	selectedGroupText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 18,
		color: colors.PRIMARY_LIGHT,
	},

	subtitle: {
		color: colors.PRIMARY,
		fontSize: 12,
		// marginTop: 2,
	},
	leftArrowContainer: {
		position: 'absolute',
		left: 17,
		top: 0,
		width: 20,
		height: COLLAPSED_HEIGHT,
		justifyContent: 'center',
		zIndex: 2,
	},
	rightArrowContainer: {
		position: 'absolute',
		right: 17,
		top: 0,
		width: 20,
		height: COLLAPSED_HEIGHT,
		justifyContent: 'center',
		zIndex: 2,
	},
	arrow: {
		height: 20,
		width: 20
	},
	counterContainer: {
		position: 'absolute',
		right: 48,
		top: 0,
		height: COLLAPSED_HEIGHT,
		justifyContent: 'center',
		zIndex: 2,
	},
	counterText: {
		color: colors.PRIMARY,
		fontSize: 18,
		fontWeight: '500',
	},
	offlineIndicator: {
		width: COMPONENT_WIDTH,
		backgroundColor: '#f59e0b',
		borderRadius: 14,
		paddingHorizontal: 16,
		paddingVertical: 7,
	},
	offlineIndicatorContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	offlineDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#fff',
		marginRight: 8,
	},
	offlineIndicatorText: {
		color: '#fff',
		fontFamily: 'Geologica-Medium',
		fontSize: 16,
	},
	recordingCountContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	groupedTitleRow: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		justifyContent: 'flex-start',
		// marginBottom: 6,
		// alignItems: 'flex-end',
		gap: 0,
	}, titleInner: {
		flex: 1,
		justifyContent: 'center',
	},
	titleAreaText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 12,
		color: colors.PRIMARY_LIGHT,
		marginLeft: 8,
		marginTop: 2,
	}, subtitleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
		marginBottom: 0,
	},
	totalAreaText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.SECONDARY,
		marginLeft: 8,
	},
	activeJobsText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		marginLeft: 8,
		marginRight: 8,
	},
	pausedJobsText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY,
	},
	noActiveJobsText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		// marginRight: 8,
	},
	subtitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'nowrap',
	},
	separator: {
		fontSize: 14,
		color: colors.PRIMARY,
		marginLeft: 3,
		marginRight: 3,
	},
	fieldCountInline: {
		fontFamily: 'Geologica-Bold',
		fontSize: 14,
		color: colors.SECONDARY,
		flexShrink: 1,
	},
	totalAreaNumber: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		marginTop: 6,
	},
	badgeContainer: {
		flexDirection: 'row',
		marginRight: 8,
		gap: 4,
	},
	noActiveJobsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	checkIcon: {
		width: 14,
		height: 14,
		marginRight: 6,
	},
	// Expanded content styles
	gradientBackground: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
	},
	editButton: {
		position: 'absolute',
		top: 8,
		right: 12,
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: colors.SECONDARY_LIGHT,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 10,
	},
	editButtonText: {
		fontSize: 16,
	},
	expandedContent: {
		flex: 1,
		alignItems: 'center',
		paddingTop: 4,
		paddingHorizontal: 24,
	},
	cropName: {
		fontFamily: 'Geologica-Bold',
		fontSize: 26,
		color: colors.PRIMARY,
		textAlign: 'center',
	},
	varietyName: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		marginTop: 2,
		textAlign: 'center',
	},
	eppoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 6,
		gap: 8,
	},
	eppoCode: {
		fontFamily: 'Geologica-Medium',
		fontSize: 12,
		color: 'white',
		backgroundColor: colors.SECONDARY,
		paddingHorizontal: 10,
		paddingVertical: 3,
		borderRadius: 10,
		overflow: 'hidden',
	},
	preferredName: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: colors.PRIMARY_LIGHT,
		fontStyle: 'italic',
	},
	bbchSection: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center',
		marginTop: 8,
	},
	bbchLabel: {
		fontFamily: 'Geologica-Medium',
		fontSize: 12,
		color: colors.PRIMARY_LIGHT,
		letterSpacing: 1.5,
		textTransform: 'uppercase',
	},
	wheelPickerWrapper: {
		height: 144,
		justifyContent: 'center',
	},
	wheelSelectedIndicator: {
		backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 8,
	},
	wheelItemText: {
		fontFamily: 'Geologica-Bold',
		fontSize: 32,
		color: colors.PRIMARY,
	},
	bbchDescription: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
	},
	startBadge: {
		borderWidth: 1,
		borderColor: colors.SUCCESS + '40',
		backgroundColor: colors.SUCCESS + '10',
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 16,
		marginBottom: 12,
	},
	startBadgeText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 13,
		color: colors.SUCCESS,
	},
	noCultivationContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	noCultivationEmoji: {
		fontSize: 40,
		marginBottom: 8,
	},
	noCultivation: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
	},
	// Overview expanded content styles
	overviewExpandedContent: {
		flex: 1,
		paddingHorizontal: 20,
		paddingTop: 16,
		alignItems: 'center',
	},
	statsGrid: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 12,
	},
	statCard: {
		backgroundColor: 'white',
		borderRadius: 16,
		paddingVertical: 20,
		paddingHorizontal: 24,
		alignItems: 'center',
		minWidth: 90,
		borderWidth: 1,
		borderColor: colors.SECONDARY_LIGHT,
	},
	statValue: {
		fontFamily: 'Geologica-Bold',
		fontSize: 32,
		color: colors.PRIMARY,
	},
	statValueActive: {
		color: colors.SECONDARY,
	},
	statLabel: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: colors.PRIMARY_LIGHT,
		marginTop: 4,
		textAlign: 'center',
	},
	groupBadge: {
		marginTop: 20,
		backgroundColor: colors.PRIMARY,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
	},
	groupBadgeText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 14,
		color: 'white',
	},
	// Group wheel picker styles
	groupWheelContainer: {
		height: 96,
		justifyContent: 'center',
		overflow: 'hidden',
	},
	groupWheelSelectedIndicator: {
		backgroundColor: 'transparent',
	},
	groupWheelItemText: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: 'white',
	},
	groupEditButton: {
		width: 50,
		height: 50,
		minWidth: 50,
		paddingHorizontal: 0,
		borderRadius: 10,
		marginLeft: 8,
	},
	groupEditButtonText: {
		fontSize: 16,
	},
	updownIcon: {
		width: 16,
		height: 16,
		marginLeft: 12,
	},
});

export default SlidingHeader;