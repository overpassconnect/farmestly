import React, { useState, useEffect, useMemo } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	Alert,
	TextInput
} from 'react-native';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { FieldArray, useFormikContext } from 'formik';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useBottomSheet } from '../../sheets/BottomSheetContextProvider';
import { useUnits } from '../../../providers/UnitsProvider';
import colors from '../../../globals/colors';
import PrimaryButton from '../../ui/core/PrimaryButton';
import ListItem from '../../ui/list/ListItem';
import SearchableListSheet from '../../ui/list/SearchableListSheet';
import JobService from '../../../utils/JobService';
import { calculateSprayMixing, calculateComplianceDates } from '../../../utils/sprayCalculations';
import { demuxSprayJob } from '../../../utils/jobDemux';
import { useTranslation } from 'react-i18next';
import { resolveTemplate, getTemplateErrorMessage } from '../../../utils/templateResolver';
import { resolveEquipment, buildCultivation } from '../../../utils/jobHelpers';
import { FormikHelper } from '../../ui/form';
import { sprayJobSchema } from '../../../validation';

/**
 * SprayFormContent - Child component that accesses Formik context
 *
 * This component must be a child of FormikHelper because useFormikContext
 * must be called inside a Formik provider. The mixing instructions useEffect
 * that depends on form values needs to live here where it can access Formik context.
 */
