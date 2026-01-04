import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import colors from '../../globals/colors';
import { FormikHelper, FormInput } from '../../utils/FormikHelper';

const { width } = Dimensions.get('screen');

/**
 * StepEmail - Optional email step in setup wizard
 *
 * Collects the user's email address for receiving reports and notifications.
 * This step is skippable - users can proceed without entering an email.
 *
 * @param {Object} props
 * @param {Object} props.state - Current wizard state
 * @param {Function} props.updateState - Update wizard state
 * @param {Function} props.onNext - Navigate to next step
 * @param {Function} props.onBack - Navigate to previous step
 */
const StepEmail = ({ state, updateState, onNext, onBack }) => {
	return (
		<View style={styles.wizardPageContainer}>
			<View style={styles.titleContainer}>
				<Text style={styles.titleText}>Add your email</Text>
				<Text style={styles.titleDesc}>
					Enter your email to receive farm reports and notifications.
				</Text>
			</View>

			<FormikHelper
				initialValues={{ email: state.email || '' }}
				onSubmit={(values) => {
					updateState({ email: values.email });
				}}
			>
				{({ values }) => {
					// Update wizard state whenever value changes
					useEffect(() => {
						updateState({ email: values.email });
					}, [values.email]);

					return (
						<FormInput
							name="email"
							label="Email"
							placeholder="your@email.com"
							keyboardType="email-address"
							autoCapitalize="none"
							autoCorrect={false}
							isLast={true}
						/>
					);
				}}
			</FormikHelper>

			<View style={styles.infoContainer}>
				<Text style={styles.infoText}>
					You can skip this step and add your email later in Settings.
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	wizardPageContainer: {
		width: width,
		padding: 34
	},
	titleContainer: {
		marginBottom: 20,
		marginTop: 15,
	},
	titleText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 28,
		color: colors.PRIMARY
	},
	titleDesc: {
		color: colors.PRIMARY_LIGHT,
		fontSize: 19,
		fontFamily: 'Geologica-Regular'
	},
	infoContainer: {
		marginTop: 16,
		paddingLeft: 2
	},
	infoText: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT
	}
});

export default StepEmail;
