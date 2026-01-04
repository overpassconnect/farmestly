import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Storage } from '../../utils/storage';
import NetInfo from '@react-native-community/netinfo';
import { api, clearCookie } from '../../globals/api';
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
	// CACHE HELPERS (simplified - no validation beyond JSON parse)
	// ============================================
	const saveToCache = useCallback(async (data) => {
		try {
			const json = JSON.stringify(data);
			await Storage.setItem(CACHE_KEY, json);
			console.log('[GlobalContext] Cache saved successfully');
			return true;
		} catch (err) {
			console.error('[GlobalContext] Cache save failed:', err);
			return false;
		}
	}, []);

	const loadCache = useCallback(async () => {
		try {
			const json = await Storage.getItem(CACHE_KEY);
			console.log('[GlobalContext] Cache read:', json ? `${json.length} chars` : 'empty');
			if (!json) return null;
			const data = JSON.parse(json);
			console.log('[GlobalContext] Cache parsed, has account:', !!data?.account);
			return data;
		} catch (err) {
			console.error('[GlobalContext] Cache load failed:', err);
			return null;
		}
	}, []);

	const clearCache = useCallback(async () => {
		try {
			await Storage.removeItem(CACHE_KEY);
			console.log('[GlobalContext] Cache cleared');
		} catch (err) {
			console.error('[GlobalContext] Cache clear failed:', err);
		}
	}, []);

	// ============================================
	// SERVER COMMUNICATION
	// ============================================
	const fetchFromServer = useCallback(async () => {
		try {
			const res = await Promise.race([
				api('/getAccountData', { method: 'GET' }),
				new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
			]);
			const data = await res.json();

			if (data.HEADERS?.STATUS_CODE === 'OK' && data.PAYLOAD) {
				return {
					account: data.PAYLOAD.account,
					farm: data.PAYLOAD.farm || null
				};
			}

			if (data.HEADERS?.STATUS_CODE === 'NO_SESSION') {
				await clearCookie();
				// Don't clear cache here - preserve offline data
				// Cache is only cleared on explicit logout
				return { noSession: true };
			}

			return null;
		} catch (err) {
			console.error('[GlobalContext] Server fetch failed:', err.message);
			return null;
		}
	}, []);

	// ============================================
	// DATA LOADING (simplified flow)
	// ============================================
	const applyData = useCallback((data, source) => {
		setAccountRaw(data.account);
		setFarmRaw(data.farm);
		setDataSource(source);
		setIsOffline(source === 'cache');

		// Initialize JobService if we have fields
		const fields = data.farm?.fields;
		if (fields?.length) {
			JobService.initialize(fields.map(f => f._id)).catch(err =>
				console.error('[GlobalContext] JobService init failed:', err)
			);
		}
	}, []);

	const loadData = useCallback(async () => {
		console.log('[GlobalContext] loadData started');
		setIsLoading(true);
		setError(null);

		// Check network state before attempting server fetch
		const netState = await NetInfo.fetch();
		const hasConnection = netState.isConnected && netState.isInternetReachable !== false;

		// Step 1: Try server (only if we might have connectivity)
		const serverData = hasConnection ? await fetchFromServer() : null;
		console.log('[GlobalContext] Server result:', serverData?.noSession ? 'NO_SESSION' : serverData?.account ? 'OK' : 'FAILED');

		// Explicit logout from server
		if (serverData?.noSession) {
			setAccountRaw(null);
			setFarmRaw(null);
			setDataSource(null);
			setIsOffline(false);
			setIsLoading(false);
			return null;
		}

		// Server returned data
		if (serverData?.account) {
			applyData(serverData, 'server');
			await saveToCache(serverData);
			setIsLoading(false);
			return serverData;
		}

		// Step 2: Server failed, try cache
		console.log('[GlobalContext] Server failed, trying cache...');
		const cached = await loadCache();

		if (cached?.account) {
			console.log('[GlobalContext] Using cached data');
			applyData(cached, 'cache');
			setIsLoading(false);
			return cached;
		}

		// Step 3: Nothing available
		console.log('[GlobalContext] No data available');
		setAccountRaw(null);
		setFarmRaw(null);
		setDataSource(null);
		setIsOffline(true);
		setIsLoading(false);
		return null;
	}, [fetchFromServer, saveToCache, loadCache, applyData]);

	const refresh = useCallback(async () => {
		const serverData = await fetchFromServer();
		if (serverData?.account) {
			applyData(serverData, 'server');
			await saveToCache(serverData);
			return true;
		}
		return false;
	}, [fetchFromServer, saveToCache, applyData]);

	// ============================================
	// CONNECTIVITY POLLING
	// ============================================
	const checkConnectivity = useCallback(async () => {
		try {
			const res = await Promise.race([
				api('/ping', { method: 'GET' }),
				new Promise((_, reject) => setTimeout(() => reject(), 5000))
			]);
			if (res.ok && isOffline) {
				setIsOffline(false);
				refresh();
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
	// STATE SETTERS (no auto-persist)
	// ============================================
	const setAccount = useCallback((data) => {
		if (typeof data === 'function') {
			setAccountRaw(prev => data(prev));
		} else {
			setAccountRaw(data);
		}
	}, []);

	const setFarm = useCallback((data) => {
		if (typeof data === 'function') {
			setFarmRaw(prev => data(prev));
		} else {
			setFarmRaw(data);
		}
	}, []);

	// ============================================
	// PARTIAL UPDATE HELPERS
	// ============================================
	const updatePreferences = useCallback((key, value) => {
		setAccountRaw(prev => ({
			...prev,
			preferences: { ...prev?.preferences, [key]: value }
		}));
		api('/settings/preferences', {
			method: 'POST',
			body: JSON.stringify({ [key]: value })
		}).catch(() => { });
	}, []);

	const updateAccountField = useCallback((key, value) => {
		setAccountRaw(prev => ({ ...prev, [key]: value }));
	}, []);

	const setLocalPreference = useCallback((key, value) => {
		setLocalPreferencesRaw(prev => {
			const next = { ...prev, [key]: value };
			Storage.setItem(LOCAL_PREFS_KEY, JSON.stringify(next)).catch(() => { });
			return next;
		});
	}, []);

	// ============================================
	// UPDATES MERGE PROTOCOL (from JobService sync)
	// ============================================
	const mergeWithProtocol = useCallback((target, source) => {
		const result = { ...target };
		Object.keys(source).forEach(key => {
			const sourceVal = source[key];
			const targetVal = target[key];

			if (sourceVal === null) {
				result[key] = null;
			} else if (Array.isArray(sourceVal)) {
				result[key] = sourceVal;
			} else if (
				sourceVal !== null &&
				typeof sourceVal === 'object' &&
				!Array.isArray(sourceVal) &&
				targetVal !== null &&
				typeof targetVal === 'object' &&
				!Array.isArray(targetVal)
			) {
				result[key] = mergeWithProtocol(targetVal, sourceVal);
			} else {
				result[key] = sourceVal;
			}
		});
		return result;
	}, []);

	// Listen to JobService events
	useEffect(() => {
		const removeListener = JobService.on((event, data) => {
			if (event === 'change') {
				setActiveRecordings(JobService.getAllActive());
			} else if (event === 'tick') {
				setActiveRecordings(prev => {
					const recordings = JobService.getAllActive();
					const prevKeys = Object.keys(prev);
					const newKeys = Object.keys(recordings);

					if (prevKeys.length !== newKeys.length) {
						return recordings;
					}

					const statusChanged = newKeys.some(key => {
						const prevRec = prev[key];
						const newRec = recordings[key];
						if (!prevRec) return true;
						return prevRec.status !== newRec.status;
					});

					return statusChanged ? recordings : prev;
				});
			} else if (event === 'sync') {
				// Handle incremental updates from server after job sync
				const { updates } = data || {};
				if (!updates || typeof updates !== 'object') return;

				setFarmRaw(prev => {
					if (!prev) return prev;

					const next = { ...prev };
					Object.entries(updates).forEach(([collection, docs]) => {
						if (!Array.isArray(docs) || !prev[collection]) return;

						next[collection] = prev[collection].map(item => {
							const update = docs.find(d => String(d._id) === String(item._id));
							if (!update) return item;
							return mergeWithProtocol(item, update);
						});
					});

					return next;
				});
			}
		});

		return () => removeListener();
	}, [mergeWithProtocol]);

	// ============================================
	// BACKWARDS COMPATIBILITY
	// ============================================
	const farmData = farm;
	const metadata = account;
	const setFarmData = setFarm;
	const setMetadata = setAccount;

	const loadFromServer = useCallback(async () => {
		setIsLoading(true);
		const serverData = await fetchFromServer();
		if (serverData?.account) {
			applyData(serverData, 'server');
			await saveToCache(serverData);
			setIsLoading(false);
			return { metadata: serverData.account, content: { farmData: serverData.farm } };
		}
		setIsLoading(false);
		return null;
	}, [fetchFromServer, saveToCache, applyData]);

	const loadFromCache = useCallback(async () => {
		const data = await loadCache();
		if (data?.account) {
			return { metadata: data.account, farmData: data.farm };
		}
		return null;
	}, [loadCache]);

	// ============================================
	// COMPUTED VALUES
	// ============================================
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
		clearCache,

		// Backwards compatibility (deprecated)
		farmData,
		metadata,
		setFarmData,
		setMetadata,
		loadFromServer,
		loadFromCache,
		setIsOffline,

		// Legacy state
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
		clearCache,
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
