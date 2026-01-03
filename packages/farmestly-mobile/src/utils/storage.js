import { createMMKV } from 'react-native-mmkv';

// Create MMKV instance (v4 API)
const mmkv = createMMKV();

// AsyncStorage-compatible wrapper for drop-in replacement
// MMKV v4 uses getString/set/remove instead of getItem/setItem/removeItem
export const Storage = {
	getItem: (key) => {
		try {
			const value = mmkv.getString(key);
			return Promise.resolve(value ?? null);
		} catch (error) {
			return Promise.reject(error);
		}
	},

	setItem: (key, value) => {
		try {
			mmkv.set(key, value);
			return Promise.resolve();
		} catch (error) {
			return Promise.reject(error);
		}
	},

	removeItem: (key) => {
		try {
			mmkv.remove(key);
			return Promise.resolve();
		} catch (error) {
			return Promise.reject(error);
		}
	},

	getAllKeys: () => {
		try {
			const keys = mmkv.getAllKeys();
			return Promise.resolve(keys);
		} catch (error) {
			return Promise.reject(error);
		}
	},

	multiGet: (keys) => {
		try {
			const result = keys.map(key => [key, mmkv.getString(key) ?? null]);
			return Promise.resolve(result);
		} catch (error) {
			return Promise.reject(error);
		}
	},

	multiSet: (keyValuePairs) => {
		try {
			keyValuePairs.forEach(([key, value]) => {
				mmkv.set(key, value);
			});
			return Promise.resolve();
		} catch (error) {
			return Promise.reject(error);
		}
	},

	multiRemove: (keys) => {
		try {
			keys.forEach(key => mmkv.remove(key));
			return Promise.resolve();
		} catch (error) {
			return Promise.reject(error);
		}
	},

	clear: () => {
		try {
			mmkv.clearAll();
			return Promise.resolve();
		} catch (error) {
			return Promise.reject(error);
		}
	}
};

// Export raw MMKV instance for direct access when needed
export const storage = mmkv;
