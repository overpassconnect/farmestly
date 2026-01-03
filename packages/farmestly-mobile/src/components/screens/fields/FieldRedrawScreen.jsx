import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../globals/api';
import { View, StyleSheet, Text, Alert, ActivityIndicator } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import colors from '../../../globals/colors';
import PlainMap from '../../PlainMap';
import PrimaryButton from '../../ui/core/PrimaryButton';
import config from '../../../globals/config';
import { Storage } from '../../../utils/storage';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import { calculatePolygonsBounds } from '../../setup/PolygonDrawingMap/utils';
import { ButtonStack } from '../../ui/core/ButtonGroup';

const BASE_URL = config.BASE_URL;
const FIELD_GROUPS_STORAGE_KEY = '@FieldGroups';

const FieldRedrawScreen = () => {
	const { t } = useTranslation('alerts');
	const route = useRoute();
	const navigation = useNavigation();
	const { farmData, setFarmData } = useGlobalContext();
	const { fieldData, newField } = route.params;
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	

	const [fields, setFields] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const mapRef = useRef(null);

	// Calculate bounds from field data for map centering if editing an existing field
	const fieldBounds = fieldData && fieldData.points && fieldData.points.length > 0
		? calculatePolygonsBounds([fieldData])
		: null;

	const handleFinishDrawing = (fieldId) => {
		// Show bottom sheet with save/cancel buttons
		showSaveOptionsBottomSheet(fieldId);
	};

	const showSaveOptionsBottomSheet = (fieldId) => {
		// Create bottom sheet content with save and cancel buttons
		const content = (
			<BottomSheetView style={styles.bottomSheetContent}>
				<Text style={styles.bottomSheetTitle}>
					{newField ? "Save New Field?" : "Save Changes?"}
				</Text>

				<Text style={styles.bottomSheetText}>
					{newField
						? "Do you want to save this new field shape?"
						: "Do you want to save the changes to this field shape?"}
				</Text>

				<ButtonStack>
					<PrimaryButton
						text="Save Field"
						onPress={() => {
							closeBottomSheet();
							handleSaveField(fieldId);
						}}
						loading={isLoading}
						variant="filled"
					/>

					<PrimaryButton
						text="Cancel"
						variant="outline"
						onPress={() => {
							closeBottomSheet();
							navigation.goBack();
						}}
						disabled={isLoading}
					/>
				</ButtonStack>
			</BottomSheetView>
		);

		// Open the bottom sheet
		openBottomSheet(content, {
			snapPoints: ['45%'],
			enablePanDownToClose: false,
		});
	};

	// Update "All fields" group in Storage to include the new field
	const updateFieldGroups = (newFieldId) => {
		return Storage.getItem(FIELD_GROUPS_STORAGE_KEY)
			.then(storedGroupsJson => {
				let groups = storedGroupsJson ? JSON.parse(storedGroupsJson) : [];

				// If there are no groups yet, create default "All fields" group
				if (groups.length === 0) {
					groups = [{
						name: 'All fields',
						fieldIds: [newFieldId],
						centroid: null
					}];
				} else {
					// Find the "All fields" group
					const allFieldsGroupIndex = groups.findIndex(g => g.name === 'All fields');

					if (allFieldsGroupIndex >= 0) {
						// Add the new field ID to the "All fields" group
						const allFieldsGroup = groups[allFieldsGroupIndex];
						if (!allFieldsGroup.fieldIds.includes(newFieldId)) {
							allFieldsGroup.fieldIds.push(newFieldId);

							// Update the centroid with all fields including the new one
							const allFieldsWithNew = farmData.fields.filter(field =>
								allFieldsGroup.fieldIds.includes(field._id) || field._id === newFieldId
							);

							allFieldsGroup.centroid = calculatePolygonsBounds(allFieldsWithNew);
							groups[allFieldsGroupIndex] = allFieldsGroup;
						}
					} else {
						// Create "All fields" group if it doesn't exist
						groups.unshift({
							name: 'All fields',
							fieldIds: [newFieldId],
							centroid: null
						});
					}
				}

				// Save updated groups
				return Storage.setItem(FIELD_GROUPS_STORAGE_KEY, JSON.stringify(groups));
			})
			.catch(err => {
				console.error('Error updating field groups:', err);
				// Continue even if field group update fails
				return Promise.resolve();
			});
	};

	const handleSaveField = (fieldId) => {
		// Get current points from map component
		const currentPoints = mapRef.current?.getCurrentPoints();

		if (!currentPoints || currentPoints.length < 3) {
			Alert.alert(
				"Invalid Field Shape",
				"Please draw a complete field shape with at least 3 points.",
				[{ text: "OK" }]
			);
			return;
		}

		if (!fields || fields.length === 0) {
			Alert.alert(
				"No Field Drawn",
				"Please complete drawing your field before saving.",
				[{ text: "OK" }]
			);
			return;
		}

		// Find the drawn field - there should be only one
		const drawnField = fields[0];

		if (!drawnField || !drawnField.points || drawnField.points.length < 3) {
			Alert.alert(
				"Invalid Field Shape",
				"Please draw a complete field shape with at least 3 points.",
				[{ text: "OK" }]
			);
			return;
		}

		setIsLoading(true);

		if (newField) {
			// For new fields, we need to generate a temporary ID to use in the Field screen
			const newFieldId = Date.now();

			// Save the field points and other data temporarily
			const newFieldData = {
				id: newFieldId,
				points: drawnField.points,
				color: drawnField.color
			};

			setIsLoading(false);

			// Navigate to Field screen to enter details for the new field
			navigation.navigate('Field', {
				forFirstSetup: true,
				polygonId: newFieldId,
				selectedFieldData: newFieldData
			});
		} else {
			// For existing fields, update the field points
			api(`${BASE_URL}/editFieldPoints?id=${fieldData.id}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',

				},
				body: JSON.stringify({
					points: drawnField.points
				})
			})
				.then(result => {
					setIsLoading(false);

					if (result.ok) {
						// Backend returns only the updated field object
						if (result.data) {
							console.log('[FieldRedrawScreen] Field points updated:', result.data.id);

							// Update farmData using selective spread
							setFarmData(prev => ({
								...prev,
								fields: (prev.fields || []).map(f =>
									f._id === result.data._id ? result.data : f
								)
							}));

							// Update field groups in Storage to reflect the changes
							updateFieldGroups(fieldData.id)
								.then(() => {
									// Navigate back immediately
									navigation.navigate('Main');

									// Show toast after navigation so it appears on TabHome
									setTimeout(() => {
										Toast.show({
											type: 'success',
											text1: t('success'),
											text2: t('successes.FIELD_UPDATED'),
											position: 'top',
											visibilityTime: 3000,
											topOffset: 60,
											autoHide: true
										});
									}, 100);
								});
						}
					} else {
						Alert.alert(
							"Error",
							"Failed to update field. Please try again.",
							[{ text: "OK" }]
						);
					}
				})
				.catch(error => {
					console.error('Error updating field points:', error);
					setIsLoading(false);
					Alert.alert(
						"Error",
						"An error occurred while saving the field.",
						[{ text: "OK" }]
					);
				});
		}
	};

	return (
		<View style={styles.container}>
			{/* Full-screen map */}
			<View style={styles.mapContainer}>
				<PlainMap
					ref={mapRef}
					valueSetter={setFields}
					fieldColor={fieldData?.color}
					fieldId={fieldData?.id}
					fieldBounds={fieldBounds}
					useGeolocation={true}
					onFinish={handleFinishDrawing}
				/>
			</View>

			{/* Floating title overlay */}
			<View style={[styles.titleContainer, { top: 60 }]}>
				<Text style={styles.titleText}>
					{newField ? "Draw New Field" : "Redraw Field Shape"}
				</Text>
				<Text style={styles.titleDesc}>
					{newField
						? "Draw the shape of your new field on the map"
						: "Use the map to draw a new shape for your field"}
				</Text>
			</View>

			{isLoading && (
				<View style={styles.loadingOverlay}>
					<ActivityIndicator size="large" color={colors.SECONDARY} />
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	mapContainer: {
		...StyleSheet.absoluteFillObject,
		flex: 1,
	},
	titleContainer: {
		position: 'absolute',
		// top: 16,
		left: 16,
		right: 16,
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: '#ffffff',
		borderRadius: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 5,
		zIndex: 10,
	},
	titleText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 24,
		color: colors.PRIMARY
	},
	titleDesc: {
		color: colors.PRIMARY_LIGHT,
		fontSize: 18,
		fontFamily: 'Geologica-Regular',
		// marginTop: 4,
	},
	loadingOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(255, 255, 255, 0.7)',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 200,
	},
	bottomSheetContent: {
		padding: 16,
		alignItems: 'center',
	},
	bottomSheetTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	bottomSheetText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 20,
		textAlign: 'center',
	}
});

export default FieldRedrawScreen;