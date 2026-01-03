import React, { useState, useEffect, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { View, StyleSheet, Dimensions, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/core';
import { useTranslation } from 'react-i18next';
import { Storage } from '../utils/storage';

import colors from './../globals/colors';
import PrimaryButton from './ui/core/PrimaryButton';
import { ButtonStack } from './ui/core/ButtonGroup';
import config from '../globals/config';
import { useGlobalContext } from './context/GlobalContextProvider';
import ListItem from './ui/list/ListItem';
import { calculatePolygonsBounds } from './setup/PolygonDrawingMap/utils';

// Import our form helpers
import { FormikHelper, FormInput, FormDropdown } from './ui/form';

const BASE_URL = config.BASE_URL;
const { width } = Dimensions.get('screen');
const FIELD_GROUPS_STORAGE_KEY = '@FieldGroups';
const SELECTED_GROUP_KEY = '@SelectedFieldGroup';

// Define farming types - keeping original structure, will translate inside component
const farmingTypes = [
	{
		id: 'CONVENTIONAL',
		label: 'Conventional',
		image: require('../assets/icons/field_conventional.png'),
		subTitle: "For conventional farming"
	},
	{
		id: 'INTEGRATED',
		label: 'Integrated',
		image: require('../assets/icons/field_integrated.png'),
		subTitle: "For integrated farming"
	},
	{
		id: 'ORGANIC',
		label: 'Organic',
		image: require('../assets/icons/field_organic.png'),
		subTitle: "For organic farming"
	}
];

const Field = () => {
	const { t } = useTranslation(['screens', 'common', 'validation', 'alerts']);
	const route = useRoute();
	const { farmData, setFarmData, tmpFirstSetup, setTmpFirstSetup, } = useGlobalContext();
	const navigation = useNavigation();
	const { api } = useApi();
	const { forFirstSetup, polygonId, selectedFieldData } = route.params;
	const [isLoading, setIsLoading] = useState(false);

	// Create translated farming types using useMemo to avoid recreation on every render
	const translatedFarmingTypes = useMemo(() => [
		{
			_id: 'CONVENTIONAL',
			label: t('common:farmingTypes.conventional.label'),
			image: require('../assets/icons/field_conventional.png'),
			subTitle: t('common:farmingTypes.conventional.subTitle')
		},
		{
			_id: 'INTEGRATED',
			label: t('common:farmingTypes.integrated.label'),
			image: require('../assets/icons/field_integrated.png'),
			subTitle: t('common:farmingTypes.integrated.subTitle')
		},
		{
			_id: 'ORGANIC',
			label: t('common:farmingTypes.organic.label'),
			image: require('../assets/icons/field_organic.png'),
			subTitle: t('common:farmingTypes.organic.subTitle')
		}
	], [t]);

	// Determine initial values with proper fallbacks for editing existing fields
	const initialValues = {
		fieldName: forFirstSetup
			? tmpFirstSetup[polygonId]?.fieldName || ''
			: selectedFieldData?.name || '',
		fieldLegalNumber: forFirstSetup
			? tmpFirstSetup[polygonId]?.fieldLegalNumber || ''
			: selectedFieldData?.fieldLegalNumber || '',
		farmingType: forFirstSetup
			? tmpFirstSetup[polygonId]?.farmingType || null
			: selectedFieldData?.farmingType || null
	};

	// Store previous state for cancel operation
	const [prevState, setPrevState] = useState(
		forFirstSetup ? JSON.parse(JSON.stringify(tmpFirstSetup)) : null
	);

	// Update field groups in Storage with new field or updated bounds
	const updateFieldGroups = (fieldId) => {
		return Storage.getItem(FIELD_GROUPS_STORAGE_KEY)
			.then(storedGroupsJson => {
				let groups = [];
				if (storedGroupsJson) {
					groups = JSON.parse(storedGroupsJson);
				}

				// Update or create "All fields" group
				let allFieldsGroup = groups.find(group => group.name === 'All fields');
				if (!allFieldsGroup) {
					allFieldsGroup = {
						name: 'All fields',
						fieldIds: [],
						centroid: null
					};
					groups.push(allFieldsGroup);
				}

				// Add this field to "All fields" group if not already present
				if (!allFieldsGroup.fieldIds.includes(fieldId)) {
					allFieldsGroup.fieldIds.push(fieldId);
				}

				// Update centroid for "All fields" group using all fields from farmData
				if (farmData && farmData.fields && farmData.fields.length > 0) {
					allFieldsGroup.centroid = calculatePolygonsBounds(farmData.fields);
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

	const handleSubmit = async (values) => {
		setIsLoading(true);

		if (forFirstSetup) {
			// Update tmpFirstSetup context
			let tmp = JSON.parse(JSON.stringify(tmpFirstSetup));
			tmp[polygonId] = {
				fieldName: values.fieldName,
				farmingType: values.farmingType,
				fieldLegalNumber: values.fieldLegalNumber
			};
			setTmpFirstSetup(tmp);

			// Check if this is a new field created from FieldGroupsScreen
			if (selectedFieldData && selectedFieldData.points) {
				// This is a new field with points from FieldRedrawScreen
				// Use the dedicated addField endpoint
				const result = await api(`${BASE_URL}/addField`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						id: polygonId,
						fieldName: values.fieldName,
						points: selectedFieldData.points,
						color: selectedFieldData.color,
						farmingType: values.farmingType,
						fieldLegalNumber: values.fieldLegalNumber
					})
				});

				setIsLoading(false);

				if (result.ok) {
					// Backend returns only the new field object
					if (result.data) {
						console.log('[Field] New field added:', result.data.id);

						// Update farmData using selective spread
						setFarmData(prev => ({
							...prev,
							fields: [...(prev.fields || []), result.data]
						}));

						// Update field groups to include the new field
						try {
							await updateFieldGroups(polygonId);
							navigation.navigate('Main');
						} catch (error) {
							console.error('Error updating field groups:', error);
							navigation.navigate('Main');
						}
					} else {
						navigation.navigate('Main');
					}
				}
			} else {
				// Standard first setup field
				setIsLoading(false);
				navigation.goBack();
			}
		} else {
			// Save to backend with all form values
			const result = await api(`${BASE_URL}/editField?id=${polygonId}`, {
				method: 'POST',
				body: JSON.stringify({
					'fieldName': values.fieldName,
					'fieldLegalNumber': values.fieldLegalNumber,
					'farmingType': values.farmingType
				}),
				headers: {
					'Content-Type': 'application/json',
				}
			});

			setIsLoading(false);

			if (result.ok) {
				// Backend returns only the updated field object
				if (result.data) {
					console.log('[Field] Field updated:', result.data.id);

					// Update farmData using selective spread
					setFarmData(prev => ({
						...prev,
						fields: (prev.fields || []).map(f =>
							f._id === result.data._id ? result.data : f
						)
					}));

					// Update field groups
					try {
						await updateFieldGroups(polygonId);
						navigation.navigate('Main');
					} catch (error) {
						console.error('Error updating field groups:', error);
						navigation.navigate('Main');
					}
				} else {
					navigation.navigate('Main');
				}
			}
		}
	};

	const handleCancel = () => {
		if (forFirstSetup && prevState) {
			setTmpFirstSetup(prevState);
		}
		navigation.goBack();
	};

	// Function to find farming type object from _id
	const getFarmingTypeObject = (farmingTypeId) => {
		if (!farmingTypeId) return null;
		return translatedFarmingTypes.find(type => type._id === farmingTypeId);
	};

	const handleRedrawField = () => {
		navigation.navigate('FieldRedrawScreen', {
			fieldData: selectedFieldData
		});
	};

	return (
		<View style={styles.wizardPageContainer}>
			<ScrollView bounces={false} bouncesZoom={false}>
				<View style={styles.titleContainer}>
					{forFirstSetup ? (
						<Text style={styles.titleText}>{t('screens:field.newFieldTitle')}</Text>
					) : (
						<Text style={styles.titleText}>{t('screens:field.editFieldTitle')} <Text style={styles.titleTextHighlighted}>{selectedFieldData?.name || 'Field'}: </Text></Text>
					)}
				</View>

				<Text style={[styles.titleDesc, { marginTop: -15, marginBottom: 15 }]}>
					{t('screens:field.addFieldDetails')}
				</Text>

				{!forFirstSetup && (
					<TouchableOpacity onPress={handleRedrawField}>
						<ListItem
							icon={require('../assets/icons/field.png')}
							title={t('screens:field.redrawFieldShape')}
							subTitle1={t('screens:field.editGeometry')}
							showChevron={true}
						/>
					</TouchableOpacity>
				)}

				<FormikHelper
					initialValues={initialValues}
					onSubmit={handleSubmit}
					enableReinitialize={true}
				>
					{({ values, setFieldValue, handleSubmit }) => (
						<>
							<FormInput
								name="fieldName"
								label={t('common:labels.fieldName')}
								description={t('screens:field.fieldNameDescription')}
								placeholder={t('common:placeholders.fieldNameExample')}
							/>

							<FormInput
								name="fieldLegalNumber"
								label={t('common:labels.fieldLegalNumber')}
								description={t('screens:field.fieldLegalNumberDescription')}
								placeholder={t('common:placeholders.fieldLegalNumberExample')}
								keyboardType="numeric"
							/>

							<FormDropdown
								name="farmingType"
								label={t('common:labels.farmingType')}
								description={t('screens:field.farmingTypeDescription')}
								items={translatedFarmingTypes}
								value={getFarmingTypeObject(values.farmingType)}
								onSelect={item => {
									setFieldValue('farmingType', item._id);
								}}
								renderItem={(item, isItemSelected) => (
									<ListItem
										icon={item.image}
										subTitle1={item.subTitle}
										title={item.label}
										simple={true}
										showChevron={false}
										showRadio={true}
										isSelected={isItemSelected}
									/>
								)}
								keyExtractor={item => item._id}
								labelExtractor={item => item.label}
								searchKeys={['label']}
								bottomSheetProps={{
									snapPoints: ['50%', '100%'],
									enablePanDownToClose: true
								}}
								isLast={true}
							/>

						<ButtonStack>
							<PrimaryButton
								text={t('common:buttons.save')}
								onPress={handleSubmit}
								loading={isLoading}
								fullWidth
							/>
							<PrimaryButton
								variant="outline"
								text={t('common:buttons.cancel')}
								onPress={handleCancel}
								disabled={isLoading}
								fullWidth
							/>
						</ButtonStack>
						</>
					)}
				</FormikHelper>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	wizardPageContainer: {
		width: width,
		padding: 34
	},
	titleContainer: {
		marginBottom: 10,
	},
	titleText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 28,
		color: colors.PRIMARY
	},
	titleTextHighlighted: {
		color: colors.SECONDARY
	},
	titleDesc: {
		color: colors.PRIMARY_LIGHT,
		fontSize: 19,
		fontFamily: 'Geologica-Regular'
	},
	monospaced: {
		fontFamily: 'RobotoMono-Regular'
	},
});

export default Field;