
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, Image } from 'react-native';
import colors from '../../globals/colors'
import { FormikHelper, FormInput } from '../../utils/FormikHelper';

const { width } = Dimensions.get('screen');

const PageDetails = ({
    valueSetter

}) => {
    return (
        <View style={styles.wizardPageContainer}>
            <View style={styles.titleContainer}>
                <Image style={styles.titleIcon} source={require('../../assets/icon_login.png')} />
                <Text style={styles.titleText}>Setup your farm</Text>
                <Text style={styles.titleDesc}>Enter a few important details about your farm.</Text>
            </View>
            <FormikHelper
                initialValues={{ farmName: '' }}
                onSubmit={(values) => {
                    valueSetter(values.farmName);
                }}
            >
                {({ values }) => {
                    // Update parent whenever value changes
                    useEffect(() => {
                        valueSetter(values.farmName);
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
    titleDesc: {
        color: colors.PRIMARY_LIGHT,
        fontSize: 19,
        fontFamily: 'Geologica-Regular'
    },
    switchModePressable: {
        // marginTop: 50
    },
    switchModePressableText: {
        fontFamily: 'Geologica-Regular',
        textDecorationLine: 'underline',
        fontSize: 15,
        color: colors.PRIMARY,
    }
});


export default PageDetails
