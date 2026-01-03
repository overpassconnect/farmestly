import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import colors from '../globals/colors';

const OfflineFieldList = ({ fields, selectedFieldId, onFieldSelect }) => {
	const renderField = ({ item }) => {
		const isSelected = item.id === selectedFieldId;
		const cultivation = item.currentCultivation;
		const cropName = cultivation?.crop || 'No crop';
		const variety = cultivation?.variety;
		const lastJobDate = 'Last job: N/A'; // Placeholder for now

		return (
			<TouchableOpacity
				style={[styles.fieldCard, isSelected && styles.fieldCardSelected]}
				onPress={() => onFieldSelect(item)}
				activeOpacity={0.7}
			>
				<View style={[styles.colorIndicator, { backgroundColor: item.color || colors.PRIMARY }]} />

				<View style={styles.fieldContent}>
					<View style={styles.topLine}>
						<Text style={styles.fieldName}>{item.name}</Text>
						<Text style={styles.cropText}>
							<Text style={styles.bullet}>• </Text>
							{cropName}
							{variety && <Text style={styles.variety}> ({variety})</Text>}
						</Text>
					</View>

					<View style={styles.bottomLine}>
						<Text style={styles.lastJobText}>{lastJobDate}</Text>
						<Text style={styles.fieldArea}>{(item.area / 10000).toFixed(2)} ha</Text>
					</View>
				</View>
			</TouchableOpacity>
		);
	};

	return (
		<FlatList
			data={fields}
			keyExtractor={(item) => item._id}
			renderItem={renderField}
			contentContainerStyle={styles.listContainer}
			showsVerticalScrollIndicator={false}
		/>
	);
};

const styles = StyleSheet.create({
	listContainer: {
		padding: 16,
		paddingBottom: 120,
	},
	fieldCard: {
		flexDirection: 'row',
		backgroundColor: '#fff',
		borderRadius: 14,
		borderWidth: 2,
		borderColor: colors.SECONDARY,
		marginBottom: 12,
		// shadowColor: '#000',
		// shadowOffset: { width: 0, height: 2 },
		// shadowOpacity: 0.08,
		// shadowRadius: 4,
		// elevation: 2,
		overflow: 'hidden',
	},
	fieldCardSelected: {
		borderWidth: 3,
		borderColor: colors.PRIMARY,
	},
	colorIndicator: {
		width: 6,
		alignSelf: 'stretch',
		marginLeft: 12,
		marginVertical: 12,
		borderRadius: 4,
	},
	fieldContent: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		justifyContent: 'center',
	},
	fieldName: {
		fontFamily: 'Geologica-Bold',
		fontSize: 17,
		color: colors.PRIMARY,
		flex: 1,
		marginRight: 8,
	},
	topLine: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 6,
	},
	cropText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: '#555',
	},
	bullet: {
		color: colors.PRIMARY,
		fontWeight: 'bold',
	},
	variety: {
		fontFamily: 'Geologica-Medium',
		fontSize: 13,
		color: '#777',
		fontStyle: 'italic',
	},
	bottomLine: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	lastJobText: {
		fontFamily: 'Geologica-Regular',
		fontSize: 13,
		color: '#888',
	},
	fieldArea: {
		fontFamily: 'Geologica-Medium',
		fontSize: 13,
		color: colors.PRIMARY,
	},
});

export default OfflineFieldList;