import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '../../globals/colors';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useUnits } from '../../providers/UnitsProvider';

const StepSelectProducts = ({ state, updateState, onNext, onBack }) => {
	const { t } = useTranslation(['common']);
	const { farmData } = useGlobalContext();
	const { formatProductRateValue, rateSymbol } = useUnits();

	const products = farmData?.products || [];
	const selectedProducts = state.sprayConfig?.products || [];


	const isProductSelected = (productId) => {
		return selectedProducts.some(p => p._id === productId);
	};

	const getProductRate = (productId) => {
		const selected = selectedProducts.find(p => p._id === productId);
		return selected?.rateOverride || '';
	};

	const handleToggleProduct = (product) => {
		const isSelected = isProductSelected(product._id);

		let newProducts;
		if (isSelected) {
			// Deselect
			newProducts = selectedProducts.filter(p => p._id !== product._id);
		} else {
			// Select with default rate
			const defaultRate = product.defaultRate
				? formatProductRateValue(product.defaultRate, product.isVolume)?.toString() || ''
				: '';

			newProducts = [
				...selectedProducts,
				{
					_id: product._id,
					rateOverride: defaultRate
				}
			];
		}

		updateState({
			sprayConfig: {
				...state.sprayConfig,
				products: newProducts
			}
		});
	};

	const handleUpdateRate = (productId, rateText) => {
		const newProducts = selectedProducts.map(p => {
			if (p._id === productId) {
				return { ...p, rateOverride: rateText };
			}
			return p;
		});

		updateState({
			sprayConfig: {
				...state.sprayConfig,
				products: newProducts
			}
		});
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Select Products</Text>
			<Text style={styles.subtitle}>Choose products for this spray template (optional)</Text>

			{products.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>This farm has no products</Text>
					<Text style={styles.emptyTextSub}>Add products to use them in spray templates</Text>
				</View>
			) : (
				<ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
					{products.map((product) => {
						const isSelected = isProductSelected(product._id);
						const productRate = getProductRate(product._id);

						return (
							<View key={product._id} style={styles.productContainer}>
								<TouchableOpacity
									style={[
										styles.productItem,
										isSelected && styles.selectedProduct
									]}
									onPress={() => handleToggleProduct(product)}
								>
									<View style={styles.checkbox}>
										{isSelected && <View style={styles.checkboxInner} />}
									</View>
									<View style={styles.productInfo}>
										<Text style={styles.productName}>{product.name}</Text>
										<Text style={styles.productDetails}>
											{product.type} • {product.activeIngredient || 'No active ingredient'}
										</Text>
									</View>
								</TouchableOpacity>

								{isSelected && (
									<View style={styles.rateInputContainer}>
										<Text style={styles.rateLabel}>
											Rate ({rateSymbol(product.isVolume)}):
										</Text>
										<TextInput
											style={styles.rateInput}
											value={productRate}
											onChangeText={(text) => handleUpdateRate(product._id, text)}
											keyboardType="numeric"
											placeholder={
												product.defaultRate
													? formatProductRateValue(product.defaultRate, product.isVolume)?.toString()
													: 'Enter rate'
											}
											placeholderTextColor={colors.PRIMARY_LIGHT}
										/>
									</View>
								)}
							</View>
						);
					})}
				</ScrollView>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white'
	},
	title: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		paddingHorizontal: 34,
		paddingTop: 20,
		marginBottom: 8
	},
	subtitle: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		paddingHorizontal: 34,
		marginBottom: 20
	},
	scrollView: {
		flex: 1,
		paddingHorizontal: 16
	},
	productContainer: {
		marginBottom: 12
	},
	productItem: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 16,
		backgroundColor: 'white',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.BORDER_LIGHT
	},
	selectedProduct: {
		backgroundColor: colors.SECONDARY_LIGHT,
		borderColor: colors.SECONDARY
	},
	checkbox: {
		width: 24,
		height: 24,
		borderRadius: 4,
		borderWidth: 2,
		borderColor: colors.PRIMARY,
		marginRight: 12,
		justifyContent: 'center',
		alignItems: 'center'
	},
	checkboxInner: {
		width: 14,
		height: 14,
		borderRadius: 2,
		backgroundColor: colors.SECONDARY
	},
	productInfo: {
		flex: 1
	},
	productName: {
		fontFamily: 'Geologica-Medium',
		fontSize: 16,
		color: colors.PRIMARY,
		marginBottom: 4
	},
	productDetails: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT
	},
	rateInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 8,
		paddingHorizontal: 16,
		paddingBottom: 8
	},
	rateLabel: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY,
		marginRight: 12
	},
	rateInput: {
		flex: 1,
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY,
		borderWidth: 1,
		borderColor: colors.BORDER_LIGHT,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: 'white'
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 34
	},
	emptyText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 20,
		color: colors.PRIMARY,
		textAlign: 'center'
	},
	emptyTextSub: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginTop: 8
	},
	footer: {
		padding: 16,
		borderTopWidth: 1,
		borderTopColor: colors.BORDER_LIGHT
	},
	selectedCount: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginBottom: 12
	}
});

export default StepSelectProducts;
