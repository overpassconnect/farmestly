import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FormikHelper, FormInput } from '../../ui/form';
import colors from '../../../globals/colors';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useApi } from '../../../hooks/useApi';
import PrimaryButton from '../../ui/core/PrimaryButton';
import ButtonStack from '../../ui/core/ButtonGroup';

const EmailSettingsScreen = () => {
	const navigation = useNavigation();
	const route = useRoute();
	const { api } = useApi();
	const { account, updateAccountField } = useGlobalContext();
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Params for returning to previous screen with state
	const returnTo = route.params?.returnTo;
	const returnParams = route.params?.returnParams;

	const handleSubmit = async (values) => {
		setIsSubmitting(true);

		const result = await api('/settings/email', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: values.email.trim() })
		});

		setIsSubmitting(false);

		if (result.ok) {
			// Update context with new email
			updateAccountField('email', values.email.trim());

			if (returnTo) {
				navigation.replace(returnTo, returnParams);
			} else {
				navigation.goBack();
			}
		}
	};

	return (
		<KeyboardAwareScrollView
			style={styles.container}
			contentContainerStyle={styles.content}
			bottomOffset={100}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={styles.title}>Email Address</Text>
			<Text style={styles.subtitle}>
				Enter your email to receive farm reports and notifications.
			</Text>

			<FormikHelper
				initialValues={{ email: account?.email || '' }}
				onSubmit={handleSubmit}
				enableReinitialize={true}
			>
				{({ handleSubmit: formikSubmit }) => (
					<>
						<FormInput
							name="email"
							label="Email"
							placeholder="your@email.com"
							keyboardType="email-address"
							autoCapitalize="none"
							autoCorrect={false}
							isLast={true}
						/>

						<ButtonStack>
							<PrimaryButton
								text="Save Email"
								onPress={formikSubmit}
								loading={isSubmitting}
							/>
							<PrimaryButton
								text="Cancel"
								variant="outline"
								onPress={() => navigation.goBack()}
							/>
						</ButtonStack>
					</>
				)}
			</FormikHelper>
		</KeyboardAwareScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff'
	},
	keyboardAvoid: {
		flex: 1
	},
	scrollView: {
		flex: 1
	},
	content: {
		padding: 24,
		paddingBottom: 40
	},
	title: {
		fontSize: 28,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		marginBottom: 8
	},
	subtitle: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		marginBottom: 24
	},
	buttonContainer: {
		marginTop: 24,
		gap: 12
	}
});

export default EmailSettingsScreen;