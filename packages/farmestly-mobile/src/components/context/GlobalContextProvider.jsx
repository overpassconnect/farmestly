import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Storage } from '../../utils/storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../../globals/api';
import JobService from '../../utils/JobService';

const GlobalContext = createContext();

const CACHE_KEY = '@app_data';
const LOCAL_PREFS_KEY = '@local_preferences';
const PING_INTERVAL = 30000;

export const GlobalContextProvider = ({ children }) => {
	// Core state - mirrors server structure exactly
	const [account, setAccountRaw] = useState(null);
	const [farm, setFarmRaw] = useState(null);

	// App state
	const [isLoading, setIsLoading] = useState(true);
	const [isOffline, setIsOffline] = useState(false);
	const [error, setError] = useState(null);
	const [dataSource, setDataSource] = useState(null); // 'server' | 'cache' | null

	// Local preferences (not synced to server)
	const [localPreferences, setLocalPreferencesRaw] = useState({
		uiPerformanceMode: 'pretty' // 'pretty' | 'balanced'
	});

	// Legacy state for job recordings and first setup
	const [activeRecordings, setActiveRecordings] = useState({});
	const [tmpFirstSetup, setTmpFirstSetup] = useState({});
	const [isTimerVisible, setIsTimerVisible] = useState(false);

	const pingIntervalRef = useRef(null);

	// Load local preferences on mount
	useEffect(() => {
		Storage.getItem(LOCAL_PREFS_KEY)
			.then(json => {
				if (json) setLocalPreferencesRaw(JSON.parse(json));
			})
			.catch(() => { });
	}, []);

	// Helper function to get recording for a specific field
	const getRecordingForField = useCallback((fieldId) => {
		return activeRecordings[fieldId] || null;
	}, [activeRecordings]);

	// Check if any recordings are active
	const hasAnyActiveRecording = useMemo(() => {
		return Object.keys(activeRecordings).length > 0;
	}, [activeRecordings]);

	// ============================================
	// AUTO-PERSIST HELPERS
	// ============================================
	const persistToCache = useCallback(async (data) => {
		if (data.account && data.farm) {
			try {
				await Storage.setItem(CACHE_KEY, JSON.stringify(data));
			} catch (err) {
				console.error('Failed to persist to cache:', err);
			}
		}
	}, []);

	// ============================================
	// SETTERS WITH AUTO-PERSIST
	// ============================================
	const setAccount = useCallback((data) => {
		setAccountRaw(data);
		persistToCache({ account: data, farm });
	}, [farm, persistToCache]);

	const setFarm = useCallback((data) => {
		setFarmRaw(data);
		persistToCache({ account, farm: data });
	}, [account, persistToCache]);

	// ============================================
	// DATA LOADING (INTERNAL)
	// ============================================
	const loadFromCacheInternal = useCallback(async () => {
		try {
			const json = await Storage.getItem(CACHE_KEY);
			return json ? JSON.parse(json) : null;
		} catch (err) {
			console.error('Failed to load from cache:', err);
			return null;
		}
	}, []);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		// Try server first
		const serverData = await fetchFromServer();
		if (serverData) {
			setAccountRaw(serverData.account);
			setFarmRaw(serverData.farm);
			setDataSource('server');
			setIsOffline(false);
			await persistToCache(serverData);

			// Initialize JobService with field IDs
			if (serverData.farm?.fields) {
				const fieldIds = serverData.farm.fields.map(f => f._id);
				JobService.initialize(fieldIds)
					.catch(err => console.error('[GlobalContext] JobService initialization failed:', err));
			}

			setIsLoading(false);
			return serverData;
		}

		// Fallback to cache
		const cachedData = await loadFromCacheInternal();
		if (cachedData) {
			setAccountRaw(cachedData.account);
			setFarmRaw(cachedData.farm);
			setDataSource('cache');
			setIsOffline(true);

			// Try to initialize JobService even from cached data
			if (cachedData.farm?.fields) {
				const fieldIds = cachedData.farm.fields.map(f => f._id);
				JobService.initialize(fieldIds)
					.catch(err => console.error('[GlobalContext] JobService initialization failed:', err));
			}

			setIsLoading(false);
			return cachedData;
		}

		// No data available
		console.error('No server or cache data available');

		setIsLoading(false);
		return null;
	}, [persistToCache, loadFromCacheInternal]);

	const fetchFromServer = useCallback(async () => {
		try {
			const res = await Promise.race([
				api('/getAccountData', { method: 'GET' }),
				new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
			]);
			const data = await res.json();

			if (data.HEADERS?.STATUS_CODE === 'OK' && data.PAYLOAD) {
				const serverData = {
					account: data.PAYLOAD.account,
					farm: data.PAYLOAD.farm || {}
				};

				if (serverData.farm) {
					Storage.setItem('@FarmDataCache', JSON.stringify(serverData.farm))
						.catch(err => console.error('Failed to cache farmData:', err));
				}

				return serverData;
			}

			// NO_SESSION is expected on first install, don't log as error
			if (data.HEADERS?.STATUS_CODE !== 'NO_SESSION') {
				console.error('Invalid response or unsuccessful request:', data);
			}
			return null;
		} catch (err) {
			console.error('Failed to fetch from server:', err);
			return null;
		}
	}, []);


	const refresh = useCallback(async () => {
		const serverData = await fetchFromServer();
		if (serverData) {
			setAccountRaw(serverData.account);
			setFarmRaw(serverData.farm);
			setDataSource('server');
			setIsOffline(false);
			await persistToCache(serverData);
			return true;
		}
		return false;
	}, [fetchFromServer, persistToCache]);

	// ============================================
	// CONNECTIVITY
	// ============================================
	const checkConnectivity = useCallback(async () => {
		try {
			const res = await Promise.race([
				api('/ping', { method: 'GET' }),
				new Promise((_, reject) => setTimeout(() => reject(), 5000))
			]);
			if (res.ok && isOffline) {
				setIsOffline(false);
				refresh(); // Sync when back online
				// JobService syncs automatically, no manual trigger needed
			}
		} catch {
			if (!isOffline) setIsOffline(true);
		}
	}, [isOffline, refresh]);

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener(state => {
			if (!state.isConnected) {
				setIsOffline(true);
			} else {
				checkConnectivity();
			}
		});
		pingIntervalRef.current = setInterval(checkConnectivity, PING_INTERVAL);
		return () => {
			unsubscribe();
			clearInterval(pingIntervalRef.current);
		};
	}, [checkConnectivity]);

	// ============================================
	// PARTIAL UPDATE HELPERS
	// ============================================
	const updatePreferences = useCallback((key, value) => {
		setAccount(prev => ({
			...prev,
			preferences: { ...prev?.preferences, [key]: value }
		}));
		// Fire-and-forget server sync
		api('/settings/preferences', {
			method: 'POST',
			body: JSON.stringify({ [key]: value })
		}).catch(() => { });
	}, [setAccount]);

	const updateAccountField = useCallback((key, value) => {
		setAccount(prev => ({ ...prev, [key]: value }));
	}, [setAccount]);

	// Setter for local preferences with auto-persist
	const setLocalPreference = useCallback((key, value) => {
		setLocalPreferencesRaw(prev => {
			const next = { ...prev, [key]: value };
			Storage.setItem(LOCAL_PREFS_KEY, JSON.stringify(next)).catch(() => { });
			return next;
		});
	}, []);

	// Listen to JobService - only update on meaningful changes
	useEffect(() => {
		const removeListener = JobService.on((event, data) => {
			if (event === 'change') {
				// Reload all active recordings when there's a change
				setActiveRecordings(JobService.getAllActive());
			} else if (event === 'tick') {
				// Update tick data but check if meaningful change first
				setActiveRecordings(prev => {
					const recordings = JobService.getAllActive();
					const prevKeys = Object.keys(prev);
					const newKeys = Object.keys(recordings);

					// Recording added or removed
					if (prevKeys.length !== newKeys.length) {
						return recordings;
					}

					// Check if any status changed (ignore elapsedMs)
					const statusChanged = newKeys.some(key => {
						const prevRec = prev[key];
						const newRec = recordings[key];
						if (!prevRec) return true;
						return prevRec.status !== newRec.status;
					});

					// Return prev reference if no meaningful change
					return statusChanged ? recordings : prev;
				});
			} else if (event === 'cultivationResolved') {
				// Update field.currentCultivation.id from temp to real ObjectId
				console.log('[GlobalContextProvider] Handling cultivationResolved event:', data);
				setFarmData(prev => ({
					...prev,
					fields: prev.fields.map(f =>
						f._id === data.fieldId && f.currentCultivation?.id === data.tempId
							? {
								...f,
								currentCultivation: {
									...f.currentCultivation,
									id: data.realId  // Update from temp_* to real ObjectId
								}
							}
							: f
					)
				}));
			}
		});

		return () => {
			removeListener();
		};
	}, []);

	// ============================================
	// BACKWARDS COMPATIBILITY LAYER
	// ============================================
	// Expose old API for components not yet migrated
	const farmData = farm;
	const metadata = account;

	const setFarmData = useCallback((data) => {
		if (typeof data === 'function') {
			setFarm(prev => data(prev));
		} else {
			setFarm(data);
		}
	}, [setFarm]);

	const setMetadata = useCallback((data) => {
		if (typeof data === 'function') {
			setAccount(prev => data(prev));
		} else {
			setAccount(data);
		}
	}, [setAccount]);

	const loadFromServer = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		const serverData = await fetchFromServer();
		if (serverData) {
			setAccountRaw(serverData.account);
			setFarmRaw(serverData.farm);
			setDataSource('server');
			setIsOffline(false);
			await persistToCache(serverData);
			setIsLoading(false);
			// Return old format for backwards compatibility
			return {
				metadata: serverData.account,
				content: { farmData: serverData.farm }
			};
		}

		setIsLoading(false);
		return null;
	}, [fetchFromServer, persistToCache]);

	const loadFromCache = useCallback(async () => {
		const data = await loadFromCacheInternal();
		if (data) {
			// Return old format for backwards compatibility
			return {
				metadata: data.account,
				farmData: data.farm
			};
		}
		return null;
	}, [loadFromCacheInternal]);

	// ============================================
	// COMPUTED VALUES
	// ============================================
	// Compute total area from fields (client-side calculation)
	const totalArea = useMemo(() => {
		if (!farm?.fields || farm.fields.length === 0) return 0;
		return farm.fields.reduce((sum, field) => sum + (field.area || 0), 0);
	}, [farm?.fields]);

	// ============================================
	// CONTEXT VALUE
	// ============================================
	const value = useMemo(() => ({
		// New API
		account,
		farm,
		setAccount,
		setFarm,
		updatePreferences,
		updateAccountField,

		// Computed values
		totalArea,

		// Local preferences
		localPreferences,
		setLocalPreference,

		// State
		isLoading,
		isOffline,
		error,
		dataSource,

		// Actions
		loadData,
		refresh,

		// Backwards compatibility - OLD API (deprecated)
		farmData,
		metadata,
		setFarmData,
		setMetadata,
		loadFromServer,
		loadFromCache,
		setIsOffline,

		// Legacy state for backwards compatibility
		tmpFirstSetup,
		setTmpFirstSetup,
		isTimerVisible,
		setIsTimerVisible,
		activeRecordings,
		setActiveRecordings,
		getRecordingForField,
		hasAnyActiveRecording,
		api,
	}), [
		account,
		farm,
		setAccount,
		setFarm,
		updatePreferences,
		updateAccountField,
		totalArea,
		localPreferences,
		setLocalPreference,
		isLoading,
		isOffline,
		error,
		dataSource,
		loadData,
		refresh,
		farmData,
		metadata,
		setFarmData,
		setMetadata,
		loadFromServer,
		loadFromCache,
		tmpFirstSetup,
		isTimerVisible,
		activeRecordings,
		getRecordingForField,
		hasAnyActiveRecording,
	]);

	return (
		<GlobalContext.Provider value={value}>
			{children}
		</GlobalContext.Provider>
	);
};

export const useGlobalContext = () => {
	const context = useContext(GlobalContext);
	if (context === undefined) {
		throw new Error('useGlobalContext must be used within a GlobalContextProvider');
	}
	return context;
};