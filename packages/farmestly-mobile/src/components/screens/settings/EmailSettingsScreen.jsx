import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { FormikHelper, FormInput } from '../../ui/form';
import colors from '../../../globals/colors';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useApi } from '../../../hooks/useApi';
import PrimaryButton from '../../ui/core/PrimaryButton';
import ButtonStack from '../../ui/core/ButtonGroup';
import VerificationBadge from '../../ui/core/VerificationBadge';

const EmailSettingsScreen = () => {
	const { t } = useTranslation(['alerts', 'screens', 'common']);
	const navigation = useNavigation();
	const route = useRoute();
	const insets = useSafeAreaInsets();
	const { api } = useApi();
	const { account, setAccount } = useGlobalContext();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResending, setIsResending] = useState(false);

	// Params for returning to previous screen with state
	const returnTo = route.params?.returnTo;
	const returnParams = route.params?.returnParams;

	// Email states
	const verifiedEmail = account?.email || null;
	const pendingEmail = account?.emailPending || null;
	const hasPending = !!pendingEmail;

	const handleSubmit = async (values) => {
		setIsSubmitting(true);

		const result = await api('/settings/email', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: values.email.trim() })
		});

		setIsSubmitting(false);

		if (result.ok) {
			// Update context: new email goes to pending
			setAccount(prev => ({
				...prev,
				emailPending: values.email.trim()
			}));

			// Show success toast
			Toast.show({
				type: 'success',
				text1: t('alerts:success'),
				text2: t('alerts:successes.VERIFICATION_EMAIL_SENT'),
				position: 'top',
				visibilityTime: 4500,
				topOffset: insets.top + 20,
				autoHide: true
			});

			if (returnTo) {
				navigation.replace(returnTo, returnParams);
			} else {
				navigation.goBack();
			}
		}

		// Return result so FormikHelper can parse validation errors
		return result;
	};

	const handleResendVerification = async () => {
		setIsResending(true);

		const result = await api('/settings/email/resend', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		setIsResending(false);

		if (result.ok) {
			Toast.show({
				type: 'success',
				text1: t('alerts:success'),
				text2: t('alerts:successes.VERIFICATION_EMAIL_SENT'),
				position: 'top',
				visibilityTime: 4500,
				topOffset: insets.top + 20,
				autoHide: true
			});
		}
	};

	return (
		<KeyboardAwareScrollView
			style={styles.container}
			contentContainerStyle={styles.content}
			bottomOffset={100}
			keyboardShouldPersistTaps="handled"
		>
			<Text style={styles.title}>{t('screens:emailSettings.title')}</Text>
			<Text style={styles.subtitle}>
				{t('screens:emailSettings.subtitle')}
			</Text>

			<FormikHelper
				initialValues={{ email: pendingEmail || '' }}
				onSubmit={handleSubmit}
				enableReinitialize={true}
			>
				{({ handleSubmit: formikSubmit, values }) => {
					const currentEmail = values.email?.trim() || '';
					const emailChanged = currentEmail !== (pendingEmail || '');

					// Button states:
					// 1. Has pending, not changed -> "Resend Verification"
					// 2. Has pending, changed -> "Change Email"
					// 3. No pending -> "Save Email"
					const showResend = hasPending && !emailChanged;

					const getButtonText = () => {
						if (showResend) {
							return isResending ? t('screens:emailSettings.sending') : t('screens:emailSettings.resendVerification');
						}
						if (!hasPending) {
							return t('screens:emailSettings.saveEmail');
						}
						return t('screens:emailSettings.changeEmail');
					};

					const getButtonDisabled = () => {
						if (showResend) return false;
						if (!currentEmail) return true;
						return false;
					};

					return (
						<>
							{/* Show current verified email if exists */}
							{verifiedEmail && (
								<View style={styles.verifiedEmailSection}>
									<View style={styles.statusRow}>
										<Text style={styles.statusLabel}>{t('screens:emailSettings.currentEmail')}</Text>
										<Text style={styles.verifiedEmailValue}>{verifiedEmail}</Text>
									</View>
								</View>
							)}

							{/* Form for new/pending email */}
							<FormInput
								name="email"
								label={verifiedEmail ? t('screens:emailSettings.newEmail') : t('screens:emailSettings.email')}
								placeholder={t('screens:emailSettings.placeholder')}
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								isLast={true}
								description={verifiedEmail ? t('screens:emailSettings.description') : undefined}
							/>

							{/* Pending status - only show when email hasn't changed */}
							{hasPending && !emailChanged && (
								<View style={styles.verificationSection}>
									<View style={styles.statusRow}>
										<Text style={styles.statusLabel}>{t('screens:emailSettings.status')}</Text>
										<VerificationBadge verified={false} size="large" />
									</View>
								</View>
							)}

							<ButtonStack>
								<PrimaryButton
									text={getButtonText()}
									onPress={showResend ? handleResendVerification : formikSubmit}
									loading={showResend ? isResending : isSubmitting}
									disabled={getButtonDisabled()}
								/>
								<PrimaryButton
									text={t('common:buttons.cancel')}
									variant="outline"
									onPress={() => navigation.goBack()}
								/>
							</ButtonStack>
						</>
					);
				}}
			</FormikHelper>
		</KeyboardAwareScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff'
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
	verifiedEmailSection: {
		marginBottom: 16,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT
	},
	verifiedEmailValue: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT
	},
	verificationSection: {
		marginBottom: 24
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8
	},
	statusLabel: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY
	}
});

export default EmailSettingsScreen;