import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import colors from '../../globals/colors';
import PrimaryButton from '../ui/core/PrimaryButton';
import RecordingDot from '../ui/core/RecordingDot';
import JobService from '../../utils/JobService';
import { useBottomSheet } from './BottomSheetContextProvider';

const pauseIcon = require('../../assets/icons/pause.png');

/**
 * Format milliseconds to HH:MM:SS or MM:SS
 */
const formatTime = (ms) => {
	const totalSeconds = Math.floor(ms / 1000);
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;

	if (h > 0) {
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}
	return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Get human-readable job title from recording data
 */
const getJobTitle = (recording) => {
	if (!recording) return 'Recording Job';
	if (recording.jobType === 'sow') return 'Sowing';
	if (recording.jobType === 'harvest') return 'Harvesting';
	if (recording.jobType === 'spray') return 'Spraying';
	return recording.jobTitle || 'Recording Job';
};

const ActiveRecordingSheet = ({ fieldId, onStop }) => {
	const { closeBottomSheet } = useBottomSheet();
	const [recording, setRecording] = useState(() =>
		JobService.getActive(fieldId)
	);
	const [batchStatus, setBatchStatus] = useState(() =>
		JobService.getBatchStatus()
	);

	useEffect(() => {
		const unsubscribe = JobService.on((event) => {
			if (event === 'tick' || event === 'change') {
				setRecording(JobService.getActive(fieldId));
				setBatchStatus(JobService.getBatchStatus());
			}
		});
		return unsubscribe;
	}, [fieldId]);

	if (!recording) return null;

	const isPaused = recording.status === 'paused';
	const isBatch = batchStatus !== null;
	const pendingFields = isBatch ? batchStatus.pendingFields : [];
	const hasPending = pendingFields.length > 0;

	const handlePause = () => {
		JobService.pause(fieldId);
	};

	const handleResume = () => {
		JobService.resume(fieldId);
	};

	const handleStop = () => {
		onStop(fieldId);
	};

	const handleAdvanceBatch = async (nextFieldId) => {
		try {
			await JobService.advanceBatch(nextFieldId);
			closeBottomSheet();
		} catch (error) {
			closeBottomSheet();
		}
	};

	return (
		<BottomSheetScrollView style={styles.container}>
			<View style={styles.topContainer}>
				<View style={styles.jobInfoContainer}>
					<Text style={styles.jobTitle}>{getJobTitle(recording)}</Text>
					<Text style={styles.fieldName}>{recording.fieldName || ''}</Text>

					{/* Batch Progress */}
					{isBatch && (
						<View style={styles.batchProgress}>
							<Text style={styles.batchProgressText}>
								Field {batchStatus.fieldIndex + 1} of {batchStatus.totalFields}
							</Text>
							{hasPending && (
								<Text style={styles.nextFieldText}>
									Next: {pendingFields[0].fieldName}
								</Text>
							)}
						</View>
					)}
				</View>

				<View style={styles.timerContainer}>
					{isPaused ? (
						<Image source={pauseIcon} style={styles.pauseIcon} />
					) : (
						<RecordingDot size={14} color="#FF3B30" style={{ marginRight: 12 }} />
					)}
					<Text style={styles.timer}>
					{formatTime(isBatch ? (batchStatus?.totalElapsedTime || 0) : (recording.elapsedTime || 0))}
				</Text>
				</View>
			</View>

			{/* Batch Mode: Advanced Controls */}
			{isBatch && hasPending ? (
				<View style={styles.buttonContainer}>
					<PrimaryButton
						text={isPaused ? 'Resume' : 'Pause'}
						variant="outline"
						onPress={isPaused ? handleResume : handlePause}
						style={styles.button}
					/>
					<PrimaryButton
						text={`Complete & Start ${pendingFields[0].fieldName}`}
						onPress={() => handleAdvanceBatch(pendingFields[0].fieldId)}
						style={styles.button}
					/>
					<PrimaryButton
						text="Stop Batch Now"
						variant="red"
						onPress={handleStop}
						// style={[styles.button, styles.endButton]}
					/>

					{/* Pending Fields Selector */}
					{pendingFields.length > 1 && (
						<View style={styles.pendingSection}>
							<Text style={styles.pendingSectionTitle}>Or jump to:</Text>
							{pendingFields.slice(1).map(pf => (
								<TouchableOpacity
								key={`pending-${pf.fieldIndex ?? String(pf.fieldId ?? pf.fieldName)}`}
									style={styles.pendingFieldItem}
									onPress={() => handleAdvanceBatch(pf.fieldId)}
								>
									<Text style={styles.pendingFieldName}>• {pf.fieldName}</Text>
									<Text style={styles.pendingFieldAction}>Start →</Text>
								</TouchableOpacity>
							))}
						</View>
					)}
				</View>
			) : (
				/* Last Field in Batch OR Single Field Mode */
				<View style={styles.buttonContainer}>
					<PrimaryButton
						text={isPaused ? 'Resume' : 'Pause'}
						variant="outline"
						onPress={isPaused ? handleResume : handlePause}
						style={styles.button}
					/>
					<PrimaryButton
						text="Complete"
						onPress={handleStop}
						style={[styles.button, styles.endButton]}
					/>
				</View>
			)}
		</BottomSheetScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 24,
		paddingBottom: 28,
	},
	topContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	jobInfoContainer: {
		marginBottom: 16,
	},
	jobTitle: {
		color: colors.PRIMARY,
		fontFamily: 'Geologica-Bold',
		fontSize: 21,
	},
	fieldName: {
		color: colors.SECONDARY,
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
	},
	timerContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 20,
	},

	pauseIcon: {
		width: 20,
		height: 20,
		tintColor: '#FF9500',
		marginRight: 12,
	},
	timer: {
		color: colors.PRIMARY,
		fontFamily: 'RobotoMono-Bold',
		fontSize: 40,
	},
	buttonContainer: {
		width: '100%',
		gap: 12,
	},
	button: {
		width: '100%',
	},
	endButton: {
		backgroundColor: '#FF3B30',
	},
	batchProgress: {
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: colors.SECONDARY_LIGHT,
	},
	batchProgressText: {
		color: colors.SECONDARY,
		fontFamily: 'Geologica-Medium',
		fontSize: 14,
	},
	nextFieldText: {
		color: colors.PRIMARY_LIGHT,
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		marginTop: 4,
	},
	pendingSection: {
		marginTop: 16,
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: colors.SECONDARY_LIGHT,
	},
	pendingSectionTitle: {
		color: colors.PRIMARY_LIGHT,
		fontFamily: 'Geologica-Medium',
		fontSize: 14,
		marginBottom: 8,
	},
	pendingFieldItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 12,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 8,
		marginBottom: 8,
	},
	pendingFieldName: {
		color: colors.PRIMARY,
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
	},
	pendingFieldAction: {
		color: colors.SECONDARY,
		fontFamily: 'Geologica-Medium',
		fontSize: 13,
	},
});

export default ActiveRecordingSheet;