import React, { useState } from 'react';
import { api } from '../../globals/api';
import { View, StyleSheet, TextInput, TouchableOpacity, Text } from 'react-native';
import { ColorPicker } from 'react-native-color-picker';

const PolygonDetailsScreen = ({ route, navigation }) => {
    const { polygonId, initialName, initialColor, onSave } = route.params;
    const [name, setName] = useState(initialName);
    const [color, setColor] = useState(initialColor);

    const handleSave = () => {
        onSave(polygonId, name, color);
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Polygon Name:</Text>
            <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter polygon name"
            />

            <Text style={styles.label}>Polygon Color:</Text>
            <View style={styles.colorPickerContainer}>
                <ColorPicker
                    onColorSelected={color => setColor(color)}
                    style={styles.colorPicker}
                    defaultColor={color}
                />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Details</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 20,
    },
    colorPickerContainer: {
        height: 300,
        marginBottom: 20,
    },
    colorPicker: {
        flex: 1,
    },
    saveButton: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default PolygonDetailsScreen;