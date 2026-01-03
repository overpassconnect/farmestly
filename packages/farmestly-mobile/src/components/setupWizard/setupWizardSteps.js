import StepFarmDetails from './StepFarmDetails';
import StepFieldDrawing from './StepFieldDrawing';

/**
 * Setup wizard step configuration
 *
 * This defines the initial farm setup flow:
 * 1. Farm Details - Enter farm name
 * 2. Field Drawing - Draw fields on map and add details
 */
export const setupWizardSteps = [
  {
    key: 'farmDetails',
    component: StepFarmDetails,
    shouldSkip: null  // Always show
  },
  {
    key: 'fieldDrawing',
    component: StepFieldDrawing,
    shouldSkip: null  // Always show
  }
];
