// PolygonDrawingMap/index.js

import React, {
	useState,
	useRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	forwardRef,
	useMemo,
	memo,
} from 'react';
import {
	View,
	StyleSheet,
	Dimensions,
	StatusBar,
	PermissionsAndroid,
	Text,
	Image,
	Animated,
} from 'react-native';
import MapView, { Polygon, Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { WINDOW_HEIGHT, WINDOW_WIDTH } from '@gorhom/bottom-sheet';
import { useIsFocused } from '@react-navigation/native';
import PrimaryButton from '../../ui/core/PrimaryButton';
import colors from '../../../globals/colors';
import countriesCentroids from '../../../globals/countriesCentroids';
import { calculatePolygonsBounds, isPointInPolygonWithBuffer } from './utils';
import JobService from '../../../utils/JobService';
import { useGlobalContext } from '../../context/GlobalContextProvider';

const { width, height } = Dimensions.get('window');

// ============================================================================
// constants.js
// ============================================================================

const ASPECT_RATIO = width / (height * 1.0);
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const BLINKING_FPS = 60;
const POLYGON_COLORS = [
	'#FF6B6B', '#004cbf', '#00a103', '#7a00a6', '#d4bb02',
	'#02d4d4', '#e06e02', '#3498DB', '#E74C3C', '#2ECC71',
	'#9B59B6', '#F1C40F', '#1ABC9C', '#E67E22', '#34495E',
	'#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#A833FF',
	'#33FFF6', '#F6FF33', '#FF8C33', '#33FF8C', '#8C33FF',
	'#FF3380', '#80FF33', '#3380FF', '#FFB833', '#B833FF',
];

//TODO: Adjust fallback location based on user country from GlobalContext
const FALLBACK_LOCATION = {
	latitude: parseFloat(countriesCentroids['GR'][0].latitude),
	longitude: parseFloat(countriesCentroids['GR'][0].longitude),
};

const FALLBACK_REGION = {
	...FALLBACK_LOCATION,
	latitudeDelta: 0.5,
	longitudeDelta: 0.5,
};

const GEOLOCATION_CONFIG = {
	skipPermissionRequests: false,
	authorizationLevel: 'whenInUse',
	locationProvider: 'playServices',
};

const GEOLOCATION_OPTIONS = {
	enableHighAccuracy: true,
	timeout: 15000,
	maximumAge: 10000,
};

// ============================================================================
// utils/polygonHelpers.js
// ============================================================================

const createPolygon = (points, color, index) => ({
	points,
	color,
	name: `Field ${index + 1}`,
	_id: Date.now(),
});

const getInitialRegion = (defaultPolygons) => {
	if (defaultPolygons.length > 0) {
		return calculatePolygonsBounds(defaultPolygons);
	}
	return FALLBACK_REGION;
};

const getPolygonCenter = (points) => {
	if (!points?.length) return null;
	const sum = points.reduce(
		(acc, p) => ({ lat: acc.lat + p.latitude, lng: acc.lng + p.longitude }),
		{ lat: 0, lng: 0 }
	);
	return {
		latitude: sum.lat / points.length,
		longitude: sum.lng / points.length,
	};
};

// ============================================================================
// hooks/useGeolocation.js
// ============================================================================

const useGeolocation = (enabled, hasPolygons, mapRef) => {
	const [centerPoint, setCenterPoint] = useState(null);

	useEffect(() => {
		if (hasPolygons || !enabled) return;

		const setup = async () => {
			try {
				const granted = await PermissionsAndroid.request(
					PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
					{
						title: 'Location Permission',
						message: 'We need your location to provide a better app experience.',
						buttonNeutral: 'Ask Me Later',
						buttonNegative: 'Cancel',
						buttonPositive: 'OK',
					}
				);

				if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
					setCenterPoint(FALLBACK_LOCATION);
					return;
				}

				Geolocation.setRNConfiguration(GEOLOCATION_CONFIG);

				Geolocation.getCurrentPosition(
					(position) => {
						const { latitude, longitude } = position.coords;
						const region = {
							latitude,
							longitude,
							latitudeDelta: LATITUDE_DELTA / 25,
							longitudeDelta: LONGITUDE_DELTA / 25,
						};
						mapRef.current?.animateToRegion(region, 1000);
						setCenterPoint({ latitude, longitude });
					},
					(error) => {
						console.log('Geolocation error:', error);
						setCenterPoint(FALLBACK_LOCATION);
					},
					GEOLOCATION_OPTIONS
				);
			} catch (err) {
				console.error('Geolocation setup error:', err);
				setCenterPoint(FALLBACK_LOCATION);
			}
		};

		setup();
	}, [enabled, hasPolygons, mapRef]);

	const updateCenterPoint = useCallback((region) => {
		setCenterPoint({ latitude: region.latitude, longitude: region.longitude });
	}, []);

	return { centerPoint, updateCenterPoint };
};

