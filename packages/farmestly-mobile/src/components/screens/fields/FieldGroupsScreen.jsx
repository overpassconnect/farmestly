import React, { useState, useEffect } from 'react';
import { api } from '../../../globals/api';
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Alert,
	ScrollView
} from 'react-native';
import { Storage } from '../../../utils/storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import ButtonStack from '../../ui/core/ButtonGroup';
import ListItem from '../../ui/list/ListItem';
import RadioButton from '../../ui/core/RadioButton';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useUnits } from '../../../providers/UnitsProvider';
import { calculatePolygonsBounds } from '../../setup/PolygonDrawingMap/utils';

// Storage keys
const FIELD_GROUPS_STORAGE_KEY = '@FieldGroups';
const SELECTED_GROUP_KEY = '@SelectedFieldGroup';

const FieldGroupsScreen = () => {
	const { farmData } = useGlobalContext();
	const navigation = useNavigation();
	const { format } = useUnits();
	const [fieldGroups, setFieldGroups] = useState([]);
	const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
	const fields = farmData?.fields || [];

	


	// Force refresh groups whenever fields change
	useEffect(() => {
		if (fields.length > 0) {
			forceRefreshGroups();
		}
	}, [fields]);

	// Load field groups and selected group on component mount and focus
	useFocusEffect(
		React.useCallback(() => {
			loadFieldGroups();
			loadSelectedGroup();
			return () => { };
		}, [])
	);

	// Force a complete refresh of all field groups
	const forceRefreshGroups = () => {
		recreateAllFieldsGroup()
			.then(groups => {
				if (groups) {
					setFieldGroups(groups);
				}
			});
	};

	// Recreate the "All fields" group
	const recreateAllFieldsGroup = () => {
		return Storage.getItem(FIELD_GROUPS_STORAGE_KEY)
			.then(storedGroupsJson => {
				let groups = storedGroupsJson ? JSON.parse(storedGroupsJson) : [];

				// Get current field IDs directly from farmData
				const currentFieldIds = fields.map(field => field._id);

				// Find or create the "All fields" group
				const allFieldsGroupIndex = groups.findIndex(g => g.name === 'All fields');

				if (allFieldsGroupIndex >= 0) {
					// Update the existing "All fields" group
					groups[allFieldsGroupIndex] = {
						...groups[allFieldsGroupIndex],
						name: 'All fields',
						fieldIds: currentFieldIds,
						centroid: fields.length > 0 ? calculatePolygonsBounds(fields) : null
					};
				} else {
					// Create a new "All fields" group
					const allFieldsGroup = {
						name: 'All fields',
						fieldIds: currentFieldIds,
						centroid: fields.length > 0 ? calculatePolygonsBounds(fields) : null
					};
					groups = [allFieldsGroup, ...groups];
				}

				// Save the updated groups
				return Storage.setItem(FIELD_GROUPS_STORAGE_KEY, JSON.stringify(groups))
					.then(() => groups);
			})
			.catch(error => {
				console.error('Error recreating All fields group:', error);
				return null;
			});
	};

	// Load field groups
	const loadFieldGroups = () => {
		recreateAllFieldsGroup()
			.then(groups => {
				if (groups) {
					setFieldGroups(groups);
				}
			})
			.catch(error => {
				console.error('Error loading field groups:', error);
			});
	};

	// Load selected group index
	const loadSelectedGroup = () => {
		Storage.getItem(SELECTED_GROUP_KEY)
			.then(selectedIndex => {
				if (selectedIndex !== null) {
					setSelectedGroupIndex(parseInt(selectedIndex));
				}
			})
			.catch(error => {
				console.error('Error loading selected group:', error);
			});
	};

	// Handle selecting a group
	const handleSelectGroup = (index) => {
		setSelectedGroupIndex(index);
		Storage.setItem(SELECTED_GROUP_KEY, index.toString())
			.catch(error => {
				console.error('Error saving selected group:', error);
			});
	};

	// Handle editing a group
	const handleEditGroup = (group, index) => {
		// Don't allow editing the "All fields" default group
		if (index === 0 && group.name === 'All fields') {
			Alert.alert(
				'Default Group',
				'The "All fields" group cannot be edited.',
				[{ text: 'OK' }]
			);
			return;
		}

		navigation.navigate('EditFieldGroupScreen', {
			groupIndex: index,
			existingGroup: group
		});
	};

	// Handle adding a new group
	const handleAddGroup = () => {
		navigation.navigate('EditFieldGroupScreen');
	};

	// Handle adding a new field
	const handleAddField = () => {
		navigation.navigate('FieldRedrawScreen', {
			newField: true
		});
	};

	// Get fields for a group
	const getFieldsForGroup = (fieldIds) => {
		if (!fieldIds || !Array.isArray(fieldIds)) {
			return [];
		}
		return fields.filter(field => fieldIds.includes(field._id));
	};

	// Render each group item
	const renderGroupItem = ({ item: group, index }) => (
		<View style={styles.groupContainer} key={`group-${index}`}>
			<RadioButton
				label={group.name}
				selected={selectedGroupIndex === index}
				onPress={() => handleSelectGroup(index)}
				onLongPress={() => handleEditGroup(group, index)}
				style={styles.groupHeader}
			/>

			{/* Only show field list for groups other than "All fields" */}
			{index !== 0 && group.fieldIds && group.fieldIds.length > 0 && (
				<View style={styles.fieldListContainer}>
						{getFieldsForGroup(group.fieldIds).slice(0, 3).map(field => (
							<View key={`field-${field._id}`} style={styles.fieldItem}>
								<ListItem
									icon={require('../../../assets/icons/field.png')}
									title={field.name}
									subTitle1={`${format(field.area, 'area')} • ${field.farmingType || 'N/A'}`}
									subTitle2={field.currentCultivation ?
										`Current crop: ${field.currentCultivation.crop}` :
										'No active cultivation'
									}
									showChevron={false}
								/>
							</View>
						))}
				</View>
			)}
		</View>
	);

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
			<Text style={styles.title}>Field Groups</Text>

			{/* Add New Field Section */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Add New Field</Text>
				<Text style={styles.sectionDescription}>
					Draw a new field on the map to add it to your farm.
				</Text>
				<PrimaryButton
					text="+ Add New Field"
					onPress={handleAddField}
					fullWidth
				/>
			</View>

			{/* Select Default View Section */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Select Default View</Text>
				<Text style={styles.sectionDescription}>
					Choose which field group to display when you open the app. Long-press any group to edit it.
				</Text>

				{fieldGroups.length === 0 ? (
					<Text style={styles.emptyText}>No field groups yet.</Text>
				) : (
					fieldGroups.map((group, index) => renderGroupItem({ item: group, index }))
				)}
			</View>

			{/* Manage Groups Section */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Manage Groups</Text>
				<Text style={styles.sectionDescription}>
					Create custom field groups to organize your fields by location or type for easier map viewing.
				</Text>
				<ButtonStack>
					<PrimaryButton
						text="+ Add Group"
						onPress={handleAddGroup}
						fullWidth
					/>

					<PrimaryButton
						text="Back"
						variant="outline"
						onPress={() => navigation.goBack()}
						fullWidth
					/>
				</ButtonStack>
			</View>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	contentContainer: {
		padding: 24,
		paddingBottom: 50,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		marginBottom: 24,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	sectionDescription: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 12,
		lineHeight: 20,
	},
	groupContainer: {
		marginBottom: 15,
	},
	groupHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 15,
		paddingHorizontal: 15,
	},
	groupNameContainer: {
		flex: 1,
	},
	groupName: {
		fontFamily: 'Geologica-Bold',
		fontSize: 22,
		color: colors.PRIMARY,
	},
	radioButtonContainer: {
		marginLeft: 15,
	},
	radioButton: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: colors.PRIMARY,
		alignItems: 'center',
		justifyContent: 'center',
	},
	radioButtonSelected: {
		width: 14,
		height: 14,
		borderRadius: 7,
		backgroundColor: colors.PRIMARY,
	},
	fieldListContainer: {
		marginTop: 8,
	},
	fieldItem: {

	},
	emptyText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginTop: 12,
		marginBottom: 12,
	},
});

export default FieldGroupsScreen;