import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Storage } from '../utils/storage';

// Import translation files
import enCommon from './locales/en/common.json';
import enScreens from './locales/en/screens.json';
import enValidation from './locales/en/validation.json';
import enAlerts from './locales/en/alerts.json';

import grCommon from './locales/gr/common.json';
import grScreens from './locales/gr/screens.json';
import grValidation from './locales/gr/validation.json';
import grAlerts from './locales/gr/alerts.json';

const LANGUAGE_STORAGE_KEY = '@app_language';

// Translation resources
const resources = {
	en: {
		common: enCommon,
		screens: enScreens,
		validation: enValidation,
		alerts: enAlerts,
	},
	gr: {
		common: grCommon,
		screens: grScreens,
		validation: grValidation,
		alerts: grAlerts,
	},
};

// FIXED Language detector - the previous one was broken
const languageDetector = {
	type: 'languageDetector',
	async: true,
	detect: (callback) => {
		Storage.getItem(LANGUAGE_STORAGE_KEY)
			.then((language) => {
				callback(language || 'en');
			})
			.catch((error) => {
				callback('en');
			});
	},
	init: () => { },
	cacheUserLanguage: (language) => {
		Storage.setItem(LANGUAGE_STORAGE_KEY, language)
			.then(() => { })
			.catch((error) => { });
	},
};

// Initialize i18next
i18n
	.use(languageDetector)
	.use(initReactI18next)
	.init({
		resources,
		fallbackLng: 'en',
		defaultNS: 'common',
		ns: ['common', 'screens', 'validation', 'alerts'],
		interpolation: {
			escapeValue: false,
		},
		react: {
			useSuspense: false,
		},
		debug: true, // Enable for debugging
	});

export default i18n;