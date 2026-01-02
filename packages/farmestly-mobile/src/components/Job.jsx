
import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import colors from './../globals/colors'
import { FormikHelper, FormInput } from './ui/form';

import { useGlobalContext } from './context/GlobalContextProvider';
import { useRoute } from '@react-navigation/core';

const { width } = Dimensions.get('screen');

const Job = ({
	valueSetter,
	fieldData,

}) => {
	const route = useRoute();
	const { farmData, tmpFirstSetup, setTmpFirstSetup } = useGlobalContext();
	const { forFirstSetup, polygonId, selectedFieldData } = route.params;

	const handleValuesChange = useCallback((values) => {
		if (forFirstSetup) {
			let tmp = JSON.parse(JSON.stringify(tmpFirstSetup));
			tmp[polygonId] = {
				fieldName: tmpFirstSetup[polygonId]?.fieldName,
				currentCrop: values.currentCrop,
				currentVariety: values.currentVariety,
			}
			setTmpFirstSetup(tmp);
		}
	}, [forFirstSetup, polygonId, tmpFirstSetup, setTmpFirstSetup]);

	return (
		<View style={styles.wizardPageContainer}>
			<ScrollView
				bounces={false}
				bouncesZoom={false}
			>
				<FormikHelper
					initialValues={{
						currentCrop: tmpFirstSetup[polygonId]?.currentCrop || '',
						currentVariety: tmpFirstSetup[polygonId]?.currentVariety || ''
					}}
					onSubmit={() => {}} // No submission, just state updates
				>
					{({ values }) => {
						// Update parent state when values change
						useEffect(() => {
							handleValuesChange(values);
						}, [values.currentCrop, values.currentVariety]);

						return (
							<>
								<View style={styles.noteContainer}>
									<Text style={styles.noteTitle}>Note:</Text>
									<Text style={styles.noteText}>The following set of crop and variety mark a new cultivation period for this field.</Text>
									<Text style={styles.noteText}>You won't be able to change these later unless by recording a final harvest which ends the cultivation period.</Text>
								</View>
								<FormInput
									name="currentCrop"
									label="Current crop"
									placeholder='e.g. Apples'
								/>
								<FormInput
									name="currentVariety"
									label="Current Crop Variety"
									placeholder='e.g. Braeburn'
									isLast={true}
								/>
							</>
						);
					}}
				</FormikHelper>
			</ScrollView>
		</View>
	);



}


const styles = StyleSheet.create({
	sheetBackdrop: {
		backgroundColor: '#999',
		position: 'absolute'
	},
	sheetInnerContainer: {
		// flex: 1,
		// alignItems: 'center',
		paddingLeft: 24,
		paddingTop: 12

	},
	bottomSheet: {
		borderWidth: 2.5,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		borderColor: colors.PRIMARY,
	},
	container: {
		flex: 1,
		// padding: 34,
		// flexWrap: 'wrap'
		// justifyContent: 'center',
		// alignItems: 'center',
		// justifyContent: 'flex-start',
	},
	wizard: {

	},
	wizardPageContainer: {
		// backgroundColor: 'grey',
		width: width,
		// padding: 16
		// marginRight: 10
		padding: 34
	},
	buttonText: {

		fontFamily: 'Geologica-Bold',
		color: '#fff',
		fontSize: 20,
		lineHeight: 22,
		textAlign: 'center',
	},
	wizardButtonContainer: {
		// flex: 1,
		flexDirection: 'row',
		marginTop: 12,
		justifyContent: 'center',
		// marginLeft: 15,
		marginBottom: 22,
		// backgroundColor:'none'

	},


	titleContainer: {
		// padding: 16,
		// marginTop: 5,
		// justifyContent:''
		// height: 150,
		// flex: 1
		marginBottom: 20,
		marginTop: 15,
	},
	titleIcon: {
		resizeMode: 'contain',
		width: 70,
		height: 60
	},
	titleText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 28,
		color: colors.PRIMARY
	},
	titleTextHighlighted: {
		color: colors.SECONDARY
	},
	titleDesc: {
		color: colors.PRIMARY_LIGHT,
		fontSize: 19,
		fontFamily: 'Geologica-Regular'
	},
	titleInfoContainer: {
		marginTop: -18,
		// marginLeft: -5,
		marginBottom: 20,
		// backgroundColor: colors.SECONDARY_LIGHT,
		// backgroundColor: 'white',
		// borderColor: colors.SECONDARY,
		// borderWidth: 1,
		// padding: 10

	},
	monospaced: {
		fontFamily: 'RobotoMono-Regular'
	},
	buttonsContainer: {
		flex: 1,
		gap: 15
	},
	titleInfoText: {
		fontFamily: 'Geologica-Medium',
		fontSize: 17,
		color: colors.PRIMARY,
		lineHeight: 25,

	},
	switchModePressable: {
		// marginTop: 50
	},
	switchModePressableText: {
		fontFamily: 'Geologica-Regular',
		textDecorationLine: 'underline',
		fontSize: 15,
		color: colors.PRIMARY,
	},

	noteContainer: {

		borderLeftColor: colors.SECONDARY,
		borderLeftWidth: 3,
		// width: '80%',
		paddingLeft: 10,
		marginBottom: 16
	},
	noteTitle: {
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
		fontSize: 24

	},
	noteText: {
		color: colors.PRIMARY,
		fontSize: 17,
		marginBottom: 5
	}
});


export default Job;
