import React, { useState } from 'react';
import { api } from '../../globals/api';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useNavigation } from '@react-navigation/native';
import colors from '../../globals/colors';
import config from '../../globals/config';
import ListItem from '../ui/list/ListItem';
import { FormikHelper, FormDropdown } from '../ui/form';
import { useTranslation } from 'react-i18next';

const BASE_URL = config.BASE_URL;

const TabCultivations = () => {
	const { t } = useTranslation();
	const { farmData } = useGlobalContext();
	const navigation = useNavigation();
	const [cultivations, setCultivations] = useState([]);
	const [loading, setLoading] = useState(false);
	const [selectedFieldId, setSelectedFieldId] = useState(null);

	const fields = farmData?.fields || [];

	// Transform fields data for dropdown
	const fieldItems = fields.map(field => ({
		_id: field._id,
		label: field.name,
		image: require('../../assets/icons/field.png'),
	}));

	// Load cultivations for selected field
	const loadCultivations = (fieldId) => {
		if (!fieldId) {
			setCultivations([]);
			return;
		}

		setLoading(true);
		api(`${BASE_URL}/cultivation/field/${fieldId}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				
			},
		})
			.then(response => {
				if (!response.ok) {
					throw new Error(`Failed to fetch cultivations: ${response.status}`);
				}
				return response.json();
			})
			.then(data => {
				if (data.HEADERS && data.HEADERS.STATUS_CODE === 'OK') {
					setCultivations(data.PAYLOAD || []);
				} else {
					setCultivations([]);
				}
			})
			.catch(error => {
				console.error('Error loading cultivations:', error);
				setCultivations([]);
			})
			.finally(() => {
				setLoading(false);
			});
	};

	// Handle field selection
	const handleFieldSelect = (field) => {
		setSelectedFieldId(field._id);
		loadCultivations(field._id);
	};

	// Handle cultivation item press
	const handleCultivationPress = (cultivation) => {
		navigation.navigate('CultivationScreen', { cultivation });
	};

	// Format cultivation dates
	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleDateString();
	};

	// Format cultivation status
	const formatStatus = (cultivation) => {
		if (cultivation.status === 'active') {
			return t('screens:tabCultivations.active');
		} else if (cultivation.status === 'completed') {
			return t('screens:tabCultivations.completed');
		}
		return cultivation.status;
	};

	// Get cultivation subtitle
	const getCultivationSubtitle = (cultivation) => {
		const startDate = formatDate(cultivation.startTime);
		const endDate = cultivation.endTime ? formatDate(cultivation.endTime) : null;
		const status = formatStatus(cultivation);

		if (endDate) {
			return `${startDate} - ${endDate} • ${status}`;
		} else {
			return `${t('screens:tabCultivations.started')} ${startDate} • ${status}`;
		}
	};

	const initialValues = {
		selectedField: null
	};

	return (
		<View style={styles.container}>
			<FormikHelper initialValues={initialValues}>
				{({ setFieldValue }) => (
					<>
						<FormDropdown
							name="selectedField"
							label={t('screens:tabCultivations.selectField')}
							items={fieldItems}
							placeholder={t('screens:tabCultivations.chooseField')}
							onSelect={(field) => {
								setFieldValue('selectedField', field._id);
								handleFieldSelect(field);
							}}
							renderItem={(item, isItemSelected) => (
								<ListItem
									icon={item.image}
									title={item.label}
									simple={true}
									showChevron={false}
									showRadio={true}
									isSelected={isItemSelected}
								/>
							)}
							keyExtractor={item => item._id}
							labelExtractor={item => item.label}
							searchPlaceholder={t('screens:tabCultivations.searchFields')}
							searchKeys={['label']}
							bottomSheetProps={{
								snapPoints: ['60%', '90%'],
								enablePanDownToClose: true
							}}
						/>
					</>
				)}
			</FormikHelper>

			<ScrollView style={styles.cultivationsList} showsVerticalScrollIndicator={false}>
				{loading ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color={colors.SECONDARY} />
						<Text style={styles.loadingText}>{t('screens:tabCultivations.loadingCultivations')}</Text>
					</View>
				) : selectedFieldId === null ? (
					<View style={styles.emptyContainer}>
						<Image
							source={require('../../assets/icons/cultivation.png')}
							style={styles.emptyIcon}
							resizeMode="contain"
						/>
						<Text style={styles.emptyText}>{t('screens:tabCultivations.selectFieldPrompt')}</Text>
					</View>
				) : cultivations.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Image
							source={require('../../assets/icons/cultivation.png')}
							style={styles.emptyIcon}
							resizeMode="contain"
						/>
						<Text style={styles.emptyText}>{t('screens:tabCultivations.noCultivations')}</Text>
						<Text style={styles.emptyTextSub}>{t('screens:tabCultivations.cultivationsHint')}</Text>
					</View>
				) : (
					<View style={styles.cultivationsContainer}>
						<Text style={styles.sectionTitle}>
							{cultivations.length} {cultivations.length !== 1 ? t('screens:tabCultivations.cultivations') : t('screens:tabCultivations.cultivation')}
						</Text>
						{cultivations.map((cultivation, index) => (
							<TouchableOpacity 
								key={cultivation._id || index} 
								style={styles.cultivationItem}
								onPress={() => handleCultivationPress(cultivation)}
								activeOpacity={0.7}
							>
								<ListItem
									icon={require('../../assets/icons/cultivation.png')}
									title={`${cultivation.crop}${cultivation.variety ? ` (${cultivation.variety})` : ''}`}
									subTitle1={getCultivationSubtitle(cultivation)}
									simple={false}
									showChevron={true}
								/>
							</TouchableOpacity>
						))}
					</View>
				)}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
		padding: 20,
	},
	cultivationsList: {
		flex: 1,
		marginTop: 20,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingTop: 50,
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		fontFamily: 'Geologica-Regular',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
		paddingTop: 50,
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
		paddingHorizontal: 20,
	},
	cultivationsContainer: {
		paddingBottom: 20,
	},
	sectionTitle: {
		fontSize: 20,
		color: colors.PRIMARY,
		fontFamily: 'Geologica-Medium',
		marginBottom: 15,
	},
	cultivationItem: {
		marginBottom: 12,
	},
});

export default TabCultivations;