// ============================================================================
// hooks/useActiveRecordingFieldIds.js - UPDATED with status
// ============================================================================

const useActiveRecordingFieldIds = () => {
	const [activeFields, setActiveFields] = useState(() => new Map());
	const prevMapRef = useRef(new Map());

	useEffect(() => {
		// Immediately sync state in case JobService is already initialized
		const syncState = () => {
			const recordings = JobService.getAllActive();
			const newMap = new Map();
			Object.entries(recordings).forEach(([fieldId, rec]) => {
				newMap.set(fieldId, rec.status);
			});
			prevMapRef.current = newMap;
			setActiveFields(newMap);
		};

		// Initial sync
		syncState();

		// Subscribe to changes
		const unsubscribe = JobService.on((event) => {
			if (event === 'tick' || event === 'change' || event === 'ready') {
				const recordings = JobService.getAllActive();
				const entries = Object.entries(recordings);
				const prevMap = prevMapRef.current;

				let hasChanged = entries.length !== prevMap.size;

				if (!hasChanged) {
					for (const [fieldId, rec] of entries) {
						if (prevMap.get(fieldId) !== rec.status) {
							hasChanged = true;
							break;
						}
					}
				}

				if (hasChanged) {
					const newMap = new Map();
					entries.forEach(([fieldId, rec]) => {
						newMap.set(fieldId, rec.status);
						console.log(`[useActiveRecordingFieldIds] Field ${fieldId} status: ${rec.status}`);
					});
					prevMapRef.current = newMap;
					setActiveFields(newMap);
				}
			}
		});

		return unsubscribe;
	}, []);

	return activeFields;
};

// ============================================================================
// hooks/usePolygonSelection.js
// ============================================================================

const usePolygonSelection = (polygons, enableMultiSelect, callbacks) => {
	const { onPolygonSelect, onPolygonDeselect } = callbacks;
	const [selectedPolygons, setSelectedPolygons] = useState(new Set());
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

	// Use refs to store current state values - prevents stale closures
	const selectedPolygonsRef = useRef(new Set());
	const isMultiSelectModeRef = useRef(false);

	// Sync refs with state on every render
	selectedPolygonsRef.current = selectedPolygons;
	isMultiSelectModeRef.current = isMultiSelectMode;

	// Reset multi-select when disabled
	useEffect(() => {
		if (!enableMultiSelect) {
			setIsMultiSelectMode(false);
			setSelectedPolygons(new Set());
		}
	}, [enableMultiSelect]);

	const selectSingle = useCallback((polygonId) => {
		setSelectedPolygons(new Set([polygonId]));
		setIsMultiSelectMode(false);
		onPolygonSelect?.(polygonId);
	}, [onPolygonSelect]);

	const clearSelection = useCallback(() => {
		setSelectedPolygons(new Set());
		setIsMultiSelectMode(false);
		onPolygonDeselect?.();
	}, [onPolygonDeselect]);

	const handlePolygonPress = useCallback((polygonId) => {
		// In multi-select mode, do nothing on tap - require long press
		if (!isMultiSelectModeRef.current) {
			selectSingle(polygonId);
		}
	}, [selectSingle]);

	const handleLongPress = useCallback((polygonId) => {
		if (!enableMultiSelect) return;

		// Read current state from refs to avoid stale closures
		const currentIsMultiSelectMode = isMultiSelectModeRef.current;
		const currentSelected = selectedPolygonsRef.current;

		if (currentIsMultiSelectMode) {
			// Toggle polygon in multi-select mode
			const newSelection = new Set(currentSelected);
			if (newSelection.has(polygonId)) {
				newSelection.delete(polygonId);
			} else {
				newSelection.add(polygonId);
			}
			console.log('[handleLongPress] Multi-select toggle:', {
				polygonId,
				before: Array.from(currentSelected),
				after: Array.from(newSelection)
			});
			setSelectedPolygons(newSelection);
		} else {
			// Start multi-select mode with this polygon
			console.log('[handleLongPress] Starting multi-select with:', polygonId);
			setIsMultiSelectMode(true);
			setSelectedPolygons(new Set([polygonId]));
		}
	}, [enableMultiSelect]);

	return {
		selectedPolygons,
		isMultiSelectMode,
		selectSingle,
		clearSelection,
		handlePolygonPress,
		handleLongPress,
		setSelectedPolygons,
		setIsMultiSelectMode,
	};
};

