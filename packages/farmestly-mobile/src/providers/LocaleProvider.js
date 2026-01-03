/**
 * LocaleProvider
 * React context that syncs the localeParser singleton with account data
 * and coordinates with i18next for translations.
 *
 * Replaces LanguageContextProvider with unified locale handling.
 */
import React, {
	createContext,
	useContext,
	useEffect,
	useCallback,
	useState,
	useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import { localeParser } from '../globals/locale/parser';
import {
	SUPPORTED_LOCALES,
	DEFAULT_LOCALE,
	getI18nCode,
	getLanguage,
	getCountry,
	getSuggestedUnits,
} from '../globals/locale/constants';
import { getDeviceLocale } from '../globals/locale/deviceLocale';
import { useGlobalContext } from '../components/context/GlobalContextProvider';
import { Storage } from '../utils/storage';

const LocaleContext = createContext(null);

const LOCALE_STORAGE_KEY = '@app_locale';

export const LocaleProvider = ({ children }) => {
	const { account, updateAccountField } = useGlobalContext();
	const { i18n: i18nInstance, t } = useTranslation();
	const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
	const [isInitialized, setIsInitialized] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	// Initialize locale on mount
	useEffect(() => {
		const initializeLocale = async () => {
			let targetLocale = DEFAULT_LOCALE;
			let localeSource = 'default';

			// Log device locale for debugging
			const deviceLocale = getDeviceLocale();
			console.log('[LocaleProvider] Device locale detected:', deviceLocale);

			// Priority 1: Account metadata (server-synced)
			if (
				account?.metadata?.locale &&
				SUPPORTED_LOCALES[account.metadata.locale]
			) {
				targetLocale = account.metadata.locale;
				localeSource = 'account.metadata';
			} else {
				// Priority 2: Local storage
				const storedLocale = await Storage.getItem(LOCALE_STORAGE_KEY);
				if (storedLocale && SUPPORTED_LOCALES[storedLocale]) {
					targetLocale = storedLocale;
					localeSource = 'localStorage';
				} else {
					// Priority 3: Device locale
					targetLocale = deviceLocale;
					localeSource = 'device';
				}
			}

			console.log('[LocaleProvider] Using locale:', targetLocale, '(source:', localeSource + ')');

			// Apply the locale
			localeParser.setLocale(targetLocale);
			setLocaleState(targetLocale);

			// Sync i18next
			const i18nCode = getI18nCode(targetLocale);
			if (i18nInstance.language !== i18nCode) {
				await i18nInstance.changeLanguage(i18nCode);
			}

			// Persist to storage
			await Storage.setItem(LOCALE_STORAGE_KEY, targetLocale);

			setIsInitialized(true);
		};

		initializeLocale();
	}, []); // Only run once on mount

	// Sync when account.metadata.locale changes (e.g., from server sync)
	useEffect(() => {
		if (!isInitialized) return;

		const accountLocale = account?.metadata?.locale;
		if (
			accountLocale &&
			SUPPORTED_LOCALES[accountLocale] &&
			accountLocale !== locale
		) {
			localeParser.setLocale(accountLocale);
			setLocaleState(accountLocale);

			const i18nCode = getI18nCode(accountLocale);
			i18nInstance.changeLanguage(i18nCode);

			Storage.setItem(LOCALE_STORAGE_KEY, accountLocale);
		}
	}, [account?.metadata?.locale, isInitialized, locale, i18nInstance]);

	/**
	 * Change locale - updates singleton, i18next, local storage, and account
	 */
	const changeLocale = useCallback(
		async (newLocale) => {
			if (!SUPPORTED_LOCALES[newLocale]) {
				console.warn(`Unsupported locale: ${newLocale}`);
				return;
			}

			setIsLoading(true);

			try {
				// Update singleton
				localeParser.setLocale(newLocale);
				setLocaleState(newLocale);

				// Update i18next
				const i18nCode = getI18nCode(newLocale);
				await i18nInstance.changeLanguage(i18nCode);

				// Persist locally
				await Storage.setItem(LOCALE_STORAGE_KEY, newLocale);

				// Sync to server (account.metadata.locale)
				if (updateAccountField) {
					updateAccountField('metadata', {
						...account?.metadata,
						locale: newLocale,
					});
				}
			} finally {
				setIsLoading(false);
			}
		},
		[account?.metadata, updateAccountField, i18nInstance]
	);

	// Memoized locale config
	const localeConfig = useMemo(
		() => SUPPORTED_LOCALES[locale] || SUPPORTED_LOCALES[DEFAULT_LOCALE],
		[locale]
	);

	const contextValue = useMemo(
		() => ({
			// Current locale state
			locale,
			language: getLanguage(locale),
			country: getCountry(locale),
			localeConfig,

			// Actions
			changeLocale,

			// Formatting methods (delegating to singleton for convenience)
			parse: (value) => localeParser.parse(value),
			format: (value, options) => localeParser.format(value, options),
			isValidPartial: (value) => localeParser.isValidPartial(value),
			formatDate: (date, options) => localeParser.formatDate(date, options),
			formatDateTime: (date, options) =>
				localeParser.formatDateTime(date, options),
			formatTime: (date, options) => localeParser.formatTime(date, options),

			// Utilities
			getSuggestedUnits: () => getSuggestedUnits(locale),
			supportedLocales: SUPPORTED_LOCALES,
			getDecimalSeparator: () => localeParser.getDecimalSeparator(),
			getThousandsSeparator: () => localeParser.getThousandsSeparator(),

			// Initialization state
			isInitialized,
			isLoading,

			// i18n access
			t,
			i18n: i18nInstance,
		}),
		[
			locale,
			localeConfig,
			changeLocale,
			isInitialized,
			isLoading,
			t,
			i18nInstance,
		]
	);

	return (
		<LocaleContext.Provider value={contextValue}>
			{children}
		</LocaleContext.Provider>
	);
};

/**
 * Hook to access locale context
 */
export const useLocale = () => {
	const context = useContext(LocaleContext);
	if (!context) {
		throw new Error('useLocale must be used within LocaleProvider');
	}
	return context;
};

export default LocaleProvider;
