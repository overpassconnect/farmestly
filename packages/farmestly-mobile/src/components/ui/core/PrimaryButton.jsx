import React, { useEffect } from 'react';
import { api } from '../../../globals/api';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, ActivityIndicator } from 'react-native';

import colors from '../../../globals/colors';
// components/ui/PrimaryButton.jsx
const PrimaryButton = ({
	text,
	onPress,
	loading = false,
	disabled = false,
	variant = 'filled',
	fullWidth = false,
	style,
	showTime = false,
	currentTime = '',
	timeColor = null,
	leftIcon = null,
}) => {

	return (
		<TouchableOpacity
			style={[
				styles.button,
				variant === 'outline' && styles.buttonOutline,
				variant === 'ghost' && styles.buttonGhost,
				variant === 'red' && styles.buttonRed,
				variant === 'redOutline' && styles.buttonRedOutline,
				disabled && styles.buttonDisabled,
				fullWidth && styles.fullWidth,
				style,  // Allow custom styles
			]}
			onPress={onPress}
			disabled={disabled}
			activeOpacity={0.7}

		>
			{loading ? (
				<ActivityIndicator
					color={variant === 'outline' ? colors.SECONDARY : variant === 'ghost' ? colors.PRIMARY : '#fff'}
				/>
			) : (
				<View style={styles.contentContainer}>
					{leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
					<Text style={[
						styles.text,
						variant === 'outline' && styles.textOutline,
						variant === 'ghost' && styles.textGhost,
						variant === 'red' && styles.textRed,
						variant === 'redOutline' && styles.textRedOutline,
						disabled && styles.textDisabled,
					]}>
						{text}
					</Text>
					{showTime && currentTime && (
						<Text style={[
							styles.timeText,
							variant === 'red' && styles.textRed,
							variant === 'redOutline' && styles.textRedOutline,
							timeColor && { color: timeColor },
						]}>
							{currentTime}
						</Text>
					)}
				</View>
			)}
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	button: {
		height: 48,
		borderRadius: 24,
		backgroundColor: colors.SECONDARY,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
		// NO margins - let parent control spacing
	},
	buttonOutline: {
		backgroundColor: 'white',
		borderWidth: 2,
		borderColor: colors.SECONDARY,
	},
	buttonGhost: {
		backgroundColor: 'transparent',
		borderWidth: 0,
	},
	buttonRed: {
		backgroundColor: '#FF4444',
	},
	buttonRedOutline: {
		backgroundColor: 'white',
		borderWidth: 2,
		borderColor: '#FF3B30',
	},
	buttonDisabled: {
		backgroundColor: '#ccc',
		borderColor: '#ccc',
	},
	fullWidth: {
		width: '100%',
	},
	contentContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	leftIcon: {
		marginRight: 0,
	},
	text: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: '#fff',
	},
	textOutline: {
		color: colors.SECONDARY,
	},
	textGhost: {
		color: colors.PRIMARY,
	},
	textRed: {
		color: '#fff',
	},
	textRedOutline: {
		color: '#FF3B30',
	},
	textDisabled: {
		color: '#888',
	},
	timeText: {
		fontFamily: 'RobotoMono-Medium',
		fontSize: 16,
		color: '#fff',
	},
});

export default PrimaryButton;