// ============================================================================
// hooks/usePolygonDrawing.js
// ============================================================================

const usePolygonDrawing = (polygons, setPolygons, valueSetter, mapRef, onFinishShape) => {
	const [isDrawing, setIsDrawing] = useState(false);
	const [currentPolygon, setCurrentPolygon] = useState([]);
	const [currentColor, setCurrentColor] = useState(null);

	const startDrawing = useCallback(() => {
		setIsDrawing(true);
		setCurrentPolygon([]);
		setCurrentColor(POLYGON_COLORS[polygons.length % POLYGON_COLORS.length]);
	}, [polygons.length]);

	const addPoint = useCallback((point) => {
		setCurrentPolygon((prev) => [...prev, point]);
	}, []);

	const finishDrawing = useCallback(() => {
		if (currentPolygon.length >= 3) {
			const newPolygon = createPolygon(currentPolygon, currentColor, polygons.length);
			const updatedPolygons = [...polygons, newPolygon];
			setPolygons(updatedPolygons);
			valueSetter(updatedPolygons);
			mapRef.current?.animateToRegion(calculatePolygonsBounds(updatedPolygons), 800);
			onFinishShape?.(newPolygon._id);
		}
		setCurrentPolygon([]);
		setIsDrawing(false);
		setCurrentColor(null);
	}, [currentPolygon, currentColor, polygons, setPolygons, valueSetter, mapRef, onFinishShape]);

	const cancelDrawing = useCallback(() => {
		setCurrentPolygon([]);
		setIsDrawing(false);
		setCurrentColor(null);
	}, []);

	return {
		isDrawing,
		currentPolygon,
		currentColor,
		startDrawing,
		addPoint,
		finishDrawing,
		cancelDrawing,
	};
};

// ============================================================================
// components/LabelsOverlay.js - RENDERED OUTSIDE MAPVIEW (no flicker)
// ============================================================================


const LabelsOverlay = memo(forwardRef(({ polygons, selectedPolygons, mapRef, isMapReady }, ref) => {
	const [labels, setLabels] = useState([]);
	const isUpdatingRef = useRef(false);
	const fadeAnim = useRef(new Animated.Value(1)).current;
	const isVisibleRef = useRef(true);

	// Expose show/hide to parent via ref
	useImperativeHandle(ref, () => ({
		hide: () => {
			if (!isVisibleRef.current) return;
			isVisibleRef.current = false;
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 50,
				useNativeDriver: true,
			}).start();
		},
		show: () => {
			if (isVisibleRef.current) return;
			isVisibleRef.current = true;
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 150,
				useNativeDriver: true,
			}).start();
		},
	}));

	const updatePositions = useCallback(async () => {
		if (!mapRef.current || !isMapReady || polygons.length === 0 || isUpdatingRef.current) {
			return;
		}

		isUpdatingRef.current = true;

		try {
			const newLabels = [];

			for (const polygon of polygons) {
				const center = getPolygonCenter(polygon.points);
				if (!center) continue;

				try {
					const point = await mapRef.current.pointForCoordinate(center);
					if (point.x > -50 && point.x < width + 50 && point.y > -50 && point.y < height + 50) {
						newLabels.push({
							id: polygon._id,
							name: polygon.name,
							crop: polygon.currentCultivation?.crop,
							variety: polygon.currentCultivation?.variety,
							x: point.x,
							y: point.y,
							isSelected: selectedPolygons.has(polygon._id),
						});
					}
				} catch (e) {
					// off screen
				}
			}

			setLabels(newLabels);
		} catch (e) {
			console.warn('Label update failed:', e);
		} finally {
			isUpdatingRef.current = false;
		}
	}, [polygons, selectedPolygons, mapRef, isMapReady]);

	// Expose updatePositions to parent via mapRef
	useEffect(() => {
		if (mapRef.current) {
			mapRef.current._updateLabels = updatePositions;
		}
	}, [mapRef, updatePositions]);

	// Update on selection change or polygon list change
	useEffect(() => {
		if (isMapReady && isVisibleRef.current) {
			updatePositions();
		}
	}, [isMapReady, selectedPolygons, polygons]);

	if (labels.length === 0) return null;

	return (
		<Animated.View
			style={[overlayStyles.container, { opacity: fadeAnim }]}
			pointerEvents="none"
		>
			{labels.map((label) => (
				<View
					key={label.id}
					style={[
						overlayStyles.labelWrapper,
						{ left: label.x, top: label.y },
					]}
				>
					<View style={[
						overlayStyles.labelInner,
						// label.isSelected && overlayStyles.labelSelected
					]}>
						<Text
							style={[
								overlayStyles.fieldNameText,
								// label.isSelected && overlayStyles.textSelected
							]}
							numberOfLines={1}
						>
							{label.name}
						</Text>
						{label.crop && (
							<Text
								style={overlayStyles.cropText}
								numberOfLines={1}
							>
								{label.crop}
								{label.variety && ` (${label.variety})`}
							</Text>
						)}
					</View>
				</View>
			))}
		</Animated.View>
	);
}));

