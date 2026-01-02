import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import PrimaryButton from './ui/core/PrimaryButton';
import RecordingDot from './ui/core/RecordingDot';
import { useRecordingTime } from '../hooks/useRecordingTime';
import colors from '../globals/colors';

const pauseIcon = require('../assets/icons/pause.png');

const formatTime = (ms) => {
	if (!ms) return '00:00';
	const totalSeconds = Math.floor(ms / 1000);
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	const pad = n => n.toString().padStart(2, '0');
	return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const getJobTitle = (recording) => {
	if (!recording) return 'Recording';
	if (recording.jobType === 'sow') return 'Sowing';
	if (recording.jobType === 'harvest') return 'Harvesting';
	if (recording.jobType === 'spray') return 'Spraying';
	return recording.jobTitle || 'Recording Job';
};

const RecordingFAB = ({ fieldId, onPress, bottom, batch }) => {
	const recording = useRecordingTime(fieldId);

	if (!recording) return null;

	const isPaused = recording.status === 'paused';
	const jobTitle = getJobTitle(recording);
	const hasBatch = batch && batch.fieldIds && batch.fieldIds.length > 1;

	const leftIcon = isPaused ? (
		<Image source={pauseIcon} style={styles.pauseIcon} />
	) : (
		<RecordingDot size={10} color="#FFFFFF" />
	);

	return (
		<Animated.View
			entering={SlideInDown.duration(200)}
			exiting={SlideOutDown.duration(200)}
			style={[styles.fab, { bottom }]}
		>
			<View style={styles.fabContent}>
				<PrimaryButton
					text={jobTitle}
					variant={isPaused ? 'redOutline' : 'red'}
					onPress={onPress}
					showTime
					currentTime={formatTime(recording.elapsedTime || 0)}
					timeColor={isPaused ? '#FF3B30' : undefined}
					leftIcon={leftIcon}
					withShadow
				/>
				{hasBatch && (
					<View style={styles.batchIndicator}>
						<Text style={styles.batchIndicatorText}>
							{batch.fieldIndex + 1}/{batch.fieldIds.length}
						</Text>
					</View>
				)}
			</View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	fab: {
		position: 'absolute',
		alignSelf: 'center',
		zIndex: 100,
	},
	fabContent: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	batchIndicator: {
		backgroundColor: colors.SECONDARY,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		marginLeft: 8,
		minWidth: 36,
		alignItems: 'center',
	},
	batchIndicatorText: {
		color: 'white',
		fontSize: 13,
		fontWeight: '600',
		fontFamily: 'Geologica-SemiBold',
	},
	pauseIcon: {
		width: 14,
		height: 14,
		tintColor: '#FF3B30',
	},
});

export default React.memo(RecordingFAB);
