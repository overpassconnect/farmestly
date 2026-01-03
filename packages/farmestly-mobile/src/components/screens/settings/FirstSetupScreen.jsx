import React, { useState } from 'react';
import { useApi } from '../../../hooks/useApi';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/core';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../../ui/core/PrimaryButton';
import Wizard from '../../ui/wizard/Wizard';
import { setupWizardSteps } from '../../setupWizard/setupWizardSteps';
import { useGlobalContext } from '../../context/GlobalContextProvider';

/**
 * FirstSetupScreen - Initial farm setup wizard
 *
 * Uses the reusable Wizard component to guide users through:
 * 1. Entering farm name
 * 2. Drawing fields on map
 *
 * After completion, creates the farm and fields on the server
 */
const FirstSetupScreen = () => {
	const { t } = useTranslation(['common']);
	const navigation = useNavigation();
	const { tmpFirstSetup, refresh } = useGlobalContext();
	const { api } = useApi();

	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [wizardState, setWizardState] = useState({
		farmName: '',
		email: '',
		fields: []
	});
	const [isLoading, setIsLoading] = useState(false);

	const handleNextStep = () => {
		if (currentStepIndex < setupWizardSteps.length - 1) {
			// Navigate to next step
			setCurrentStepIndex(currentStepIndex + 1);
		} else {
			// On final step, submit
			handleComplete();
		}
	};

	const handleComplete = async () => {
		setIsLoading(true);

		// Build the fields array with enriched data from tmpFirstSetup
		let newFields = [];
		let index = 0;
		for (let field of wizardState.fields) {
			newFields.push({
				points: field.points,
				color: field.color,
				name: tmpFirstSetup[field._id]?.fieldName
					? tmpFirstSetup[field._id].fieldName
					: "Field " + index,
				currentCultivation: null,
				farmingType: tmpFirstSetup[field._id]?.farmingType,
				fieldLegalNumber: tmpFirstSetup[field._id]?.fieldLegalNumber,
				_id: field._id
			});
			index++;
		}

		const result = await api('/firstSetup', {
			method: 'POST',
			body: JSON.stringify({
				'farmData': {
					'farmName': wizardState.farmName,
					'fields': newFields
				}
			}),
			headers: {
				'Content-Type': 'application/json',
			}
		});

		if (result.ok) {
			// If user entered an email, save it (this will trigger verification email)
			if (wizardState.email && wizardState.email.trim()) {
				await api('/settings/email', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: wizardState.email.trim() })
				});
				// We don't need to check the result - if it fails, user can add email later
			}

			// Refresh data from server to get the newly created fields
			const refreshed = await refresh();
			if (refreshed) {
				navigation.replace('Main');
			} else {
				// Fallback to splash if refresh fails
				navigation.replace('Splash');
			}
		}

		setIsLoading(false);
	};

	// Get current step config to check if it's skippable
	const currentStep = setupWizardSteps[currentStepIndex];
	const isSkippable = currentStep?.canUserSkip?.(wizardState) ?? false;
	const isLastStep = currentStepIndex >= setupWizardSteps.length - 1;

	// Determine button text based on step and state
	const getButtonText = () => {
		if (isLastStep) {
			return t('common:buttons.done');
		}
		// For email step: show "Next" if email entered, "Skip" if empty
		if (isSkippable && !wizardState.email?.trim()) {
			return t('common:buttons.skip');
		}
		return t('common:buttons.next');
	};

	return (
		<View style={styles.container}>
			<Wizard
				steps={setupWizardSteps}
				currentStepIndex={currentStepIndex}
				onStepChange={setCurrentStepIndex}
				state={wizardState}
				onStateChange={setWizardState}
			/>
			<View style={styles.wizardButtonContainer}>
				<PrimaryButton
					onPress={handleNextStep}
					loading={isLoading}
					text={getButtonText()}
				/>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	wizardButtonContainer: {
		flexDirection: 'row',
		marginTop: 12,
		justifyContent: 'center',
		marginBottom: 22,
	}
});

export default FirstSetupScreen;