const overlayStyles = StyleSheet.create({
	container: {
		...StyleSheet.absoluteFillObject,
		overflow: 'hidden',
	},
	labelWrapper: {
		position: 'absolute',
		transform: [{ translateX: -60 }, { translateY: -25 }],
	},
	labelInner: {
		// backgroundColor: 'rgba(0, 0, 0, 0.75)',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		flexDirection: 'column',
		alignItems: 'center',
		gap: 2,
	},
	labelSelected: {
		backgroundColor: 'rgba(180, 0, 0, 0.85)',
		borderWidth: 1,
		borderColor: '#FFD700',
	},
	icon: {
		width: 14,
		height: 14,
	},
	fieldNameText: {
		color: 'white',
		fontSize: 15,
		elevation: 2,
		fontWeight: '700',
		textAlign: 'center',
		maxWidth: 120,
		textShadowColor: 'rgba(0, 0, 0, 0.9)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},
	cropText: {
		color: 'rgba(255, 255, 255, 0.85)',
		fontSize: 12,
		elevation: 2,
		fontWeight: '500',
		textAlign: 'center',
		maxWidth: 120,
		textShadowColor: 'rgba(0, 0, 0, 0.8)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	textSelected: {
		color: '#FFD700',
	},
});

// ============================================================================
// components/VertexMarkers.js
// ============================================================================

const VertexMarkers = memo(({ points, polygonId, isSelected }) => {
	return points.map((point, index) => (
		<Marker
			key={`${polygonId}-vertex-${index}`}
			coordinate={point}
			anchor={{ x: 0.2, y: 0.2 }}
			tracksViewChanges={false}
			tracksInfoWindowChanges={false}
		>
			<View
				style={[
					vertexStyles.marker,
					{ backgroundColor: isSelected ? 'red' : colors.PRIMARY }
				]}
			/>
		</Marker>
	));
});

const vertexStyles = StyleSheet.create({
	marker: {
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 2,
		borderColor: 'white',
	},
});

// ============================================================================
// components/FieldPolygon.js - FIXED color and paused state
// ============================================================================

// ============================================================================
// FieldPolygon - OPTIMIZED WITH SINGLE ANIMATION CLOCK
// ============================================================================

// Color interpolation helper
const interpolateColor = (color1, color2, factor) => {
	// Parse hex colors (supports #RRGGBB and #RRGGBBAA)
	const parseHex = (hex) => {
		const clean = hex.replace('#', '');
		const hasAlpha = clean.length === 8;
		return {
			r: parseInt(clean.substring(0, 2), 16),
			g: parseInt(clean.substring(2, 4), 16),
			b: parseInt(clean.substring(4, 6), 16),
			a: hasAlpha ? parseInt(clean.substring(6, 8), 16) : 255,
		};
	};

	const c1 = parseHex(color1);
	const c2 = parseHex(color2);

	const r = Math.round(c1.r + (c2.r - c1.r) * factor);
	const g = Math.round(c1.g + (c2.g - c1.g) * factor);
	const b = Math.round(c1.b + (c2.b - c1.b) * factor);
	const a = Math.round(c1.a + (c2.a - c1.a) * factor);

	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
};

const FieldPolygon = memo(({
	polygon,
	isSelected,
	showVertices,
	recordingStatus,
	animationPhase,
	onPress,
	onLongPress,
}) => {
	const isRecording = recordingStatus === 'running';
	const isPaused = recordingStatus === 'paused';

	const baseColor = useMemo(() => {
		const alpha = isSelected ? 'DD' : '50';
		const color = polygon.color.replace('#', '');
		return `#${color}${alpha}`;
	}, [polygon.color, isSelected]);

	const flashColor = '#42210ba1';
	const pausedColor = '#d6d6d6aa';

	const fillColor = isPaused ? pausedColor : !isRecording ? baseColor : interpolateColor(baseColor, flashColor, animationPhase);

	const strokeColor = isSelected ? 'red' : (isRecording || isPaused) ? '#FF3300' : colors.PRIMARY;

	const strokeWidth = isSelected || isRecording || isPaused ? 2 : 1;
	const zIndex = isSelected ? 1 : 0;

	const handlePress = useCallback(() => onPress(polygon._id), [onPress, polygon._id]);
	const handleLongPress = useCallback(() => onLongPress?.(polygon._id), [onLongPress, polygon._id]);

	return (
		<>
			<Polygon
				key={`polygon-${polygon._id}-${isSelected}`}
				coordinates={polygon.points}
				fillColor={fillColor}
				strokeColor={strokeColor}
				strokeWidth={strokeWidth}
				zIndex={zIndex}
				tappable
				onPress={handlePress}
				onLongPress={handleLongPress}
			/>
			{showVertices && (
				<VertexMarkers
					points={polygon.points}
					polygonId={polygon._id}
					isSelected={isSelected}
				/>
			)}
		</>
	);
});

// ============================================================================
// components/DrawingPreview.js
// ============================================================================

const DrawingPreview = memo(({ currentPolygon, currentColor, centerPoint, showVertices, useCenterPointMode }) => {
	if (currentPolygon.length === 0 || !currentColor) return null;

	return (
		<>
			<Polygon
				coordinates={currentPolygon}
				fillColor={`${currentColor}50`}
				strokeColor={colors.PRIMARY}
				strokeWidth={1}
			/>
			{showVertices && (
				<VertexMarkers
					points={currentPolygon}
					polygonId="drawing"
					isSelected={false}
				/>
			)}
			{useCenterPointMode && centerPoint && currentPolygon.length > 0 && (
				<Polyline
					coordinates={[currentPolygon[currentPolygon.length - 1], centerPoint]}
					strokeColor={colors.SECONDARY}
					strokeWidth={2}
					lineDashPattern={[5, 5]}
				/>
			)}
		</>
	);
});

// ============================================================================
// components/CenterIndicator.js
// ============================================================================

const CenterIndicator = memo(({ visible }) => {
	if (!visible) return null;

	return (
		<View style={indicatorStyles.container} pointerEvents="none">
			<View style={indicatorStyles.dot} />
		</View>
	);
});

const indicatorStyles = StyleSheet.create({
	container: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: 'center',
		justifyContent: 'center',
	},
	dot: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: colors.SECONDARY,
		borderWidth: 4,
		borderColor: 'white',
	},
});