const SprayFormContent = ({
	targetFields,
	isMultiField,
	totalArea,
	availableSprayers,
	farmData,
	navigation
}) => {
	const { t } = useTranslation(['screens', 'common', 'validation']);
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();
	const {
		format,
		formatValue,
		formatRateValue,
		formatProductRateValue,
		symbol,
		rateSymbol
	} = useUnits();

	// Access Formik context
	const { values, setFieldValue, errors, touched, handleSubmit, isValid } = useFormikContext();

	// Derived state for mixing calculations (computed values, not direct user input)
	const [mixingInstructions, setMixingInstructions] = useState(null);
	const [complianceInfo, setComplianceInfo] = useState(null);

	// Recalculate mixing instructions when form values change
	useEffect(() => {
		if (values.sprayer && values.carrierRate && values.products.length > 0 && totalArea > 0) {
			try {
				const carrierRateNum = parseFloat(values.carrierRate);
				if (isNaN(carrierRateNum) || carrierRateNum <= 0) {
					setMixingInstructions(null);
					return;
				}

				// Get total area in user's preferred unit
				const fieldAreaInUserUnits = formatValue(totalArea, 'area');

				// Convert tank capacity from L to user's volume unit
				const tankCapacityInUserUnits = formatValue(values.sprayer.tankCapacity, 'volume');

				// Product rates are already in user's display units
				const productsForCalc = values.products
					.map(sp => ({
						productId: sp.productId,
						name: sp.name,
						rate: parseFloat(sp.rate) || 0,
						isVolume: sp.isVolume
					}))
					.filter(p => p.rate > 0);

				if (productsForCalc.length === 0) {
					setMixingInstructions(null);
					return;
				}

				const instructions = calculateSprayMixing({
					fieldArea: fieldAreaInUserUnits,
					tankCapacity: tankCapacityInUserUnits,
					carrierRate: carrierRateNum,
					products: productsForCalc
				});

				setMixingInstructions(instructions);

				const compliance = calculateComplianceDates(
					values.products.map(sp => ({ rei: sp.rei, phi: sp.phi }))
				);
				setComplianceInfo(compliance);
			} catch (error) {
				console.error('Error calculating mixing instructions:', error);
				setMixingInstructions(null);
			}
		} else {
			setMixingInstructions(null);
		}
	}, [values.sprayer, values.carrierRate, values.products, totalArea, formatValue]);

	// Handle sprayer selection via bottom sheet
	const handleSelectSprayer = () => {
		if (availableSprayers.length === 0) {
			Alert.alert(
				t('screens:sprayJob.noSprayersAvailable'),
				t('screens:sprayJob.noSprayersMessage'),
				[
					{ text: t('common:buttons.ok') },
					{
						text: t('screens:sprayJob.goToEquipment'),
						onPress: () => navigation.navigate('Main', { screen: 'Equipment' })
					}
				]
			);
			return;
		}

		const content = (
			<BottomSheetView style={{ padding: 16 }}>
				<Text style={styles.sheetTitle}>{t('screens:sprayJob.selectSprayerSheet')}</Text>
				<BottomSheetScrollView style={{ maxHeight: 400 }}>
					{availableSprayers.map(sprayer => (
						<TouchableOpacity
							key={`${sprayer.type}-${sprayer._id || sprayer.id}`}
							onPress={() => {
								setFieldValue('sprayer', sprayer);
								setFieldValue('sprayerType', sprayer.type);
								// Set default carrier rate if available
								if (sprayer.defaultCarrierRate) {
									const formatted = formatRateValue(sprayer.defaultCarrierRate);
									setFieldValue('carrierRate', formatted?.toString() || '');
								}
								closeBottomSheet();
							}}
							style={{ marginBottom: 8 }}
						>
							<ListItem
								icon={sprayer.type === 'machine'
									? require('../../../assets/icons/tractor_brown.png')
									: require('../../../assets/icons/plow_brown.png')}
								title={sprayer.name}
								subTitle1={`Tank: ${format(sprayer.tankCapacity, 'volume')}`}
								subTitle2={sprayer.make}
								showChevron={true}
							/>
						</TouchableOpacity>
					))}
				</BottomSheetScrollView>
				<PrimaryButton
					text={t('common:buttons.cancel')}
					variant="outline"
					onPress={closeBottomSheet}
					style={{ marginTop: 16 }}
				/>
			</BottomSheetView>
		);

		openBottomSheet(content, {
			snapPoints: ['60%', '90%'],
			enablePanDownToClose: true
		});
	};

	// Handle add product via bottom sheet
	const handleAddProduct = (pushProduct) => {
		if (!farmData.products || farmData.products.length === 0) {
			Alert.alert(
				t('screens:sprayJob.noProductsAvailable'),
				t('screens:sprayJob.noProductsMessage'),
				[
					{ text: t('common:buttons.ok') },
					{
						text: t('screens:sprayJob.goToInputs'),
						onPress: () => navigation.navigate('Main', { screen: 'Inputs' })
					}
				]
			);
			return;
		}

		const handleSelectProduct = (product) => {
			const displayRate = product.defaultRate
				? formatProductRateValue(product.defaultRate, product.isVolume)
				: '';
			pushProduct({
				productId: product._id,
				name: product.name,
				rate: displayRate?.toString() || '',
				isVolume: product.isVolume,
				rei: product.rei,
				phi: product.phi
			});
			closeBottomSheet();
		};

		const renderProductItem = ({ item, onSelect }) => (
			<TouchableOpacity
				onPress={() => onSelect(item)}
				style={{ marginBottom: 8 }}
			>
				<ListItem
					icon={require('../../../assets/icons/tool.png')}
					title={item.name}
					subTitle1={item.type}
					subTitle2={item.activeIngredient}
					showChevron={true}
				/>
			</TouchableOpacity>
		);

		const content = (
			<SearchableListSheet
				localData={farmData.products || []}
				searchKeys={['name', 'type', 'activeIngredient']}
				searchPlaceholder={t('screens:sprayJob.searchProducts')}
				title={t('screens:sprayJob.selectProductSheet')}
				onSelect={handleSelectProduct}
				renderItem={renderProductItem}
				keyExtractor={(item) => item._id}
				cancelLabel={t('common:buttons.cancel')}
				onCancel={closeBottomSheet}
				emptyTitle={t('screens:sprayJob.noProductsFound')}
				emptySubtitle={t('screens:sprayJob.tryDifferentSearch')}
			/>
		);

		openBottomSheet(content, {
			snapPoints: ['95%'],
			enablePanDownToClose: true
		});
	};

	// Check if form is valid for submission (schema validation + business logic)
	const canSubmit = isValid && mixingInstructions;

	return (
		<>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={true}
			>
				<View style={styles.titleContainer}>
					<Text style={styles.titleText}>{t('screens:sprayJob.title')}</Text>
					{isMultiField ? (
						<Text style={styles.subtitle}>
							{targetFields.length}{t('screens:sprayJob.fieldsTotal')}{format(totalArea, 'area')}{t('screens:sprayJob.total')}
						</Text>
					) : (
						<Text style={styles.subtitle}>
							{targetFields[0]?.name} • {format(targetFields[0]?.area, 'area')}
						</Text>
					)}
				</View>

				{/* Selected Fields List (for multi-field mode) */}
				{isMultiField && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t('screens:sprayJob.selectedFields')}</Text>
						{targetFields.map(f => (
							<Text key={f._id || f.id} style={styles.fieldListItem}>
								• {f.name} ({format(f.area, 'area')})
							</Text>
						))}
					</View>
				)}

				{/* Sprayer Selection */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>{t('screens:sprayJob.selectSprayer')}</Text>
					{values.sprayer ? (
						<TouchableOpacity onPress={handleSelectSprayer}>
							<ListItem
								icon={values.sprayerType === 'machine'
									? require('../../../assets/icons/tractor_brown.png')
									: require('../../../assets/icons/plow_brown.png')}
								title={values.sprayer.name}
								subTitle1={`${t('screens:sprayJob.tank')}${format(values.sprayer.tankCapacity, 'volume')}`}
								showChevron={true}
							/>
						</TouchableOpacity>
					) : (
						<>
							<PrimaryButton
								text={t('screens:sprayJob.selectSprayerSheet')}
								onPress={handleSelectSprayer}
								variant="outline"
							/>
							{errors.sprayer && touched.sprayer && (
								<Text style={styles.errorText}>{t(`validation:${errors.sprayer}`)}</Text>
							)}
						</>
					)}
				</View>

				{/* Carrier Rate */}
				{values.sprayer && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t('screens:sprayJob.carrierRate')}</Text>
						<View style={styles.formikStyleInputContainer}>
							<TextInput
								style={[
									styles.formikStyleInput,
									errors.carrierRate && touched.carrierRate && styles.inputError
								]}
								value={values.carrierRate}
								onChangeText={(text) => setFieldValue('carrierRate', text)}
								placeholder="200"
								placeholderTextColor={colors.PRIMARY_LIGHT}
								keyboardType="decimal-pad"
								cursorColor={colors.PRIMARY}
								selectionColor={colors.SECONDARY}
							/>
							<Text style={styles.formikStyleInputUnit}>{rateSymbol(true)}</Text>
						</View>
						{errors.carrierRate && touched.carrierRate && (
							<Text style={styles.errorText}>{t(`validation:${errors.carrierRate}`)}</Text>
						)}
					</View>
				)}

				{/* Products */}
				{values.sprayer && values.carrierRate && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t('screens:sprayJob.products')}</Text>

						<FieldArray name="products">
							{({ push, remove }) => (
								<>
									{values.products.map((product, index) => (
										<View key={index} style={styles.productRow}>
											<Text style={styles.productName}>{product.name}</Text>
											<View style={styles.productInputRow}>
												<View style={styles.formikStyleInputContainer}>
													<TextInput
														style={[
															styles.formikStyleInput,
															errors.products?.[index]?.rate && touched.products?.[index]?.rate && styles.inputError
														]}
														value={product.rate}
														onChangeText={(text) => setFieldValue(`products.${index}.rate`, text)}
														placeholder={t('screens:sprayJob.rate')}
														placeholderTextColor={colors.PRIMARY_LIGHT}
														keyboardType="decimal-pad"
														cursorColor={colors.PRIMARY}
														selectionColor={colors.SECONDARY}
													/>
													<Text style={styles.formikStyleInputUnit}>{rateSymbol(product.isVolume)}</Text>
												</View>
												<TouchableOpacity
													onPress={() => remove(index)}
													style={styles.removeButton}
												>
													<Text style={styles.removeButtonText}>{t('screens:sprayJob.remove')}</Text>
												</TouchableOpacity>
											</View>
											{errors.products?.[index]?.rate && touched.products?.[index]?.rate && (
												<Text style={styles.errorText}>{t(`validation:${errors.products[index].rate}`)}</Text>
											)}
										</View>
									))}

									<PrimaryButton
										text={t('screens:sprayJob.addProduct')}
										onPress={() => handleAddProduct(push)}
										variant="outline"
										style={{ marginTop: 12 }}
									/>

									{/* Array-level error (e.g., "min 1 product") */}
									{errors.products && typeof errors.products === 'string' && touched.products && (
										<Text style={styles.errorText}>{t(`validation:${errors.products}`)}</Text>
									)}
								</>
							)}
						</FieldArray>
					</View>
				)}

				{/* Mixing Instructions */}
				{mixingInstructions && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t('screens:sprayJob.tankMixingInstructions')}</Text>

						{/* Summary */}
						<View style={styles.summaryCard}>
							<Text style={styles.summaryText}>
								{isMultiField ? t('screens:sprayJob.totalArea') : t('screens:sprayJob.fieldArea')}{format(totalArea, 'area')}
							</Text>
							<Text style={styles.summaryText}>
								{t('screens:sprayJob.tanksRequired')}{mixingInstructions.tanksRequired}
							</Text>
						</View>

						{/* Tank instructions */}
						{mixingInstructions.tanks.map(tank => (
							<View key={tank.tankNumber} style={styles.tankCard}>
								<Text style={styles.tankTitle}>
									{tank.isFull
										? t('screens:sprayJob.tankFull', { tankNumber: tank.tankNumber })
										: t('screens:sprayJob.tankPartial', { tankNumber: tank.tankNumber, fillPercent: Math.round(tank.fillRatio * 100) })
									}
								</Text>
								<Text style={styles.instruction}>
									{t('screens:sprayJob.addWater', { amount: tank.waterVolume.toFixed(2), unit: symbol('volume') })}
								</Text>
								{tank.products.map((product, idx) => {
									const productInfo = values.products.find(p => p.productId === product.productId);
									const isVolume = productInfo?.isVolume ?? true;
									return (
										<Text key={idx} style={styles.instruction}>
											{t('screens:sprayJob.addProductInstruction', {
												amount: product.volume.toFixed(2),
												unit: symbol(isVolume ? 'volume' : 'mass'),
												name: product.name
											})}
										</Text>
									);
								})}
							</View>
						))}

						{/* Total quantities */}
						<View style={styles.totalCard}>
							<Text style={styles.totalTitle}>{t('screens:sprayJob.totalQuantitiesNeeded')}</Text>
							{mixingInstructions.totalQuantities.map((product, idx) => {
								const productInfo = values.products.find(p => p.productId === product.productId);
								const isVolume = productInfo?.isVolume ?? true;
								return (
									<Text key={idx} style={styles.totalText}>
										{t('screens:sprayJob.totalQuantityLine', {
											name: product.name,
											amount: product.totalVolume.toFixed(2),
											unit: symbol(isVolume ? 'volume' : 'mass')
										})}
									</Text>
								);
							})}
						</View>

						{/* Compliance info */}
						{complianceInfo && (complianceInfo.maxREI > 0 || complianceInfo.maxPHI > 0) && (
							<View style={styles.complianceCard}>
								<Text style={styles.complianceIcon}>!</Text>
								<Text style={styles.complianceTitle}>{t('screens:sprayJob.complianceInformation')}</Text>
								{complianceInfo.maxREI > 0 && (
									<Text style={styles.complianceText}>
										{t('screens:sprayJob.reentryAllowed', { hours: complianceInfo.maxREI })}
									</Text>
								)}
								{complianceInfo.maxPHI > 0 && (
									<Text style={styles.complianceText}>
										{t('screens:sprayJob.doNotHarvest', { days: complianceInfo.maxPHI })}
									</Text>
								)}
							</View>
						)}
					</View>
				)}
			</ScrollView>

			{/* Start Button */}
			<View style={styles.footer}>
				<PrimaryButton
					text={t('screens:sprayJob.startSpraying')}
					onPress={handleSubmit}
					disabled={!canSubmit}
				/>
			</View>
		</>
	);
};

