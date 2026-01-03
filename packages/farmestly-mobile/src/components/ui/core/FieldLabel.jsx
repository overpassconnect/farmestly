import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ComplianceBadge from './ComplianceBadge';
import { getBadgeData, onComplianceChange } from '../../../utils/compliance';

/**
 * FieldLabel - Displays a field name with optional compliance badges (REI/PHI)
 *
 * This component efficiently handles compliance data by:
 * - Loading badge data only when needed
 * - Subscribing to compliance changes to stay updated
 * - Preventing stale state with proper cleanup
 * - Supporting both compact and full badge display modes
 *
 * @param {string|number} fieldId - The field ID (required for compliance badges)
 * @param {string} fieldName - The field name to display
 * @param {boolean} showCompliance - Whether to show compliance badges (default: false)
 * @param {boolean} compactBadges - If true, badges show only "REI"/"PHI" without amounts (default: false)
 * @param {object} textStyle - Additional styles for the field name text
 * @param {object} containerStyle - Additional styles for the container
 */
const FieldLabel = ({
	fieldId,
	fieldName,
	showCompliance = false,
	compactBadges = false,
	textStyle,
	containerStyle
}) => {
	const [badgeData, setBadgeData] = useState(null);

	// Load compliance data when needed
	useEffect(() => {
		if (!showCompliance || !fieldId) {
			setBadgeData(null);
			return;
		}

		let isMounted = true;

		// Load initial badge data
		const loadBadgeData = async () => {
			try {
				const data = await getBadgeData(fieldId);
				if (isMounted) {
					setBadgeData(data);
				}
			} catch (err) {
				console.error(`Failed to load badge data for field ${fieldId}:`, err);
				if (isMounted) {
					setBadgeData(null);
				}
			}
		};

		loadBadgeData();

		// Subscribe to compliance changes
		const unsubscribe = onComplianceChange(loadBadgeData);

		// Cleanup on unmount
		return () => {
			isMounted = false;
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [fieldId, showCompliance]);

	const hasBadges = badgeData && (badgeData.showREI || badgeData.showPHI);

	return (
		<View style={[styles.container, containerStyle]}>
			{/* Compliance badges (left side) */}
			{hasBadges && (
				<View style={styles.badgeContainer}>
					{badgeData.showREI && (
						<ComplianceBadge
							type="rei"
							remaining={badgeData.reiRemaining}
							compact={compactBadges}
						/>
					)}
					{badgeData.showPHI && (
						<ComplianceBadge
							type="phi"
							remaining={badgeData.phiRemaining}
							compact={compactBadges}
						/>
					)}
				</View>
			)}

			{/* Field name */}
			<Text style={[styles.fieldName, textStyle]} numberOfLines={1}>
				{fieldName}
			</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
	},
	badgeContainer: {
		flexDirection: 'row',
		marginRight: 8,
		gap: 4,
	},
	fieldName: {
		flexShrink: 1,
	},
});

export default FieldLabel;