// ============================================================================
// components/DrawingControls.js
// ============================================================================

const DrawingControls = memo(({
	isDrawing,
	useCenterPointMode,
	currentPolygonLength,
	selectedCount,
	isMultiSelectMode,
	onlyEditButton,
	onAddPoint,
	onFinish,
	onCancel,
	onDelete,
	onEdit,
	onStartDrawing,
}) => {
	// Drawing mode - center point style
	if (isDrawing && useCenterPointMode) {
		const canFinish = currentPolygonLength >= 3;
		return (
			<View style={controlStyles.drawingRow}>
				<PrimaryButton
					text="Add Point"
					onPress={onAddPoint}
					style={controlStyles.addPointBtn}
				/>
				<PrimaryButton
					variant="outline"
					style={[controlStyles.finishBtn, { borderColor: canFinish ? 'green' : 'red' }]}
					text={canFinish ? 'Finish Shape' : 'Cancel'}
					onPress={canFinish ? onFinish : onCancel}
				/>
			</View>
		);
	}

	// Drawing mode - tap to add style
	if (isDrawing) {
		const canFinish = currentPolygonLength >= 3;
		return (
			<PrimaryButton
				variant="outline"
				style={{ borderColor: canFinish ? 'green' : 'red' }}
				text={canFinish ? 'Finish Shape' : 'Cancel'}
				onPress={canFinish ? onFinish : onCancel}
			/>
		);
	}

	// Selection mode
	if (selectedCount > 0) {
		return (
			<View style={controlStyles.selectionRow}>
				{!onlyEditButton && (
					<PrimaryButton
						text={isMultiSelectMode ? `Delete (${selectedCount})` : 'Delete'}
						variant="outline"
						style={controlStyles.deleteBtn}
						onPress={onDelete}
					/>
				)}
				<PrimaryButton
					text="Edit"
					variant="outline"
					style={onlyEditButton ? { width: 280 } : controlStyles.editBtn}
					onPress={onEdit}
				/>
			</View>
		);
	}

	// Default - add button
	if (!onlyEditButton) {
		return (
			<PrimaryButton
				variant="outline"
				text="Add New"
				onPress={onStartDrawing}
			/>
		);
	}

	return null;
});

