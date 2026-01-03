import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../../globals/api';
import { useTranslation } from 'react-i18next';
import i18n from '../../globals/i18n';

const LanguageContext = createContext();

export const useLanguage = () => {
	const context = useContext(LanguageContext);
	if (!context) {
		throw new Error('useLanguage must be used within LanguageContextProvider');
	}
	return context;
};

export const LanguageContextProvider = ({ children }) => {
	const { i18n: i18nInstance } = useTranslation();
	const [currentLanguage, setCurrentLanguage] = useState(i18nInstance.language);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		// Listen to language change events
		const handleLanguageChange = (newLanguage) => {
			console.log('Language changed to:', newLanguage);
			setCurrentLanguage(newLanguage);
		};

		// Subscribe to language change events
		i18nInstance.on('languageChanged', handleLanguageChange);

		return () => {
			// Cleanup listener
			i18nInstance.off('languageChanged', handleLanguageChange);
		};
	}, [i18nInstance]);

	const changeLanguage = async (language) => {
		setIsLoading(true);
		try {
			await i18nInstance.changeLanguage(language);
			setCurrentLanguage(language);
		} catch (error) {
		} finally {
			setIsLoading(false);
		}
	};

	const contextValue = {
		currentLanguage,
		changeLanguage,
		isLoading,
		t: i18nInstance.t,
		i18n: i18nInstance,
	};

	return (
		<LanguageContext.Provider value={contextValue}>
			{children}
		</LanguageContext.Provider>
	);
};

export default LanguageContextProvider;