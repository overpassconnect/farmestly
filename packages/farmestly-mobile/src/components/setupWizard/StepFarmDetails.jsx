import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, Image } from 'react-native';
import colors from '../../globals/colors';
import { FormikHelper, FormInput } from '../../utils/FormikHelper';

const { width } = Dimensions.get('screen');

/**
 * StepFarmDetails - First step of setup wizard
 *
 * Collects the farm name from the user
 *
 * @param {Object} props
 * @param {Object} props.state - Current wizard state
 * @param {Function} props.updateState - Update wizard state
 * @param {Function} props.onNext - Navigate to next step
 * @param {Function} props.onBack - Navigate to previous step
 */
const StepFarmDetails = ({ state, updateState, onNext, onBack }) => {
    return (
        <View style={styles.wizardPageContainer}>
            <View style={styles.titleContainer}>
                <Image style={styles.titleIcon} source={require('../../assets/icon_login.png')} />
                <Text style={styles.titleText}>Setup your farm</Text>
                <Text style={styles.titleDesc}>Enter a few important details about your farm.</Text>
            </View>
            <FormikHelper
                initialValues={{ farmName: state.farmName || '' }}
                onSubmit={(values) => {
                    // FormikHelper requires onSubmit, but we don't auto-advance here
                    // The parent button controls navigation
                    updateState({ farmName: values.farmName });
                }}
            >
                {({ values }) => {
                    // Update wizard state whenever value changes
                    useEffect(() => {
                        updateState({ farmName: values.farmName });
                    }, [values.farmName]);

                    return (
                        <FormInput
                            name="farmName"
                            label="Farm Name"
                            placeholder='Enter your farm name here'
                            isLast={true}
                        />
                    );
                }}
            </FormikHelper>
        </View>
    );
};

const styles = StyleSheet.create({
    wizardPageContainer: {
        width: width,
        padding: 34
    },
    titleContainer: {
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
    titleDesc: {
        color: colors.PRIMARY_LIGHT,
        fontSize: 19,
        fontFamily: 'Geologica-Regular'
    }
});

export default StepFarmDetails;