const controlStyles = StyleSheet.create({
	drawingRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 12,
		width: WINDOW_WIDTH - 40,
	},
	addPointBtn: {
		flex: 1,
		maxWidth: 160,
	},
	finishBtn: {
		flex: 1,
		maxWidth: 160,
	},
	selectionRow: {
		width: WINDOW_WIDTH,
		bottom: -30,
		flexDirection: 'row',
		justifyContent: 'center',
	},
	deleteBtn: {
		width: WINDOW_WIDTH / 2 - WINDOW_WIDTH * 0.09,
		borderColor: 'red',
	},
	editBtn: {
		width: WINDOW_WIDTH / 2 - WINDOW_WIDTH * 0.09,
	},
});

// ============================================================================
// PolygonDrawingMap (main component) - index.js
// ============================================================================

const PolygonDrawingMap = forwardRef(({
	valueSetter,
	defaultPolygons = [],
	onlyEditButton,
	hideAllButtons = false,
	buttonsVerticalOfsset,
	onPolygonSelect,
	onEditPolygon,
	onPolygonDeselect,
	onDeletePolygon,
	onMultiSelectChange,
	enableMultiSelect = true,
	disableOutsideDeselect = false,
	showVertices = false,
	showLabels = true,
	fitPadding = { top: 50, right: 50, bottom: 50, left: 50 },
	onFinishShape,
	useCenterPointMode = false,
	useGeolocation: useGeolocationProp = true,
	nameSource = null,
}, ref) => {
	const isFocused = useIsFocused();
	const { localPreferences } = useGlobalContext();
	const isPrettyMode = localPreferences?.uiPerformanceMode !== 'balanced';

	const mapRef = useRef(null);
	const labelsRef = useRef(null);
	const panTimeoutRef = useRef(null);
	const [isMapReady, setIsMapReady] = useState(false);
	const [polygons, setPolygons] = useState(defaultPolygons);

	// Animation state
	const [animationPhase, setAnimationPhase] = useState(0);
	// Stable ID string for dependency tracking
	const defaultPolygonIds = useMemo(
		() => defaultPolygons.map((p) => p._id).sort().join(','),
		[defaultPolygons]
	);

	const initialRegion = useMemo(
		() => getInitialRegion(defaultPolygons),
		[] // Only compute once
	);

	// Hooks
	const { centerPoint, updateCenterPoint } = useGeolocation(
		useGeolocationProp,
		defaultPolygons.length > 0,
		mapRef
	);

	const selection = usePolygonSelection(polygons, enableMultiSelect, {
		onPolygonSelect,
		onPolygonDeselect,
	});

	const drawing = usePolygonDrawing(
		polygons,
		setPolygons,
		valueSetter,
		mapRef,
		onFinishShape
	);

	const activeRecordingFields = useActiveRecordingFieldIds();

	// Single animation clock for all recording polygons
	useEffect(() => {
		if (!isFocused) return;

		const hasRecording = Array.from(activeRecordingFields.values()).some(s => s === 'running');
		if (!hasRecording) return;

		if (isPrettyMode) {
			// Pretty mode: smooth sine wave animation at 30fps
			let frame;
			const start = Date.now();
			let lastTime = 0;
			const fpsInterval = 1000 / BLINKING_FPS; // 30 fps

			const tick = (currentTime) => {
				frame = requestAnimationFrame(tick);

				const elapsed = currentTime - lastTime;
				if (elapsed < fpsInterval) return;

				lastTime = currentTime - (elapsed % fpsInterval);
				const rawPhase = (Math.sin((Date.now() - start) / 600 * Math.PI) + 1) / 2;
				// Apply power function for sharper/faster transitions
				const phase = Math.pow(rawPhase, 3);
				setAnimationPhase(phase);
			};

			frame = requestAnimationFrame(tick);
			return () => cancelAnimationFrame(frame);
		} else {
			// Balanced mode: simple blink every 600ms
			let on = true;
			setAnimationPhase(1);
			const interval = setInterval(() => {
				on = !on;
				setAnimationPhase(on ? 1 : 0);
			}, 600);

			return () => clearInterval(interval);
		}
	}, [isFocused, activeRecordingFields, isPrettyMode]);

	// Sync polygons from props
	useEffect(() => {
		setPolygons(defaultPolygons);
	}, [defaultPolygonIds]);

	// Sync polygon names from external source (e.g., tmpFirstSetup during first setup)
	useEffect(() => {
		if (!nameSource) return;

		setPolygons((prevPolygons) => {
			let hasChanges = false;
			const updatedPolygons = prevPolygons.map((polygon) => {
				const nameData = nameSource[polygon._id];
				if (nameData?.fieldName && nameData.fieldName !== polygon.name) {
					hasChanges = true;
					return { ...polygon, name: nameData.fieldName };
				}
				return polygon;
			});

			return hasChanges ? updatedPolygons : prevPolygons;
		});
	}, [nameSource]);

	// Notify parent of multiselect state changes
	useEffect(() => {

		if (onMultiSelectChange) {
			onMultiSelectChange(selection.selectedPolygons, selection.isMultiSelectMode);
		}
	}, [selection.selectedPolygons, selection.isMultiSelectMode, onMultiSelectChange]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (panTimeoutRef.current) {
				clearTimeout(panTimeoutRef.current);
			}
		};
	}, []);

	// Imperative handle
	useImperativeHandle(ref, () => ({
		fitToField: (fieldId, animated = false) => {
			const polygon = polygons.find((p) => p._id === fieldId);
			if (!polygon?.points?.length) return false;
			mapRef.current?.fitToCoordinates(polygon.points, { edgePadding: fitPadding, animated });
			return true;
		},

		fitToFields: (fieldIds, animated = false) => {
			const allPoints = polygons
				.filter((p) => fieldIds.includes(p._id))
				.flatMap((p) => p.points);
			if (!allPoints.length) return false;
			mapRef.current?.fitToCoordinates(allPoints, { edgePadding: fitPadding, animated });
			return true;
		},

		fitToAll: (animated = false) => {
			const allPoints = polygons.flatMap((p) => p.points);
			if (!allPoints.length) return false;
			mapRef.current?.fitToCoordinates(allPoints, { edgePadding: fitPadding, animated });
			return true;
		},

		selectField: (fieldId, animated = true) => {
			const polygon = polygons.find((p) => p._id === fieldId);
			if (!polygon) return false;

			selection.setSelectedPolygons(new Set([fieldId]));
			selection.setIsMultiSelectMode(false);
			onPolygonSelect?.(fieldId);

			if (mapRef.current && polygon.points?.length) {
				mapRef.current.fitToCoordinates(polygon.points, { edgePadding: fitPadding, animated });
			}
			return true;
		},

		clearSelection: () => {
			selection.clearSelection();
		},

		hideLabels: () => {
			labelsRef.current?.hide();
		},

		showLabels: async () => {
			await mapRef.current?._updateLabels?.();
			labelsRef.current?.show();
		},
	}), [polygons, fitPadding, selection, onPolygonSelect]);
	// Map event handlers
	const handleMapReady = useCallback(() => {
		if (defaultPolygons.length > 0) {
			mapRef.current?.fitToCoordinates(
				defaultPolygons.flatMap((p) => p.points),
				{ edgePadding: fitPadding, animated: false }
			);
		}
		setIsMapReady(true);
		// Initial label position update after a brief delay
		setTimeout(() => {
			mapRef.current?._updateLabels?.();
		}, 100);
	}, [defaultPolygons, fitPadding]);

	const handlePanDrag = useCallback(() => {
		// Hide labels when actively dragging
		if (panTimeoutRef.current) {
			clearTimeout(panTimeoutRef.current);
			panTimeoutRef.current = null;
		}
		labelsRef.current?.hide();
	}, []);

	const handleRegionChangeComplete = useCallback((region) => {
		if (useCenterPointMode) {
			updateCenterPoint(region);
		}

		// Show labels again after dragging stops
		if (panTimeoutRef.current) {
			clearTimeout(panTimeoutRef.current);
		}
		panTimeoutRef.current = setTimeout(async () => {
			await mapRef.current?._updateLabels?.();
			labelsRef.current?.show();
		}, 50);
	}, [useCenterPointMode, updateCenterPoint]);

	const handleMapPress = useCallback((e) => {
		const point = e.nativeEvent.coordinate;

		if (drawing.isDrawing) {
			if (!useCenterPointMode) {
				drawing.addPoint(point);
			}
			return;
		}

		const touchedPolygon = polygons.find((p) => isPointInPolygonWithBuffer(point, p.points));

		if (!touchedPolygon) {
			if (!disableOutsideDeselect) {
				selection.clearSelection();
			}
			return;
		}

		selection.handlePolygonPress(touchedPolygon._id);
	}, [drawing, useCenterPointMode, polygons, selection, disableOutsideDeselect]);

	const handleMapLongPress = useCallback((e) => {
		if (drawing.isDrawing) return;

		const point = e.nativeEvent.coordinate;
		const touchedPolygon = polygons.find((p) => isPointInPolygonWithBuffer(point, p.points));

		if (touchedPolygon) {
			selection.handleLongPress(touchedPolygon._id);
		}
	}, [drawing.isDrawing, polygons, selection.handleLongPress]);

	const handlePolygonPress = useCallback((polygonId) => {
		if (drawing.isDrawing) return;
		selection.handlePolygonPress(polygonId);
	}, [drawing.isDrawing, selection]);

	const handlePolygonLongPress = useCallback((polygonId) => {
		// if (!drawing.isDrawing) {
		// 	selection.handleLongPress(polygonId);
		// }
	}, [drawing.isDrawing, selection.handleLongPress]);

	// Control handlers
	const handleAddPoint = useCallback(() => {
		if (centerPoint && drawing.isDrawing && useCenterPointMode) {
			drawing.addPoint({ latitude: centerPoint.latitude, longitude: centerPoint.longitude });
		}
	}, [centerPoint, drawing, useCenterPointMode]);

	const handleDelete = useCallback(() => {
		if (selection.selectedPolygons.size > 0) {
			const newPolygons = polygons.filter((p) => !selection.selectedPolygons.has(p._id));
			setPolygons(newPolygons);
			valueSetter(newPolygons);

			// Notify parent about deletions
			if (onDeletePolygon) {
				selection.selectedPolygons.forEach((polygonId) => {
					onDeletePolygon(polygonId);
				});
			}

			selection.clearSelection();
		}
	}, [selection, polygons, valueSetter, onDeletePolygon]);

	const handleEdit = useCallback(() => {
		const [firstSelected] = selection.selectedPolygons;
		if (onEditPolygon) {
			onEditPolygon(firstSelected);
		}
	}, [selection.selectedPolygons, onEditPolygon]);

	// Button container offset
	const buttonContainerStyle = useMemo(() => [
		styles.buttonContainer,
		buttonsVerticalOfsset && { bottom: styles.buttonContainer.bottom + buttonsVerticalOfsset }
	], [buttonsVerticalOfsset]);

	return (
		<View style={styles.mapContainer}>
			<MapView
				toolbarEnabled={false}
				mapType="satellite"
				ref={mapRef}
				style={[styles.map, { opacity: isMapReady ? 1 : 0 }]}
				onPress={handleMapPress}
				initialRegion={initialRegion}
				onMapReady={handleMapReady}
				onLongPress={handleMapLongPress}
				onPanDrag={handlePanDrag}
				onRegionChangeComplete={handleRegionChangeComplete}
				showsUserLocation={useGeolocationProp}
				onMarkerSelect={null}
				moveOnMarkerPress={false}
			>
				{polygons.map((polygon) => (
					<FieldPolygon
						key={polygon._id}
						polygon={polygon}
						isSelected={selection.selectedPolygons.has(polygon._id)}
						showVertices={showVertices}
						recordingStatus={activeRecordingFields.get(String(polygon._id)) || null}
						animationPhase={animationPhase}
						onPress={handlePolygonPress}
						onLongPress={handlePolygonLongPress}
					/>
				))}

				<DrawingPreview
					currentPolygon={drawing.currentPolygon}
					currentColor={drawing.currentColor}
					centerPoint={centerPoint}
					showVertices={showVertices}
					useCenterPointMode={useCenterPointMode}
				/>
			</MapView>

			{/* Labels rendered OUTSIDE MapView - no flickering */}
			{showLabels && (
				<LabelsOverlay
					ref={labelsRef}
					polygons={polygons}
					selectedPolygons={selection.selectedPolygons}
					mapRef={mapRef}
					isMapReady={isMapReady}
				/>
			)}

			<CenterIndicator visible={drawing.isDrawing && useCenterPointMode} />

			{!hideAllButtons && (
				<View style={buttonContainerStyle}>
					<DrawingControls
						isDrawing={drawing.isDrawing}
						useCenterPointMode={useCenterPointMode}
						currentPolygonLength={drawing.currentPolygon.length}
						selectedCount={selection.selectedPolygons.size}
						isMultiSelectMode={selection.isMultiSelectMode}
						onlyEditButton={onlyEditButton}
						onAddPoint={handleAddPoint}
						onFinish={drawing.finishDrawing}
						onCancel={drawing.cancelDrawing}
						onDelete={handleDelete}
						onEdit={handleEdit}
						onStartDrawing={drawing.startDrawing}
					/>
				</View>
			)}
		</View>
	);
});

// ============================================================================
// Main styles
// ============================================================================

const styles = StyleSheet.create({
	mapContainer: {
		width: width,
		flex: 1,
		overflow: 'hidden',
	},
	map: {
		...StyleSheet.absoluteFillObject,
	},
	buttonContainer: {
		bottom: 27,
		alignSelf: 'center',
		flexDirection: 'row',
		justifyContent: 'center',
		marginTop: WINDOW_HEIGHT - StatusBar.currentHeight - 150,
		zIndex: 999,
	},
});

export default PolygonDrawingMap;