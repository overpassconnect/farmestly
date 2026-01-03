import React, { useEffect, useState } from 'react';
import { api } from '../../../globals/api';
import { View, Text, StyleSheet, Button, BackHandler, Dimensions, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import PrimaryButton from '../../ui/core/PrimaryButton';
import colors from '../../../globals/colors';
import { FlatList, Pressable } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

import config from '../../../globals/config';

const BASE_URL = config.BASE_URL;

const EntryScreen = ({ navigation }) => {
    const { t } = useTranslation(['screens', 'common']);
    const [activeIndex, setActiveIndex] = useState(0);

    // Use translation keys for the entry data
    const ENTRY_DATA = [
        {
            path: require("../../../assets/images/entryscreen/entry_1.png"),
            title: t('screens:entry.slide1.title'),
            subtitle: t('screens:entry.slide1.subtitle')
        },
        {
            path: require("../../../assets/images/entryscreen/entry_2.png"),
            title: t('screens:entry.slide2.title'),
            subtitle: t('screens:entry.slide2.subtitle')
        },
        {
            path: require("../../../assets/images/entryscreen/entry_3.png"),
            title: t('screens:entry.slide3.title'),
            subtitle: t('screens:entry.slide3.subtitle')
        },
        {
            path: require("../../../assets/images/entryscreen/entry_4.png"),
            title: t('screens:entry.slide4.title'),
            subtitle: t('screens:entry.slide4.subtitle')
        },
        {
            path: require("../../../assets/images/entryscreen/entry_5.png"),
            title: t('screens:entry.slide5.title'),
            subtitle: t('screens:entry.slide5.subtitle')
        }
    ];

    const renderSlide = ({ item, index }) => (
        <View style={styles.slide}>
            <Image source={item.path} style={styles.image} />
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubTitle}>{item.subtitle}</Text>
        </View>
    );

    const renderPaginationDot = (index) => (
        <View
            key={index}
            style={[
                styles.paginationDot,
                { backgroundColor: index === activeIndex ? '#fff' : null }
            ]}
        />
    );

    return (
        <View style={styles.container}>
            <View style={styles.carouselContainer}>
                <FlatList
                    data={ENTRY_DATA}
                    renderItem={renderSlide}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                        const index = Math.round(event.nativeEvent.contentOffset.x / width);
                        setActiveIndex(index);
                    }}
                    style={styles.carousel}
                />

                <View style={styles.paginationContainer}>
                    {ENTRY_DATA.map((_, index) => (
                        renderPaginationDot(index)
                    ))}
                </View>
            </View>

            <PrimaryButton 
                text={t('common:buttons.signUp')} 
                onPress={() => navigation.navigate('SignUp', { for: 'signup' })} 
            />
            
            <View style={styles.loginContainer}>
                <Text style={styles.loginText}>{t('screens:entry.loginText')}</Text>
                <Pressable 
                    style={styles.loginButton} 
                    onPress={() => navigation.navigate('SignUp', { for: 'login' })}
                >
                    <Text style={styles.login}>{t('common:buttons.logIn')}</Text>
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: colors.PRIMARY
    },
    carouselContainer: {
        height: '70%',
        alignItems: 'center',
        marginBottom: 50,
        marginTop: 40,
    },
    carousel: {
        marginBottom: 30
    },
    slide: {
        width: width,
        paddingHorizontal: 10,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    image: {
        width: '80%',
        height: '60%',
        resizeMode: 'contain',
        marginBottom: 10,
    },
    slideTitle: {
        fontFamily: 'Geologica-Bold',
        color: '#fff',
        fontSize: 30,
        textAlign: 'center'
    },
    slideSubTitle: {
        fontFamily: 'Geologica-Regular',
        color: '#fff',
        fontSize: 20,
        marginTop: -5,
        textAlign: 'center',
        width: '80%',
    },
    paginationContainer: {
        flexDirection: 'row',
        height: 20
    },
    paginationDot: {
        width: 10,
        height: 10,
        marginLeft: 5,
        marginRight: 5,
        borderRadius: 50,
        backgroundColor: colors.PRIMARY_LIGHT
    },
    loginContainer: {
        flexDirection: 'row',
        marginTop: 30
    },
    loginText: {
        fontFamily: 'Geologica-Regular',
        color: '#fff',
        marginRight: 12,
        fontSize: 17
    },
    loginButton: {
    },
    login: {
        top: 2,
        fontSize: 17,
        color: '#fff',
        textDecorationLine: 'underline'
    }
});

export default EntryScreen;