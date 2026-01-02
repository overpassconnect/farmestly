import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import colors from '../globals/colors';
import RecordingDot from './ui/RecordingDot';

const formatTime = (ms) => {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const RecordingTimer = ({ recording, onPause, onResume, onStop }) => {
	const [status, setStatus] = useState('');
	const [timeDisplay, setTimeDisplay] = useState('00:00:00');
	const timerRef = useRef(null);
	const startTimeRef = useRef(null);
	const pausedElapsedRef = useRef(0);
	const mountedRef = useRef(false);

	// Helper to clear timer safely
	const clearTimer = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	};

	// Helper to start timer
	const startTimer = () => {
		clearTimer();
		startTimeRef.current = Date.now();
		timerRef.current = setInterval(() => {
			const elapsed = Date.now() - startTimeRef.current + pausedElapsedRef.current;
			setTimeDisplay(formatTime(elapsed));
		}, 1000);
	};

	// Initial mount only - sync from recording prop ONCE
	useEffect(() => {
		if (!recording || mountedRef.current) return;
		mountedRef.current = true;

		setStatus(recording.status);
		pausedElapsedRef.current = recording.elapsedTime || 0;
		setTimeDisplay(formatTime(recording.elapsedTime || 0));

		if (recording.status === 'running') {
			startTimer();
		}

		return clearTimer;
	}, [recording]);

	// Cleanup on unmount only
	useEffect(() => {
		return clearTimer;
	}, []);

	const handlePause = () => {
		// Capture elapsed BEFORE clearing
		if (startTimeRef.current) {
			pausedElapsedRef.current = Date.now() - startTimeRef.current + pausedElapsedRef.current;
		}
		clearTimer();
		setStatus('paused');
		onPause();
	};

	const handleResume = () => {
		setStatus('running');
		startTimer();
		onResume();
	};

	const handleStop = () => {
		clearTimer();
		onStop();
	};

	const isPaused = status === 'paused';

	if (!recording) return null;

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<View style={styles.leftSection}>
					<View style={styles.recordIndicator}>
						{isPaused ? (
							<RecordingDot
								size={12}
								icon={require('../assets/icons/pause.png')}
								iconTintColor="red"
								blinking={false}
								style={{ marginRight: 5 }}
							/>
						) : (
							<RecordingDot
								size={12}
								color="red"
								blinking={true}
								style={{ marginRight: 5 }}
							/>
						)}
						{isPaused ?
							<Text style={styles.recordingStatus}>PAUSED</Text> :
							<Text style={styles.recordingStatus}>REC</Text>
						}
					</View>

					<View style={styles.jobInfo}>
						<Text style={styles.jobTitle} numberOfLines={1}>
							{recording.jobType === 'sow' ? 'Sowing' :
								recording.jobType === 'harvest' ? 'Harvesting' :
									recording.jobType === 'spray' ? 'Spraying' :
										recording.jobTitle || 'Job'}
						</Text>
						<Text style={styles.fieldName} numberOfLines={1}>
							{recording.fieldName || ''}
						</Text>
					</View>
				</View>

				<View style={styles.rightSection}>
					<Text style={styles.timer}>
						{timeDisplay}
					</Text>

					<View style={styles.controls}>
						{isPaused ? (
							<TouchableOpacity
								style={styles.controlButton}
								onPress={handleResume}
							>
								<Image
									source={require('../assets/icons/play.png')}
									style={styles.controlIcon}
									resizeMode="contain"
								/>
							</TouchableOpacity>
						) : (
							<TouchableOpacity
								style={styles.controlButton}
								onPress={handlePause}
							>
								<Image
									source={require('../assets/icons/pause.png')}
									style={styles.controlIcon}
									resizeMode="contain"
								/>
							</TouchableOpacity>
						)}

						<TouchableOpacity
							style={styles.controlButton}
							onPress={handleStop}
						>
							<Image
								source={require('../assets/icons/stop.png')}
								style={styles.controlIcon}
								resizeMode="contain"
							/>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		bottom: 120,
		left: 20,
		right: 20,
		backgroundColor: 'white',
		borderRadius: 18,
		borderColor: 'red',
		borderWidth: 3,
		padding: 10,
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		zIndex: 999,
	},
	content: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	leftSection: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 2,
	},
	recordIndicator: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 12,
	},
    
	recordingStatus: {
		color: colors.PRIMARY,
		fontFamily: 'Geologica-Bold',
		fontSize: 14,
	},
	jobInfo: {
		flex: 1,
	},
	jobTitle: {
		color: colors.PRIMARY,
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
	},
	fieldName: {
		color: colors.SECONDARY,
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
	},
	rightSection: {
		flex: 1,
		alignItems: 'flex-end',
	},
	timer: {
		color: colors.PRIMARY,
		fontFamily: 'RobotoMono-Medium',
		fontSize: 18,
	},
	controls: {
		flexDirection: 'row',
		marginTop: 4,
	},
	controlButton: {
		width: 30,
		height: 30,
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 12,
	},
	controlIcon: {
		width: 20,
		height: 20,
		tintColor: colors.PRIMARY,
	},
});

export default RecordingTimer;