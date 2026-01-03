import React, { useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { api } from '../../globals/api';
import {
	StyleSheet,
	View,
	Text,
	Pressable,
	Dimensions,
	Image,
	TouchableOpacity
} from 'react-native';
import Animated, {
	useAnimatedStyle,
	withSpring,
	useSharedValue,
	runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import colors from '../../globals/colors';
import { useNavigation } from '@react-navigation/native';
import RecordingDot from '../ui/core/RecordingDot';
import { Storage } from '../../utils/storage';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { getBadgeData, onComplianceChange } from '../../utils/compliance';
import { useTranslation } from 'react-i18next';
import ComplianceBadge from '../ui/core/ComplianceBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MARGIN = 16;
const COMPONENT_WIDTH = SCREEN_WIDTH - (MARGIN * 2);

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
	onNotificationsPress,
	onSettingsPress,
	onReportsPress,
	onEditField,
	title,
	fields = [],
	onGestureStart,
	onGestureEnd,
}, ref) => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const { isOffline, activeRecordings } = useGlobalContext();
	const translateX = useSharedValue(-initialIndex * COMPONENT_WIDTH);
	const currentIndex = useSharedValue(initialIndex);
	const [showLeftArrow, setShowLeftArrow] = useState(false);
	const [showRightArrow, setShowRightArrow] = useState(true);
	const [currentViewIndex, setCurrentViewIndex] = useState(initialIndex);
	const [selectedGroupName, setSelectedGroupName] = useState(null);
	const [selectedGroupFields, setSelectedGroupFields] = useState([]);
	const [badgeData, setBadgeData] = useState({});

	// console.log(fields)
	// Check for selected field group on mount
	useEffect(() => {
		Storage.getItem('@SelectedFieldGroup')
			.then(groupIndex => {
				if (groupIndex) {
					// Get the field groups
					return Storage.getItem('@FieldGroups')
						.then(groups => {
							if (groups) {
								const parsedGroups = JSON.parse(groups);
								const index = parseInt(groupIndex);
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

	// Expose the animateToIndex method via ref
	useImperativeHandle(ref, () => ({
		slideToIndex: (index) => {
			if (index < 0 || index >= views.length) return;

			const boundedIndex = Math.max(0, Math.min(index, views.length - 1));
			animateToIndex(boundedIndex);
		},
		getCurrentIndex: () => currentIndex.value
	}), [animateToIndex, views.length]);

	const handleArrowPress = useCallback((direction) => {
		const newIndex = direction === 'left'
			? Math.max(0, currentIndex.value - 1)
			: Math.min(views.length - 1, currentIndex.value + 1);
		animateToIndex(newIndex);
	}, [views.length, animateToIndex]);

	const panGesture = Gesture.Pan()
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

	const renderView = (view, index) => {
		const isFieldView = index > 0 && view.fieldId;
		const hasRecording = isFieldView && activeRecordings && activeRecordings[view.fieldId];

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

		const viewContent = (
			<View style={styles.content}>
				{fieldCount && groupName ? (
					// Overview slide with count above name
					<>
						<View style={styles.groupedTitleRow}>
							<Text style={styles.title}>{groupName}</Text>
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
							<Text style={styles.fieldCountInline} numberOfLines={1} ellipsizeMode="tail">{fieldCount} {t('common:general.fields', { count: parseInt(fieldCount) })}</Text>
						</View>
						{/* total area moved to the top header touchable */}
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

		return (
			<View key={index} style={[styles.view, { width: COMPONENT_WIDTH }]}>
				{isFieldView && onEditField ? (
					<TouchableOpacity
						style={styles.touchableView}
						onPress={() => onEditField(view.fieldId)}
						activeOpacity={0.7}
					>
						{viewContent}
					</TouchableOpacity>
				) : (
					viewContent
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
						<TouchableOpacity
							style={styles.titleContainer}
							onPress={navigateToFieldGroups}
						>
							<View style={styles.titleInner}>
								<Text style={styles.topHeaderTitleText} numberOfLines={1} ellipsizeMode="tail">{selectedGroupName || title}</Text>
								{views && views[0] && views[0].subtitle ? (
									<Text style={styles.titleAreaText} numberOfLines={1} ellipsizeMode="tail">{views[0].subtitle.replace(/^Total area:\s*/i, '')}</Text>
								) : null}
							</View>
							<Image
								style={styles.dropdownIcon}
								source={require('../../assets/icons/arrow_right.png')}
								resizeMode="contain"
							/>
						</TouchableOpacity>
						<TouchableOpacity style={styles.topHeaderButton} onPress={onNotificationsPress}>
							<Image style={styles.topHeaderButtonImage} resizeMethod='contain' source={require('../../assets/icons/notifications.png')} />
						</TouchableOpacity>
						<TouchableOpacity style={styles.topHeaderButton} onPress={onReportsPress}>
							<Image style={styles.topHeaderButtonImage} resizeMethod='contain' source={require('../../assets/icons/report.png')} />
						</TouchableOpacity>
						<TouchableOpacity style={styles.topHeaderButton} onPress={onSettingsPress}>
							<Image style={styles.topHeaderButtonImage} resizeMethod='contain' source={require('../../assets/icons/gear_white.png')} />
						</TouchableOpacity>
					</View>

					<View style={styles.bottomHeader}>
						{showLeftArrow && (
							<Pressable
								onPress={() => handleArrowPress('left')}
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
								onPress={() => handleArrowPress('right')}
								style={styles.rightArrowContainer}
							>
								<Image style={styles.arrow} resizeMode="contain" source={require('../../assets/icons/arrow_right.png')} />
							</Pressable>
						)}
					</View>
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
		justifyContent: 'center',
		borderRadius: 14,
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
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
		tintColor: 'white'
	},
	bottomHeader: {
		height: 90,
		marginTop: 8,
		backgroundColor: 'white',
		borderRadius: 18,
		borderColor: colors.PRIMARY,
		borderWidth: 3,
		overflow: 'hidden',
		position: 'relative',
	},
	slider: {
		height: '100%',
		flexDirection: 'row',
		position: 'absolute',
	},
	view: {
		height: '100%',
		justifyContent: 'center',
	},
	content: {
		paddingHorizontal: 50,
		paddingVertical: 8,
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
		bottom: 0,
		justifyContent: 'center',
		zIndex: 2,
	},
	rightArrowContainer: {
		position: 'absolute',
		right: 17,
		top: 0,
		width: 20,
		bottom: 0,
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
		bottom: 0,
		justifyContent: 'center',
		zIndex: 2,
	},
	counterText: {
		color: colors.PRIMARY,
		fontSize: 18,
		fontWeight: '500',
	},
	touchableView: {
		flex: 1,
		justifyContent: 'center',
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
		// marginTop: 6,
		marginBottom: 4,
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
		marginLeft: 6,
		marginRight: 6,
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

	}
});

export default SlidingHeader;