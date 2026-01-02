import React, { useRef, useState, useCallback } from 'react';
import { Formik } from 'formik';
import i18n from '../../../globals/i18n';
import { FormikHelperContext, useFormikHelper } from './FormikHelperContext';

// Re-export hooks and components for convenience
export { useFormikHelper } from './FormikHelperContext';
export { FormInput } from './FormInput';
export { FormDropdown } from './FormDropdown';
export { FormPhoneInput } from './FormPhoneInput';

// FormikHelper component that manages form fields and provides automatic navigation
export const FormikHelper = ({
	children,
	initialValues,
	validationSchema,
	onSubmit,
	enableReinitialize = false
}) => {
	const fieldsRef = useRef({});
	const [currentFocusedField, setCurrentFocusedField] = useState(null);
	const [serverErrors, setServerErrors] = useState({});

	const registerField = useCallback((name, ref, isLast) => {
		fieldsRef.current[name] = { ref, isLast };
	}, []);

	const focusNextField = useCallback((currentFieldName) => {
		const fieldNames = Object.keys(fieldsRef.current);
		const currentIndex = fieldNames.indexOf(currentFieldName);

		if (currentIndex < fieldNames.length - 1) {
			const nextFieldName = fieldNames[currentIndex + 1];
			const nextField = fieldsRef.current[nextFieldName];
			if (nextField?.ref?.current?.focus) {
				nextField.ref.current.focus();
			}
		}
	}, []);

	const clearServerError = useCallback((fieldName) => {
		setServerErrors(prev => {
			const newErrors = { ...prev };
			delete newErrors[fieldName];
			return newErrors;
		});
	}, []);

	const handleSubmit = useCallback(async (values, formikBag) => {
		// Clear all server errors on new submission
		setServerErrors({});

		// Call the user's onSubmit function
		const response = await onSubmit(values, formikBag);

		// Check if response contains validation errors
		// Support both raw API response format (HEADERS.VALIDATION) and useApi format (validation)
		const validationArray = response?.HEADERS?.VALIDATION || response?.validation;

		if (validationArray && Array.isArray(validationArray)) {
			// Parse validation array: [{ path: 'fieldName', msg: 'errorCode' }]
			// Translate error codes and convert to: { fieldName: 'translated message' }
			const validationErrors = {};
			validationArray.forEach(error => {
				if (error.path && error.msg) {
					// Attempt to translate the error code
					// Falls back to raw message if translation key not found
					const translated = i18n.t(`validation:${error.msg}`, {
						defaultValue: error.msg
					});
					validationErrors[error.path] = translated;
				}
			});

			// Update server errors state
			setServerErrors(validationErrors);
		}

		return response;
	}, [onSubmit]);

	const contextValue = {
		registerField,
		focusNextField,
		submitForm: () => { },
		fields: fieldsRef.current,
		currentFocusedField,
		setCurrentFocusedField,
		serverErrors,
		clearServerError,
	};

	return (
		<Formik
			initialValues={initialValues}
			validationSchema={validationSchema}
			onSubmit={handleSubmit}
			enableReinitialize={enableReinitialize}
		>
			{(formikProps) => (
				<FormikHelperContext.Provider value={{
					...contextValue,
					submitForm: formikProps.handleSubmit
				}}>
					{typeof children === 'function' ? children(formikProps) : children}
				</FormikHelperContext.Provider>
			)}
		</Formik>
	);
};

export default FormikHelper;
