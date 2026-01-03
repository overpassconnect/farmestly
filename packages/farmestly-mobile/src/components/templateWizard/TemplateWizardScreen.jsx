import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Wizard from '../ui/wizard/Wizard';
import { templateWizardSteps } from './wizardSteps';
import PrimaryButton from '../ui/core/PrimaryButton';

/**
 * TemplateWizardScreen - Template creation wizard using the reusable Wizard component
 *
 * This screen manages the template wizard state and integrates with the navigation system.
 * The Wizard component handles all flow control, step filtering, and animations.
 */
const TemplateWizardScreen = ({ route }) => {
	const navigation = useNavigation();
	const [currentStepIndex, setCurrentStepIndex] = useState(0);

	// Initialize wizard state with job type from route params or existing template
	const [wizardState, setWizardState] = useState(() => {
		const template = route?.params?.template;

		if (template) {
			// Edit mode - initialize from existing template
			return {
				_id: template._id, // Preserve template ID for edit mode
				type: template.type,
				name: template.name || '',
				machineId: template.machineId || null,
				attachmentId: template.attachmentId || null,
				toolId: template.toolId || null,
				sprayConfig: {
					overrides: {
						carrierRate: template.sprayConfig?.carrierRate || ''
					},
					products: (template.sprayConfig?.products || []).map(p => ({
						id: p.id,
						rateOverride: p.overrides?.rate || ''
					}))
				}
			};
		}

		// Create mode - initialize with defaults
		return {
			type: route?.params?.selectedType || null,
			name: '',
			machineId: null,
			attachmentId: null,
			toolId: null,
			sprayConfig: {
				overrides: {
					carrierRate: ''
				},
				products: []
			}
		};
	});

	// Set navigation header options
	useEffect(() => {
		navigation.setOptions({
			title: wizardState._id ? 'Edit Template' : 'Create Template',
			headerBackTitle: 'Cancel'
		});
	}, [navigation, wizardState._id]);

	// Handle navigation back from first step
	const handleNavigateBack = () => {
		navigation.goBack();
	};

	// Handle back button - go to previous step or exit if on first step
	const handleBack = () => {
		if (currentStepIndex === 0) {
			navigation.goBack();
		} else {
			// Find previous valid step by iterating backward
			let prevIndex = currentStepIndex - 1;
			while (prevIndex >= 0) {
				const step = templateWizardSteps[prevIndex];
				const shouldSkip = step.shouldSkip?.(wizardState) ?? false;
				if (!shouldSkip) {
					setCurrentStepIndex(prevIndex);
					return;
				}
				prevIndex--;
			}
			// No valid previous step, go back to previous screen
			navigation.goBack();
		}
	};

	// Handle skip/next button - advance to next valid step
	const handleNext = () => {
		let nextIndex = currentStepIndex + 1;
		while (nextIndex < templateWizardSteps.length) {
			const step = templateWizardSteps[nextIndex];
			const shouldSkip = step.shouldSkip?.(wizardState) ?? false;
			if (!shouldSkip) {
				setCurrentStepIndex(nextIndex);
				return;
			}
			nextIndex++;
		}
	};

	// Determine if current step can be skipped (for showing skip/next button)
	const canSkipCurrentStep = () => {
		const currentStep = templateWizardSteps[currentStepIndex];

		// Check if step has custom canUserSkip function
		if (currentStep?.canUserSkip) {
			return currentStep.canUserSkip(wizardState);
		}

		// If step has no shouldSkip function, it's always optional and can be skipped
		if (!currentStep?.shouldSkip) {
			return true;
		}

		// If step has shouldSkip function, check if it evaluates to false for current state
		// (meaning the step IS shown, so user should be able to skip it)
		const shouldAutoSkip = currentStep.shouldSkip(wizardState);

		// If shouldAutoSkip is false, it means the step is relevant and shown,
		// so the user CAN skip it if they want
		// If shouldAutoSkip is true, the step shouldn't be shown at all (wizard bug if we're here)
		return !shouldAutoSkip;
	};

	// Check if current step has data selected (to show "Next" instead of "Skip")
	const isCurrentStepComplete = () => {
		const currentStep = templateWizardSteps[currentStepIndex];
		if (currentStep?.isStepComplete) {
			return currentStep.isStepComplete(wizardState);
		}
		return false;
	};

	// Check if we're on the final step
	const isFinalStep = currentStepIndex === templateWizardSteps.length - 1;

	return (
		<View style={styles.container}>
			{wizardState.type && (
				<Wizard
					steps={templateWizardSteps}
					currentStepIndex={currentStepIndex}
					onStepChange={setCurrentStepIndex}
					state={wizardState}
					onStateChange={setWizardState}
					onNavigateBack={handleNavigateBack}
				/>
			)}

			{/* Footer with Back and Skip buttons */}
			{wizardState.type !== null && !isFinalStep && (
				<View style={styles.footer}>
					<View style={styles.buttonLeft}>
						<PrimaryButton
							text="Back"
							variant="ghost"
							onPress={handleBack}
						/>
					</View>
					{(canSkipCurrentStep() || isCurrentStepComplete()) && (
						<View style={styles.buttonRight}>
							<PrimaryButton
								text={isCurrentStepComplete() ? "Next" : "Skip"}
								variant={isCurrentStepComplete() ? "primary" : "outline"}
								onPress={handleNext}
							/>
						</View>
					)}
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	footer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 16,
		backgroundColor: 'transparent',
	},
	buttonLeft: {
		flex: 0,
	},
	buttonRight: {
		flex: 0,
	},
});

export default TemplateWizardScreen;
