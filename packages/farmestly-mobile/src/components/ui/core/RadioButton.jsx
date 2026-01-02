import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import colors from '../../../globals/colors';

const RadioButton = ({
	label,
	selected = false,
	onPress,
	onLongPress,
	icon,
	description,
	style,
	disabled = false
}) => {
	return (
		<TouchableOpacity
			style={[styles.container, disabled && styles.containerDisabled, style]}
			onPress={disabled ? undefined : onPress}
			onLongPress={disabled ? undefined : onLongPress}
			activeOpacity={disabled ? 1 : 0.7}
			disabled={disabled}
		>
			<View style={styles.content}>
				{icon && <Image source={icon} style={[styles.icon, disabled && styles.iconDisabled]} />}
				<View style={styles.textContainer}>
					<Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
					{description && (
						<Text style={[styles.description, disabled && styles.descriptionDisabled]}>{description}</Text>
					)}
				</View>
			</View>
			<View style={[styles.radio, selected && styles.radioSelected, disabled && styles.radioDisabled]}>
				{selected && <View style={[styles.radioDot, disabled && styles.radioDotDisabled]} />}
			</View>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	icon: {
		width: 24,
		height: 24,
		marginRight: 12,
	},
	textContainer: {
		flex: 1,
	},
	label: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
	},
	description: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		marginTop: 2,
	},
	radio: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 2,
		borderColor: colors.PRIMARY_LIGHT,
		alignItems: 'center',
		justifyContent: 'center',
		marginLeft: 12,
	},
	radioSelected: {
		borderColor: colors.SECONDARY,
	},
	radioDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: colors.SECONDARY,
	},
	containerDisabled: {
		opacity: 0.5,
	},
	labelDisabled: {
		color: colors.PRIMARY_LIGHT,
	},
	descriptionDisabled: {
		color: colors.PRIMARY_LIGHT,
	},
	iconDisabled: {
		opacity: 0.5,
	},
	radioDisabled: {
		borderColor: colors.PRIMARY_LIGHT,
	},
	radioDotDisabled: {
		backgroundColor: colors.PRIMARY_LIGHT,
	},
});

export default RadioButton;
