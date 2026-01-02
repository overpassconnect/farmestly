import React, { useState, useEffect, memo, useCallback } from 'react';
import {
	View,
	Dimensions,
	Pressable,
} from 'react-native';
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withSpring,
	interpolateColor,
	useDerivedValue,
	runOnJS,
	withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import colors from '../../../globals/colors';

const { width } = Dimensions.get('window');

const INDICATOR_WIDTH = 32;
const INDICATOR_HEIGHT = 4;

const SPRING_CONFIG = {
	damping: 28,
	mass: 0.8,
	stiffness: 200,
	overshootClamping: true,
	restDisplacementThreshold: 0.01,
	restSpeedThreshold: 2,
};

const AnimatedText = Animated.createAnimatedComponent(Animated.Text);

const Tab = memo(({ title, animatedValue }) => {
	const textStyle = useAnimatedStyle(() => ({
		fontSize: 17,
		textAlign: 'center',
		fontFamily: 'Geologica-Medium',
		color: interpolateColor(
			animatedValue.value,
			[0, 1],
			[colors.PRIMARY_LIGHT, colors.PRIMARY]
		),
	}));

	return (
		<AnimatedText style={textStyle}>
			{title}
		</AnimatedText>
	);
});

const SwipeableTabs = ({
	tabs,
	initialTab = 0,
	onTabChange,
	onSwipeStart,
	onSwipeEnd,
	style,
	disableSwiping = false,
}) => {
	const [activeTab, setActiveTab] = useState(initialTab);
	const translateX = useSharedValue(-initialTab * width);
	const indicatorPosition = useSharedValue(0);
	const isDragging = useSharedValue(false);

	const tabAnimatedValues = tabs.map((_, index) =>
		useDerivedValue(() =>
			activeTab === index ? withTiming(1, { duration: 150 }) : withTiming(0, { duration: 150 })
		)
	);

	useEffect(() => {
		const tabCenter = width / (tabs.length * 2);
		indicatorPosition.value = initialTab * (width / tabs.length) + tabCenter - (INDICATOR_WIDTH / 2);
	}, []);

	const animateToTab = useCallback((index) => {
		if (isDragging.value) return;

		const prevTab = activeTab;
		setActiveTab(index);

		translateX.value = withSpring(
			-index * width,
			SPRING_CONFIG
		);

		const tabWidth = width / tabs.length;
		const tabCenter = tabWidth / 2;
		indicatorPosition.value = withSpring(
			index * tabWidth + tabCenter - (INDICATOR_WIDTH / 2),
			SPRING_CONFIG
		);

		if (prevTab !== index && onTabChange) {
			onTabChange(index, tabs[index]);
		}
	}, [activeTab, tabs, onTabChange]);

	const gesture = Gesture.Pan()
		.minDistance(10)
		.onStart(() => {
			'worklet';
			isDragging.value = true;
			if (onSwipeStart) {
				runOnJS(onSwipeStart)();
			}
		})
		.onUpdate((event) => {
			'worklet';
			// Only handle horizontal gestures
			if (Math.abs(event.velocityY) > Math.abs(event.velocityX) || disableSwiping) {
				return;
			}

			const newValue = -activeTab * width + event.translationX;
			const maxOffset = -width * (tabs.length - 1);

			if (newValue <= 0 && newValue >= maxOffset) {
				translateX.value = newValue;

				const tabWidth = width / tabs.length;
				const indicatorDx = (event.translationX / width) * tabWidth;
				const tabCenter = tabWidth / 2;
				indicatorPosition.value = activeTab * tabWidth + tabCenter - (INDICATOR_WIDTH / 2) - indicatorDx;
			}
		})
		.onEnd((event) => {
			'worklet';
			isDragging.value = false;

			if (disableSwiping) {
				runOnJS(animateToTab)(activeTab);
				if (onSwipeEnd) {
					runOnJS(onSwipeEnd)();
				}
				return;
			}

			const swipeThreshold = width * 0.2;
			let newTab = activeTab;

			if (Math.abs(event.translationX) > swipeThreshold || Math.abs(event.velocityX) > 500) {
				if (event.translationX > 0 && activeTab > 0) {
					newTab = activeTab - 1;
				} else if (event.translationX < 0 && activeTab < tabs.length - 1) {
					newTab = activeTab + 1;
				}
			}

			runOnJS(animateToTab)(newTab);
			if (onSwipeEnd) {
				runOnJS(onSwipeEnd)();
			}
		})
		.enabled(!disableSwiping);

	const contentStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}), []);

	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: indicatorPosition.value }],
	}), []);

	return (
		<View style={[styles.container, style]}>
			<View style={styles.tabBar}>
				{tabs.map((tab, index) => (
					<Pressable
						key={tab.key}
						style={styles.tab}
						onPress={() => !isDragging.value && animateToTab(index)}
					>
						<Tab
							title={tab.title}
							animatedValue={tabAnimatedValues[index]}
						/>
					</Pressable>
				))}

				<Animated.View
					style={[
						styles.indicator,
						indicatorStyle,
					]}
				/>
			</View>

			{/* <GestureDetector gesture={gesture}> */}
			<Animated.View
				style={[
					styles.contentWrapper,
					{
						width: width * tabs.length,
					},
					contentStyle,
				]}
			>
				{tabs.map((tab) => (
					<View key={tab.key} style={styles.tabContent}>
						{tab.content}
					</View>
				))}
			</Animated.View>
			{/* </GestureDetector> */}
		</View>
	);
};

const styles = {
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	tabBar: {
		flexDirection: 'row',
		position: 'relative',
		backgroundColor: 'white',
		paddingVertical: 16,
	},
	tab: {
		flex: 1,
		alignItems: 'center',
	},
	indicator: {
		position: 'absolute',
		bottom: 0,
		width: INDICATOR_WIDTH,
		height: INDICATOR_HEIGHT,
		backgroundColor: colors.SECONDARY,
		borderRadius: INDICATOR_HEIGHT / 2,
	},
	contentWrapper: {
		flex: 1,
		flexDirection: 'row',
	},
	tabContent: {
		width: width,
	},
};

export default memo(SwipeableTabs);