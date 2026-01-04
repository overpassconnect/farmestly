import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi';
import { useGlobalContext } from './context/GlobalContextProvider';
import { useLocale } from '../providers/LocaleProvider';
import colors from '../globals/colors';
import { toTitleCase, deduplicateEppoResults, getBestFullnameFromResults } from '../utils/eppoHelpers';

/**
 * EppoSuggestion - Compact suggestion component for EPPO codes
 * Displays in the 65% right side of the EPPO input row
 * @param {string} cropValue - Current crop input value
 * @param {string} eppoValue - Current EPPO code input value
 * @param {function} onSuggestionChange - Called when suggestion changes (for auto-filling input)
 */
const EppoSuggestion = ({ cropValue, eppoValue, onSuggestionChange }) => {
	const { t } = useTranslation('common');
	const { api } = useApi();
	const { isOffline } = useGlobalContext();
	const { locale } = useLocale();
	const [suggestion, setSuggestion] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const [noMatch, setNoMatch] = useState(false);
	const debounceRef = useRef(null);
	const lastCropQuery = useRef('');
	const lastAutoFilledEppo = useRef(''); // Track EPPO code auto-filled from crop search
	const requestIdRef = useRef(0);
	// Use ref for locale to avoid stale closures
	const localeRef = useRef(locale);
	localeRef.current = locale;

	// Effect for crop-based search
	useEffect(() => {
		// Clear any pending debounce
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}

		const cropQuery = cropValue?.trim() || '';

		// Reset states when crop query is too short
		if (cropQuery.length < 2) {
			setSuggestion(null);
			setNoMatch(false);
			setIsLoading(false);
			lastCropQuery.current = '';
			return;
		}

		// Skip if offline
		if (isOffline) {
			setIsLoading(false);
			return;
		}

		// Skip if same crop query already fetched
		if (cropQuery === lastCropQuery.current) {
			return;
		}

		// Clear previous suggestion, show loading
		setSuggestion(null);
		setNoMatch(false);
		setIsLoading(true);

		const currentRequestId = ++requestIdRef.current;

		debounceRef.current = setTimeout(async () => {
			try {
				const { ok, data } = await api(`/eppo/search?search=${encodeURIComponent(cropQuery)}`);

				// Check if this is still the latest request
				if (currentRequestId !== requestIdRef.current) {
					return;
				}

				lastCropQuery.current = cropQuery;

				// Use ref for current language to avoid stale closure
				const lang = localeRef.current;

				if (ok && data?.results?.length > 0) {
					const deduplicated = deduplicateEppoResults(data.results, lang);
					const result = deduplicated[0];
					if (result) {
						result.fullname = getBestFullnameFromResults(data.results, result.eppocode, lang) || result.fullname;
						// Track this EPPO code so we don't re-search when it auto-fills
						lastAutoFilledEppo.current = result.eppocode;
					}
					setSuggestion(result);
					setNoMatch(false);
					// Auto-fill the eppo code
					if (onSuggestionChange) {
						onSuggestionChange(result);
					}
				} else {
					setSuggestion(null);
					setNoMatch(true);
					lastAutoFilledEppo.current = '';
				}
			} catch {
				if (currentRequestId !== requestIdRef.current) {
					return;
				}
				setSuggestion(null);
				setNoMatch(true);
			} finally {
				if (currentRequestId === requestIdRef.current) {
					setIsLoading(false);
				}
			}
		}, 400);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [cropValue, isOffline, api, onSuggestionChange]);

	// Effect for manual EPPO code input
	useEffect(() => {
		const eppoQuery = eppoValue?.trim()?.toUpperCase() || '';

		// Skip if too short
		if (eppoQuery.length < 2) {
			return;
		}

		// Skip if offline
		if (isOffline) {
			return;
		}

		// If user modified the auto-filled value, clear the tracking so future edits work
		if (eppoQuery !== lastAutoFilledEppo.current && lastAutoFilledEppo.current !== '') {
			lastAutoFilledEppo.current = '';
		}

		// Skip only on the first render after auto-fill (when they match exactly)
		// After that, lastAutoFilledEppo is cleared so subsequent edits will search
		if (eppoQuery === lastAutoFilledEppo.current) {
			return;
		}

		setSuggestion(null);
		setNoMatch(false);
		setIsLoading(true);

		const currentRequestId = ++requestIdRef.current;

		const timeoutId = setTimeout(async () => {
			try {
				const { ok, data } = await api(`/eppo/search?search=${encodeURIComponent(eppoQuery)}`);

				if (currentRequestId !== requestIdRef.current) {
					return;
				}

				const lang = localeRef.current;

				if (ok && data?.results?.length > 0) {
					// When searching by EPPO code, prioritize matches that include the query
					const matchingResults = data.results.filter(r => r.eppocode?.includes(eppoQuery));
					const resultsToUse = matchingResults.length > 0 ? matchingResults : data.results;

					const deduplicated = deduplicateEppoResults(resultsToUse, lang);
					const result = deduplicated[0];
					if (result) {
						result.fullname = getBestFullnameFromResults(resultsToUse, result.eppocode, lang) || result.fullname;
					}
					setSuggestion(result);
					setNoMatch(false);
				} else {
					setSuggestion(null);
					setNoMatch(true);
				}
			} catch {
				if (currentRequestId !== requestIdRef.current) {
					return;
				}
				setSuggestion(null);
				setNoMatch(true);
			} finally {
				if (currentRequestId === requestIdRef.current) {
					setIsLoading(false);
				}
			}
		}, 400);

		return () => clearTimeout(timeoutId);
	}, [eppoValue, isOffline, api]);

	// Don't render if offline
	if (isOffline) return null;

	// Nothing typed yet or too short
	const query = cropValue?.trim() || '';
	if (query.length < 2) return null;

	return (
		<View style={styles.wrapper}>
			<Text style={styles.label}>{t('labels.suggestedEppoCode')}</Text>
			<View style={styles.content}>
				{isLoading ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="small" color={colors.SECONDARY} />
					</View>
				) : suggestion ? (
					<View style={styles.suggestionRow}>
						<View style={styles.iconContainer}>
							<Image
								source={require('../assets/icons/eppo_brown.png')}
								style={styles.icon}
								resizeMode="contain"
							/>
						</View>
						<View style={styles.detailsContainer}>
							<Text style={styles.title} numberOfLines={1}>
								{toTitleCase(suggestion.fullname)}
							</Text>
							<Text style={styles.subtitle} numberOfLines={1}>
								{suggestion.preferred}
							</Text>
						</View>
						</View>
				) : noMatch ? (
					<View style={styles.noMatchContainer}>
						<Text style={styles.noMatch}>{t('messages.noEppoMatch')}</Text>
					</View>
				) : (
					<View style={styles.emptyContainer} />
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	wrapper: {
		flex: 1,
		marginLeft: 8,
	},
	label: {
		fontSize: 14,
		fontFamily: 'Geologica-Medium',
		color: colors.PRIMARY_LIGHT,
	},
	content: {
		flex: 1,
		borderRadius: 8,
		justifyContent: 'center',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	suggestionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	iconContainer: {
		marginRight: 8,
	},
	icon: {
		width: 46,
		height: 46,
	},
	detailsContainer: {
		// flex: 1,
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		marginTop: -3,
		marginBottom: -4,
		color: colors.PRIMARY,
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
	},
	noMatchContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 8,
	},
	noMatch: {
		fontFamily: 'Geologica-Regular',
		fontSize: 12,
		color: colors.WARNING,
		textAlign: 'center',
	},
	emptyContainer: {
		flex: 1,
	},
});

export default EppoSuggestion;
