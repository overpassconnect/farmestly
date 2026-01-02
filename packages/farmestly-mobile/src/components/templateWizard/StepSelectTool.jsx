import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import colors from '../../globals/colors';
import { useGlobalContext } from '../context/GlobalContextProvider';
import ListItem from '../ui/list/ListItem';
import PrimaryButton from '../ui/core/PrimaryButton';

const StepSelectTool = ({ state, updateState, onNext, onBack }) => {
	const { t } = useTranslation(['common']);
	const navigation = useNavigation();
	const { farmData } = useGlobalContext();

	const tools = farmData?.tools || [];
	const selectedToolId = state.toolId;

	const handleSelectTool = (toolId) => {
		// Toggle selection - if already selected, deselect it
		if (selectedToolId === toolId) {
			updateState({ toolId: null });
		} else {
			updateState({ toolId });
			// Immediately advance to next step after selection
			onNext();
		}
	};

	const handleAddTool = () => {
		navigation.navigate('EditEntityScreen', {
			entityType: 'tool',
			isAdding: true
		});
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Select Tool</Text>
			<Text style={styles.subtitle}>Choose a tool for this template (optional)</Text>

			{tools.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>This farm has no tools</Text>
					<Text style={styles.emptyTextSub}>Do you want to add one now?</Text>
					<PrimaryButton
						text="Add Tool"
						onPress={handleAddTool}
						style={{ marginTop: 20, width: 220 }}
					/>
				</View>
			) : (
				<ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
					{tools.map((tool) => {
						const isSelected = selectedToolId === tool._id;

						return (
							<TouchableOpacity
								key={tool._id}
								style={[
									styles.itemContainer,
									isSelected && styles.selectedItem
								]}
								onPress={() => handleSelectTool(tool._id)}
							>
								<ListItem
									icon={require('../../assets/icons/tool.png')}
									title={tool.name}
									subTitle1={tool.brand}
									subTitle2={`${tool.type} • ${tool.model}`}
									showChevron={false}
									showRadio={true}
									isSelected={isSelected}
								/>
							</TouchableOpacity>
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
	itemContainer: {
		marginBottom: 8,
		borderRadius: 8,
		overflow: 'hidden'
	},
	selectedItem: {
		backgroundColor: colors.SECONDARY_LIGHT
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
	}
});

export default StepSelectTool;
