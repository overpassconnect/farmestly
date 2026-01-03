import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import colors from '../../globals/colors';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useApi } from '../../hooks/useApi';
import { useUnits } from '../../providers/UnitsProvider';
import config from '../../globals/config';
import PrimaryButton from '../ui/core/PrimaryButton';
import { FormikHelper, FormInput } from '../ui/form';

const BASE_URL = config.BASE_URL;

const StepNameAndSave = ({ state, updateState, onBack }) => {
	const { t } = useTranslation(['common']);
	const navigation = useNavigation();
	const { farmData, setFarmData } = useGlobalContext();
	const { api } = useApi();
	const { parseRate, rateSymbol, formatRateValue, parseProductRate } = useUnits();

	// Detect edit mode
	const isEditMode = !!state._id;

	// Build initial values from wizard state
	const initialValues = useMemo(() => {
		let carrierRate = '';
		// First check wizard state (now using nested path)
		if (state.sprayConfig?.overrides?.carrierRate) {
			carrierRate = state.sprayConfig.overrides.carrierRate;
		}
		// Fallback: check attachment default and format it
		else if (state.attachmentId) {
			const attachment = farmData?.attachments?.find(a => a._id === state.attachmentId);
			if (attachment?.defaultCarrierRate) {
				carrierRate = formatRateValue(attachment.defaultCarrierRate)?.toString() || '';
			}
		}

		return {
			templateName: state.name || '',
			carrierRate
		};
	}, [state, farmData, formatRateValue]);

	// Generate auto-suggested name
	const suggestedName = useMemo(() => {
		const typeLabel = t(`common:jobTypes.${state.type}`) || state.type;

		// Get equipment name
		let equipmentName = '';
		if (state.machineId) {
			const machine = farmData?.machines?.find(m => m._id === state.machineId);
			equipmentName = machine?.name || '';
		} else if (state.attachmentId) {
			const attachment = farmData?.attachments?.find(a => a._id === state.attachmentId);
			equipmentName = attachment?.name || '';
		}

		return equipmentName
			? `${typeLabel} - ${equipmentName}`
			: `${typeLabel} Template`;
	}, [state, farmData, t]);

	// Resolve equipment for summary
	const selectedMachine = useMemo(() => {
		if (!state.machineId) return null;
		return farmData?.machines?.find(m => m._id === state.machineId);
	}, [state.machineId, farmData]);

	const selectedAttachment = useMemo(() => {
		if (!state.attachmentId) return null;
		return farmData?.attachments?.find(a => a._id === state.attachmentId);
	}, [state.attachmentId, farmData]);

	const selectedTool = useMemo(() => {
		if (!state.toolId) return null;
		return farmData?.tools?.find(t => t._id === state.toolId);
	}, [state.toolId, farmData]);

	const selectedProducts = useMemo(() => {
		if (state.type !== 'spray') return [];
		return (state.sprayConfig?.products || []).map(p => {
			const productId = p._id || p.id;
			const product = farmData?.products?.find(prod => prod._id === productId);
			return product || null;
		}).filter(Boolean);
	}, [state, farmData]);

	const handleCreateTemplate = async (values) => {
		const finalName = values.templateName.trim() || suggestedName;

		try {
			// Build payload - backend generates _id (MongoDB ObjectId)
			const payload = {
				type: state.type,
				name: finalName,
				machineId: state.machineId || null,
				attachmentId: state.attachmentId || null,
				toolId: state.toolId || null
			};

			// Add spray config if spray type
			if (state.type === 'spray') {
				const carrierRateValue = values.carrierRate ? parseRate(values.carrierRate) : null;

				payload.sprayConfig = {
					carrierRate: carrierRateValue,
					products: (state.sprayConfig?.products || []).map(p => {
						// Support both _id (wizard state) and id (from saved templates)
						const productId = p._id || p.id;
						// Get product to check if volume or mass
						const product = farmData?.products?.find(prod => prod._id === productId);
						return {
							id: productId,
							overrides: p.rateOverride ? {
								rate: parseProductRate(p.rateOverride, product?.isVolume !== false)
							} : null
						};
					})
				};
			}

			// Call API - POST for create, PUT for edit
			const url = isEditMode
				? `${BASE_URL}/jobTemplate/${state._id}`
				: `${BASE_URL}/jobTemplate`;
			const method = isEditMode ? 'PUT' : 'POST';

			const result = await api(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			console.log('[StepNameAndSave] API result:', {
				ok: result.ok,
				hasData: !!result.data,
				code: result.code,
				dataKeys: result.data ? Object.keys(result.data) : []
			});

			if (result.ok) {
				// Backend returns only the created/updated template, not the full farm data
				if (result.data && result.data._id) {
					console.log(`[StepNameAndSave] Template ${isEditMode ? 'updated' : 'created'} successfully:`, result.data._id);
					console.log('[StepNameAndSave] Full template data:', JSON.stringify(result.data, null, 2));

					const updatedTemplate = {
						...result.data,
					};

					console.log(`[StepNameAndSave] Template to ${isEditMode ? 'update' : 'add'}:`, JSON.stringify(updatedTemplate, null, 2));

					// Optimistically update farmData
					setFarmData(prev => {
						if (isEditMode) {
							// Edit mode: replace existing template
							return {
								...prev,
								jobTemplates: (prev.jobTemplates || []).map(t =>
									t._id === state._id ? updatedTemplate : t
								)
							};
						} else {
							// Create mode: add new template
							return {
								...prev,
								jobTemplates: [...(prev.jobTemplates || []), updatedTemplate]
							};
						}
					});

					// Small delay to ensure state update completes
					setTimeout(() => {
						// Reset navigation stack so user can't go back to wizard
						navigation.reset({
							index: 0,
							routes: [{ name: 'Main', params: { screen: 'TabJobs' } }],
						});
					}, 100);
				} else {
					console.error('[StepNameAndSave] Invalid response structure!');
					console.error('Expected: { _id: "...", type: "...", name: "...", ... }');
					console.error('Received:', JSON.stringify(result.data, null, 2));
					alert(`Template ${isEditMode ? 'updated' : 'created'} but unable to update local data. Please restart the app.`);
				}
			}

			// Return result for FormikHelper to parse server validation errors
			return result;
		} catch (error) {
			console.error('Error creating template:', error);
			alert('An error occurred while creating the template.');
		}
	};

	const hasEquipmentSelected = selectedMachine || selectedAttachment || selectedTool;
	const hasProductsSelected = selectedProducts.length > 0;

	return (
		<FormikHelper
			initialValues={initialValues}
			onSubmit={handleCreateTemplate}
			enableReinitialize={true}
		>
			{({ handleSubmit, isSubmitting }) => (
				<ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
					<Text style={styles.title}>Save Template</Text>
					<Text style={styles.subtitle}>Give this template a name and review your selections</Text>

					{/* Template Name Input */}
					<FormInput
						name="templateName"
						label="Template Name"
						placeholder={suggestedName}
						isLast={state.type !== 'spray'}
					/>

					{/* Carrier Rate Input (spray only) */}
					{state.type === 'spray' && (
						<FormInput
							name="carrierRate"
							label="Carrier Rate"
							description="Default rate when using this template"
							placeholder="Enter default carrier rate"
							keyboardType="numeric"
							unit={rateSymbol(true)}
							isLast={true}
						/>
					)}

					{/* Summary Section */}
					{(hasEquipmentSelected || hasProductsSelected) && (
						<View style={styles.summarySection}>
							<Text style={styles.sectionLabel}>Selected Equipment</Text>

							{selectedMachine && (
								<Text style={styles.itemText}>{selectedMachine.name}</Text>
							)}

							{selectedAttachment && (
								<Text style={styles.itemText}>{selectedAttachment.name}</Text>
							)}

							{selectedTool && (
								<Text style={styles.itemText}>{selectedTool.name}</Text>
							)}

							{hasProductsSelected && (
								<>
									<Text style={[styles.sectionLabel, { marginTop: 20 }]}>Selected Products</Text>
									{selectedProducts.map((product) => (
										<Text key={product._id} style={styles.itemText}>{product.name}</Text>
									))}
								</>
							)}
						</View>
					)}

					{/* Button Stack */}
					<View style={styles.buttonContainer}>
						{isSubmitting ? (
							<ActivityIndicator size="large" color={colors.SECONDARY} />
						) : (
							<>
								<PrimaryButton
									text={isEditMode ? "Update Template" : "Create Template"}
									onPress={handleSubmit}
									fullWidth
								/>
								<PrimaryButton
									text="Back"
									variant="outline"
									onPress={onBack}
									fullWidth
									style={{ marginTop: 12 }}
								/>
							</>
						)}
					</View>
				</ScrollView>
			)}
		</FormikHelper>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white'
	},
	scrollContent: {
		paddingHorizontal: 34,
		paddingTop: 20,
		paddingBottom: 100
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		marginBottom: 8
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 24
	},
	summarySection: {
		marginTop: 22
	},
	sectionLabel: {
		fontFamily: 'Geologica-Medium',
		fontSize: 18,
		color: colors.PRIMARY_LIGHT,
		// textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 8
	},
	itemText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 6
	},
	buttonContainer: {
		marginTop: 32
	}
});

export default StepNameAndSave;
