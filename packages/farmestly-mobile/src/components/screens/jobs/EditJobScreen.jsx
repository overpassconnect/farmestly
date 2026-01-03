import React, { useState } from 'react';
import { useApi } from '../../../hooks/useApi';
import { View, Text, StyleSheet, Alert, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFormikContext } from 'formik';
import colors from '../../../globals/colors';

import PrimaryButton from '../../ui/core/PrimaryButton';
import ButtonStack from '../../ui/core/ButtonGroup';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { FormikHelper, FormInput, useFormikHelper } from '../../ui/form';
import config from '../../../globals/config';

const BASE_URL = config.BASE_URL;

// Custom time input component using Formik context
const TimeInputGroup = ({ name, label, maxLength }) => {
	const { values, setFieldValue, handleBlur } = useFormikContext();
	const { serverErrors } = useFormikHelper();
	const hasError = serverErrors[name];

	return (
		<View style={styles.timeInputGroup}>
			<TextInput
				style={[styles.timeInput, hasError && styles.inputError]}
				onChangeText={(text) => setFieldValue(name, text)}
				onBlur={() => handleBlur(name)}
				value={values[name]}
				placeholder="0"
				keyboardType="number-pad"
				maxLength={maxLength}
				placeholderTextColor={colors.PRIMARY_LIGHT}
			/>
			<Text style={styles.timeLabel}>{label}</Text>
			{hasError && (
				<Text style={styles.errorText}>{serverErrors[name]}</Text>
			)}
		</View>
	);
};

