
import { View, StyleSheet } from 'react-native';
import React from 'react';

export const ButtonStack = ({ children, style }) => {
	const childrenArray = React.Children.toArray(children);

	return (
		<View style={[stackStyles.container, style]}>
			{childrenArray.map((child, index) => (
				<View
					key={index}
					style={index < childrenArray.length - 1 ? stackStyles.buttonSpacing : null}
				>
					{child}
				</View>
			))}
		</View>
	);
};

const stackStyles = StyleSheet.create({
	container: {
		// paddingHorizontal: 24,
		paddingVertical: 16,
	},
	buttonSpacing: {
		// marginTop: 10,
		marginBottom: 18,
	},
});

export default ButtonStack;

// For floating buttons at bottom of screen
export const FloatingButtonContainer = ({ children, style }) => (
	<View style={[styles.floating, style]}>
		{children}
	</View>
);

const styles = StyleSheet.create({
	stack: {
		gap: 12,
		paddingHorizontal: 24,
		paddingVertical: 16,
	},
	floating: {
		position: 'absolute',
		bottom: 100,  // Above tab bar
		left: 24,
		right: 24,
		gap: 12,
	},
});