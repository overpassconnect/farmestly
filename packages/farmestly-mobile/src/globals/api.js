// globals/api.js

import * as Keychain from 'react-native-keychain';
import config from './config';

const COOKIE_SERVICE = 'session_cookie';

let cachedCookie = null;
let cacheLoaded = false;

async function getCookie() {
	if (cacheLoaded) return cachedCookie;

	try {
		const creds = await Keychain.getGenericPassword({ service: COOKIE_SERVICE });
		cachedCookie = creds ? creds.password : null;
		cacheLoaded = true;
		return cachedCookie;
	} catch {
		cacheLoaded = true;
		return null;
	}
}

async function setCookie(cookie) {
	if (cookie) {
		cachedCookie = cookie;  // update cache
		await Keychain.setGenericPassword('cookie', cookie, { service: COOKIE_SERVICE });
	}
}

export async function clearCookie() {
	cachedCookie = null;  // clear cache
	cacheLoaded = true;   // mark as loaded (with null value)
	await Keychain.resetGenericPassword({ service: COOKIE_SERVICE });
}

export async function api(url, options = {}) {
	const fullUrl = url.startsWith('http') ? url : config.BASE_URL + url;
	const cookie = await getCookie();

	const headers = { ...options.headers };
	if (cookie) {
		headers['Cookie'] = cookie;
	}

	const res = await fetch(fullUrl, { ...options, headers, credentials: 'include' });

	const setCookieHeader = res.headers.get('set-cookie');

	// Only write to Keychain if session ID changed (new login or session regeneration).
	// With rolling sessions, server sends Set-Cookie on every request to refresh expiry,
	// but the session ID stays the same - no need to hit Keychain repeatedly.
	if (setCookieHeader) {
		const newCookie = setCookieHeader.split(';')[0];
		if (newCookie !== cachedCookie) {
			try {
				await setCookie(newCookie);
			} catch (err) {
				console.error('[API] Failed to persist session to Keychain:', err);
			}
		}
	}

	return res;
}

export default api;