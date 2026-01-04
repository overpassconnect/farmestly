import React from 'react';
import { View, StyleSheet, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/core';

import { useGlobalContext } from '../context/GlobalContextProvider';
import SwipeableTabs from '../ui/core/SwipableTabs';
import ListItem from '../ui/list/ListItem';
import PrimaryButton from '../ui/core/PrimaryButton';
import colors from '../../globals/colors';

const TabInputs = () => {
	const { t } = useTranslation(['screens', 'common']);
	const { farmData } = useGlobalContext();
	const navigation = useNavigation();

	// Guard against missing farmData (e.g., offline with no cache)
	const products = farmData?.products || [];

	// Helper function to get product type display name using i18n
	const getProductTypeDisplay = (type) => {
		const map = {
			'herbicide': t('common:productTypes.herbicide'),
			'fungicide': t('common:productTypes.fungicide'),
			'insecticide': t('common:productTypes.insecticide'),
			'adjuvant': t('common:productTypes.adjuvant'),
			'fertilizer': t('common:productTypes.fertilizer'),
			'other': t('common:productTypes.other')
		};
		return map[type] || type;
	};

	// Products tab content
	const ProductsTab = (
		<View style={styles.tabContainer}>
			{products.length === 0 ? (
				<View style={styles.emptyTextContainer}>
					<Image
						source={require('../../assets/icons/inputs_brown.png')}
						style={styles.emptyIcon}
						resizeMode="contain"
					/>
					<Text style={styles.emptyText}>{t('screens:inputs.noProducts')}</Text>
					<Text style={styles.emptyTextSub}>{t('screens:inputs.addProduct')}</Text>
				</View>
			) : (
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={true}
				>
					{products.map((product) => {
						return (
							<TouchableOpacity
								key={'product-' + product.id}
								onPress={() => {
									navigation.navigate('EditEntityScreen', {
										entityType: 'product',
										entity: product,
										isAdding: false
									});
								}}
							>
								<ListItem
									icon={require('../../assets/icons/inputs_brown.png')}
									timeCount={null}
									subTitle1={getProductTypeDisplay(product.type)}
									title={product.name}
									subTitle2={product.activeIngredient || product.notes}
									showChevron={true}
								/>
							</TouchableOpacity>
						);
					})}
				</ScrollView>
			)}
			<View style={styles.buttonContainer}>
				<PrimaryButton
					text={t('common:buttons.add')}
					style={{ width: 300 }}
					onPress={() => {
						navigation.navigate('EditEntityScreen', {
							entityType: 'product',
							isAdding: true
						});
					}}
				/>
			</View>
		</View>
	);

	return (
		<SwipeableTabs
			initialTab={0}
			tabs={[
				{
					key: 'products',
					title: t('screens:inputs.products'),
					content: ProductsTab
				}
			]}
		/>
	);
};

const styles = StyleSheet.create({
	tabContainer: {
		flex: 1,
		position: 'relative',
	},
	scrollView: {
		flex: 1,
		paddingHorizontal: 16,
	},
	scrollContent: {
		paddingBottom: 180,
	},
	buttonContainer: {
		position: 'absolute',
		alignSelf: 'center',
		bottom: 120
	},
	emptyTextContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
	},
	emptyIcon: {
		width: 80,
		height: 80,
		opacity: 0.3,
		marginBottom: 16,
	},
	emptyText: {
		fontSize: 18,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginBottom: 8,
	},
	emptyTextSub: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
	}
});

export default TabInputs;
