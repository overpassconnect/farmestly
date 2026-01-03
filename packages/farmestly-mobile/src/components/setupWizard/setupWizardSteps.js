import StepFarmDetails from './StepFarmDetails';
import StepEmail from './StepEmail';
import StepFieldDrawing from './StepFieldDrawing';

/**
 * Setup wizard step configuration
 *
 * This defines the initial farm setup flow:
 * 1. Farm Details - Enter farm name
 * 2. Email - Add email address (skippable)
 * 3. Field Drawing - Draw fields on map and add details
 */
export const setupWizardSteps = [
  {
    key: 'farmDetails',
    component: StepFarmDetails,
    shouldSkip: null  // Always show
  },
  {
    key: 'email',
    component: StepEmail,
    shouldSkip: null,  // Always show (user can skip manually)
    canUserSkip: () => true  // Allow user to skip this step
  },
  {
    key: 'fieldDrawing',
    component: StepFieldDrawing,
    shouldSkip: null  // Always show
  }
];
