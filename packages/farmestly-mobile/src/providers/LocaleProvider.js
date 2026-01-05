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
	useRef,
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

	// Track the last applied account locale to prevent re-applying on initial load
	const lastAppliedAccountLocaleRef = useRef(null);
	// Track if we used a local source (localStorage/device) - server shouldn't override user's local choice
	const usedLocalSourceRef = useRef(false);

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
				// Mark this as already applied so we don't re-apply in the sync effect
				lastAppliedAccountLocaleRef.current = account.metadata.locale;
			} else {
				// Priority 2: Local storage
				const storedLocale = await Storage.getItem(LOCALE_STORAGE_KEY);
				if (storedLocale && SUPPORTED_LOCALES[storedLocale]) {
					targetLocale = storedLocale;
					localeSource = 'localStorage';
					// User has a local preference - don't let server override on initial load
					usedLocalSourceRef.current = true;
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

	// Sync when account.metadata.locale changes from server (after initialization)
	// This only triggers if the server sends a NEW locale different from what we already applied
	useEffect(() => {
		if (!isInitialized) return;

		const accountLocale = account?.metadata?.locale;

		// Skip if no account locale or unsupported
		if (!accountLocale || !SUPPORTED_LOCALES[accountLocale]) {
			return;
		}

		// Skip if same as current locale
		if (accountLocale === locale) {
			return;
		}

		// Skip if we already applied this account locale
		if (accountLocale === lastAppliedAccountLocaleRef.current) {
			return;
		}

		// Skip if we used a local source on init - this is likely the initial account data arriving
		// after we already loaded from localStorage. The user's local choice should win.
		// Clear the flag after first check so future server changes CAN apply.
		if (usedLocalSourceRef.current) {
			console.log('[LocaleProvider] Ignoring initial account locale, using local preference:', locale);
			usedLocalSourceRef.current = false;
			lastAppliedAccountLocaleRef.current = accountLocale;
			return;
		}

		console.log('[LocaleProvider] Account locale changed from server:', accountLocale);

		// Update the ref to prevent re-applying
		lastAppliedAccountLocaleRef.current = accountLocale;

		localeParser.setLocale(accountLocale);
		setLocaleState(accountLocale);

		const i18nCode = getI18nCode(accountLocale);
		i18nInstance.changeLanguage(i18nCode);

		Storage.setItem(LOCALE_STORAGE_KEY, accountLocale);
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

			console.log('Changing locale to:', newLocale);
			setIsLoading(true);

			try {
				// Update ref to prevent the sync effect from re-applying
				lastAppliedAccountLocaleRef.current = newLocale;

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
