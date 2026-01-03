import React, { useState, useEffect, useMemo } from 'react';
import { useApi } from '../../../hooks/useApi';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator, Platform, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/core';
import { useTranslation } from 'react-i18next';

import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import config from '../../../globals/config';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import ListItem from '../../ui/list/ListItem';
import ButtonStack from '../../ui/core/ButtonGroup';
// Import Formik helpers
import { FormikHelper, FormInput, FormDropdown, formStyles } from '../../ui/form';
import { useUnits } from '../../../providers/UnitsProvider';
import OptionPicker from '../../ui/core/OptionPicker';
import SearchableListSheet from '../../ui/list/SearchableListSheet';

const BASE_URL = config.BASE_URL;
const { width } = Dimensions.get('screen');


const EditEntityScreen = () => {
	const route = useRoute();
	const { t } = useTranslation(['common', 'validation']);
	const { farmData, setFarmData, isOffline } = useGlobalContext();
	const navigation = useNavigation();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const { api } = useApi();
	const [isLoading, setIsLoading] = useState(false);
	const { parseRate, formatRateValue, parseProductRate, formatProductRateValue, rateSymbol, symbol, parse, formatValue } = useUnits();


	// Extract entity type and data from route params
	const { entityType, entity, isAdding = false, usedFor: presetUsedFor } = route.params || {};

	// Determine endpoints based on entity type
	const getEndpoints = () => {
		switch (entityType) {
			case 'machine':
				return {
					add: '/machine/add',
					update: '/machine/update',
					delete: '/machine/delete'
				};
			case 'attachment':
				return {
					add: '/attachment/add',
					update: '/attachment/update',
					delete: '/attachment/delete'
				};
			case 'tool':
				return {
					add: '/tool/add',
					update: '/tool/update',
					delete: '/tool/delete'
				};
			case 'product':
				return {
					add: '/product/add',
					update: '/product/update',
					delete: '/product/delete'
				};
			case 'jobTemplate':
				return {
					add: '/jobTemplate',
					update: '/jobTemplate',  // Will append /:id in handler
					delete: '/jobTemplate'   // Will append /:id in handler
				};
			default:
				return { add: '', update: '', delete: '' };
		}
	};


	// Get entity-specific details
	const getEntityDetails = () => {
		if (isAdding) {
			switch (entityType) {
				case 'machine':
					return {
						title: 'Add a Machine',
						subtitle: 'This machine will be used in future jobs.'
					};
				case 'attachment':
					return {
						title: 'Add an Attachment',
						subtitle: 'This attachment will be used in future jobs.'
					};
				case 'tool':
					return {
						title: 'Add a Tool',
						subtitle: 'This tool will be used in future jobs.'
					};
				case 'product':
					return {
						title: 'Add a Product',
						subtitle: 'This product can be used in spray jobs.'
					};
				case 'jobTemplate':
					return {
						title: 'Add a Job',
						subtitle: 'You can use this job to record your work at the farm'
					};
				default:
					return { title: 'Add', subtitle: '' };
			}
		} else {
			switch (entityType) {
				case 'machine':
					return {
						title: 'Edit Machine',
						subtitle: 'Update your machine information.'
					};
				case 'attachment':
					return {
						title: 'Edit Attachment',
						subtitle: 'Update your attachment information.'
					};
				case 'tool':
					return {
						title: 'Edit Tool',
						subtitle: 'Update your tool information.'
					};
				case 'product':
					return {
						title: 'Edit Product',
						subtitle: 'Update product information.'
					};
				case 'jobTemplate':
					return {
						title: 'Edit Job Template',
						subtitle: 'Update your job template information.'
					};
				default:
					return { title: 'Edit', subtitle: '' };
			}
		}
	};

	// Set up initial values based on entity type
	const getInitialValues = () => {
		if (isAdding) {
			// Default values for new entities
			switch (entityType) {
				case 'machine':
					return {
						name: '',
						make: '',
						licenceNo: '',
						powerOnTime: '',
						tankCapacity: '',
						boomWidth: '',
						defaultCarrierRate: '',
						notes: ''
					};
				case 'attachment':
					return {
						name: '',
						make: '',
						type: '',
						powerOnTime: '',
						// 'usedFor' can be 'spray' | 'irrigate' or '' (not used)
						// Pre-fill from route params if provided (from wizard)
						usedFor: presetUsedFor || '',
						litersPerHour: '',
						tankCapacity: '',
						boomWidth: '',
						defaultCarrierRate: '',
						notes: ''
					};
				case 'tool':
					return {
						name: '',
						type: '',
						brand: '',
						model: '',
						powerOnTime: '',
						notes: ''
					};
				case 'product':
					return {
						name: '',
						type: '',
						activeIngredient: '',
						defaultRate: '',
						isVolume: true, // default to liquid
						rei: '',
						phi: '',
						notes: ''
					};
				case 'jobTemplate':
					return {
						name: '',
						machine: null,
						attachment: null,
						tool: null
					};
				default:
					return {};
			}
		} else {
			// Existing values for editing
			switch (entityType) {
				case 'machine':
					return {
						name: entity.name || '',
						make: entity.make || '',
						licenceNo: entity.licenceNo || '',
						powerOnTime: entity.powerOnTime ? formatValue(entity.powerOnTime, 'time')?.toString() : '',
						tankCapacity: entity.tankCapacity ? formatValue(entity.tankCapacity, 'volume')?.toString() : '',
						boomWidth: entity.boomWidth ? formatValue(entity.boomWidth, 'length')?.toString() : '',
						defaultCarrierRate: entity.defaultCarrierRate ? formatRateValue(entity.defaultCarrierRate)?.toString() : '',
						notes: entity.notes || ''
					};
				case 'attachment':
					return {
						name: entity.name || '',
						make: entity.make || '',
						type: entity.type || '',
						powerOnTime: entity.powerOnTime ? formatValue(entity.powerOnTime, 'time')?.toString() : '',
						usedFor: entity.usedFor || (entity.usedInSpraying ? 'spray' : '') || '',
						litersPerHour: entity.litersPerHour ? formatValue(entity.litersPerHour, 'volume')?.toString() : '',
						tankCapacity: entity.tankCapacity ? formatValue(entity.tankCapacity, 'volume')?.toString() : '',
						boomWidth: entity.boomWidth ? formatValue(entity.boomWidth, 'length')?.toString() : '',
						defaultCarrierRate: entity.defaultCarrierRate ? formatRateValue(entity.defaultCarrierRate)?.toString() : '',
						notes: entity.notes || ''
					};
				case 'tool':
					return {
						name: entity.name || '',
						type: entity.type || '',
						brand: entity.brand || '',
						model: entity.model || '',
						powerOnTime: entity.powerOnTime ? formatValue(entity.powerOnTime, 'time')?.toString() : '',
						notes: entity.notes || ''
					};
				case 'product':
					return {
						name: entity.name || '',
						type: entity.type || '',
						activeIngredient: entity.activeIngredient || '',
						defaultRate: entity.defaultRate ? formatProductRateValue(entity.defaultRate, entity.isVolume)?.toString() : '',
						isVolume: entity.isVolume ?? true, // default to liquid
						rei: entity.rei ? entity.rei.toString() : '',
						phi: entity.phi ? entity.phi.toString() : '',
						notes: entity.notes || ''
					};
				case 'jobTemplate':
					return {
						name: entity.name || '',
						// Support both old (machine) and new (machineId) field names
						machine: entity.machine || entity.machineId || null,
						attachment: entity.attachment || entity.attachmentId || null,
						tool: entity.tool || entity.toolId || null
					};
				default:
					return {};
			}
		}
	};

	const { title, subtitle } = getEntityDetails();
	const endpoints = getEndpoints();
	const initialValues = getInitialValues();

	// Save built-in template locally - this doesn't require server sync
	const saveBuiltInTemplateToLocalFarmData = (template) => {
		try {
			// Create a deep copy of farmData to modify
			const updatedFarmData = JSON.parse(JSON.stringify(farmData || {}));

			// Ensure jobTemplates array exists
			if (!updatedFarmData.jobTemplates) {
				updatedFarmData.jobTemplates = [];
			}

			// Check if the built-in template already exists in jobTemplates
			const existingTemplateIndex = updatedFarmData.jobTemplates.findIndex(
				t => t._id === template._id
			);

			if (existingTemplateIndex >= 0) {
				// Update existing template
				updatedFarmData.jobTemplates[existingTemplateIndex] = template;
			} else {
				// Add as new template
				updatedFarmData.jobTemplates.push(template);
			}

			// Update farm data in context
			setFarmData(updatedFarmData);
			return true;
		} catch (error) {
			console.error('Error updating local farmData:', error);
			return false;
		}
	};

	// Handle entity deletion
	const handleDelete = async () => {
		if (!entity || !entity._id) {
			console.error('[EditEntityScreen] Cannot delete: entity or entity._id is missing');
			return;
		}

		const entityName = entityType.charAt(0).toUpperCase() + entityType.slice(1);

		// Show confirmation alert
		if (Platform.OS === 'web') {
			const confirmed = window.confirm(`Are you sure you want to delete this ${entityType}?`);
			if (!confirmed) return;
		} else {
			const { Alert } = require('react-native');
			Alert.alert(
				`Delete ${entityName}?`,
				`Are you sure you want to delete this ${entityType}? This action cannot be undone.`,
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Delete',
						style: 'destructive',
						onPress: async () => {
							await performDelete();
						}
					}
				]
			);
			return;
		}

		await performDelete();
	};

	const performDelete = async () => {
		setIsLoading(true);

		try {
			const endpoint = endpoints.delete;
			let url;
			let options = {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' }
			};

			// Different handling for different entity types
			if (entityType === 'jobTemplate') {
				// jobTemplate uses URL param
				url = `${BASE_URL}${endpoint}/${entity._id}`;
			} else {
				// machine, attachment, tool, product use query param
				url = `${BASE_URL}${endpoint}?_id=${entity._id}`;
			}

			const result = await api(url, options);

			if (result.ok) {
				console.log(`[EditEntityScreen] ${entityType} deleted successfully`);

				// Backend returns { deleted: id } for the deleted entity (MongoDB _id)
				// Update farmData by removing the deleted entity
				const deletedId = result.data?.deleted || entity._id || entity.id;

				if (entityType === 'machine') {
					setFarmData(prev => ({
						...prev,
						machines: (prev.machines || []).filter(m => m._id !== deletedId)
					}));
				} else if (entityType === 'attachment') {
					setFarmData(prev => ({
						...prev,
						attachments: (prev.attachments || []).filter(a => a._id !== deletedId)
					}));
				} else if (entityType === 'tool') {
					setFarmData(prev => ({
						...prev,
						tools: (prev.tools || []).filter(t => t._id !== deletedId)
					}));
				} else if (entityType === 'product') {
					setFarmData(prev => ({
						...prev,
						products: (prev.products || []).filter(p => p._id !== deletedId)
					}));
				} else if (entityType === 'jobTemplate') {
					setFarmData(prev => ({
						...prev,
						jobTemplates: (prev.jobTemplates || []).filter(t =>
							t._id !== deletedId
						)
					}));
				}

				navigation.navigate('Main');
			} else {
				console.error('[EditEntityScreen] Delete failed:', result);
				if (Platform.OS !== 'web') {
					const { Alert } = require('react-native');
					Alert.alert('Error', 'Failed to delete. Please try again.');
				}
			}
		} catch (error) {
			console.error('[EditEntityScreen] Delete error:', error);
			if (Platform.OS !== 'web') {
				const { Alert } = require('react-native');
				Alert.alert('Error', 'An error occurred while deleting.');
			}
		} finally {
			setIsLoading(false);
		}
	};

	// Handle form submission
	const handleSubmit = async (values, formikBag) => {
		setIsLoading(true);

		const payload = { ...values };

		// For updates, include _id (backend expects _id, not id)
		if (!isAdding) {
			payload._id = entity._id;
		}

		// Parse powerOnTime for machines, attachments, and tools (convert hours to seconds)
		if ((entityType === 'machine' || entityType === 'attachment' || entityType === 'tool')) {
			if (payload.powerOnTime !== undefined && payload.powerOnTime !== '') {
				payload.powerOnTime = parse(payload.powerOnTime, 'time') ?? 0;
			} else {
				payload.powerOnTime = 0;
			}
		}

		// Handle sprayer fields for machines and attachments
		if (entityType === 'machine' || entityType === 'attachment') {
			// Parse tankCapacity - convert from user's volume unit to L
			if (payload.tankCapacity) {
				payload.tankCapacity = parse(payload.tankCapacity, 'volume');
			} else {
				payload.tankCapacity = undefined;
			}

			// Parse boomWidth - convert from user's length unit to m
			if (payload.boomWidth) {
				payload.boomWidth = parse(payload.boomWidth, 'length');
			} else {
				payload.boomWidth = undefined;
			}

			// Parse defaultCarrierRate - CONVERT TO BASE UNITS
			if (payload.defaultCarrierRate) {
				payload.defaultCarrierRate = parseRate(payload.defaultCarrierRate);  // Convert to L/m²
			} else {
				payload.defaultCarrierRate = undefined;
			}

			// Parse litersPerHour (for irrigation attachments) - convert from user's volume unit to L
			if (payload.litersPerHour) {
				payload.litersPerHour = parse(payload.litersPerHour, 'volume');
			} else {
				payload.litersPerHour = undefined;
			}

			// usedInSpraying is deprecated - removed in favor of usedFor
		}

		// Handle product numeric fields
		if (entityType === 'product') {
			// Parse defaultRate - convert from display units to base units (L/m² or kg/m²)
			if (payload.defaultRate) {
				payload.defaultRate = parseProductRate(payload.defaultRate, payload.isVolume);
			} else {
				payload.defaultRate = undefined;
			}

			// Remove old field if present
			delete payload.defaultRateUnit;

			// Parse REI (hours)
			if (payload.rei) {
				const reiValue = parseInt(payload.rei);
				payload.rei = !isNaN(reiValue) ? reiValue : undefined;
			} else {
				payload.rei = undefined;
			}

			// Parse PHI (days)
			if (payload.phi) {
				const phiValue = parseInt(payload.phi);
				payload.phi = !isNaN(phiValue) ? phiValue : undefined;
			} else {
				payload.phi = undefined;
			}
		}

		// Transform jobTemplate payload to match new API schema
		if (entityType === 'jobTemplate') {
			// Rename fields: machine -> machineId, attachment -> attachmentId, tool -> toolId
			const transformedPayload = {
				type: payload.type || 'custom',
				name: payload.name,
				machineId: payload.machine || null,
				attachmentId: payload.attachment || null,
				toolId: payload.tool || null
			};

			// Replace payload with transformed version
			Object.keys(payload).forEach(key => delete payload[key]);
			Object.assign(payload, transformedPayload);
		}

		// For jobTemplate updates, append /:id to endpoint
		let endpoint = isAdding ? endpoints.add : endpoints.update;
		if (entityType === 'jobTemplate' && !isAdding) {
			endpoint = `${endpoints.update}/${entity._id || entity.id}`;
		}

		const result = await api(`${BASE_URL}${endpoint}`, {
			method: isAdding ? 'POST' : (entityType === 'jobTemplate' ? 'PUT' : 'POST'),
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (result.ok) {
			// Backend now returns only the created/updated entity, not full farmData
			// We need to optimistically update farmData ourselves

			if (entityType === 'jobTemplate') {
				if (isAdding && result.data?._id) {
					// Adding new template - optimistically update farmData
					console.log('[EditEntityScreen] Adding new template:', result.data._id);
					const newTemplate = {
						...result.data,
					};
					setFarmData(prev => ({
						...prev,
						jobTemplates: [...(prev.jobTemplates || []), newTemplate]
					}));
					console.log('[EditEntityScreen] Template added successfully');
				} else if (!isAdding && result.data?._id) {
					// Updating existing template - replace it
					console.log('[EditEntityScreen] Updating template:', result.data._id);
					const updatedTemplate = {
						...result.data,
						id: result.data._id  // Map _id to id
					};
					setFarmData(prev => ({
						...prev,
						jobTemplates: (prev.jobTemplates || []).map(t =>
							(t._id === result.data._id || t.id === result.data._id)
								? updatedTemplate
								: t
						)
					}));
					console.log('[EditEntityScreen] Template updated successfully');
				}
			} else if (entityType === 'product') {
				// Backend returns only the product object with _id
				console.log(`[EditEntityScreen] Product ${isAdding ? 'added' : 'updated'} successfully`);
				console.log('[EditEntityScreen] Product data:', result.data);

				setFarmData(prev => {
					if (isAdding) {
						console.log('[EditEntityScreen] Adding new product:', result.data._id);
						return {
							...prev,
							products: [...(prev.products || []), result.data]
						};
					} else {
						console.log('[EditEntityScreen] Updating product:', result.data._id);
						return {
							...prev,
							products: (prev.products || []).map(p =>
								p._id === result.data._id ? result.data : p
							)
						};
					}
				});
			} else if (entityType === 'machine') {
				// Backend returns only the machine object with _id
				console.log(`[EditEntityScreen] Machine ${isAdding ? 'added' : 'updated'} successfully`);

				setFarmData(prev => {
					if (isAdding) {
						console.log('[EditEntityScreen] Adding new machine:', result.data._id);
						return {
							...prev,
							machines: [...(prev.machines || []), result.data]
						};
					} else {
						console.log('[EditEntityScreen] Updating existing machine:', result.data._id);
						return {
							...prev,
							machines: (prev.machines || []).map(m =>
								m._id === result.data._id ? result.data : m
							)
						};
					}
				});
			} else if (entityType === 'attachment') {
				// Backend returns only the attachment object with _id
				console.log(`[EditEntityScreen] Attachment ${isAdding ? 'added' : 'updated'} successfully`);

				setFarmData(prev => {
					if (isAdding) {
						console.log('[EditEntityScreen] Adding new attachment:', result.data._id);
						return {
							...prev,
							attachments: [...(prev.attachments || []), result.data]
						};
					} else {
						console.log('[EditEntityScreen] Updating existing attachment:', result.data._id);
						return {
							...prev,
							attachments: (prev.attachments || []).map(a =>
								a._id === result.data._id ? result.data : a
							)
						};
					}
				});
			} else if (entityType === 'tool') {
				// Backend returns only the tool object with _id
				console.log(`[EditEntityScreen] Tool ${isAdding ? 'added' : 'updated'} successfully`);

				setFarmData(prev => {
					if (isAdding) {
						console.log('[EditEntityScreen] Adding new tool:', result.data._id);
						return {
							...prev,
							tools: [...(prev.tools || []), result.data]
						};
					} else {
						console.log('[EditEntityScreen] Updating existing tool:', result.data._id);
						return {
							...prev,
							tools: (prev.tools || []).map(t =>
								t._id === result.data._id ? result.data : t
							)
						};
					}
				});
			} else {
				// For any other entity types, try to detect if it's full farmData or single entity
				const hasMultipleEntityTypes = result.data?.machines || result.data?.attachments || result.data?.products;

				if (hasMultipleEntityTypes) {
					// Backend returned full farmData (legacy behavior)
					console.log(`[EditEntityScreen] ${entityType} ${isAdding ? 'added' : 'updated'} - received full farmData`);
					setFarmData(result.data);
				} else {
					// Backend returned single entity - this is unexpected for unknown entity types
					console.warn('[EditEntityScreen] Received single entity for unknown type:', entityType);
					console.warn('[EditEntityScreen] Cannot update farmData - entity type not handled');
				}
			}

			navigation.navigate('Main');
		}

		setIsLoading(false);

		// Return raw response for FormikHelper - it expects the original format with HEADERS.VALIDATION
		return result.raw;
	};


	// Render form fields based on entity type
	const renderFormFields = (formikProps) => {
		const { values, setFieldValue, handleSubmit } = formikProps;

		if (entityType === 'machine') {
			return (
				<>
					<FormInput
						name="name"
						label={t('common:labels.name')}
						description="A friendly name to identify this machine"
						placeholder={t('common:placeholders.machineNameExample')}
						invalidMessage={t('validation:nameRequired')}
					/>

					<FormInput
						name="make"
						label={t('common:labels.make')}
						description="The manufacturer or brand of the machine"
						placeholder={t('common:placeholders.makeExample')}
						invalidMessage={t('validation:makeRequired')}
					/>

					<FormInput
						name="licenceNo"
						label={t('common:labels.licenceNo')}
						description="Registration or license plate number"
						placeholder={t('common:placeholders.licenceNoExample')}
						invalidMessage={t('validation:licenceNoInvalid')}
					/>

					<FormInput
						name="powerOnTime"
						label={`${t('common:labels.powerOnHours')} (${symbol('time')})`}
						description="Total operating hours on the machine"
						placeholder="e.g. 6000"
						keyboardType="numeric"
						invalidMessage={t('validation:powerOnHoursMustBeNumber')}
					/>

					<FormInput
						name="notes"
						label={t('common:labels.notesOptional')}
						description={t('common:descriptions.equipmentNotes')}
						placeholder={t('common:placeholders.enterNotes')}
						invalidMessage=""
						isLast={true}
						numberOfLines={4}
						multiline={true}
						maxLength={500}
					/>
				</>
			);
		} else if (entityType === 'attachment') {
			return (
				<>
					<FormInput
						name="name"
						label="Name"
						description="A friendly name to identify this attachment"
						placeholder="e.g. My Attachment"
						invalidMessage="Name is required"
					/>

					<FormInput
						name="make"
						label="Make"
						description="The manufacturer or brand of the attachment"
						placeholder="e.g. Kubota"
						invalidMessage="Make is required"
					/>

					<FormInput
						name="type"
						label="Type"
						description="What kind of attachment this is"
						placeholder="e.g. Roller"
						invalidMessage="Type is required"
					/>

					<FormInput
						name="powerOnTime"
						label={`Power-on-Hours (${symbol('time')})`}
						description="Total operating hours on the attachment"
						placeholder="e.g. 6000"
						keyboardType="numeric"
						invalidMessage="Power-on-Hours must be a number"
					/>

					{/* Usage Type Picker */}
					<OptionPicker
						label="Used For"
						description="Select how this attachment will be used (optional)"
						options={[
							{ key: 'spray', label: 'Spraying' },
							{ key: 'irrigate', label: 'Irrigation' }
						]}
						value={values.usedFor}
						onChange={(value) => setFieldValue('usedFor', value)}
						allowNoneSelected={true}
					/>

					{/* Conditional sprayer fields */}
					{values.usedFor === 'spray' && (
						<>
							<FormInput
								name="tankCapacity"
								label={`${t('common:labels.tankCapacity')} (${symbol('volume')})`}
								description={t('common:descriptions.tankCapacity')}
								placeholder="π.χ. 3000"
								keyboardType="numeric"
								invalidMessage={t('validation:tankCapacityRequired') || 'Tank capacity is required when used for spraying'}
							/>

							<FormInput
								name="boomWidth"
								label={`${t('common:labels.boomWidth')} (${symbol('length')})`}
								description={t('common:descriptions.boomWidth')}
								placeholder="π.χ. 24"
								keyboardType="numeric"
								invalidMessage=""
							/>

							<FormInput
								name="defaultCarrierRate"
								label={`${t('common:labels.defaultCarrierRate')} (${rateSymbol(true)})`}
								description={t('common:descriptions.defaultCarrierRate')}
								placeholder="π.χ. 200"
								keyboardType="numeric"
								invalidMessage=""
								isLast={true}
							/>
						</>
					)}

					{values.usedFor === 'irrigate' && (
						<FormInput
							name="litersPerHour"
							label={`Flow rate (${symbol('volume')}/hour)`}
							description="Flow rate for irrigation setups (e.g., for an irrigation wheel)"
							placeholder="e.g. 200"
							keyboardType="numeric"
							invalidMessage=""
						/>
					)}

					<FormInput
						name="notes"
						label={t('common:labels.notesOptional')}
						description={t('common:descriptions.equipmentNotes')}
						placeholder={t('common:placeholders.enterNotes')}
						invalidMessage=""
						isLast={true}
						numberOfLines={4}
						multiline={true}
						maxLength={500}
					/>
				</>
			);
		} else if (entityType === 'tool') {
			return (
				<>
					<FormInput
						name="name"
						label="Name"
						description="A friendly name to identify this tool"
						placeholder="e.g. My Tool"
						invalidMessage="Name is required"
					/>

					<FormInput
						name="type"
						label="Type"
						description="What kind of tool this is"
						placeholder="e.g. Sprayer"
						invalidMessage="Type is required"
					/>

					<FormInput
						name="brand"
						label="Brand"
						description="The manufacturer or brand of the tool"
						placeholder="e.g. John Deere"
						invalidMessage="Brand is required"
					/>

					<FormInput
						name="model"
						label="Model"
						description="The specific model number or version"
						placeholder="e.g. X540"
						invalidMessage="Model is required"
					/>

					<FormInput
						name="powerOnTime"
						label={`Power-On-Hours (${symbol('time')})`}
						description="Total operating hours on the tool"
						placeholder="e.g. 500"
						keyboardType="numeric"
						invalidMessage="Power-On-Hours must be a number"
					/>

					<FormInput
						name="notes"
						label={t('common:labels.notesOptional')}
						description={t('common:descriptions.equipmentNotes')}
						placeholder={t('common:placeholders.enterNotes')}
						invalidMessage=""
						isLast={true}
						numberOfLines={4}
						multiline={true}
						maxLength={500}
					/>
				</>
			);
		} else if (entityType === 'product') {
			const productTypeItems = useMemo(() => [
				{ _id: 'herbicide', label: t('common:productTypes.herbicide'), description: t('common:productTypeDescriptions.herbicide') || 'Controls weeds and unwanted plants' },
				{ _id: 'fungicide', label: t('common:productTypes.fungicide'), description: t('common:productTypeDescriptions.fungicide') || 'Controls fungal diseases' },
				{ _id: 'insecticide', label: t('common:productTypes.insecticide'), description: t('common:productTypeDescriptions.insecticide') || 'Controls insects and pests' },
				{ _id: 'adjuvant', label: t('common:productTypes.adjuvant'), description: t('common:productTypeDescriptions.adjuvant') || 'Enhances spray effectiveness' },
				{ _id: 'fertilizer', label: t('common:productTypes.fertilizer'), description: t('common:productTypeDescriptions.fertilizer') || 'Provides plant nutrients' },
				{ _id: 'other', label: t('common:productTypes.other'), description: t('common:productTypeDescriptions.other') || 'Other product types' }
			], [t]);

			const selectedProductType = productTypeItems.find(item => item._id === values.type);

			const openProductTypeSheet = () => {
				openBottomSheet(
					<SearchableListSheet
						isOnline={!isOffline}
						localData={productTypeItems}
						endpoint={null}
						title={t('common:labels.productType')}
						searchPlaceholder={t('common:placeholders.searchProductType') || 'Search product type...'}
						searchKeys={['label']}
						onSelect={(item) => {
							setFieldValue('type', item._id);
							closeBottomSheet();
						}}
						onCancel={closeBottomSheet}
						keyExtractor={(item) => item._id}
						renderItem={({ item, onSelect }) => (
							<ListItem
								title={item.label}
								subTitle1={item.description}
								simple={true}
								showChevron={false}
								showRadio={true}
								isSelected={values.type === item._id}
								onPress={() => onSelect(item)}
							/>
						)}
						emptyTitle={t('common:general.noResults') || 'No results'}
						emptySubtitle={t('common:general.tryDifferentSearch') || 'Try a different search'}
					/>,
					{
						snapPoints: ['100%'],
						enablePanDownToClose: true,
						index: 0
					}
				);
			};

			return (
				<>
					<FormInput
						name="name"
						label={t('common:labels.productName')}
						description={t('common:descriptions.productName')}
						placeholder="π.χ. Roundup Power 2.0"
						invalidMessage={t('validation:equipment.nameRequired') || 'Product name is required'}
					/>

					{/* Product Type - using SearchableListSheet */}
					<View style={formStyles.inputContainer}>
						<Text style={formStyles.formLabel}>{t('common:labels.productType')}:</Text>
						<Text style={formStyles.formDescription}>{t('common:descriptions.productType')}</Text>
						<Pressable
							style={styles.dropdownField}
							onPress={openProductTypeSheet}
						>
							<Text style={[
								styles.dropdownFieldText,
								!selectedProductType && styles.dropdownFieldPlaceholder
							]}>
								{selectedProductType?.label || t('common:placeholders.selectProductType') || 'Select product type'}
							</Text>
							<Text style={styles.dropdownChevron}>▼</Text>
						</Pressable>
					</View>

					<FormInput
						name="activeIngredient"
						label={t('common:labels.activeIngredient')}
						description={t('common:descriptions.activeIngredient')}
						placeholder="π.χ. Glyphosate 360g/L"
						invalidMessage=""
					/>

					{/* Product Type Toggle */}
					<OptionPicker
						label="Product Form"
						description="Select whether this product is a liquid or solid"
						options={[
							{ key: 'liquid', label: `Liquid (${symbol('volume')})` },
							{ key: 'solid', label: `Solid (${symbol('mass')})` }
						]}
						value={values.isVolume ? 'liquid' : 'solid'}
						onChange={(value) => setFieldValue('isVolume', value === 'liquid')}
						allowNoneSelected={false}
					/>

					<FormInput
						name="defaultRate"
						label={`${t('common:labels.defaultRate')} (${rateSymbol(values.isVolume)})`}
						description={t('common:descriptions.defaultRate')}
						placeholder="π.χ. 1.6"
						keyboardType="numeric"
						invalidMessage=""
					/>

					<FormInput
						name="rei"
						label={t('common:labels.rei')}
						description={t('common:descriptions.rei')}
						placeholder="π.χ. 24"
						keyboardType="numeric"
						invalidMessage=""
					/>

					<FormInput
						name="phi"
						label={t('common:labels.phi')}
						description={t('common:descriptions.phi')}
						placeholder="π.χ. 14"
						keyboardType="numeric"
						invalidMessage=""
					/>

					<FormInput
						name="notes"
						label={t('common:labels.notesOptional')}
						description={t('common:descriptions.productNotes')}
						placeholder={t('common:placeholders.enterNotes')}
						invalidMessage=""
						isLast={true}
						numberOfLines={4}
						multiline={true}
						maxLength={500}
					/>
				</>
			);
		} else if (entityType === 'jobTemplate') {
			return (
				<>
					<FormInput
						name="name"
						label="Job Name"
						description="A descriptive name for this job template"
						placeholder="e.g. My Job 1"
						invalidMessage="Job name is required"
					/>

					<FormDropdown
						name="machine"
						label="Machine"
						description="The primary machine used for this job"
						placeholder="Select a machine"
						items={farmData.machines || []}
						value={farmData.machines?.find(m => m._id === values.machine)}
						renderItem={(item, isItemSelected) => (
							<ListItem
								icon={require('../../../assets/icons/tractor_brown.png')}
								timeCount={formatValue(item.powerOnTime, 'time')}
								subTitle1={item.make}
								title={item.name}
								subTitle2={item.licenceNo}
								showChevron={false}
								showRadio={true}
								isSelected={isItemSelected}
							/>
						)}
						keyExtractor={item => item._id}
						labelExtractor={item => item.name}
						searchKeys={['name', 'make']}
						renderEmpty={() => (
							<View style={styles.emptyContainer}>
								<View style={styles.emptyTextContainer}>
									<Text style={styles.emptyText}> This farm has no machines. </Text>
									<Text style={styles.emptyTextSub}> Do you want to add one now? </Text>
								</View>
								<View style={styles.buttonContainer}>
									<PrimaryButton
										style={{ width: 220 }}
										text={"Go to Machines"}
										onPress={() => {
											closeBottomSheet();
											navigation.navigate('EditEntityScreen', {
												entityType: 'machine',
												isAdding: true
											});
										}}
									/>
								</View>
							</View>
						)}
						bottomSheetProps={{
							snapPoints: (farmData?.machines?.length === 0 ? ['30%'] : ['50%', '100%']),
							enablePanDownToClose: true
						}}
					/>

					<FormDropdown
						name="attachment"
						label="Attachment"
						description="The attachment connected to the machine"
						placeholder="Select an attachment"
						items={farmData.attachments || []}
						value={farmData.attachments?.find(a => a._id === values.attachment)}
						renderItem={(item, isItemSelected) => (
							<ListItem
								icon={require('../../../assets/icons/plow_brown.png')}
								timeCount={formatValue(item.powerOnTime, 'time')}
								subTitle1={item.make}
								title={item.name}
								subTitle2={item.type}
								showChevron={false}
								showRadio={true}
								isSelected={isItemSelected}
							/>
						)}
						keyExtractor={item => item._id}
						labelExtractor={item => item.name}
						searchKeys={['name', 'make', 'type']}
						renderEmpty={() => (
							<View style={styles.emptyContainer}>
								<View style={styles.emptyTextContainer}>
									<Text style={styles.emptyText}> This farm has no attachments. </Text>
									<Text style={styles.emptyTextSub}> Do you want to add one now? </Text>
								</View>
								<View style={styles.buttonContainer}>
									<PrimaryButton
										// style={{ width: 220 }}
										text={"Go to Attachments"}
										onPress={() => {
											closeBottomSheet();
											navigation.navigate('EditEntityScreen', {
												entityType: 'attachment',
												isAdding: true
											});
										}}
									/>
								</View>
							</View>
						)}
						bottomSheetProps={{
							snapPoints: (farmData?.attachments?.length === 0 ? ['30%'] : ['50%', '100%']),
							enablePanDownToClose: true
						}}
					/>

					<FormDropdown
						name="tool"
						label="Tool"
						description="Additional tools or equipment used for this job"
						placeholder="Select a tool"
						items={farmData.tools || []}
						value={farmData.tools?.find(t => t._id === values.tool)}
						renderItem={(item, isItemSelected) => (
							<ListItem
								icon={require('../../../assets/icons/tool.png')}
								subTitle1={item.brand}
								title={item.name}
								subTitle2={`${item.type} • ${item.model}`}
								showChevron={false}
								showRadio={true}
								isSelected={isItemSelected}
							/>
						)}
						keyExtractor={item => item._id}
						labelExtractor={item => item.name}
						searchKeys={['name', 'brand', 'type']}
						isLast={true}
						renderEmpty={() => (
							<View style={styles.emptyContainer}>
								<View style={styles.emptyTextContainer}>
									<Text style={styles.emptyText}> This farm has no tools. </Text>
									<Text style={styles.emptyTextSub}> Do you want to add one now? </Text>
								</View>
								<View style={styles.buttonContainer}>
									<PrimaryButton
										text={"Go to Tools"}
										style={{ width: 220 }}
										onPress={() => {
											closeBottomSheet();
											navigation.navigate('EditEntityScreen', {
												entityType: 'tool',
												isAdding: true
											});
										}}
									/>
								</View>
							</View>
						)}
						bottomSheetProps={{
							snapPoints: (farmData?.tools?.length === 0 ? ['35%'] : ['50%', '100%']),
							enablePanDownToClose: true
						}}
					/>
				</>
			);
		}
		return null;
	};

	// Render additional notes
	const renderNotes = () => {
		if (entityType === 'jobTemplate') {
			return (
				<View style={styles.noteContainer}>
					<Text style={styles.noteTitle}>Note:</Text>
					<Text style={styles.noteText}>The rest of the job attributes will be available at the time of the recording.</Text>
				</View>
			);
		}
		return null;
	};

	return (
		<KeyboardAwareScrollView
			style={styles.container}
			contentContainerStyle={styles.scrollContent}
			bottomOffset={100}
			bounces={false}
			keyboardShouldPersistTaps="handled"
			showsVerticalScrollIndicator={false}
		>
				<View style={styles.titleContainer}>
					<Text style={styles.titleText}>{title}</Text>
				</View>

				<Text style={[styles.titleDesc, { marginTop: -15, marginBottom: 15 }]}>
					{subtitle}
				</Text>

				<FormikHelper
					initialValues={initialValues}
					onSubmit={handleSubmit}
					enableReinitialize={true}
				>
					{(formikProps) => (
						<>
							{/* Form fields rendered based on entity type */}
							{renderFormFields(formikProps)}

							{/* Additional notes if needed */}
							{renderNotes()}

							{/* Buttons */}
							<ButtonStack >
								<PrimaryButton
									text="Save"
									onPress={formikProps.handleSubmit}
									loading={isLoading}
									fullWidth
								/>
								<PrimaryButton
									text="Cancel"
									variant="outline"
									onPress={() => navigation.goBack()}
									fullWidth
								/>
								{!isAdding && (
									<PrimaryButton
										text="Delete"
										variant="outline"
										onPress={handleDelete}
										fullWidth
										style={{ borderColor: '#D32F2F', marginTop: 10 }}
										textStyle={{ color: '#D32F2F' }}
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
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	scrollContent: {
		paddingHorizontal: 34,
		paddingBottom: 40,
		flexGrow: 1,
		backgroundColor: 'white',
	},
	wizardPageContainer: {
		width: width,
		// padding: 34,
		paddingBottom: 0,
		flex: 1,
		backgroundColor: 'white'
	},
	titleContainer: {
		marginBottom: 10
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
	noteContainer: {
		borderLeftColor: colors.SECONDARY,
		borderLeftWidth: 3,
		paddingLeft: 10,
		marginBottom: 16,
		marginTop: 16
	},
	noteTitle: {
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		fontSize: 20
	},
	noteText: {
		color: colors.PRIMARY,
		fontSize: 17,
		marginBottom: 5,
		fontFamily: 'Geologica-Regular'
	},
	buttonsContainer: {
		flex: 1,
		gap: 15,
		marginTop: 20,
		marginBottom: 30
	},
	emptyContainer: {
		padding: 10
	},
	emptyTextContainer: {
		justifyContent: 'center',
		marginBottom: 20
	},
	emptyText: {
		color: colors.PRIMARY,
		textAlign: 'center',
		fontFamily: 'Geologica-Regular',
		fontSize: 20
	},
	emptyTextSub: {
		color: colors.PRIMARY,
		fontSize: 16,
		textAlign: 'center',
		fontFamily: 'Geologica-Regular',
		marginTop: 8
	},
	buttonContainer: {
		alignSelf: 'center'
	},
	loadingOverlay: {
		...StyleSheet.absoluteFillObject,
		// backgroundColor: 'rgba(255, 255, 255, 0.7)',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 1000
	},
	dropdownField: {
		height: 46,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 15,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	dropdownFieldText: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		flex: 1,
	},
	dropdownFieldPlaceholder: {
		color: colors.PRIMARY_LIGHT,
	},
	dropdownChevron: {
		fontSize: 22,
		color: colors.SECONDARY,
		fontWeight: 'bold',
	}
});

export default EditEntityScreen;