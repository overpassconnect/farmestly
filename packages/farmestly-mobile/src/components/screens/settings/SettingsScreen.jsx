import React, { useState, useEffect, useCallback } from 'react';
import {
	View,
	Text,
	Switch,
	ActivityIndicator,
	TouchableOpacity,
	ScrollView,
	StyleSheet,
	Platform,
} from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';

import colors from '../../../globals/colors';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useLocale } from '../../../providers/LocaleProvider';
import { SUPPORTED_LOCALES } from '../../../globals/locale/constants';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUnits } from '../../../providers/UnitsProvider';
import { Storage } from '../../../utils/storage';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import config from '../../../globals/config';
import { clearCookie } from '../../../globals/api';
import { useApi } from '../../../hooks/useApi';
import PrimaryButton from '../../ui/core/PrimaryButton';
import OptionPicker from '../../ui/core/OptionPicker';
import ListItem from '../../ui/list/ListItem';
import JobService from '../../../utils/JobService';
import VerificationBadge from '../../ui/core/VerificationBadge';

const BASE_URL = config.BASE_URL;

const validationMessages = {
	username: 'Username must be at least 5 letters',
	email: 'Please enter a valid email address',
	phone: 'Please enter a valid phone number',
	password: 'Password must be at least 8 characters',
};

const SettingInput = ({
	label,
	value,
	type = 'text',
	onSave,
	onPress,
	isEditing,
	isSectionEditing,
	error,
	fieldKey,
	showIndividualEdit = true,
	isSecure = false
}) => {
	const [localValue, setLocalValue] = useState(value);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const handleSave = async (newValue) => {
		setIsLoading(true);
		try {
			const result = await onSave(newValue);
			if (!result.success) {
				setLocalValue(value);
			}
		} catch (error) {
			console.error('Failed to update setting:', error);
			setLocalValue(value);
		}
		setIsLoading(false);
	};

	const content = (
		<>
			<View style={styles.settingContent}>
				<Text style={styles.label}>{label}</Text>
				<View style={styles.inputWrapper}>
					{type === 'switch' ? (
						<Switch
							value={localValue}
							onValueChange={(newValue) => {
								setLocalValue(newValue);
								handleSave(newValue);
							}}
							disabled={(!showIndividualEdit && !isEditing) || isLoading || isSectionEditing}
							trackColor={{ false: '#E5E7EB', true: colors.SECONDARY }}
							thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : localValue ? '#FFFFFF' : '#F3F4F6'}
						/>
					) : (
						<View style={styles.valueContainer}>
							<Text
								style={[styles.valueText, isSecure && styles.secureText]}
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{localValue || 'Not set'}
							</Text>
							{showIndividualEdit && !isSectionEditing && (
								isLoading ? (
									<ActivityIndicator color="#007AFF" size="small" style={styles.chevron} />
								) : (
									<Text style={styles.chevron}>›</Text>
								)
							)}
						</View>
					)}
				</View>
			</View>
			{error && (
				<Text style={styles.errorText}>{validationMessages[fieldKey]}</Text>
			)}
		</>
	);

	if (type === 'switch' || !showIndividualEdit || isSectionEditing) {
		return <View style={styles.settingContainer}>{content}</View>;
	}

	return (
		<TouchableOpacity
			style={styles.settingContainer}
			onPress={onPress}
			disabled={isLoading}
		>
			{content}
		</TouchableOpacity>
	);
};

const SettingsSection = ({
	title,
	children,
	showIndividualEdit = true
}) => {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>{title}</Text>
			{React.Children.map(children, child =>
				child ? React.cloneElement(child, {
					showIndividualEdit: showIndividualEdit
				}) : null
			)}
		</View>
	);
};

