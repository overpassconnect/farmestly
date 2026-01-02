import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { api } from '../globals/api';
import { View, StyleSheet, Dimensions, TouchableOpacity, PermissionsAndroid } from 'react-native';
import MapView, { Polygon, Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import colors from '../globals/colors';
import PrimaryButton from './ui/core/PrimaryButton';
import countriesCentroids from '../globals/countriesCentroids';
import { calculatePolygonsBounds } from './setup/PolygonDrawingMap/utils';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const COLORS = ['#FF6B6B', '#004cbf', '#00a103', '#7a00a6', '#d4bb02', '#02d4d4', '#e06e02', '#3498DB', '#E74C3C', '#2ECC71'];

const PlainMap = forwardRef(({
	valueSetter,
	fieldColor = null,
	fieldId = null,
	fieldBounds = null,
	useGeolocation = true,
	onFinish
}, ref) => {
	const mapRef = useRef(null);

	// State for tracking points and field
	const [points, setPoints] = useState([]);
	const [currentColor, setCurrentColor] = useState(fieldColor || COLORS[Math.floor(Math.random() * COLORS.length)]);
	const [initialRegion, setInitialRegion] = useState(null);
	const [isRecording, setIsRecording] = useState(false);
	const [centerPoint, setCenterPoint] = useState(null);
	const [currentRegion, setCurrentRegion] = useState(null);

	// Expose methods via ref
	useImperativeHandle(ref, () => ({
		animateToRegion: (region, ms = 800) => mapRef?.current?.animateToRegion(region, ms),
		getCurrentPoints: () => points,
		resetPoints: () => setPoints([]),
		startRecording: () => setIsRecording(true),
		stopRecording: () => setIsRecording(false),
		isRecording: () => isRecording
	}));

	// Initialize map with field bounds for centering only
	useEffect(() => {
		// Priority 1: Use fieldBounds if available
		if (fieldBounds) {
			setInitialRegion(fieldBounds);
			setCenterPoint({
				latitude: fieldBounds.latitude,
				longitude: fieldBounds.longitude
			});
			return;
		}

		// Priority 2: Use geolocation if requested
		if (useGeolocation) {
			setupGeolocation();
		} else {
			// Priority 3: Fall back to default location (Greece)
			const defaultLocation = {
				latitude: parseFloat(countriesCentroids['GR'][0].latitude),
				longitude: parseFloat(countriesCentroids['GR'][0].longitude),
				latitudeDelta: LATITUDE_DELTA * 20,
				longitudeDelta: LONGITUDE_DELTA * 20
			};

			setInitialRegion(defaultLocation);
			setCenterPoint({
				latitude: defaultLocation.latitude,
				longitude: defaultLocation.longitude
			});
		}
	}, [fieldBounds, useGeolocation]);

	const setupGeolocation = async () => {
		try {
			const granted = await PermissionsAndroid.request(
				PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
				{
					title: 'Location Permission',
					message: 'We need your location to provide a better app experience.',
					buttonNeutral: 'Ask Me Later',
					buttonNegative: 'Cancel',
					buttonPositive: 'OK'
				}
			);

			if (granted === PermissionsAndroid.RESULTS.GRANTED) {
				Geolocation.setRNConfiguration({
					skipPermissionRequests: false,
					authorizationLevel: 'whenInUse',
					locationProvider: 'playServices'
				});

				Geolocation.getCurrentPosition(
					position => {
						const region = {
							latitude: position.coords.latitude,
							longitude: position.coords.longitude,
							latitudeDelta: LATITUDE_DELTA / 25,
							longitudeDelta: LONGITUDE_DELTA / 25
						};

						setInitialRegion(region);
						setCenterPoint({
							latitude: position.coords.latitude,
							longitude: position.coords.longitude
						});
					},
					error => {
						console.log('Geolocation error:', error);
						// Fallback to Greece when geolocation fails
						const fallbackLocation = {
							latitude: parseFloat(countriesCentroids['GR'][0].latitude),
							longitude: parseFloat(countriesCentroids['GR'][0].longitude),
							latitudeDelta: LATITUDE_DELTA * 20,
							longitudeDelta: LONGITUDE_DELTA * 20
						};

						setInitialRegion(fallbackLocation);
						setCenterPoint({
							latitude: fallbackLocation.latitude,
							longitude: fallbackLocation.longitude
						});
					},
					{ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
				);
			} else {
				// Fall back to Greece
				const countryLocation = {
					latitude: parseFloat(countriesCentroids['GR'][0].latitude),
					longitude: parseFloat(countriesCentroids['GR'][0].longitude),
					latitudeDelta: LATITUDE_DELTA * 20,
					longitudeDelta: LONGITUDE_DELTA * 20
				};

				setInitialRegion(countryLocation);
				setCenterPoint({
					latitude: countryLocation.latitude,
					longitude: countryLocation.longitude
				});
			}
		} catch (err) {
			console.error('Geolocation setup error:', err);

			// Fall back to default location (Greece)
			const defaultLocation = {
				latitude: parseFloat(countriesCentroids['GR'][0].latitude),
				longitude: parseFloat(countriesCentroids['GR'][0].longitude),
				latitudeDelta: LATITUDE_DELTA * 20,
				longitudeDelta: LONGITUDE_DELTA * 20
			};

			setInitialRegion(defaultLocation);
			setCenterPoint({
				latitude: defaultLocation.latitude,
				longitude: defaultLocation.longitude
			});
		}
	};

	// Handle map region change to update center point
	// ALWAYS track center, not just when recording - fixes bug where first point
	// lands at old field center instead of crosshair when redrawing
	const handleRegionChange = (region) => {
		const point = {
			latitude: region.latitude,
			longitude: region.longitude
		};
		setCenterPoint(point);
		setCurrentRegion(point);
	};



	// Add a point at the center of the screen
	const handleAddPoint = () => {
		if (!centerPoint || !isRecording) return;

		// Create a completely new point object with explicit values
		const newPoint = {
			latitude: centerPoint.latitude,
			longitude: centerPoint.longitude
		};
		setCurrentRegion(newPoint);
		// Create a new array rather than modifying the existing one
		const newPoints = [...points, newPoint];
		setPoints(newPoints);

		// Update parent component if valueSetter is provided
		if (valueSetter) {
			const field = {
				points: newPoints,
				color: currentColor,
				id: fieldId || Date.now().toString()
			};

			valueSetter([field]);
		}
	};

	// Finish drawing when we have at least 3 points
	const handleFinishDrawing = () => {
		if (points.length < 3) {
			alert('Please add at least 3 points to create a valid field shape');
			return;
		}

		setIsRecording(false);

		// Close the polygon by adding the first point again if needed
		const lastPoint = points[points.length - 1];
		const firstPoint = points[0];

		let finalPoints = [...points];

		// Only close the polygon if it's not already closed
		if (firstPoint.latitude !== lastPoint.latitude || firstPoint.longitude !== lastPoint.longitude) {
			finalPoints = [...points, { ...firstPoint }];
			setPoints(finalPoints);
		}

		// Update parent component
		if (valueSetter) {
			const field = {
				points: finalPoints,
				color: currentColor,
				id: fieldId || Date.now().toString()
			};

			valueSetter([field]);
		}

		// Call finish callback if provided
		if (onFinish) {
			onFinish(fieldId || Date.now().toString());
		}
	};

	// Clear all points and start over
	const handleClearPoints = () => {
		setPoints([]);

		// Update parent component
		if (valueSetter) {
			valueSetter([]);
		}
	};

	// Add this function to explicitly get the latest preview line coordinates
	// const getPreviewLineCoordinates = useCallback(() => {
	// 	if (!isRecording || points.length === 0 || !centerPoint) {
	// 		return null;
	// 	}
	// 	// console.log(JSON.stringify(points))
	// 	// Get the last point explicitly with new object creation
	// 	const from = {
	// 		latitude: points[points.length - 1].latitude,
	// 		longitude: points[points.length - 1].longitude
	// 	};
	// 	// console.log(lastPoint)

	// 	// Create a fresh center point object
	// 	const to = currentRegion;

	// 	return [from, to];
	// }, [currentRegion]);
	const getPreviewLineCoordinates = () => {
		if (!isRecording || points.length === 0 || !centerPoint) {
			return null;
		}
		// Get the last point explicitly with new object creation
		const from = {
			latitude: points[points.length - 1].latitude,
			longitude: points[points.length - 1].longitude
		};
		// console.log(lastPoint)
		
		// Create a fresh center point object
		const to = currentRegion;
		console.log(JSON.stringify([to,from]))

		return [from, to];
	};

	// Start recording button
	const renderStartButton = () => {
		if (isRecording) return null;

		return (
			<PrimaryButton
				text="Draw"
				onPress={() => setIsRecording(true)}
			/>
		);
	};

	// Render recording controls when active
	const renderRecordingControls = () => {
		if (!isRecording) return null;

		return (
			<View style={styles.recordingControls}>
				<View style={styles.controlsRow}>
					<PrimaryButton
						text="Add Point"
						style={{ width: 150 }}
						onPress={handleAddPoint}
					/>
					<PrimaryButton
						text="Clear"
						style={{ width: 150, backgroundColor: 'tomato' }}
						onPress={handleClearPoints}
					/>
				</View>

				{points.length >= 3 && (
					<View style={styles.doneButtonContainer}>
						<PrimaryButton
							text="Finish Shape"
							style={{ width: 200, backgroundColor: 'green' }}
							onPress={handleFinishDrawing}
						/>
					</View>
				)}
			</View>
		);
	};

	// Render center indicator for positioning points
	const renderCenterIndicator = () => {
		if (!isRecording) return null;

		return (
			<View style={styles.centerIndicatorContainer} pointerEvents="none">
				<View style={styles.centerIndicator} />
			</View>
		);
	};

	return (
		<View style={styles.container}>
			{initialRegion && (
				<MapView
					ref={mapRef}
					style={styles.map}
					initialRegion={initialRegion}
					onRegionChangeComplete={handleRegionChange}
					mapType="satellite"
					showsUserLocation={true}
				>
					{/* Render existing points as a polygon if we have enough */}
					{points.length >= 3 && (
						<Polygon
							coordinates={points}
							strokeColor={colors.PRIMARY}
							fillColor={`${currentColor}50`}
							strokeWidth={3}
						/>
					)}

					{/* Render line connecting existing points if we have at least 2 */}
					{points.length >= 2 && points.length < 3 && (
						<Polyline
							coordinates={points}
							strokeColor={colors.PRIMARY}
							strokeWidth={3}
						/>
					)}

					{/* Render preview line from last point to center with the new approach */}
					{isRecording && points.length > 0 && centerPoint && (() => {
						const coords = getPreviewLineCoordinates();
						console.log('------');
						console.log(coords)
						return coords ? (
							<Polyline

								coordinates={coords}
								strokeColor={colors.SECONDARY}
								strokeWidth={3}
								lineDashPattern={[5, 5]}
							/>
						) : null;
					})()}

					{/* Render markers for each point with correct anchor */}
					{points.map((point, index) => (
						<Marker
							key={`point-${index}`}
							coordinate={point}
							anchor={{ x: 0.2, y: 0.3 }}
							tracksViewChanges={false}
						>
							<View style={styles.pointMarker} />
						</Marker>
					))}
				</MapView>
			)}

			{renderCenterIndicator()}

			<View style={styles.buttonContainer}>
				{renderStartButton()}
				{renderRecordingControls()}
			</View>
		</View>
	);
});

const styles = StyleSheet.create({
	container: {
		flex: 1,
		position: 'relative',
	},
	map: {
		...StyleSheet.absoluteFillObject,
	},
	buttonContainer: {
		position: 'absolute',
		bottom: 20,
		left: 0,
		right: 0,
		alignItems: 'center',
		zIndex: 1,
	},
	recordingControls: {
		alignItems: 'center',
		width: '100%',
	},
	controlsRow: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		width: '100%',
		paddingHorizontal: 20,
		marginBottom: 10,
	},
	doneButtonContainer: {
		marginTop: 10,
		alignItems: 'center',
	},
	centerIndicatorContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: 'center',
		justifyContent: 'center',
		pointerEvents: 'none',
	},
	centerIndicator: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: colors.SECONDARY,
		borderWidth: 4,
		borderColor: 'white',
	},
	pointMarker: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: colors.PRIMARY,
		borderWidth: 2,
		borderColor: 'white',
	},
});

export default PlainMap;