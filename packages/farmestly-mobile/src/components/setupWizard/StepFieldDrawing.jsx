import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import PolygonDrawingMap from '../setup/PolygonDrawingMap/index.jsx';
import { useNavigation } from '@react-navigation/core';
import { useGlobalContext } from '../context/GlobalContextProvider';

const { width } = Dimensions.get('screen');

/**
 * StepFieldDrawing - Second step of setup wizard
 *
 * Allows user to draw fields on a map and edit their details
 *
 * @param {Object} props
 * @param {Object} props.state - Current wizard state
 * @param {Function} props.updateState - Update wizard state
 * @param {Function} props.onNext - Navigate to next step
 * @param {Function} props.onBack - Navigate to previous step
 */
const StepFieldDrawing = ({ state, updateState, onNext, onBack }) => {
    const navigation = useNavigation();
    const { tmpFirstSetup, setTmpFirstSetup } = useGlobalContext();

    return (
        <View style={styles.container}>
            <PolygonDrawingMap
                useGeolocation={true}
                useCenterPointMode={true}
                onlyEditButton={false}
                valueSetter={(fields) => {
                    updateState({ fields });
                }}
                nameSource={tmpFirstSetup}
                onEditPolygon={(polygonId) => {
                    navigation.navigate('Field', {
                        polygonId,
                        forFirstSetup: true
                    });
                }}
                onFinishShape={(polygonId) => {
                    navigation.navigate('Field', {
                        polygonId,
                        forFirstSetup: true
                    });
                }}
                onDeletePolygon={(polygonId) => {
                    let tmp = JSON.parse(JSON.stringify(tmpFirstSetup));
                    delete tmp[polygonId];
                    setTmpFirstSetup(tmp);
                }}
                showVertices={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        flex: 1
    }
});

export default StepFieldDrawing;
