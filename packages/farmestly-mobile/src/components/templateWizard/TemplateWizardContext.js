import React, { createContext, useContext, useState } from 'react';

const TemplateWizardContext = createContext();

export const useTemplateWizard = () => {
	const context = useContext(TemplateWizardContext);
	if (!context) {
		throw new Error('useTemplateWizard must be used within a TemplateWizardProvider');
	}
	return context;
};

export const TemplateWizardProvider = ({ children }) => {
	const [wizardState, setWizardState] = useState({
		type: null,              // 'sow' | 'harvest' | 'spray' | 'irrigate' | 'custom'
		name: '',
		machineId: null,
		attachmentId: null,
		toolId: null,
		sprayConfig: {
			carrierRate: '',
			products: []  // [{ id, rateOverride }]
		}
	});

	const updateWizardState = (updates) => {
		setWizardState(prev => ({
			...prev,
			...updates
		}));
	};

	const resetWizardState = () => {
		setWizardState({
			type: null,
			name: '',
			machineId: null,
			attachmentId: null,
			toolId: null,
			sprayConfig: {
				carrierRate: '',
				products: []
			}
		});
	};

	const value = {
		wizardState,
		updateWizardState,
		resetWizardState
	};

	return (
		<TemplateWizardContext.Provider value={value}>
			{children}
		</TemplateWizardContext.Provider>
	);
};
