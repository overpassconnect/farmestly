import React, { useState, useEffect } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Alert
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Yup from 'yup';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import ButtonStack from '../../ui/core/ButtonGroup';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useUnits } from '../../../providers/UnitsProvider';
import { Storage } from '../../../utils/storage';
import { calculatePolygonsBounds } from '../../setup/PolygonDrawingMap/utils';
import { FormikHelper, FormInput } from '../../ui/form';
import { useTranslation } from 'react-i18next';

// Storage key for field groups
const FIELD_GROUPS_STORAGE_KEY = '@FieldGroups';

// Validation schema
const validationSchema = (t) => Yup.object().shape({
	name: Yup.string()
		.required(t('validation:group.nameRequired'))
		.min(2, t('validation:group.nameMinLength'))
		.max(50, t('validation:group.nameMaxLength'))
});

const EditFieldGroupScreen = () => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const route = useRoute();
	const { farmData } = useGlobalContext();
	const { format } = useUnits();
	const { groupIndex, existingGroup } = route.params || {};
	const isEditing = groupIndex !== undefined;

	const [selectedFieldIds, setSelectedFieldIds] = useState([]);
	const [initialValues, setInitialValues] = useState({ name: '' });

	// Initialize with existing group data if editing
	useEffect(() => {
		if (isEditing && existingGroup) {
			setInitialValues({ name: existingGroup.name });
			setSelectedFieldIds(existingGroup.fieldIds || []);
		}
	}, [isEditing, existingGroup]);

	const handleSubmit = (values) => {
		// Validate that at least one field is selected
		if (selectedFieldIds.length === 0) {
			Alert.alert(t('screens:editFieldGroup.selectionRequired'), t('screens:editFieldGroup.selectionRequiredMessage'));
			return;
		}

		// Get the selected fields
		const groupFields = farmData.fields.filter(field => selectedFieldIds.includes(field._id));

		// Calculate centroid for the group
		const centroid = calculatePolygonsBounds(groupFields);

		// Create or update the group
		saveGroup({
			name: values.name,
			fieldIds: selectedFieldIds,
			centroid
		});
	};

	const saveGroup = async (groupData) => {
		try {
			// Load existing groups
			const storedGroupsJson = await Storage.getItem(FIELD_GROUPS_STORAGE_KEY);
			let groups = storedGroupsJson ? JSON.parse(storedGroupsJson) : [];

			if (isEditing) {
				// Update existing group
				groups[groupIndex] = groupData;
			} else {
				// Add new group
				groups.push(groupData);
			}

			// Save updated groups
			await Storage.setItem(FIELD_GROUPS_STORAGE_KEY, JSON.stringify(groups));

			// Go back to groups screen
			navigation.goBack();
		} catch (error) {
			console.error('Error saving field group:', error);
			Alert.alert(t('screens:editFieldGroup.error'), t('screens:editFieldGroup.saveFailed'));
		}
	};

	const handleDelete = async () => {
		if (!isEditing) return;

		Alert.alert(
			t('screens:editFieldGroup.deleteConfirmTitle'),
			t('screens:editFieldGroup.deleteConfirmMessage', { groupName: existingGroup.name }),
			[
				{ text: t('screens:editFieldGroup.cancel'), style: 'cancel' },
				{
					text: t('screens:editFieldGroup.deleteGroup'),
					style: 'destructive',
					onPress: async () => {
						try {
							const storedGroupsJson = await Storage.getItem(FIELD_GROUPS_STORAGE_KEY);
							let groups = storedGroupsJson ? JSON.parse(storedGroupsJson) : [];

							// Remove the group at the specified index
							groups.splice(groupIndex, 1);

							await Storage.setItem(FIELD_GROUPS_STORAGE_KEY, JSON.stringify(groups));
							navigation.goBack();
						} catch (error) {
							console.error('Error deleting field group:', error);
							Alert.alert(t('screens:editFieldGroup.error'), t('screens:editFieldGroup.deleteFailed'));
						}
					}
				}
			]
		);
	};

	const toggleFieldSelection = (fieldId) => {
		setSelectedFieldIds(prev => {
			if (prev.includes(fieldId)) {
				return prev.filter(id => id !== fieldId);
			} else {
				return [...prev, fieldId];
			}
		});
	};

	const renderFieldItem = ({ item: field }) => {
		const isSelected = selectedFieldIds.includes(field._id);
		return (
			<TouchableOpacity
				style={styles.fieldItem}
				onPress={() => toggleFieldSelection(field._id)}
			>
				<View style={styles.fieldItemContent}>
					<View style={styles.fieldInfo}>
						<Text style={styles.fieldName}>{field.name}</Text>
						<Text style={styles.fieldDetails}>
							{format(field.area, 'area')} • {field.farmingType || 'N/A'}
						</Text>
					</View>
					<View style={[
						styles.checkbox,
						isSelected && styles.checkboxSelected
					]}>
						{isSelected && <Text style={styles.checkmark}>✓</Text>}
					</View>
				</View>
			</TouchableOpacity>
		);
	};

	return (
		<KeyboardAwareScrollView
			style={styles.keyboardAvoid}
			contentContainerStyle={styles.container}
			bottomOffset={100}
			keyboardShouldPersistTaps="handled"
		>
			<FormikHelper
				initialValues={initialValues}
				validationSchema={validationSchema(t)}
				onSubmit={handleSubmit}
				enableReinitialize={true}
			>
				{({ handleSubmit, isValid }) => (
					<>
						<Text style={styles.title}>{isEditing ? t('screens:editFieldGroup.editTitle') : t('screens:editFieldGroup.createTitle')}</Text>

						<FormInput
							name="name"
							label={t('screens:editFieldGroup.groupName')}
							placeholder={t('screens:editFieldGroup.enterGroupName')}
							isLast={true}
						/>

						<View style={styles.fieldsSection}>
							<Text style={styles.fieldsSectionTitle}>{t('screens:editFieldGroup.selectFields')}</Text>

							{farmData.fields.map((field) => renderFieldItem({ item: field }))}
						</View>

						<ButtonStack>
							<PrimaryButton
								text={isEditing ? t('screens:editFieldGroup.saveChanges') : t('screens:editFieldGroup.createGroup')}
								onPress={handleSubmit}
								disabled={!isValid || selectedFieldIds.length === 0}
							/>

							<PrimaryButton
								variant="outline"
								text={t('screens:editFieldGroup.cancel')}
								onPress={() => navigation.goBack()}
							/>

							{isEditing && (
								<PrimaryButton
									variant="outline"
									text={t('screens:editFieldGroup.deleteGroup')}
									onPress={handleDelete}
								/>
							)}
						</ButtonStack>
					</>
				)}
			</FormikHelper>
		</KeyboardAwareScrollView>
	);
};

const styles = StyleSheet.create({
	keyboardAvoid: {
		flex: 1,
	},
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: 'white',
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		marginBottom: 20,
	},
	fieldsSection: {
		flex: 1,
		marginTop: 10,
		marginBottom: 20,
	},
	fieldsSectionTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 10,
	},
	fieldsList: {
		flex: 1,
	},
	fieldsListContent: {
		paddingBottom: 20,
	},
	fieldItem: {
		// backgroundColor: '#F6F6F6',
		borderRadius: 8,
		marginBottom: 8,
	},
	fieldItemContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 12,
	},
	fieldInfo: {
		flex: 1,
	},
	fieldName: {
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
		color: colors.PRIMARY,
	},
	fieldDetails: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
	},
	checkbox: {
		width: 24,
		height: 24,
		borderWidth: 2,
		borderColor: colors.PRIMARY,
		borderRadius: 4,
		alignItems: 'center',
		justifyContent: 'center',
		marginLeft: 10,
	},
	checkboxSelected: {
		backgroundColor: colors.SECONDARY_LIGHT,
	},
	checkmark: {
		color: colors.PRIMARY,
		fontSize: 14,
		fontWeight: 'bold',
	}
});

export default EditFieldGroupScreen;