import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import PrimaryButton from './ui/core/PrimaryButton';
import colors from '../globals/colors';

/**
 * MultiSelectOverlay
 *
 * Displays a bottom bar when multiple fields are selected on the map,
 * showing the count and total area with options to clear or start a batch job.
 */
const MultiSelectOverlay = ({ selectedFields, totalArea, onClear, onStartJob }) => {
	const canStartJob = selectedFields.length > 1;
	const fieldText = selectedFields.length === 1 ? 'field selected' : 'fields selected';

	return (
		<Animated.View
			entering={SlideInDown.duration(200)}
			exiting={SlideOutDown.duration(200)}
			style={styles.container}
		>
			<View style={styles.content}>
				<View style={styles.infoSection}>
					<Text style={styles.countText}>
						{selectedFields.length} {fieldText}
					</Text>
					<Text style={styles.areaText}>
						{totalArea}
					</Text>
					{!canStartJob && (
						<Text style={styles.hintText}>
							Select 2+ fields to start a batch job
						</Text>
					)}
				</View>

				<View style={styles.actionsSection}>
					<TouchableOpacity style={styles.clearButton} onPress={onClear}>
						<Text style={styles.clearText}>Clear</Text>
					</TouchableOpacity>

					<PrimaryButton
						text="Start Job"
						onPress={onStartJob}
						style={styles.startButton}
						disabled={!canStartJob}
					/>
				</View>
			</View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: 'white',
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 8,
	},
	content: {
		paddingHorizontal: 20,
		paddingVertical: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	infoSection: {
		flex: 1,
		marginRight: 16,
	},
	countText: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.TEXT_PRIMARY,
		marginBottom: 4,
	},
	areaText: {
		fontSize: 14,
		color: colors.TEXT_SECONDARY,
	},
	hintText: {
		fontSize: 12,
		color: colors.TEXT_TERTIARY,
		marginTop: 4,
		fontStyle: 'italic',
	},
	actionsSection: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	clearButton: {
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	clearText: {
		fontSize: 15,
		fontWeight: '600',
		color: colors.SECONDARY,
	},
	startButton: {
		minWidth: 120,
	},
});

export default MultiSelectOverlay;
