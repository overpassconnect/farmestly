import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	ActivityIndicator,
	Keyboard,
	FlatList,
} from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../../globals/colors';
import PrimaryButton from '../core/PrimaryButton';
import { useApi } from '../../../hooks/useApi';

/**
 * Get a nested value from an object using dot notation
 * @param {object} obj - The object to search
 * @param {string} path - Dot notation path (e.g., 'category.label')
 * @returns {any} The value at the path or undefined
 */
const getNestedValue = (obj, path) => {
	if (!obj || !path) return undefined;
	return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

/**
 * Check if an item matches the search query
 * @param {object} item - The item to search
 * @param {string} query - The search query
 * @param {string[]|null} searchKeys - Specific keys to search (dot notation supported)
 * @returns {boolean} Whether the item matches
 */
const itemMatchesQuery = (item, query, searchKeys) => {
	if (!query.trim()) return true;

	const lowerQuery = query.toLowerCase();

	// If specific keys are provided, only search those
	if (searchKeys && searchKeys.length > 0) {
		return searchKeys.some((key) => {
			const value = getNestedValue(item, key);
			if (value == null) return false;
			return String(value).toLowerCase().includes(lowerQuery);
		});
	}

	// Otherwise, search all string/number fields recursively
	const searchObject = (obj) => {
		for (const value of Object.values(obj)) {
			if (value == null) continue;
			if (typeof value === 'string' || typeof value === 'number') {
				if (String(value).toLowerCase().includes(lowerQuery)) {
					return true;
				}
			} else if (typeof value === 'object' && !Array.isArray(value)) {
				if (searchObject(value)) return true;
			}
		}
		return false;
	};

	return searchObject(item);
};

/**
 * SearchableListSheet - A reusable searchable list component
 * Can be used inside bottom sheets or as a standalone component
 *
 * @param {object} props
 * @param {boolean} props.isBottomSheet - Whether component is inside a bottom sheet (default: true)
 * @param {boolean} props.isOnline - Whether the app is currently online
 * @param {array} props.localData - Local data to use when offline or as fallback
 * @param {string|null} props.endpoint - API endpoint for remote data (null = local only)
 * @param {string[]|null} props.searchKeys - Specific keys to search (dot notation supported)
 * @param {string} props.searchPlaceholder - Placeholder text for search input
 * @param {number} props.debounceMs - Debounce delay for online search (default: 300)
 * @param {React.ReactNode} props.customFilters - Custom filter components to render
 * @param {function} props.onSelect - Callback when an item is selected
 * @param {function} props.renderItem - Custom render function for list items
 * @param {function} props.keyExtractor - Function to extract unique key from item
 * @param {string} props.title - Sheet title
 * @param {string} props.cancelLabel - Label for cancel button (hidden if onCancel not provided)
 * @param {function} props.onCancel - Callback when cancel is pressed (optional - hides button if not provided)
 * @param {string} props.emptyTitle - Title to show when no results
 * @param {string} props.emptySubtitle - Subtitle to show when no results
 * @param {function} props.renderEmpty - Custom render function for empty state (overrides emptyTitle/emptySubtitle)
 * @param {function} props.onEndReached - Callback when list reaches end (for pagination)
 * @param {boolean} props.hasMore - Whether there's more data to load
 * @param {boolean} props.loadingMore - Whether currently loading more data
 * @param {number} props.onEndReachedThreshold - How far from end to trigger onEndReached (default: 0.5)
 * @param {boolean} props.showHeader - Whether to show the header with title and search (default: true)
 * @param {object} props.style - Additional container styles
 * @param {string} props.responseDataKey - Key to extract array from response (e.g., 'results' for { results: [...] })
 * @param {function} props.transformResults - Optional function to transform results after fetching (e.g., deduplication)
 */
const SearchableListSheet = ({
	isBottomSheet = true,
	isOnline = true,
	localData = [],
	endpoint = null,
	searchKeys = null,
	searchPlaceholder,
	debounceMs = 300,
	customFilters = null,
	onSelect,
	renderItem,
	keyExtractor = (item, index) => item._id || item.id || String(index),
	title,
	cancelLabel,
	onCancel,
	emptyTitle,
	emptySubtitle,
	renderEmpty,
	onEndReached,
	hasMore = false,
	loadingMore = false,
	onEndReachedThreshold = 0.5,
	showHeader = true,
	style,
	responseDataKey = null,
	transformResults = null,
}) => {
	const { t } = useTranslation('common');
	const { api } = useApi();
	const insets = useSafeAreaInsets();

	const [searchQuery, setSearchQuery] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [remoteData, setRemoteData] = useState([]);
	const [hasRemoteError, setHasRemoteError] = useState(false);

	const debounceRef = useRef(null);
	const lastFetchedQuery = useRef('');
	const isMounted = useRef(true);

	// Choose components based on context
	const ListComponent = isBottomSheet ? BottomSheetFlatList : FlatList;
	const HeaderComponent = isBottomSheet ? BottomSheetView : View;

	// Determine if we should use remote data
	const shouldUseRemote = endpoint && isOnline && !hasRemoteError;

	// The data source to display
	const sourceData = shouldUseRemote ? remoteData : localData;

	// Filter data locally
	const filteredData = useMemo(() => {
		// When online with endpoint, server handles filtering (we still filter locally as backup)
		// When offline or no endpoint, filter locally
		if (!shouldUseRemote) {
			return sourceData.filter((item) => itemMatchesQuery(item, searchQuery, searchKeys));
		}
		// When online, the remote data is already filtered by the server
		// But we still apply local filter in case connection dropped mid-type
		return sourceData.filter((item) => itemMatchesQuery(item, searchQuery, searchKeys));
	}, [sourceData, searchQuery, searchKeys, shouldUseRemote]);

	// Fetch remote data
	const fetchRemoteData = useCallback(async (query) => {
		if (!endpoint || !isOnline) return;

		setIsLoading(true);

		try {
			const url = query
				? `${endpoint}?search=${encodeURIComponent(query)}`
				: endpoint;

			const result = await api(url);

			if (!isMounted.current) return;

			if (result.ok && result.data) {
				// Extract data using responseDataKey if provided (e.g., 'results' for { results: [...] })
				let dataArray = responseDataKey
					? result.data[responseDataKey]
					: result.data;
				dataArray = Array.isArray(dataArray) ? dataArray : [];
				// Apply transformResults if provided (e.g., for deduplication)
				if (transformResults) {
					dataArray = transformResults(dataArray);
				}
				setRemoteData(dataArray);
				setHasRemoteError(false);
				lastFetchedQuery.current = query;
			} else {
				// On error, fall back to local data
				setHasRemoteError(true);
			}
		} catch {
			if (isMounted.current) {
				setHasRemoteError(true);
			}
		} finally {
			if (isMounted.current) {
				setIsLoading(false);
			}
		}
	}, [api, endpoint, isOnline, responseDataKey]);

	// Initial fetch when online
	useEffect(() => {
		isMounted.current = true;

		if (endpoint && isOnline) {
			fetchRemoteData('');
		}

		return () => {
			isMounted.current = false;
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [endpoint, isOnline, fetchRemoteData]);

	// Handle connection changes - refetch if we come back online
	useEffect(() => {
		if (isOnline && endpoint && hasRemoteError) {
			setHasRemoteError(false);
			fetchRemoteData(searchQuery);
		}
	}, [isOnline, endpoint, hasRemoteError, searchQuery, fetchRemoteData]);

	// Handle search input change
	const handleSearchChange = useCallback((text) => {
		setSearchQuery(text);

		// Clear existing debounce
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		// If online with endpoint, debounce and fetch
		if (endpoint && isOnline && !hasRemoteError) {
			debounceRef.current = setTimeout(() => {
				fetchRemoteData(text);
			}, debounceMs);
		}
		// If offline or no endpoint, local filtering happens via useMemo
	}, [endpoint, isOnline, hasRemoteError, debounceMs, fetchRemoteData]);

	// Handle item selection
	const handleSelect = useCallback((item) => {
		Keyboard.dismiss();
		onSelect?.(item);
	}, [onSelect]);

	// Render list item
	const handleRenderItem = useCallback(({ item, index }) => {
		return renderItem({ item, index, onSelect: handleSelect });
	}, [renderItem, handleSelect]);

	// Handle end reached for pagination
	const handleEndReached = useCallback(() => {
		if (onEndReached && hasMore && !loadingMore && !isLoading) {
			onEndReached();
		}
	}, [onEndReached, hasMore, loadingMore, isLoading]);

	// Render empty state
	const renderEmptyState = () => {
		if (isLoading) {
			return (
				<View style={styles.emptyContainer}>
					<ActivityIndicator size="large" color={colors.SECONDARY} />
				</View>
			);
		}

		// Use custom renderEmpty if provided
		if (renderEmpty) {
			return renderEmpty();
		}

		return (
			<View style={styles.emptyContainer}>
				<Text style={styles.emptyIcon}>🔍</Text>
				<Text style={styles.emptyTitle}>
					{emptyTitle || t('general.noResults') || 'No results found'}
				</Text>
				<Text style={styles.emptySubtitle}>
					{emptySubtitle || t('general.tryDifferentSearch') || 'Try a different search term'}
				</Text>
			</View>
		);
	};

	// Render loading indicator in list footer
	const renderFooter = () => {
		// Show loading more indicator for pagination
		if (loadingMore) {
			return (
				<View style={styles.loadingFooter}>
					<ActivityIndicator size="small" color={colors.SECONDARY} />
					<Text style={styles.loadingMoreText}>{t('general.loadingMore') || 'Loading more...'}</Text>
				</View>
			);
		}

		// Show initial loading indicator
		if (isLoading && filteredData.length === 0) {
			return null; // Empty state handles this
		}

		if (isLoading) {
			return (
				<View style={styles.loadingFooter}>
					<ActivityIndicator size="small" color={colors.SECONDARY} />
				</View>
			);
		}

		return null;
	};

	// Calculate bottom padding based on context
	const bottomPadding = onCancel ? 80 + insets.bottom : 20 + insets.bottom;

	return (
		<View style={[styles.container, style]}>
			{/* Header */}
			{showHeader && (
				<HeaderComponent style={styles.header}>
					{title && <Text style={styles.title}>{title}</Text>}

					{/* Search Bar */}
					<View style={styles.searchContainer}>
						<TextInput
							style={styles.searchInput}
							placeholder={searchPlaceholder || t('general.search') || 'Search...'}
							value={searchQuery}
							onChangeText={handleSearchChange}
							placeholderTextColor={colors.PRIMARY_LIGHT}
							autoCorrect={false}
							autoCapitalize="none"
							clearButtonMode="while-editing"
						/>
						{isLoading && (
							<View style={styles.searchLoadingIndicator}>
								<ActivityIndicator size="small" color={colors.SECONDARY} />
							</View>
						)}
					</View>

					{/* Custom Filters */}
					{customFilters}
				</HeaderComponent>
			)}

			{/* List */}
			<ListComponent
				data={filteredData}
				renderItem={handleRenderItem}
				keyExtractor={keyExtractor}
				ListEmptyComponent={renderEmptyState}
				ListFooterComponent={renderFooter}
				contentContainerStyle={[
					styles.listContent,
					filteredData.length === 0 && styles.listContentEmpty,
					{ paddingBottom: bottomPadding }
				]}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				onEndReached={handleEndReached}
				onEndReachedThreshold={onEndReachedThreshold}
			/>

			{/* Floating Cancel Button - only show if onCancel provided */}
			{onCancel && (
				<View style={[styles.floatingButtonContainer, { paddingBottom: insets.bottom + 16 }]}>
					<PrimaryButton
						text={cancelLabel || t('general.cancel') || 'Cancel'}
						onPress={onCancel}
						variant="outline"
						fullWidth
					/>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 12,
		backgroundColor: 'white',
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		marginBottom: 16,
	},
	searchContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		position: 'relative',
	},
	searchInput: {
		flex: 1,
		height: 46,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingRight: 44,
		fontSize: 17,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
	},
	searchLoadingIndicator: {
		position: 'absolute',
		right: 12,
	},
	listContent: {
		paddingHorizontal: 20,
	},
	listContentEmpty: {
		flex: 1,
		justifyContent: 'center',
	},
	emptyContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 40,
	},
	emptyIcon: {
		fontSize: 48,
		marginBottom: 16,
	},
	emptyTitle: {
		fontFamily: 'Geologica-SemiBold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 8,
		textAlign: 'center',
	},
	emptySubtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		paddingHorizontal: 32,
	},
	loadingFooter: {
		paddingVertical: 20,
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 8,
	},
	loadingMoreText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
	},
	floatingButtonContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		paddingHorizontal: 20,
		paddingTop: 12,
		backgroundColor: 'white',
		borderTopWidth: 1,
		borderTopColor: colors.SECONDARY_LIGHT,
	},
});

export default SearchableListSheet;
