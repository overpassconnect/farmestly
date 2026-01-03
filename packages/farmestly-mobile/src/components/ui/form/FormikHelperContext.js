import { createContext, useContext } from 'react';

// Create a context for form field registration
export const FormikHelperContext = createContext({
	registerField: () => { },
	focusNextField: () => { },
	submitForm: () => { },
	fields: [],
	currentFocusedField: null,
	setCurrentFocusedField: () => { },
	serverErrors: {},
	clearServerError: () => { },
});

// Custom hook to access FormikHelper context
export const useFormikHelper = () => useContext(FormikHelperContext);
