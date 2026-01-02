import React from 'react';
import { api } from '../../globals/api';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import colors from '../../globals/colors';
import PrimaryButton from '../ui/core/PrimaryButton';
import FieldLabel from '../ui/core/FieldLabel';

const JobConfirmationSheet = ({ recording, onConfirm, onCancel }) => {
	const formatDuration = (ms) => {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		let result = '';
		if (hours > 0) {
			result += `${hours} hour${hours !== 1 ? 's' : ''} `;
		}
		if (minutes > 0 || hours > 0) {
			result += `${minutes} minute${minutes !== 1 ? 's' : ''} `;
		}
		result += `${seconds} second${seconds !== 1 ? 's' : ''}`;

		return result;
	};

	const getJobTypeName = (jobType) => {
		switch (jobType) {
			case 'sow':
				return 'Sowing';
			case 'harvest':
				return 'Harvesting';
			case 'spray':
				return 'Spraying';
			case 'custom':
				return recording.jobTitle || 'Custom Job';
			default:
				return 'Job';
		}
	};

	return (
		<BottomSheetView style={styles.container}>
			<Text style={styles.title}>End Recording?</Text>

			<View style={styles.messageContainer}>
				<Text style={styles.message}>
					Are you sure you want to end the {getJobTypeName(recording.jobType)} recording for{' '}
				</Text>
				<FieldLabel
					fieldId={recording.fieldId}
					fieldName={recording.fieldName}
					showCompliance={true}
					compactBadges={true}
					textStyle={styles.fieldNameText}
				/>
				<Text style={styles.message}>?</Text>
			</View>

			<Text style={styles.duration}>
				Duration: {formatDuration(recording.elapsedTime)}
			</Text>

			<View style={styles.buttonsContainer}>
				<PrimaryButton
					text="Yes, End Recording"
					onPress={onConfirm}
				/>

				<PrimaryButton
					text="No, Continue"
					variant="outline"
					onPress={onCancel}
				/>
			</View>
		</BottomSheetView>
	);
};

const styles = StyleSheet.create({
	container: {
		padding: 24,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		marginBottom: 16,
		textAlign: 'center',
	},
	messageContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 16,
	},
	message: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		textAlign: 'center',
	},
	fieldNameText: {
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
		color: colors.PRIMARY,
	},
	duration: {
		fontFamily: 'Geologica-Medium',
		fontSize: 18,
		color: colors.SECONDARY,
		marginBottom: 24,
		textAlign: 'center',
	},
	buttonsContainer: {
		gap: 15,
	},
});

export default JobConfirmationSheet;