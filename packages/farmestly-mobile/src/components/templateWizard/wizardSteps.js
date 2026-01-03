import StepSelectMachine from './StepSelectMachine';
import StepSelectAttachment from './StepSelectAttachment';
import StepSelectProducts from './StepSelectProducts';
import StepSelectTool from './StepSelectTool';
import StepNameAndSave from './StepNameAndSave';

/**
 * Template Wizard Step Configuration
 *
 * Defines the complete flow for the template creation wizard with declarative skip conditions.
 * Each step specifies:
 * - key: unique identifier
 * - component: React component function (NOT an element - the Wizard will instantiate it)
 * - shouldSkip: optional function (state) => boolean to determine if step should be skipped
 * - canUserSkip: optional function (state) => boolean to determine if user can skip the step
 * - isStepComplete: optional function (state) => boolean to determine if step has data selected
 *   (used to show "Next" instead of "Skip" when user has made a selection)
 *
 * Skip conditions are evaluated dynamically based on wizard state, allowing the wizard
 * to automatically navigate through irrelevant steps while showing smooth animations.
 */
export const templateWizardSteps = [
	{
		key: 'machine',
		component: StepSelectMachine,
		shouldSkip: null,
		canUserSkip: (state) => {
			// For spray, machine is required
			if (state.type === 'spray') return false;
			return true;
		},
		isStepComplete: (state) => state.machineId !== null,
	},
	{
		key: 'attachment',
		component: StepSelectAttachment,
		// Attachment step is always shown (never auto-skipped)
		// But whether user can skip it manually depends on job type
		shouldSkip: null,
		// Custom property to control manual skip button visibility
		canUserSkip: (state) => {
			// For spray and irrigate, attachment is important - don't allow manual skip
			if (state.type === 'spray' || state.type === 'irrigate') {
				return false;
			}
			// For other job types, user can skip if they want
			return true;
		},
		isStepComplete: (state) => state.attachmentId !== null,
	},
	{
		key: 'products',
		component: StepSelectProducts,
		// Products step is ONLY relevant for spray jobs
		// Skip for all other job types
		shouldSkip: (state) => state.type !== 'spray',
		// Always required when shown (spray only)
		canUserSkip: () => false,
		isStepComplete: (state) => state.sprayConfig?.products?.length > 0,
	},
	{
		key: 'tool',
		component: StepSelectTool,
		// Tool step is always optional - never skip automatically
		shouldSkip: null,
		isStepComplete: (state) => state.toolId !== null,
	},
	{
		key: 'save',
		component: StepNameAndSave,
		// Final step - never skip
		shouldSkip: null,
	},
];
