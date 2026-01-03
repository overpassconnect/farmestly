import React, { useState, useMemo, useEffect } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Alert,
	TextInput,
	Switch,
	TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DatePicker from 'react-native-date-picker';
import { useApi } from '../../../hooks/useApi';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useUnits } from '../../../providers/UnitsProvider';
import { useTranslation } from 'react-i18next';
import colors from '../../../globals/colors';
import config from '../../../globals/config';
import PrimaryButton from '../../ui/core/PrimaryButton';
import { FormikHelper, FormInput } from '../../ui/form';

const BASE_URL = config.BASE_URL;

const JobDetailScreen = () => {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const route = useRoute();
	const { jobRecord } = route.params || {};
	const { farmData, setFarmData } = useGlobalContext();
	const { api, showError } = useApi();
	const { formatRateValue, formatProductRateValue, parseRate, parseProductRate, formatValue, parse, symbol, rateSymbol } = useUnits();

	const [isEditing, setIsEditing] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
	const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

	// Safety check: navigate back if no job record
	useEffect(() => {
		if (!jobRecord) {
			Alert.alert('Error', 'No job record found');
			navigation.goBack();
		}
	}, [jobRecord, navigation]);

	// Check if job is synced (has _id)
	const isSynced = Boolean(jobRecord?._id);

	// Get job title
	const title = jobRecord?.template?.name || t(`common:jobTypes.${jobRecord?.type}`);

	// Get field name
	const getFieldName = () => {
		if (!jobRecord) return 'Unknown Field';
		if (jobRecord.fieldId && farmData?.fields) {
			const field = farmData.fields.find(f => String(f._id) === String(jobRecord.fieldId));
			return field?.name || jobRecord.fieldId;
		}
		return jobRecord.fieldId || 'Unknown Field';
	};

	// Format date for display
	const formatDateTime = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' • ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	// Resolve equipment names
	const getEquipmentNames = useMemo(() => {
		const equipment = {};
		if (!jobRecord) return equipment;

		// Try to read equipment from embedded objects first (new schema)
		if (jobRecord.machine?.name) {
			equipment.machine = jobRecord.machine.name;
		}
		if (jobRecord.attachment?.name) {
			equipment.attachment = jobRecord.attachment.name;
		}
		if (jobRecord.tool?.name) {
			equipment.tool = jobRecord.tool.name;
		}

		// If no embedded objects, fall back to template lookup (old schema)
		if (!equipment.machine && !equipment.attachment && !equipment.tool) {
			let machineId, attachmentId, toolId;

			// First try to get template from embedded object
			if (jobRecord.template) {
				machineId = jobRecord.template.machine || jobRecord.template.machineId;
				attachmentId = jobRecord.template.attachment || jobRecord.template.attachmentId;
				toolId = jobRecord.template.tool || jobRecord.template.toolId;
			}
			// Fall back to template lookup
			else if (jobRecord.templateId && farmData?.jobTemplates) {
				const template = farmData.jobTemplates.find(t => t._id === jobRecord.templateId);
				if (template) {
					machineId = template.machine || template.machineId;
					attachmentId = template.attachment || template.attachmentId;
					toolId = template.tool || template.toolId;
				}
			}

			// Look up equipment names from IDs
			if (machineId && farmData?.machines) {
				const machine = farmData.machines.find(m => m._id === machineId);
				equipment.machine = machine?.name || null;
			}

			if (attachmentId && farmData?.attachments) {
				const attachment = farmData.attachments.find(a => a._id === attachmentId);
				equipment.attachment = attachment?.name || null;
			}

			if (toolId && farmData?.tools) {
				const tool = farmData.tools.find(t => t._id === toolId);
				equipment.tool = tool?.name || null;
			}
		}

		return equipment;
	}, [jobRecord, farmData]);

	// Initial form values
	const initialValues = useMemo(() => {
		const defaults = {
			startTime: new Date(),
			endTime: new Date(),
			notes: '',
			harvestedKg: '',
			isFinalHarvest: false,
			carrierRate: '',
			products: [],
			rei: '',
			phi: '',
		};

		if (!jobRecord) return defaults;

		let startTime = defaults.startTime;
		let endTime = defaults.endTime;

		try {
			// Support both new and old property names
			const startTimeField = jobRecord.startedAt || jobRecord.startTime;
			const endTimeField = jobRecord.endedAt || jobRecord.endTime;

			if (startTimeField) {
				startTime = new Date(startTimeField);
				if (isNaN(startTime.getTime())) startTime = defaults.startTime;
			}
			if (endTimeField) {
				endTime = new Date(endTimeField);
				if (isNaN(endTime.getTime())) endTime = defaults.endTime;
			} else if (startTimeField && jobRecord.elapsedTime) {
				endTime = new Date(new Date(startTimeField).getTime() + jobRecord.elapsedTime);
			}
		} catch (e) {
			console.warn('Error parsing job dates:', e);
		}

		// Read harvest data from new or old schema
		const harvestedKg = jobRecord.data?.harvest?.amount || jobRecord.harvestedKg;
		const isFinalHarvest = jobRecord.data?.harvest?.isFinalHarvest ?? jobRecord.isFinalHarvest;

		// Read spray data from new or old schema
		const sprayData = jobRecord.data?.spray || jobRecord.sprayData;

		// Format values for display using user's preferred units
		const formattedHarvestedKg = harvestedKg != null ? formatValue(harvestedKg, 'mass')?.toString() ?? '' : '';
		const formattedCarrierRate = sprayData?.carrierRate != null ? formatRateValue(sprayData.carrierRate)?.toString() ?? '' : '';

		return {
			startTime,
			endTime,
			notes: jobRecord.notes ?? '',
			harvestedKg: formattedHarvestedKg,
			isFinalHarvest: Boolean(isFinalHarvest),
			carrierRate: formattedCarrierRate,
			products: sprayData?.products?.map(p => ({
				...p,
				rate: p.rate != null ? formatProductRateValue(p.rate, p.isVolume)?.toString() ?? '' : '',
			})) ?? [],
			rei: sprayData?.complianceInfo?.maxREI?.toString() ?? '',
			phi: sprayData?.complianceInfo?.maxPHI?.toString() ?? '',
		};
	}, [jobRecord, formatValue, formatRateValue, formatProductRateValue]);

	// Calculate duration
	const calculateDuration = (startTime, endTime) => {
		return new Date(endTime).getTime() - new Date(startTime).getTime();
	};

	const formatDuration = (durationMs) => {
		if (!durationMs) return 'N/A';
		const totalSeconds = Math.floor(durationMs / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	};

	// Handle form submission
	const handleSubmit = async (values) => {
		if (!isSynced) {
			Alert.alert('Cannot Edit', 'This job must sync before it can be edited.');
			return;
		}

		setIsSubmitting(true);

		const elapsedTime = calculateDuration(values.startTime, values.endTime);

		// Build update object with only changed fields
		// Server expects _id field for the job identifier
		const updateData = {
			_id: jobRecord._id,
		};

		if (values.startTime.getTime() !== new Date(jobRecord.startTime).getTime()) {
			updateData.startTime = values.startTime.toISOString();
		}

		if (values.endTime.getTime() !== new Date(jobRecord.endTime || jobRecord.startTime + jobRecord.elapsedTime).getTime()) {
			updateData.endTime = values.endTime.toISOString();
		}

		if (elapsedTime !== jobRecord.elapsedTime) {
			updateData.elapsedTime = elapsedTime;
		}

		if (values.notes !== (jobRecord.notes || '')) {
			updateData.notes = values.notes;
		}

		// Get job type with fallback
		const jobType = jobRecord.type || jobRecord.jobType;

		// Harvest-specific fields
		if (jobType === 'harvest') {
			const harvestedKgParsed = parse(values.harvestedKg, 'mass');
			const oldHarvestedKg = jobRecord.data?.harvest?.amount || jobRecord.harvestedKg;
			if (harvestedKgParsed != null && harvestedKgParsed !== oldHarvestedKg) {
				updateData.harvestedKg = harvestedKgParsed;
			}
			const oldIsFinalHarvest = jobRecord.data?.harvest?.isFinalHarvest ?? jobRecord.isFinalHarvest;
			if (values.isFinalHarvest !== oldIsFinalHarvest) {
				updateData.isFinalHarvest = values.isFinalHarvest;
			}
		}

		// Spray-specific fields
		const sprayData = jobRecord.data?.spray || jobRecord.sprayData;
		if (jobType === 'spray' && sprayData) {
			const carrierRateNum = parseFloat(values.carrierRate);
			if (!isNaN(carrierRateNum) && carrierRateNum !== sprayData.carrierRate) {
				updateData.carrierRate = parseRate(values.carrierRate);
			}

			// Update products
			const updatedProducts = values.products.map(p => ({
				productId: p.productId,
				name: p.name,
				rate: parseProductRate(p.rate, p.isVolume),
				isVolume: p.isVolume,
				rei: p.rei,
				phi: p.phi,
			}));

			if (JSON.stringify(updatedProducts) !== JSON.stringify(sprayData.products)) {
				updateData.products = updatedProducts;
			}

			// Update compliance
			const reiNum = parseInt(values.rei, 10);
			const phiNum = parseInt(values.phi, 10);
			if (!isNaN(reiNum) && reiNum !== sprayData.complianceInfo?.maxREI) {
				updateData.maxREI = reiNum;
			}
			if (!isNaN(phiNum) && phiNum !== sprayData.complianceInfo?.maxPHI) {
				updateData.maxPHI = phiNum;
			}
		}

		// Only send request if there are changes
		if (Object.keys(updateData).length === 1) {
			Alert.alert('No Changes', 'No fields were modified.');
			setIsSubmitting(false);
			setIsEditing(false);
			return;
		}

		const result = await api(`${BASE_URL}/job/record/update`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(updateData)
		});

		setIsSubmitting(false);

		if (result.ok) {
			if (result.data?.farmData) {
				setFarmData(result.data.farmData);
			}
			setIsEditing(false);
			navigation.goBack();
		} else if (result.validation) {
			// Show validation errors using the error sheet
			// Use VALIDATION_FAILED code which should have a generic translation
			showError('VALIDATION_FAILED');
		}

		return result;
	};

	// Handle delete
	const handleDelete = () => {
		if (!isSynced) {
			Alert.alert('Cannot Delete', 'This job must sync before it can be deleted.');
			return;
		}

		const getConfirmMessage = () => {
			const jobType = jobRecord.type || jobRecord.jobType;
			const isFinalHarvest = jobRecord.data?.harvest?.isFinalHarvest ?? jobRecord.isFinalHarvest;

			if (jobType === 'sow') {
				return 'This will permanently delete this sowing job and its associated cultivation. Jobs linked to this cultivation must be deleted first.';
			}
			if (jobType === 'harvest' && isFinalHarvest) {
				return 'This will delete this harvest and reopen the cultivation, marking it as active again.';
			}
			return 'This will permanently delete this job record. This cannot be undone.';
		};

		Alert.alert(
			'Delete Job?',
			getConfirmMessage(),
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						setIsDeleting(true);
						const result = await api(`${BASE_URL}/job/record/${jobRecord._id}`, {
							method: 'DELETE',
							headers: { 'Content-Type': 'application/json' }
						});

						setIsDeleting(false);

						if (result.ok) {
							if (result.data?.farmData) {
								setFarmData(result.data.farmData);
							}
							navigation.replace('Main', { screen: 'Jobs' });
						}
					}
				}
			]
		);
	};

	if (!jobRecord) {
		return null;
	}

	return (
		<View style={styles.container}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<View>
						<Text style={styles.title}>{title}</Text>
						<Text style={styles.subtitle}>{getFieldName()}</Text>
					</View>
					{isSynced && !isEditing && (
						<TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
							<Text style={styles.editButtonText}>Edit</Text>
						</TouchableOpacity>
					)}
				</View>

				{/* Unsynced banner */}
				{!isSynced && (
					<View style={styles.warningBanner}>
						<Text style={styles.warningText}>
							This job hasn't synced yet. Editing is disabled until sync completes.
						</Text>
					</View>
				)}

				<FormikHelper
					initialValues={initialValues}
					onSubmit={handleSubmit}
					enableReinitialize={true}
				>
					{({ handleSubmit, handleChange, handleBlur, values, setFieldValue }) => (
						<>
							{/* Time Section */}
							<View style={styles.section}>
								<Text style={styles.sectionHeader}>Time & Duration</Text>

								<View style={styles.row}>
									<Text style={styles.label}>Start Time</Text>
									{isEditing ? (
										<TouchableOpacity onPress={() => setStartDatePickerOpen(true)}>
											<Text style={[styles.value, styles.editableValue]}>
												{formatDateTime(values.startTime)}
											</Text>
										</TouchableOpacity>
									) : (
										<Text style={styles.value}>{formatDateTime(values.startTime)}</Text>
									)}
								</View>

								<View style={styles.row}>
									<Text style={styles.label}>End Time</Text>
									{isEditing ? (
										<TouchableOpacity onPress={() => setEndDatePickerOpen(true)}>
											<Text style={[styles.value, styles.editableValue]}>
												{formatDateTime(values.endTime)}
											</Text>
										</TouchableOpacity>
									) : (
										<Text style={styles.value}>{formatDateTime(values.endTime)}</Text>
									)}
								</View>

								<View style={styles.row}>
									<Text style={styles.label}>Duration</Text>
									<Text style={styles.value}>
										{formatDuration(calculateDuration(values.startTime, values.endTime))}
									</Text>
								</View>
							</View>

							{/* Job-Specific Sections */}
							{(jobRecord.type === 'sow' || jobRecord.jobType === 'sow') && (
								<View style={styles.section}>
									<Text style={styles.sectionHeader}>Sowing Details</Text>
									<View style={styles.row}>
										<Text style={styles.label}>Crop</Text>
										<Text style={styles.value}>{jobRecord.data?.sow?.crop || jobRecord.crop || 'N/A'}</Text>
									</View>
									{(jobRecord.data?.sow?.variety || jobRecord.variety) && (
										<View style={styles.row}>
											<Text style={styles.label}>Variety</Text>
											<Text style={styles.value}>{jobRecord.data?.sow?.variety || jobRecord.variety}</Text>
										</View>
									)}
								</View>
							)}

							{(jobRecord.type === 'harvest' || jobRecord.jobType === 'harvest') && (
								<View style={styles.section}>
									<Text style={styles.sectionHeader}>Harvest Details</Text>

									{isEditing ? (
										<FormInput
											name="harvestedKg"
											label="Harvested"
											unit={symbol('mass')}
											inline={true}
											placeholder="0"
											keyboardType="numeric"
											inputStyle={{ width: 120 }}
										/>
									) : (
										<View style={styles.row}>
											<Text style={styles.label}>Harvested</Text>
											<Text style={styles.value}>{values.harvestedKg ? `${values.harvestedKg} ${symbol('mass')}` : 'N/A'}</Text>
										</View>
									)}

									<View style={styles.row}>
										<Text style={styles.label}>Final Harvest</Text>
										{isEditing ? (
											<Switch
												value={values.isFinalHarvest}
												onValueChange={(value) => setFieldValue('isFinalHarvest', value)}
												trackColor={{ false: '#E5E7EB', true: colors.SECONDARY }}
												thumbColor={values.isFinalHarvest ? '#FFFFFF' : '#F3F4F6'}
											/>
										) : (
											<Text style={styles.value}>{values.isFinalHarvest ? 'Yes' : 'No'}</Text>
										)}
									</View>
								</View>
							)}

							{(jobRecord.type === 'spray' || jobRecord.jobType === 'spray') && (jobRecord.data?.spray || jobRecord.sprayData) && (
								<View style={styles.section}>
									<Text style={styles.sectionHeader}>Spray Details</Text>

									<View style={styles.row}>
										<Text style={styles.label}>Sprayer</Text>
										<Text style={styles.value}>{(jobRecord.data?.spray || jobRecord.sprayData)?.sprayerName || 'N/A'}</Text>
									</View>

									{isEditing ? (
										<FormInput
											name="carrierRate"
											label="Carrier Rate"
											unit={rateSymbol(true)}
											inline={true}
											placeholder="0"
											keyboardType="numeric"
											inputStyle={{ width: 120 }}
										/>
									) : (
										<View style={styles.row}>
											<Text style={styles.label}>Carrier Rate</Text>
											<Text style={styles.value}>
												{values.carrierRate ? `${values.carrierRate} ${rateSymbol(true)}` : 'N/A'}
											</Text>
										</View>
									)}

									{values.products && values.products.length > 0 && (
										<>
											<Text style={styles.subsectionHeader}>Products</Text>
											{values.products.map((product, idx) => (
												<View key={idx} style={styles.productSection}>
													<Text style={styles.productName}>{product.name}</Text>

													{isEditing ? (
														<FormInput
															name={`products[${idx}].rate`}
															label="Rate"
															unit={rateSymbol(product.isVolume)}
															inline={true}
															placeholder="0"
															keyboardType="numeric"
															inputStyle={{ width: 120 }}
														/>
													) : (
														<View style={styles.row}>
															<Text style={styles.sublabel}>Rate</Text>
															<Text style={styles.value}>
																{product.rate ? `${product.rate} ${rateSymbol(product.isVolume)}` : 'N/A'}
															</Text>
														</View>
													)}

													{isEditing ? (
														<FormInput
															name={`products[${idx}].rei`}
															label="REI"
															unit="hours"
															inline={true}
															placeholder="0"
															keyboardType="number-pad"
															inputStyle={{ width: 120 }}
														/>
													) : (
														<View style={styles.row}>
															<Text style={styles.sublabel}>REI (hours)</Text>
															<Text style={styles.value}>{product.rei || 0} hours</Text>
														</View>
													)}

													{isEditing ? (
														<FormInput
															name={`products[${idx}].phi`}
															label="PHI"
															unit="days"
															inline={true}
															placeholder="0"
															keyboardType="number-pad"
															inputStyle={{ width: 120 }}
														/>
													) : (
														<View style={styles.row}>
															<Text style={styles.sublabel}>PHI (days)</Text>
															<Text style={styles.value}>{product.phi || 0} days</Text>
														</View>
													)}
												</View>
											))}
										</>
									)}

									{(() => {
										const sprayData = jobRecord.data?.spray || jobRecord.sprayData;
										const complianceInfo = sprayData?.complianceInfo;
										return complianceInfo && (complianceInfo.maxREI > 0 || complianceInfo.maxPHI > 0) && (
											<View style={styles.complianceSection}>
												<Text style={styles.subsectionHeader}>Compliance</Text>

												{complianceInfo.maxREI > 0 && (
													<View style={styles.complianceRow}>
														<View style={styles.complianceContent}>
															<Text style={styles.complianceLabel}>Re-entry Interval</Text>
															<Text style={styles.complianceValue}>
																{complianceInfo.maxREI} hours
															</Text>
															{complianceInfo.reentryDate && (
																<Text style={styles.complianceDate}>
																	Until {new Date(complianceInfo.reentryDate).toLocaleString()}
																</Text>
															)}
														</View>
														{new Date() < new Date(complianceInfo.reentryDate) && (
															<View style={styles.activeIndicator} />
														)}
													</View>
												)}

												{complianceInfo.maxPHI > 0 && (
													<View style={styles.complianceRow}>
														<View style={styles.complianceContent}>
															<Text style={styles.complianceLabel}>Pre-Harvest Interval</Text>
															<Text style={styles.complianceValue}>
																{complianceInfo.maxPHI} days
															</Text>
															{complianceInfo.harvestDate && (
																<Text style={styles.complianceDate}>
																	Until {new Date(complianceInfo.harvestDate).toLocaleDateString()}
																</Text>
															)}
													</View>
													{new Date() < new Date(complianceInfo.harvestDate) && (
														<View style={styles.activeIndicator} />
													)}
												</View>
											)}
										</View>
									);
									})()}
								</View>
							)}

							{(jobRecord.type === 'irrigate' || jobRecord.jobType === 'irrigation') && (jobRecord.data?.irrigate || jobRecord.irrigationData) && (() => {
								const irrigationData = jobRecord.data?.irrigate || jobRecord.irrigationData;
								return (
									<View style={styles.section}>
										<Text style={styles.sectionHeader}>Irrigation Details</Text>
										<View style={styles.row}>
											<Text style={styles.label}>Irrigator</Text>
											<Text style={styles.value}>{irrigationData.irrigatorName || 'N/A'}</Text>
										</View>
										<View style={styles.row}>
											<Text style={styles.label}>Flow Rate</Text>
											<Text style={styles.value}>
												{irrigationData.litersPerHour ? `${irrigationData.litersPerHour} L/hour` : 'N/A'}
											</Text>
										</View>
										<View style={styles.row}>
											<Text style={styles.label}>Water Applied</Text>
											<Text style={styles.value}>
												{irrigationData.waterAppliedLiters?.toFixed(1) ||
												 ((jobRecord.elapsedTime / 3600000) * irrigationData.litersPerHour).toFixed(1)} L
											</Text>
										</View>
									</View>
								);
							})()}

							{/* Equipment Section */}
							{(getEquipmentNames.machine || getEquipmentNames.attachment || getEquipmentNames.tool) && (
								<View style={styles.section}>
									<Text style={styles.sectionHeader}>Equipment</Text>
									{getEquipmentNames.machine && (
										<View style={styles.row}>
											<Text style={styles.label}>Machine</Text>
											<Text style={styles.value}>{getEquipmentNames.machine}</Text>
										</View>
									)}
									{getEquipmentNames.attachment && (
										<View style={styles.row}>
											<Text style={styles.label}>Attachment</Text>
											<Text style={styles.value}>{getEquipmentNames.attachment}</Text>
										</View>
									)}
									{getEquipmentNames.tool && (
										<View style={styles.row}>
											<Text style={styles.label}>Tool</Text>
											<Text style={styles.value}>{getEquipmentNames.tool}</Text>
										</View>
									)}
								</View>
							)}

							{/* Notes Section */}
							<View style={styles.section}>
								<Text style={styles.sectionHeader}>Notes</Text>
								{isEditing ? (
									<TextInput
										style={styles.notesInput}
										onChangeText={handleChange('notes')}
										onBlur={handleBlur('notes')}
										value={values.notes}
										placeholder="Add notes about this job"
										placeholderTextColor={colors.PRIMARY_LIGHT}
										multiline
									/>
								) : (
									<Text style={styles.notesText}>{values.notes || 'No notes'}</Text>
								)}
							</View>

							{/* Action Buttons */}
							{isEditing && (
								<View style={styles.buttonContainer}>
									<PrimaryButton
										text={isSubmitting ? "Saving..." : "Save Changes"}
										onPress={handleSubmit}
										disabled={isSubmitting}
										style={styles.button}
									/>

									<PrimaryButton
										text="Cancel"
										variant="outline"
										onPress={() => setIsEditing(false)}
										disabled={isSubmitting}
										style={styles.button}
									/>
								</View>
							)}

							{/* Delete Section */}
							{isSynced && !isEditing && (
								<View style={styles.deleteSection}>
									<Text style={styles.deleteSectionHeader}>Delete Job</Text>
									<Text style={styles.deleteSectionDescription}>
										{(() => {
											const jobType = jobRecord.type || jobRecord.jobType;
											const isFinalHarvest = jobRecord.data?.harvest?.isFinalHarvest ?? jobRecord.isFinalHarvest;

											if (jobType === 'sow') {
												return 'This will also delete the associated cultivation. Any other jobs linked to that cultivation must be deleted first.';
											} else if (jobType === 'harvest' && isFinalHarvest) {
												return 'This will reopen the cultivation, marking it as active again.';
											}
											return 'This action cannot be undone.';
										})()}
									</Text>
									<PrimaryButton
										text={isDeleting ? 'Deleting...' : 'Delete Job'}
										variant="outline"
										onPress={handleDelete}
										disabled={isDeleting}
										style={[styles.button, styles.deleteButton]}
									/>
								</View>
							)}

							{/* Date Pickers */}
							<DatePicker
								modal
								open={startDatePickerOpen}
								date={values.startTime}
								mode="datetime"
								onConfirm={(date) => {
									setStartDatePickerOpen(false);
									setFieldValue('startTime', date);
								}}
								onCancel={() => setStartDatePickerOpen(false)}
								title="Select start time"
							/>

							<DatePicker
								modal
								open={endDatePickerOpen}
								date={values.endTime}
								mode="datetime"
								onConfirm={(date) => {
									setEndDatePickerOpen(false);
									setFieldValue('endTime', date);
								}}
								onCancel={() => setEndDatePickerOpen(false)}
								title="Select end time"
							/>
						</>
					)}
				</FormikHelper>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	scrollView: {
		flex: 1,
	},
	contentContainer: {
		padding: 20,
		paddingBottom: 40,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 24,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.SECONDARY,
	},
	editButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 6,
		backgroundColor: colors.SECONDARY,
	},
	editButtonText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 15,
		color: 'white',
	},
	warningBanner: {
		backgroundColor: '#FFF3CD',
		padding: 12,
		marginBottom: 20,
		borderRadius: 8,
	},
	warningText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: '#856404',
		lineHeight: 18,
	},
	section: {
		marginBottom: 24,
	},
	sectionHeader: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	subsectionHeader: {
		fontFamily: 'Geologica-Medium',
		fontSize: 16,
		color: colors.PRIMARY,
		marginTop: 16,
		marginBottom: 12,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	label: {
		fontFamily: 'Geologica-Medium',
		fontSize: 15,
		color: colors.PRIMARY,
	},
	sublabel: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
	},
	value: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
		textAlign: 'right',
		flex: 1,
		marginLeft: 16,
	},
	editableValue: {
		color: colors.SECONDARY,
		textDecorationLine: 'underline',
	},
	// Product input styles - matching FormInput inline style
	productName: {
		fontFamily: 'Geologica-Medium',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	productInputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 12,
	},
	productInputLabel: {
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		fontSize: 17,
		marginRight: 12,
		minWidth: 40,
	},
	productInputWrapper: {
		position: 'relative',
		flexDirection: 'row',
		alignItems: 'center',
	},
	productInput: {
		width: 120,
		height: 46,
		fontSize: 17,
		color: colors.PRIMARY,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
		paddingRight: 60,
		fontFamily: 'Geologica-Regular',
	},
	productInputUnit: {
		position: 'absolute',
		right: 12,
		fontSize: 16,
		fontFamily: 'Geologica-Medium',
		color: colors.SECONDARY,
	},
	notesInput: {
		height: 100,
		fontSize: 15,
		color: colors.PRIMARY,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY_LIGHT,
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		fontFamily: 'Geologica-Regular',
		textAlignVertical: 'top',
	},
	notesText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
		lineHeight: 22,
	},
	errorText: {
		color: 'red',
		fontFamily: 'Geologica-Light',
		fontSize: 12,
		marginTop: 4,
	},
	productSection: {
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
	},
	complianceSection: {
		marginTop: 16,
	},
	complianceRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	complianceContent: {
		flex: 1,
	},
	complianceLabel: {
		fontFamily: 'Geologica-Medium',
		fontSize: 14,
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	complianceValue: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
	},
	complianceDate: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: colors.PRIMARY_LIGHT,
		marginTop: 2,
	},
	activeIndicator: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.SECONDARY,
		marginLeft: 12,
	},
	buttonContainer: {
		marginTop: 8,
		gap: 12,
	},
	button: {
		width: '100%',
	},
	deleteSection: {
		marginTop: 32,
		paddingTop: 24,
		borderTopWidth: 1,
		borderTopColor: '#F3F4F6',
	},
	deleteSectionHeader: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	deleteSectionDescription: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 16,
		lineHeight: 18,
	},
	deleteButton: {
		borderColor: '#FF3B30',
	},
});

export default JobDetailScreen;