const SettingsScreen = () => {
	const { t } = useTranslation(['common', 'screens']);
	const { locale, changeLocale } = useLocale();
	const { unit: getCurrentUnit, setUnit, getAvailableUnits } = useUnits();

	const navigation = useNavigation();
	const { account, localPreferences, setLocalPreference, refresh, clearCache } = useGlobalContext();

	// Refresh account data when screen is focused (e.g., after email verification)
	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh])
	);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoading2, setIsLoading2] = useState(false);
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const { api } = useApi();

	const handleLocaleChange = async (newLocale) => {
		try {
			console.log('Changing locale to:', newLocale);
			await changeLocale(newLocale);
			closeBottomSheet();
		} catch (error) {
			console.error('Error changing locale:', error);
		}
	};

	const handleAreaUnitChange = (unit) => {
		setUnit('area', unit);
		closeBottomSheet();
	};

	const handleLengthUnitChange = (unit) => {
		setUnit('length', unit);
		closeBottomSheet();
	};

	const handleVolumeUnitChange = (unit) => {
		setUnit('volume', unit);
		closeBottomSheet();
	};

	const handleMassUnitChange = (unit) => {
		setUnit('mass', unit);
		closeBottomSheet();
	};

	const showLocaleOptions = () => {
		// Build locale options from SUPPORTED_LOCALES
		const locales = Object.entries(SUPPORTED_LOCALES).map(([key, config]) => ({
			key,
			label: config.displayName,
			icon: config.country,
		}));

		const content = (
			<BottomSheetView style={styles.bottomSheetContainer}>
				{locales.map((loc) => (
					<TouchableOpacity
						key={loc.key}
						onPress={() => handleLocaleChange(loc.key)}
					>
						<ListItem
							icon={<Text style={styles.unitIcon}>{loc.icon}</Text>}
							title={loc.label}
							simple={true}
							showChevron={false}
							showRadio={true}
							isSelected={locale === loc.key}
						/>
					</TouchableOpacity>
				))}
			</BottomSheetView>
		);

		openBottomSheet(content, {
			snapPoints: ['50%'],
			enablePanDownToClose: true
		});
	};

	const showAreaUnitOptions = () => {
		const currentAreaUnit = getCurrentUnit('area');
		const units = getAvailableUnits('area').map(u => ({
			key: u.key,
			label: u.symbol,
			displayLabel: u.key === 'hectares' ? t('common:units.hectares') :
				u.key === 'acres' ? t('common:units.acres') :
					u.key === 'm2' ? t('common:units.squareMeters') :
						u.key === 'stremma' ? t('common:units.stremma') :
							u.symbol
		}));

		const content = (
			<BottomSheetView style={styles.bottomSheetContainer}>
				{units.map((unit) => (
					<TouchableOpacity
						key={unit.key}
						onPress={() => handleAreaUnitChange(unit.key)}
					>
						<ListItem
							icon={<Text style={styles.unitIcon}>{unit.label}</Text>}
							title={unit.displayLabel}
							simple={true}
							showChevron={false}
							showRadio={true}
							isSelected={currentAreaUnit === unit.key}
						/>
					</TouchableOpacity>
				))}
			</BottomSheetView>
		);

		openBottomSheet(content, {
			snapPoints: ['40%'],
			enablePanDownToClose: true
		});
	};

	const showLengthUnitOptions = () => {
		const currentLengthUnit = getCurrentUnit('length');
		const units = getAvailableUnits('length').map(u => ({
			key: u.key,
			label: u.symbol,
			displayLabel: u.key === 'm' ? t('common:units.meters') :
				u.key === 'ft' ? t('common:units.feet') :
					u.key === 'yd' ? t('common:units.yards') :
						u.symbol
		}));

		const content = (
			<BottomSheetView style={styles.bottomSheetContainer}>
				{units.map((unit) => (
					<TouchableOpacity
						key={unit.key}
						onPress={() => handleLengthUnitChange(unit.key)}
					>
						<ListItem
							icon={<Text style={styles.unitIcon}>{unit.label}</Text>}
							title={unit.displayLabel}
							simple={true}
							showChevron={false}
							showRadio={true}
							isSelected={currentLengthUnit === unit.key}
						/>
					</TouchableOpacity>
				))}
			</BottomSheetView>
		);

		openBottomSheet(content, {
			snapPoints: ['40%'],
			enablePanDownToClose: true
		});
	};

	const showVolumeUnitOptions = () => {
		const currentVolumeUnit = getCurrentUnit('volume');
		const units = getAvailableUnits('volume').map(u => ({
			key: u.key,
			label: u.symbol,
			displayLabel: u.key === 'L' ? t('common:units.liters') :
				u.key === 'mL' ? t('common:units.milliliters') :
					u.key === 'gal' ? t('common:units.gallons') :
						u.symbol
		}));

		const content = (
			<BottomSheetView style={styles.bottomSheetContainer}>
				{units.map((unit) => (
					<TouchableOpacity
						key={unit.key}
						onPress={() => handleVolumeUnitChange(unit.key)}
					>
						<ListItem
							icon={<Text style={styles.unitIcon}>{unit.label}</Text>}
							title={unit.displayLabel}
							simple={true}
							showChevron={false}
							showRadio={true}
							isSelected={currentVolumeUnit === unit.key}
						/>
					</TouchableOpacity>
				))}
			</BottomSheetView>
		);

		openBottomSheet(content, {
			snapPoints: ['40%'],
			enablePanDownToClose: true
		});
	};

	const showMassUnitOptions = () => {
		const currentMassUnit = getCurrentUnit('mass');
		const units = getAvailableUnits('mass').map(u => ({
			key: u.key,
			label: u.symbol,
			displayLabel: u.key === 'kg' ? t('common:units.kilograms') :
				u.key === 'g' ? t('common:units.grams') :
					u.key === 'lb' ? t('common:units.pounds') :
						u.symbol
		}));

		const content = (
			<BottomSheetView style={styles.bottomSheetContainer}>
				{units.map((unit) => (
					<TouchableOpacity
						key={unit.key}
						onPress={() => handleMassUnitChange(unit.key)}
					>
						<ListItem
							icon={<Text style={styles.unitIcon}>{unit.label}</Text>}
							title={unit.displayLabel}
							simple={true}
							showChevron={false}
							showRadio={true}
							isSelected={currentMassUnit === unit.key}
						/>
					</TouchableOpacity>
				))}
			</BottomSheetView>
		);

		openBottomSheet(content, {
			snapPoints: ['40%'],
			enablePanDownToClose: true
		});
	};


	const getLocaleLabel = (localeCode) => {
		return SUPPORTED_LOCALES[localeCode]?.displayName || localeCode;
	};

	const getAreaUnitLabel = () => {
		const unit = getCurrentUnit('area');
		switch (unit) {
			case 'hectares': return t('common:units.hectares');
			case 'acres': return t('common:units.acres');
			case 'm2': return t('common:units.squareMeters');
			case 'stremma': return t('common:units.stremma');
			default: return unit;
		}
	};

	const getLengthUnitLabel = () => {
		const unit = getCurrentUnit('length');
		switch (unit) {
			case 'm': return t('common:units.meters');
			case 'ft': return t('common:units.feet');
			case 'yd': return t('common:units.yards');
			default: return unit;
		}
	};

	const getVolumeUnitLabel = () => {
		const unit = getCurrentUnit('volume');
		switch (unit) {
			case 'L': return t('common:units.liters');
			case 'mL': return t('common:units.milliliters');
			case 'gal': return t('common:units.gallons');
			default: return unit;
		}
	};

	const getMassUnitLabel = () => {
		const unit = getCurrentUnit('mass');
		switch (unit) {
			case 'kg': return t('common:units.kilograms');
			case 'g': return t('common:units.grams');
			case 'lb': return t('common:units.pounds');
			default: return unit;
		}
	};


	const handleSignout = async () => {
		setIsLoading(true);
		const result = await api(BASE_URL + '/signout', { method: 'POST' });
		setIsLoading(false);
		if (result.ok || result.code === 'SIGNED_OUT') {
			await JobService.reset();
			await clearCookie();
			await clearCache();
			navigation.replace('Entry');
		}
	};

	return (
		<View style={styles.container}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[styles.contentContainer]}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.title}>{t('screens:settings.title')}</Text>

				{/* Email Section */}
				<SettingsSection
					title={t('screens:settings.email')}
					showIndividualEdit={true}
				>
					<SettingInput
						fieldKey="email"
						label={t('common:labels.email')}
						value={account?.email || t('screens:settings.notSet')}
						onSave={() => ({ success: true })}
						onPress={() => navigation.navigate('EmailSettingsScreen')}
					/>
					{account?.emailPending ? (
						<View style={styles.verificationStatus}>
							<VerificationBadge verified={false} size="small" />
							<Text style={styles.pendingEmailText}>({account.emailPending})</Text>
						</View>
					) : account?.email ? (
						<View style={styles.verificationStatus}>
							<VerificationBadge verified={true} size="small" />
						</View>
					) : null}
				</SettingsSection>

				{/* Language & Unit Preferences */}
				<SettingsSection
					title={t('common:general.preferences')}
					showIndividualEdit={true}
				>
					<SettingInput
						fieldKey="language"
						label={t('common:labels.language')}
						value={getLocaleLabel(locale)}
						onSave={() => ({ success: true })}
						onPress={showLocaleOptions}
					/>
					<SettingInput
						fieldKey="areaUnit"
						label={t('common:labels.areaUnit')}
						value={getAreaUnitLabel()}
						onSave={() => ({ success: true })}
						onPress={showAreaUnitOptions}
					/>
					<SettingInput
						fieldKey="lengthUnit"
						label={t('common:labels.lengthUnit')}
						value={getLengthUnitLabel()}
						onSave={() => ({ success: true })}
						onPress={showLengthUnitOptions}
					/>
					<SettingInput
						fieldKey="volumeUnit"
						label={t('common:labels.volumeUnit')}
						value={getVolumeUnitLabel()}
						onSave={() => ({ success: true })}
						onPress={showVolumeUnitOptions}
					/>
					<SettingInput
						fieldKey="massUnit"
						label={t('common:labels.massUnit')}
						value={getMassUnitLabel()}
						onSave={() => ({ success: true })}
						onPress={showMassUnitOptions}
					/>
				</SettingsSection>

				{/* UI Performance Section */}
				<SettingsSection title="UI Performance">
					<Text style={styles.sectionDescription}>
						Choose between smooth animations or better performance.
					</Text>
					<OptionPicker
						options={[
							{ key: 'pretty', label: 'Pretty' },
							{ key: 'balanced', label: 'Balanced' }
						]}
						value={localPreferences.uiPerformanceMode}
						onChange={(value) => setLocalPreference('uiPerformanceMode', value)}
						allowNoneSelected={false}
						containerStyle={{ marginTop: 8 }}
					/>
				</SettingsSection>

				{/* Sign Out Section */}
				<SettingsSection title={t('common:general.signOut')}>
					<Text style={styles.sectionDescription}>
						{t('screens:settings.signOutDescription')}
					</Text>
					<PrimaryButton
						text={isLoading ? t('screens:settings.signingOut') : t('common:general.signOut')}
						onPress={handleSignout}
						disabled={isLoading}
						loading={isLoading}
						fullWidth
						variant='outline'
					/>
				</SettingsSection>

				{/* Delete Account Section */}
				<SettingsSection title={t('screens:settings.deleteAccount')}>
					<Text style={styles.sectionDescription}>
						{t('screens:settings.deleteAccountDescription')}
					</Text>
					<PrimaryButton
						text={isLoading2 ? t('screens:settings.deleting') : t('screens:settings.deleteAccount')}
						variant="outline"
						onPress={async () => {
							setIsLoading2(true);

							const result = await api('/deleteAccount', { method: 'GET' });

							console.log('_____________________');
							console.log(result);
							setIsLoading2(false);

							if (result.ok) {
								await JobService.reset();
								const keys = await Storage.getAllKeys();
								await Storage.multiRemove(keys);
								navigation.navigate('Entry');
							}
						}}
						disabled={isLoading2}
						loading={isLoading2}
						fullWidth
						style={{ borderColor: 'red' }}
					/>
				</SettingsSection>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	scrollView: {
		flex: 1,
	},
	contentContainer: {
		padding: 24,
		paddingBottom: Platform.select({
			ios: 100,
			android: 85,
		}),
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
		marginBottom: 24,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	sectionDescription: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 12,
		lineHeight: 20,
	},
	settingContainer: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
	},
	settingContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	label: {
		fontSize: 16,
		color: colors.PRIMARY,
		fontFamily: 'Geologica-Regular',
		flexShrink: 0,
	},
	errorText: {
		fontSize: 12,
		color: 'red',
		marginTop: 4,
		marginLeft: 4,
		fontFamily: 'Geologica-Regular',
	},
	inputWrapper: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
	},
	valueContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
		flex: 1,
		flexShrink: 1,
	},
	valueText: {
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		marginRight: 8,
		fontFamily: 'Geologica-Regular',
		textAlign: 'right',
		flexShrink: 1,
	},
	secureText: {
		letterSpacing: 1,
	},
	chevron: {
		color: colors.SECONDARY,
		fontSize: 24,
		lineHeight: 24,
		includeFontPadding: false,
		width: 24,
		textAlign: 'center',
		textAlignVertical: 'center',
	},
	bottomSheetContainer: {
		padding: 16,
	},
	unitIcon: {
		fontSize: 20,
		fontFamily: 'Geologica-Bold',
		color: colors.SECONDARY,
		textAlign: 'center',
		minWidth: 36,
	},
	verificationStatus: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		paddingTop: 6,
	},
	pendingEmailText: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.SECONDARY,
		marginLeft: 6,
	},
});

export default SettingsScreen;