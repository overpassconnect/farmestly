import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import colors from '../../../globals/colors';
import PrimaryButton from './PrimaryButton';

/**
 * EmptyState Component
 *
 * A reusable component to display empty states across the app with consistent styling.
 *
 * @param {Object} props
 * @param {any} props.icon - Icon source (require() or URI) to display above the text
 * @param {string} props.title - Main title text
 * @param {string} props.subtitle - Subtitle/description text (optional)
 * @param {string} props.actionText - Text for action button (optional)
 * @param {Function} props.onAction - Callback when action button is pressed (optional)
 * @param {string} props.actionVariant - Button variant: 'primary' or 'outline' (default: 'primary')
 * @param {boolean} props.loading - Show loading spinner instead of content (optional)
 * @param {Object} props.containerStyle - Additional styles for container (optional)
 * @param {Object} props.iconStyle - Additional styles for icon (optional)
 * @param {Object} props.titleStyle - Additional styles for title (optional)
 * @param {Object} props.subtitleStyle - Additional styles for subtitle (optional)
 */
const EmptyState = ({
	icon,
	title,
	subtitle,
	actionText,
	onAction,
	actionVariant = 'primary',
	loading = false,
	containerStyle,
	iconStyle,
	titleStyle,
	subtitleStyle
}) => {
	if (loading) {
		return (
			<View style={[styles.container, containerStyle]}>
				<ActivityIndicator size="large" color={colors.SECONDARY} />
			</View>
		);
	}

	return (
		<View style={[styles.container, containerStyle]}>
			{icon && (
				<Image
					source={icon}
					style={[styles.icon, iconStyle]}
					resizeMode="contain"
				/>
			)}

			{title && (
				<Text style={[styles.title, titleStyle]}>
					{title}
				</Text>
			)}

			{subtitle && (
				<Text style={[styles.subtitle, subtitleStyle]}>
					{subtitle}
				</Text>
			)}

			{actionText && onAction && (
				<View style={styles.buttonContainer}>
					<PrimaryButton
						text={actionText}
						onPress={onAction}
						variant={actionVariant}
					/>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
	},
	icon: {
		width: 80,
		height: 80,
		opacity: 0.3,
		marginBottom: 16,
	},
	title: {
		fontSize: 18,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginTop: 8,
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginBottom: 16,
		lineHeight: 20,
	},
	buttonContainer: {
		marginTop: 8,
		width: '100%',
		maxWidth: 300,
	},
});

export default EmptyState;
