import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * ComplianceBadge - Displays REI (Re-Entry Interval) or PHI (Pre-Harvest Interval) badges
 *
 * @param {string} type - 'rei' or 'phi'
 * @param {number} remaining - Remaining time (hours for REI, days for PHI)
 * @param {boolean} compact - If true, shows only type label without amount (e.g., "REI" instead of "REI: 24h")
 * @param {object} style - Additional styles for the badge container
 */
const ComplianceBadge = ({ type, remaining, compact = false, style }) => {
	if (!type || (!compact && (!remaining || remaining <= 0))) {
		return null;
	}

	const isREI = type.toLowerCase() === 'rei';
	const label = isREI ? 'REI' : 'PHI';
	const badgeStyle = isREI ? styles.reiBadge : styles.phiBadge;

	// Format remaining time
	let displayText = label;
	if (!compact && remaining) {
		displayText = isREI ? `${label}: ${remaining}h` : `${label}: ${remaining}d`;
	}

	return (
		<View style={[styles.badge, badgeStyle, style]}>
			<Text style={styles.badgeText}>{displayText}</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	badge: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 12,
	},
	reiBadge: {
		backgroundColor: '#FFA000',
	},
	phiBadge: {
		backgroundColor: '#F44336',
	},
	badgeText: {
		color: 'white',
		fontSize: 10,
		fontFamily: 'Geologica-Bold',
		lineHeight: 12,
	},
});

export default ComplianceBadge;
