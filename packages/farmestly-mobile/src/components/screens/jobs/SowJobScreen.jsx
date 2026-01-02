import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import { FormikHelper, FormInput, FormDropdown } from '../../ui/form';
import { resolveEquipment, tempCultivationId } from '../../../utils/jobHelpers';
import EppoSuggestion from '../../EppoSuggestion';
import EppoSearchSheet from '../../sheets/EppoSearchSheet';
import seedManufacturers from '../../../globals/seedManufacturers';
import { sowJobSchema } from '../../../validation/schemas/sowJob';

const SowJobScreen = () => {
	const { t } = useTranslation(['screens', 'common']);
	const navigation = useNavigation();
	const route = useRoute();
	const { field, templateId } = route.params || {};
	const { farmData, isOffline } = useGlobalContext();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();

	const handleEppoSelect = (eppo, setFieldValue) => {
		setFieldValue('eppoCode', eppo?.eppocode || null);
	};

	const openEppoSearch = (setFieldValue) => {
		openBottomSheet(
			<EppoSearchSheet
				onSelect={(eppo) => handleEppoSelect(eppo, setFieldValue)}
				onCancel={closeBottomSheet}
			/>,
			{ snapPoints: ['95%'] }
		);
	};


	const handleSubmit = (values) => {
		const template = templateId ? farmData.jobTemplates?.find(t => t._id === templateId) : null;
		const equipment = template ? resolveEquipment(farmData, template) : { machine: null, attachment: null, tool: null };

		// Generate temp cultivation ID for new sow job
		const cultivationId = tempCultivationId();

		navigation.navigate('Main', {
			screen: 'Home',
			params: {
				startJobRecording: {
					type: 'sow',
					fieldId: field._id,
					template: template ? { id: template._id, name: template.name } : null,
					machine: equipment.machine,
					attachment: equipment.attachment,
					tool: equipment.tool,
					cultivation: {
						id: cultivationId,
						crop: values.crop.trim(),
						variety: values.variety.trim() || null,
						eppoCode: values.eppoCode || null,
						lotNumber: values.lotNumber.trim() || null,
						seedManufacturer: values.seedManufacturer || null
					},
					data: {
						sow: {
							crop: values.crop.trim(),
							variety: values.variety.trim() || null,
							cultivationId: cultivationId,
							eppoCode: values.eppoCode || null,
							lotNumber: values.lotNumber.trim() || null,
							seedManufacturer: values.seedManufacturer || null
						}
					},
					notes: ''
				}
			}
		});
	};

	return (
		<KeyboardAwareScrollView
			style={styles.safeArea}
			contentContainerStyle={styles.container}
			bottomOffset={200}
			bounces={false}
			keyboardShouldPersistTaps="handled"
			showsVerticalScrollIndicator={false}
			enabled={true}
		>
			<Text style={styles.title}>{t('screens:sowJob.title')}</Text>
			<Text style={styles.fieldName}>{field.name}</Text>

			<FormikHelper
				initialValues={{ crop: '', variety: '', eppoCode: null, lotNumber: '', seedManufacturer: null }}
				validationSchema={sowJobSchema}
				onSubmit={handleSubmit}
			>
				{({ handleSubmit, isValid, values, setFieldValue }) => (
					<>
						<FormInput
							name="crop"
							label={t('common:labels.crop')}
							placeholder={t('common:placeholders.enterCropName')}
						/>

						<FormInput
							name="variety"
							label={t('common:labels.variety') + ' (' + t('common:general.optional') + ')'}
							placeholder={t('common:placeholders.enterVariety')}
						/>

						{/* EPPO Code Section */}
						<View style={styles.eppoSection}>
							{/* 35/65 Row: Input + Suggestion */}
							<View style={styles.eppoRow}>
								{/* Left 35%: EPPO Code Input */}
								<View style={styles.eppoInputContainer}>
									<FormInput
										name="eppoCode"
										label={t('common:labels.eppoCode')}
										placeholder={t('common:placeholders.enterEppoCode')}
										autoCapitalize="characters"
										onChangeText={(text) => {
											const upperText = text.toUpperCase();
											setFieldValue('eppoCode', upperText || null);
										}}
									/>
								</View>

								{/* Right 65%: Suggestion (only when online) */}
								<View style={styles.eppoSuggestionContainer}>
									{!isOffline && values.crop.trim().length >= 2 ? (
										<EppoSuggestion
											cropValue={values.crop}
											eppoValue={values.eppoCode}
											onSuggestionChange={(suggestion) => {
												// Auto-fill the EPPO code input when suggestion changes
												if (suggestion?.eppocode) {
													setFieldValue('eppoCode', suggestion.eppocode);
												}
											}}
										/>
									) : !isOffline ? (
										<View style={styles.eppoPlaceholder}>
											<Text style={styles.eppoPlaceholderText}>
												{t('common:labels.suggestedEppoCode')}
											</Text>
											<View style={styles.eppoPlaceholderBox}>
												<Text style={styles.eppoPlaceholderHint}>
													{t('common:messages.enterCropFirst')}
												</Text>
											</View>
										</View>
									) : null}
								</View>
							</View>

							{/* Divider with "or" and Search button (only when online) */}
							{!isOffline && (
								<>
									<View style={styles.dividerContainer}>
										<View style={styles.dividerLine} />
										<Text style={styles.dividerText}>{t('common:general.or')}</Text>
										<View style={styles.dividerLine} />
									</View>

									<PrimaryButton
										text={t('common:buttons.searchEppoCodes')}
										onPress={() => openEppoSearch(setFieldValue)}
										variant="outline"
										style={styles.searchButton}
									/>
								</>
							)}
						</View>

						{/* Lot Number */}
						<FormInput
							name="lotNumber"
							label={t('common:labels.lotNumber') + ' (' + t('common:general.optional') + ')'}
							placeholder={t('common:placeholders.enterLotNumber')}
						/>

						{/* Seed Manufacturer - FormDropdown with SearchableListSheet */}
						<FormDropdown
							name="seedManufacturer"
							label={t('common:labels.seedManufacturer') + ' (' + t('common:general.optional') + ')'}
							placeholder={t('common:placeholders.selectSeedManufacturer')}
							items={seedManufacturers}
							keyExtractor={item => item.shortName}
							labelExtractor={item => item.name}
							subLabelExtractor={item => item.countryCode}
							searchKeys={['name', 'shortName']}
							searchPlaceholder={t('common:placeholders.searchSeedManufacturer')}
							title={t('common:titles.selectSeedManufacturer')}
							emptyTitle={t('common:messages.noSeedManufacturersFound')}
							emptySubtitle={t('common:messages.tryDifferentSearch')}
							bottomSheetProps={{ snapPoints: ['95%'] }}
						/>

						<View style={styles.buttonsContainer}>
							<PrimaryButton
								text={t('common:buttons.start')}
								onPress={handleSubmit}
								disabled={!isValid}
							/>
						</View>
					</>
				)}
			</FormikHelper>
		</KeyboardAwareScrollView>
	);
};

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#fff',
	},
	keyboardAvoid: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	container: {
		padding: 20,
		// paddingBottom: 300,
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		color: colors.PRIMARY,
		marginBottom: 8,
		fontFamily: 'Geologica-Bold',
	},
	fieldName: {
		fontSize: 18,
		color: colors.PRIMARY_LIGHT,
		marginBottom: 24,
		fontFamily: 'Geologica-Regular',
	},
	noteContainer: {
		backgroundColor: '#F0F9FF',
		padding: 16,
		borderRadius: 12,
		marginVertical: 20,
		borderLeftWidth: 4,
		borderLeftColor: colors.SECONDARY,
	},
	noteTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.PRIMARY,
		marginBottom: 4,
		fontFamily: 'Geologica-Medium',
	},
	noteText: {
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		lineHeight: 20,
		fontFamily: 'Geologica-Regular',
	},
	buttonsContainer: {
		marginTop: 32,
		alignItems: 'center',
	},
	searchButton: {
		marginTop: 4,
	},
	// EPPO Section styles
	eppoSection: {
		marginTop: 16,
		marginBottom: 8,
	},
	eppoRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
	},
	eppoInputContainer: {
		flex: 35,
	},
	eppoSuggestionContainer: {
		flex: 65,
	},
	eppoPlaceholder: {
		flex: 1,
		marginLeft: 8,
	},
	eppoPlaceholderText: {
		fontSize: 14,
		fontFamily: 'Geologica-Medium',
		color: colors.PRIMARY_LIGHT,
		marginBottom: 8,
	},
	eppoPlaceholderBox: {
		flex: 1,
		borderWidth: 1,
		borderColor: colors.PRIMARY_LIGHT,
		borderRadius: 8,
		borderStyle: 'dashed',
		justifyContent: 'center',
		alignItems: 'center',
		minHeight: 40,
	},
	eppoPlaceholderHint: {
		fontSize: 12,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		paddingHorizontal: 8,
	},
	dividerContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginVertical: 16,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: colors.PRIMARY_LIGHT,
	},
	dividerText: {
		marginHorizontal: 12,
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
	},
});

export default SowJobScreen;
