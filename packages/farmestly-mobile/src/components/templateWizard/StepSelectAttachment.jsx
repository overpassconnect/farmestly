import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import colors from '../../globals/colors';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useUnits } from '../../providers/UnitsProvider';
import ListItem from '../ui/list/ListItem';
import PrimaryButton from '../ui/core/PrimaryButton';

const StepSelectAttachment = ({ state, updateState, onNext, onBack }) => {
	const { t } = useTranslation(['common']);
	const navigation = useNavigation();
	const { farmData } = useGlobalContext();
	const { formatRateValue, formatValue } = useUnits();
	const [validationError, setValidationError] = useState('');

	const selectedAttachmentId = state.attachmentId;
	const jobType = state.type;

	// Filter attachments based on job type
	const filteredAttachments = useMemo(() => {
		const attachments = farmData?.attachments || [];

		switch (jobType) {
			case 'spray':
				return attachments.filter(a => a.usedFor === 'spray');
			case 'irrigate':
				return attachments.filter(a => a.usedFor === 'irrigate');
			default:
				return attachments;
		}
	}, [farmData?.attachments, jobType]);

	const handleSelectAttachment = (attachmentId) => {
		// Toggle selection - if already selected, deselect it
		if (selectedAttachmentId === attachmentId) {
			updateState({
				attachmentId: null,
				sprayConfig: {
					...state.sprayConfig,
					carrierRate: ''
				}
			});
			setValidationError('');
			return;
		}

		const attachment = filteredAttachments.find(a => a._id === attachmentId);

		// Extract default carrier rate or liters per hour
		let updates = { attachmentId };

		if (attachment) {
			if (jobType === 'spray' && attachment.defaultCarrierRate) {
				// Convert from base units (L/m²) to user's preferred units (e.g., L/ha)
				const formattedRate = formatRateValue(attachment.defaultCarrierRate);
				updates.sprayConfig = {
					...state.sprayConfig,
					carrierRate: formattedRate?.toString() || ''
				};
			}
		}

		updateState(updates);
		setValidationError('');
		// Immediately advance to next step after selection
		onNext();
	};

	const handleAddAttachment = () => {
		const params = {
			entityType: 'attachment',
			isAdding: true
		};

		// Pre-set usedFor for spray/irrigate types
		if (jobType === 'spray') {
			params.usedFor = 'spray';
		} else if (jobType === 'irrigate') {
			params.usedFor = 'irrigate';
		}

		navigation.navigate('EditEntityScreen', params);
	};

	const isRequired = jobType === 'irrigate';

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Select Attachment</Text>
			<Text style={styles.subtitle}>
				{isRequired ? 'Required for this job type' : 'Choose an attachment for this template (optional)'}
			</Text>

			{validationError ? (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{validationError}</Text>
				</View>
			) : null}

			{filteredAttachments.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>
						{jobType === 'spray' && 'No sprayers available'}
						{jobType === 'irrigate' && 'No irrigation attachments available'}
						{jobType !== 'spray' && jobType !== 'irrigate' && 'This farm has no attachments'}
					</Text>
					<Text style={styles.emptyTextSub}>
						{jobType === 'spray' && 'You need an attachment with spray capability'}
						{jobType === 'irrigate' && 'You need an attachment with irrigation capability'}
						{jobType !== 'spray' && jobType !== 'irrigate' && 'Do you want to add one now?'}
					</Text>
					<PrimaryButton
						text="Add Attachment"
						onPress={handleAddAttachment}
						style={{ marginTop: 20, width: 220 }}
					/>
				</View>
			) : (
				<ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
					{filteredAttachments.map((attachment) => {
						const isSelected = selectedAttachmentId === attachment._id;

						return (
							<TouchableOpacity
								key={attachment._id}
								style={[
									styles.itemContainer,
									isSelected && styles.selectedItem
								]}
								onPress={() => handleSelectAttachment(attachment._id)}
							>
								<ListItem
									icon={require('../../assets/icons/plow_brown.png')}
									title={attachment.name}
									subTitle1={attachment.make}
									subTitle2={attachment.type}
									timeCount={formatValue(attachment.powerOnTime, 'time')}
									showChevron={false}
									showRadio={true}
									isSelected={isSelected}
								/>
							</TouchableOpacity>
						);
					})}
				</ScrollView>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white'
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		paddingHorizontal: 34,
		paddingTop: 20,
		marginBottom: 8
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		paddingHorizontal: 34,
		marginBottom: 20
	},
	errorContainer: {
		marginHorizontal: 34,
		marginBottom: 16,
		padding: 12,
		backgroundColor: '#ffebee',
		borderRadius: 8,
		borderLeftWidth: 4,
		borderLeftColor: '#f44336'
	},
	errorText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: '#c62828'
	},
	scrollView: {
		flex: 1,
		paddingHorizontal: 16
	},
	itemContainer: {
		marginBottom: 8,
		borderRadius: 8,
		overflow: 'hidden'
	},
	selectedItem: {
		backgroundColor: colors.SECONDARY_LIGHT
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 34
	},
	emptyText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 20,
		color: colors.PRIMARY,
		textAlign: 'center'
	},
	emptyTextSub: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginTop: 8
	}
});

export default StepSelectAttachment;