/**
 * SprayJobScreen - Main component with FormikHelper wrapper
 */
const SprayJobScreen = () => {
	const { t } = useTranslation(['screens', 'common']);
	const navigation = useNavigation();
	const route = useRoute();
	const { farmData } = useGlobalContext();
	const {
		formatRateValue,
		formatProductRateValue,
		parseRate,
		parseProductRate
	} = useUnits();

	// Get field(s) and templateId from navigation params
	const { field, fields, templateId } = route.params || {};
	const targetFields = fields || (field ? [field] : []);
	const isMultiField = targetFields.length > 1;
	const totalArea = targetFields.reduce((sum, f) => sum + (f.area || 0), 0);

	// Safety check: navigate back if no fields provided
	useEffect(() => {
		if (targetFields.length === 0) {
			Alert.alert(
				t('screens:sprayJob.noFieldSelected'),
				t('screens:sprayJob.noFieldMessage'),
				[{ text: t('common:buttons.ok'), onPress: () => navigation.goBack() }]
			);
		}
	}, [targetFields.length, navigation, t]);

	// Get list of sprayer-enabled equipment
	const availableSprayers = useMemo(() => {
		const machines = (farmData.machines || [])
			.filter(m => m.tankCapacity)
			.map(m => ({ ...m, type: 'machine' }));

		const attachments = (farmData.attachments || [])
			.filter(a => a.usedFor === 'spray' && a.tankCapacity)
			.map(a => ({ ...a, type: 'attachment' }));

		return [...machines, ...attachments];
	}, [farmData.machines, farmData.attachments]);

	// Build initial values (including template resolution)
	const initialValues = useMemo(() => {
		const defaults = {
			sprayer: null,
			sprayerType: '',
			carrierRate: '',
			products: [],
		};

		if (!templateId || !farmData) return defaults;

		const template = farmData.jobTemplates?.find(t => t.id === templateId || t._id === templateId);
		if (!template) return defaults;

		const resolved = resolveTemplate(template, farmData);

		// Check template validity and show alert if invalid
		if (!resolved.isValid) {
			const errorMessage = getTemplateErrorMessage(resolved);
			Alert.alert(
				'Template Issues',
				errorMessage,
				[
					{ text: 'Cancel', onPress: () => navigation.goBack() },
					{ text: 'Continue Anyway' }
				]
			);
		}

		// Pre-populate sprayer (machine or attachment)
		let sprayer = null;
		let sprayerType = '';

		if (resolved.attachment && resolved.attachment.usedFor === 'spray') {
			sprayer = { ...resolved.attachment, type: 'attachment' };
			sprayerType = 'attachment';
		} else if (resolved.machine && resolved.machine.tankCapacity) {
			sprayer = { ...resolved.machine, type: 'machine' };
			sprayerType = 'machine';
		}

		// Pre-populate carrier rate
		const carrierRate = resolved.carrierRate
			? formatRateValue(resolved.carrierRate)?.toString() || ''
			: '';

		// Pre-populate products
		const products = resolved.products.map(p => ({
			productId: p._id,
			name: p.name,
			rate: p.templateRate
				? formatProductRateValue(p.templateRate, p.isVolume)?.toString() || ''
				: (p.defaultRate ? formatProductRateValue(p.defaultRate, p.isVolume)?.toString() : ''),
			isVolume: p.isVolume,
			rei: p.rei,
			phi: p.phi
		}));

		return { sprayer, sprayerType, carrierRate, products };
	}, [templateId, farmData, formatRateValue, formatProductRateValue, navigation]);

	// Handle form submission - called by Formik when validation passes
	const handleStartSpraying = (values) => {
		// Calculate compliance info for submission
		const complianceInfo = calculateComplianceDates(
			values.products.map(p => ({ rei: p.rei, phi: p.phi }))
		);

		// Get template and resolve equipment
		const template = templateId
			? farmData.jobTemplates?.find(t => t.id === templateId || t._id === templateId)
			: null;

		// Build embedded equipment snapshots
		const machineSnapshot = template?.machineId
			? (() => {
					const m = farmData.machines?.find(m => m._id === template.machineId);
					return m ? { id: m._id, name: m.name, make: m.make } : null;
				})()
			: null;

		const attachmentSnapshot = template?.attachmentId
			? (() => {
					const a = farmData.attachments?.find(a => a._id === template.attachmentId);
					return a ? { id: a._id, name: a.name, type: a.type } : null;
				})()
			: null;

		const toolSnapshot = template?.toolId
			? (() => {
					const tool = farmData.tools?.find(t => t._id === template.toolId);
					return tool ? { id: tool._id, name: tool.name, brand: tool.brand } : null;
				})()
			: null;

		const templateSnapshot = template
			? { id: template._id || template.id, name: template.name }
			: null;

		// Build shared configuration with all required fields
		const sharedConfig = {
			template: templateSnapshot,
			machine: machineSnapshot,
			attachment: attachmentSnapshot,
			tool: toolSnapshot,
			sprayer: {
				id: values.sprayer._id,
				name: values.sprayer.name,
				type: values.sprayerType,
				tankCapacity: values.sprayer.tankCapacity,
			},
			carrierRate: parseRate(values.carrierRate),
			products: values.products.map(p => ({
				productId: p.productId,
				name: p.name,
				rate: parseProductRate(p.rate, p.isVolume),
				isVolume: p.isVolume,
				rei: p.rei,
				phi: p.phi
			})),
			complianceInfo
		};

		if (isMultiField) {
			// Multi-field batch mode
			const payloads = demuxSprayJob(targetFields, sharedConfig);
			JobService.startBatch(payloads)
				.then(() => {
					navigation.navigate('Main', { screen: 'Home' });
				})
				.catch(error => {
					console.error('Error starting batch spray recording:', error);
					Alert.alert(t('screens:createReport.error'), t('screens:sprayJob.errorStartBatchRecording'));
				});
		} else {
			// Single-field mode
			const singleField = targetFields[0];
			const equipment = template ? resolveEquipment(farmData, template) : {};
			const cultivation = buildCultivation(singleField);

			const jobPayload = {
				type: 'spray',
				fieldId: singleField._id,
				template: templateSnapshot,
				machine: equipment.machine || null,
				attachment: equipment.attachment || null,
				tool: equipment.tool || null,
				cultivation,
				data: {
					spray: {
						sprayerId: sharedConfig.sprayer.id,
						sprayerName: sharedConfig.sprayer.name,
						sprayerType: sharedConfig.sprayer.type,
						tankCapacity: sharedConfig.sprayer.tankCapacity,
						carrierRate: sharedConfig.carrierRate,
						products: sharedConfig.products,
						complianceInfo: sharedConfig.complianceInfo,
					}
				},
				notes: ''
			};

			navigation.navigate('Main', {
				screen: 'Home',
				params: {
					startJobRecording: jobPayload
				}
			});
		}
	};

	return (
		<View style={styles.container}>
			<FormikHelper
				initialValues={initialValues}
				validationSchema={sprayJobSchema}
				onSubmit={handleStartSpraying}
				enableReinitialize={true}
			>
				<SprayFormContent
					targetFields={targetFields}
					isMultiField={isMultiField}
					totalArea={totalArea}
					availableSprayers={availableSprayers}
					farmData={farmData}
					navigation={navigation}
				/>
			</FormikHelper>
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
	scrollContent: {
		padding: 16,
		paddingBottom: 100,
	},
	titleContainer: {
		marginBottom: 24,
	},
	titleText: {
		fontFamily: 'Geologica-Bold',
		fontSize: 24,
		color: colors.PRIMARY,
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.SECONDARY,
		marginTop: 4,
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
	fieldListItem: {
		fontFamily: 'Geologica-Regular',
		fontSize: 15,
		color: colors.PRIMARY,
		marginBottom: 6,
		paddingLeft: 8,
	},
	sheetTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 20,
		color: colors.PRIMARY,
		marginBottom: 16,
	},
	// FormikHelper-style input
	formikStyleInputContainer: {
		flex: 1,
		position: 'relative',
		flexDirection: 'row',
		alignItems: 'center',
	},
	formikStyleInput: {
		flex: 1,
		height: 42,
		fontSize: 17,
		color: colors.PRIMARY,
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.PRIMARY,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
		paddingRight: 60,
		fontFamily: 'Geologica-Regular',
	},
	formikStyleInputUnit: {
		position: 'absolute',
		right: 12,
		fontSize: 16,
		fontFamily: 'Geologica-Medium',
		color: colors.SECONDARY,
	},
	inputError: {
		borderWidth: 1.5,
		borderColor: 'red',
		backgroundColor: '#FFF2F2',
	},
	errorText: {
		color: 'red',
		fontFamily: 'Geologica-Light',
		fontSize: 14,
		marginLeft: 1,
		marginTop: 4,
	},
	productRow: {
		marginBottom: 12,
	},
	productName: {
		fontFamily: 'Geologica-Medium',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	productInputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	removeButton: {
		padding: 8,
	},
	removeButtonText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 14,
		color: colors.ERROR || '#FF3B30',
	},
	summaryCard: {
		marginBottom: 12,
	},
	summaryText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	tankCard: {
		marginBottom: 12,
	},
	tankTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 17,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	instruction: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	totalCard: {
		marginTop: 12,
	},
	totalTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 17,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	totalText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 4,
	},
	complianceCard: {
		marginTop: 16,
		padding: 16,
	},
	complianceIcon: {
		fontFamily: 'Geologica-Bold',
		fontSize: 32,
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 12,
	},
	complianceTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 18,
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 12,
	},
	complianceText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		textAlign: 'center',
		marginBottom: 8,
	},
	footer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 16,
		backgroundColor: 'white',
		borderTopWidth: 1,
		borderTopColor: colors.SECONDARY_LIGHT,
	},
});

export default SprayJobScreen;
