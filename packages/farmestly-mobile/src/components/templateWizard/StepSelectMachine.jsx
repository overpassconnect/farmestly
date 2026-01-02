import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import colors from '../../globals/colors';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useUnits } from '../../providers/UnitsProvider';
import ListItem from '../ui/list/ListItem';
import PrimaryButton from '../ui/core/PrimaryButton';

const StepSelectMachine = ({ state, updateState, onNext, onBack }) => {
	const { t } = useTranslation(['common']);
	const navigation = useNavigation();
	const { farmData } = useGlobalContext();
	const { formatValue } = useUnits();

	const machines = farmData?.machines || [];
	const selectedMachineId = state.machineId;

	const handleSelectMachine = (machineId) => {
		// Toggle selection - if already selected, deselect it
		if (selectedMachineId === machineId) {
			updateState({ machineId: null });
		} else {
			updateState({ machineId });
			// Immediately advance to next step after selection
			onNext();
		}
	};

	const handleAddMachine = () => {
		navigation.navigate('EditEntityScreen', {
			entityType: 'machine',
			isAdding: true
		});
	};

	// Check if machine has spray capability
	const hasSprayCapability = (machine) => {
		return machine.usedFor === 'spray';
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Select Machine</Text>
			<Text style={styles.subtitle}>Choose a machine for this template (optional)</Text>

			{machines.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>This farm has no machines</Text>
					<Text style={styles.emptyTextSub}>Do you want to add one now?</Text>
					<PrimaryButton
						text="Add Machine"
						onPress={handleAddMachine}
						style={{ marginTop: 20, width: 220 }}
					/>
				</View>
			) : (
				<ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
					{machines.map((machine) => {
						const isSelected = selectedMachineId === machine._id;
						const isSprayCapable = hasSprayCapability(machine);

						return (
							<TouchableOpacity
								key={machine._id}
								style={[
									styles.itemContainer,
									isSelected && styles.selectedItem
								]}
								onPress={() => handleSelectMachine(machine._id)}
							>
								<ListItem
									icon={require('../../assets/icons/tractor_brown.png')}
									title={machine.name}
									subTitle1={machine.make}
									subTitle2={machine.licenceNo}
									timeCount={formatValue(machine.powerOnTime, 'time')}
									showChevron={false}
									showRadio={true}
									isSelected={isSelected}
								/>
								{isSprayCapable && state.type === 'spray' && (
									<View style={styles.badge}>
										<Text style={styles.badgeText}>Spray</Text>
									</View>
								)}
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
		overflow: 'hidden',
		position: 'relative'
	},
	selectedItem: {
		backgroundColor: colors.SECONDARY_LIGHT
	},
	badge: {
		position: 'absolute',
		top: 8,
		right: 8,
		backgroundColor: colors.SECONDARY,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 4
	},
	badgeText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 12,
		color: 'white'
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

export default StepSelectMachine;
