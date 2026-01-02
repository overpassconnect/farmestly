import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../../globals/api';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, BackHandler, Dimensions, TextInput } from 'react-native';
import BottomSheet, { BottomSheetModal, BottomSheetView, BottomSheetModalProvider, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DatePicker from 'react-native-date-picker';

import colors from '../../../globals/colors';

const renderBackdrop = (props) => {
    return (
        <BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} {...props} pressBehavior={'none'} />
    )
}

const DateInput = ({ modalRef }) => {

    const [isFocused, setIsFocused] = useState(false);
    const [value, setValue] = useState();
    const [date, setDate] = useState(new Date())


    const bottomSheetRef = useRef();
    return (
        <>
            <TextInput style={[styles.dateInput, isFocused && styles.inputFocused]}
                onFocus={() => {
                    // otherProps.onFocusDo();
                    bottomSheetRef.current.present();
                    setIsFocused(true);
                }}
                onPress={() => {

                }}
                onBlur={() => {
                    // otherProps.onBlurDo();
                    setIsFocused(false)
                }}
                // editable={false}
                placeholder={"123"}
                curs
            >

            </TextInput>
            <View style={styles.bottomSheetContainer}>
                <BottomSheetModalProvider>
                    <BottomSheetModal
                        backgroundStyle={styles.bottomSheet}
                        enableDynamicSizing={false}
                        snapPoints={['48%', '40%']}
                        ref={bottomSheetRef}
                        index={0}
                        backdropComponent={renderBackdrop}
                    >
                        {/* <DatePicker date={date} onDateChange={setDate} /> */}

                    </BottomSheetModal>



                </BottomSheetModalProvider>
            </View>
        </>
    )
}


const styles = StyleSheet.create({
    bottomSheetContainer: {
        position: 'absolute',
        backgroundColor: 'red',
        bottom: -500,
        width: 500,
        height: 500
    },
    dateInput: {
        height: 42,
        fontSize: 16,
        color: colors.PRIMARY,
        backgroundColor: colors.SECONDARY_LIGHT,
        borderColor: colors.PRIMARY,
        borderWidth: 2,
        borderRadius: 10,
        lineHeight: -100,
        paddingHorizontal: 10,
        marginBottom: 4,
        fontFamily: 'Geologica-Regular',
        paddingTop: 0,
        paddingBottom: 0
    },
    inputFocused: {
        borderColor: colors.SECONDARY,
        borderWidth: 2,
    },
    bottomSheet: {
        borderWidth: 2.5,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderColor: colors.PRIMARY,
    },


})

export default DateInput;