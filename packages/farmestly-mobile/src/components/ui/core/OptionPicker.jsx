import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../../../globals/colors';
import { formStyles } from '../form/formStyles';

/**
 * OptionPicker - A modular component for selecting one option from a list
 *
 * @param {Object} props
 * @param {string} props.label - The label text displayed above the options
 * @param {string} props.description - Optional description text below the label
 * @param {Array} props.options - Array of option objects with { key, label } structure
 * @param {string} props.value - The currently selected option key
 * @param {Function} props.onChange - Callback when selection changes, receives option key
 * @param {boolean} props.allowNoneSelected - If true, allows toggling selection off (default: true)
 * @param {Object} props.containerStyle - Optional custom style for the container
 */
const OptionPicker = ({
	label,
	description,
	options = [],
	value,
	onChange,
	allowNoneSelected = true,
	containerStyle
}) => {
	const handleOptionPress = (optionKey) => {
		if (allowNoneSelected && value === optionKey) {
			// If already selected and we allow none selected, deselect it
			onChange('');
		} else {
			// Select this option
			onChange(optionKey);
		}
	};

	return (
		<View style={[styles.container, containerStyle]}>
			{label && <Text style={formStyles.formLabel}>{label}:</Text>}
			{description && <Text style={formStyles.formDescription}>{description}</Text>}
			<View style={styles.optionsContainer}>
				{options.map((option) => {
					const isSelected = value === option.key;
					return (
						<TouchableOpacity
							key={option.key}
							style={[
								styles.option,
								isSelected && styles.optionSelected
							]}
							onPress={() => handleOptionPress(option.key)}
							activeOpacity={0.7}
						>
							<Text style={[
								styles.optionText,
								isSelected && styles.optionTextSelected
							]}>
								{option.label}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginBottom: 16
	},
	optionsContainer: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 8
	},
	option: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		backgroundColor: colors.PRIMARY_LIGHT + '15',
		borderWidth: 2,
		borderColor: 'transparent',
		alignItems: 'center',
		justifyContent: 'center'
	},
	optionSelected: {
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.SECONDARY
	},
	optionText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
		textAlign: 'center'
	},
	optionTextSelected: {
		fontFamily: 'Geologica-Medium',
		color: colors.PRIMARY
	}
});

export default OptionPicker;
