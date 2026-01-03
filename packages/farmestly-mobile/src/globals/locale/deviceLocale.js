/**
 * Device Locale Detection
 * Returns BCP 47 locale tag from device settings
 */
import { NativeModules, Platform } from 'react-native';
import {
	SUPPORTED_LOCALES,
	DEFAULT_LOCALE,
} from './constants';

/**
 * Get device locale as BCP 47 tag
 * Falls back to DEFAULT_LOCALE if unsupported
 * @returns {string} BCP 47 locale tag
 */
export const getDeviceLocale = () => {
	let deviceLocale;

	try {
		if (Platform.OS === 'ios') {
			deviceLocale =
				NativeModules.SettingsManager?.settings?.AppleLocale ||
				NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
		} else {
			deviceLocale = NativeModules.I18nManager?.localeIdentifier;
		}
	} catch (e) {
		console.warn('Failed to get device locale:', e);
		return DEFAULT_LOCALE;
	}

	if (!deviceLocale) {
		return DEFAULT_LOCALE;
	}

	// Normalize: some devices return 'el_GR', we need 'el-GR'
	deviceLocale = deviceLocale.replace('_', '-');

	// Check if exact match exists
	if (SUPPORTED_LOCALES[deviceLocale]) {
		return deviceLocale;
	}

	// Try matching by language prefix (e.g., 'el-CY' -> 'el-GR')
	const language = deviceLocale.split('-')[0];
	const matchingLocale = Object.keys(SUPPORTED_LOCALES).find((loc) =>
		loc.startsWith(language + '-')
	);

	if (matchingLocale) {
		return matchingLocale;
	}

	return DEFAULT_LOCALE;
};

/**
 * Get the device's country code for initial defaults
 * @returns {string} Two-letter country code
 */
export const getDeviceCountry = () => {
	const locale = getDeviceLocale();
	return locale.split('-')[1] || 'US';
};
