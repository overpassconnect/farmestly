import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../globals/api';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, BackHandler, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

// Import your country flag icons
// import flagIcons from './flags';


const { width, height } = Dimensions.get('window');

import colors from '../../../globals/colors';
import flagIcons from '../../../globals/flagIcons';


const CountryPicker = ({
    countries,
    country,
    onCountryPress,
    label,
    showCountryName
}) => {
    return (
        <View>
            {/* <Text style={styles.formLabel}>{label + ':'}</Text> */}
            <TouchableOpacity style={styles.countryButton} onPress={onCountryPress}>
                <Image source={flagIcons[country.code]} style={styles.flagIcon} />
                {showCountryName ?
                    <Text style={styles.countryName}>{country.name}</Text>
                    :
                    <Text style={styles.countryName}>▼</Text>
                }
            </TouchableOpacity>

            <Text style={[styles.formWarning, { opacity: 0 }]}></Text>
        </View>
    );
};

const styles = StyleSheet.create({
    formLabel: {
        fontFamily: 'Geologica-Regular',
        color: colors.PRIMARY,
        fontSize: 19,
        marginBottom: 3,
        marginTop: 0,
        // marginLeft: -5
    },
    countryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: colors.SECONDARY_LIGHT,
        borderRadius: 10,
        height: 42
        // objectFit:'contain'
        // width: '50%',
        // borderBottomColor: colors.PRIMARY,
        // borderBottomWidth: 2
    },
    flagIcon: {
        width: 32,
        height: 21,
        marginRight: 8,
    },
    countryName: {
        fontFamily: 'Geologica-regular',
        fontSize: 16,
        // fontWeight: 'bold',
        color: colors.PRIMARY
    },
    formWarning: {
        color: 'red',
        fontFamily: 'Geologica-Light',
        marginBottom: 0,
        marginLeft: 1,
        marginTop: -4,
    },
});

export default CountryPicker;