const EditJobScreen = () => {
	const navigation = useNavigation();
	const route = useRoute();
	const { jobRecord } = route.params;
	const { setFarmData } = useGlobalContext();
	const { api } = useApi();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	// Convert milliseconds to hours, minutes, seconds
	const msToTime = (duration) => {
		const totalSeconds = Math.floor(duration / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		return { hours, minutes, seconds };
	};

	// Get time components from job record
	const timeComponents = msToTime(jobRecord.elapsedTime || 0);

	// Initialize form values
	const initialValues = {
		notes: jobRecord.notes || '',
		hours: timeComponents.hours.toString(),
		minutes: timeComponents.minutes.toString(),
		seconds: timeComponents.seconds.toString()
	};

	// Format job type for display
	const getJobTypeName = (jobType) => {
		switch (jobType) {
			case 'sow':
				return 'Sowing';
			case 'harvest':
				return 'Harvesting';
			case 'spray':
				return 'Spraying';
			case 'irrigate':
			case 'irrigation':
				return 'Irrigation';
			case 'custom':
				return jobRecord.jobTitle || 'Custom Job';
			default:
				return 'Job';
		}
	};

	// Get job type with fallback to old property name
	const jobType = jobRecord.type || jobRecord.jobType;

	// Calculate milliseconds from time components
	const calculateDurationMs = (hours, minutes, seconds) => {
		return ((parseInt(hours, 10) * 3600) + (parseInt(minutes, 10) * 60) + parseInt(seconds, 10)) * 1000;
	};

	// Handle form submission
	const handleSubmit = async (values) => {
		setIsSubmitting(true);

		// Convert input values to numbers with fallback to 0
		const hours = parseInt(values.hours, 10) || 0;
		const minutes = parseInt(values.minutes, 10) || 0;
		const seconds = parseInt(values.seconds, 10) || 0;

		// Calculate total milliseconds
		const elapsedTimeMs = calculateDurationMs(hours, minutes, seconds);

		// Prepare data for API
		const updateData = {
			jobId: jobRecord._id,
			notes: values.notes,
			elapsedTime: elapsedTimeMs
		};

		// Send update to server
		const result = await api(`${BASE_URL}/job/record/update`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(updateData)
		});

		setIsSubmitting(false);

		if (result.ok) {
			// Navigate back to summary screen with updated data
			navigation.navigate('JobSummaryScreen', {
				completedRecording: {
					...jobRecord,
					notes: values.notes,
					elapsedTime: elapsedTimeMs
				},
				readOnly: true
			});
		}

		// Return result for FormikHelper to parse server validation errors
		return result;
	};
	const handleDelete = () => {
		const getConfirmMessage = () => {
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

	return (
		<KeyboardAwareScrollView
			style={styles.safeArea}
			contentContainerStyle={styles.container}
			bottomOffset={100}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={styles.title}>Edit {getJobTypeName(jobType)}</Text>
			<Text style={styles.fieldName}>{jobRecord.fieldName}</Text>

			<FormikHelper
				initialValues={initialValues}
				onSubmit={handleSubmit}
			>
				{({ handleSubmit }) => (
					<>
						{/* Duration Section */}
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Duration</Text>
							<Text style={styles.sectionDescription}>
								Adjust the total time spent on this job
							</Text>
							<View style={styles.timeInputContainer}>
								<TimeInputGroup name="hours" label="hours" maxLength={3} />
								<TimeInputGroup name="minutes" label="min" maxLength={2} />
								<TimeInputGroup name="seconds" label="sec" maxLength={2} />
							</View>
						</View>

						{/* Notes Section */}
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Notes</Text>
							<Text style={styles.sectionDescription}>
								Add any additional information about this job
							</Text>
							<FormInput
								name="notes"
								placeholder="Add notes about this job"
								multiline={true}
								style={styles.notesInput}
								isLast={true}
							/>
						</View>

						{/* Irrigation Details Section */}
						{(jobType === 'irrigate' || jobType === 'irrigation') && (jobRecord.data?.irrigate || jobRecord.irrigationData) && (() => {
							const irrigationData = jobRecord.data?.irrigate || jobRecord.irrigationData;
							return (
								<View style={styles.section}>
									<Text style={styles.sectionTitle}>Irrigation Details</Text>
									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>Irrigator:</Text>
										<Text style={styles.detailValue}>{irrigationData.irrigatorName}</Text>
									</View>
									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>Flow Rate:</Text>
										<Text style={styles.detailValue}>
											{irrigationData.litersPerHour} L/hour
										</Text>
									</View>
									<View style={styles.detailRow}>
										<Text style={styles.detailLabel}>Water Applied:</Text>
										<Text style={styles.detailValue}>
											{irrigationData.waterAppliedLiters?.toFixed(1) ||
											 ((jobRecord.elapsedTime / 3600000) * irrigationData.litersPerHour).toFixed(1)} L
										</Text>
									</View>
								</View>
							);
						})()}

						<ButtonStack style={{ marginTop: 16, marginBottom: 24 }}>
							<PrimaryButton
								text={isSubmitting ? "Saving..." : "Save Changes"}
								onPress={handleSubmit}
								disabled={isSubmitting}
								fullWidth
							/>

							<PrimaryButton
								text="Cancel"
								variant="outline"
								onPress={() => navigation.goBack()}
								disabled={isSubmitting}
								fullWidth
							/>
						</ButtonStack>
					</>
				)}
			</FormikHelper>
			{/* Delete Job Section */}
			{jobRecord._id && (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Delete Job</Text>
					<Text style={styles.sectionDescription}>
						{(() => {
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
						fullWidth
					/>
				</View>
			)}
		</KeyboardAwareScrollView>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: 'white',
	},
	keyboardAvoid: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	container: {
		padding: 24,
		flex: 1,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	fieldName: {
		fontFamily: 'Geologica-Regular',
		fontSize: 18,
		color: colors.SECONDARY,
		marginBottom: 24,
	},
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 6,
	},
	sectionDescription: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 12,
		lineHeight: 20,
	},
	timeInputContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	timeInputGroup: {
		flex: 1,
		marginHorizontal: 4,
		alignItems: 'center',
	},
	timeInput: {
		height: 42,
		width: '80%',
		fontSize: 18,
		textAlign: 'center',
		color: colors.PRIMARY,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY_LIGHT,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 10,
		fontFamily: 'Geologica-Regular',
	},
	timeLabel: {
		marginTop: 4,
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		fontFamily: 'Geologica-Regular',
	},
	notesInput: {
		height: 100,
		textAlignVertical: 'top',
		paddingTop: 10,
	},
	errorText: {
		color: 'red',
		fontFamily: 'Geologica-Light',
		fontSize: 12,
		marginTop: 4,
		textAlign: 'center',
	},
	inputError: {
		borderWidth: 1,
		borderColor: 'red',
	},
	detailRow: {
		flexDirection: 'row',
		marginBottom: 8,
	},
	detailLabel: {
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
		color: colors.PRIMARY,
		width: 120,
	},
	detailValue: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		flex: 1,
	},
});

export default EditJobScreen;