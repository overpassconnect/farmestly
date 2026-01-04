import { useCallback, useRef } from 'react';
import { Text, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBottomSheet } from '../components/sheets/BottomSheetContextProvider';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useGlobalContext } from '../components/context/GlobalContextProvider';
import { api as rawApi, clearCookie } from '../globals/api';
import { useNavigation } from '@react-navigation/native';
import colors from '../globals/colors';
import PrimaryButton from '../components/ui/core/PrimaryButton';

const HTTP_FALLBACK = {
	400: 'BAD_REQUEST',
	401: 'SIGNED_OUT',
	403: 'FORBIDDEN',
	404: 'NOT_FOUND',
	408: 'TIMEOUT',
	409: 'CONFLICT',
	422: 'VALIDATION_FAILED',
	429: 'TOO_MANY_REQUESTS',
	500: 'INTERNAL_ERROR',
	502: 'BAD_GATEWAY',
	503: 'SERVICE_UNAVAILABLE',
	504: 'GATEWAY_TIMEOUT',
};

export function useApi() {
	const { t } = useTranslation('alerts');
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const { isOffline } = useGlobalContext();
	const navigation = useNavigation();
	const shownRef = useRef(false);

	const showError = useCallback((code, data = {}) => {
		if (shownRef.current || isOffline) return;
		shownRef.current = true;

		const message = t(`errors.${code}`, { ...data, defaultValue: t('errors.UNKNOWN') });

		openBottomSheet(
			<BottomSheetView style={styles.container}>
				<Image
					source={require('../assets/icons/exclamation_circle_orange.png')}
					style={styles.icon}
				/>
				<Text style={styles.title}>{t('error')}</Text>
				<Text style={styles.message}>{message}</Text>
				<PrimaryButton
					text="OK"
					onPress={() => {
						closeBottomSheet();
						shownRef.current = false;
					}}
					style={{ marginTop: 24 }}
				/>
			</BottomSheetView>,
			{ snapPoints: ['35%'], enablePanDownToClose: true }
		);
	}, [t, isOffline, openBottomSheet, closeBottomSheet]);

	const api = useCallback(async (url, options = {}) => {
		try {
			const res = await rawApi(url, options);

			let json = null;
			try {
				json = await res.json();
			} catch { }

			// Valid app response
			if (json?.HEADERS?.STATUS_CODE) {
				const code = json.HEADERS.STATUS_CODE;
				const ok = code === 'OK';
				const validation = json.HEADERS.VALIDATION;

				if (code === 'SIGNED_OUT') {
					await clearCookie();
					navigation.reset({ index: 0, routes: [{ name: 'Entry' }] });
				} else if (!ok && !validation) {
					showError(code, json.PAYLOAD || {});
				}

				return { ok, data: json.PAYLOAD, code, validation, status: res.status, raw: json };
			}

			// No JSON body - infrastructure failure
			const fallback = HTTP_FALLBACK[res.status] || 'UNKNOWN';

			if (fallback === 'SIGNED_OUT') {
				await clearCookie();
				navigation.reset({ index: 0, routes: [{ name: 'Entry' }] });
			} else {
				showError(fallback);
			}

			return { ok: false, data: null, code: fallback, validation: null, status: res.status, raw: null };

		} catch {
			showError('NETWORK_ERROR');
			return { ok: false, data: null, code: 'NETWORK_ERROR', validation: null, status: 0, raw: null };
		}
	}, [navigation, showError]);

	return { api, showError };
}

const styles = StyleSheet.create({
	container: { padding: 16, alignItems: 'center' },
	icon: { width: 48, height: 48, marginBottom: 8 },
	title: { fontSize: 24, fontFamily: 'Geologica-SemiBold', color: colors.PRIMARY, marginBottom: 12 },
	message: { fontSize: 18, fontFamily: 'Geologica-Regular', color: colors.PRIMARY_LIGHT, textAlign: 'center', lineHeight: 26 },
});