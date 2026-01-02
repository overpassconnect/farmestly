import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { FlatList, Dimensions, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('screen');

/**
 * AnimatedStep - Wrapper component for individual wizard steps with smooth animations
 *
 * Applies scale, opacity, and translateX interpolations based on scroll position
 * to create a polished carousel effect where adjacent steps are visually present
 * but de-emphasized while the current step animates smoothly into focus.
 */
const AnimatedStep = ({ children, index, scrollX }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.85, 1, 0.85],
      'clamp'
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      'clamp'
    );

    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [50, 0, -50],
      'clamp'
    );

    return {
      transform: [{ scale }, { translateX }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.stepContainer, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

/**
 * Wizard - Reusable multi-step flow controller
 *
 * This component provides a generalized wizard implementation with:
 * - Horizontal FlatList navigation with smooth animations
 * - Declarative step configuration with skip conditions
 * - Centralized flow control logic
 * - State management with stable callback references
 *
 * @param {Object} props
 * @param {Array} props.steps - Array of step configurations, each containing:
 *   - key: unique identifier for the step
 *   - component: React component to render (as function: (props) => JSX)
 *   - shouldSkip: optional function (state) => boolean to determine if step should be skipped
 * @param {Object} props.initialState - Initial wizard state object
 * @param {number} props.currentStepIndex - Current step index (controlled)
 * @param {Function} props.onStepChange - Callback when step changes: (newIndex) => void
 * @param {Object} props.state - Current wizard state (controlled)
 * @param {Function} props.onStateChange - Callback when state changes: (newState) => void
 * @param {Function} props.onNavigateBack - Optional callback when back is pressed on first step
 */
const Wizard = ({
  steps,
  initialState = {},
  currentStepIndex,
  onStepChange,
  state,
  onStateChange,
  onNavigateBack,
}) => {
  const flatListRef = useRef(null);
  const scrollX = useSharedValue(0);

  /**
   * Map current step index to visible steps index
   */
  const visibleStepIndex = useMemo(() => {
    let visibleIndex = 0;
    for (let i = 0; i < currentStepIndex; i++) {
      const step = steps[i];
      const shouldSkip = step.shouldSkip?.(state) ?? false;
      if (!shouldSkip) {
        visibleIndex++;
      }
    }
    return visibleIndex;
  }, [currentStepIndex, steps, state]);

  // Sync FlatList scroll position when visibleStepIndex changes
  useEffect(() => {
    flatListRef.current?.scrollToIndex({
      animated: true,
      index: visibleStepIndex,
    });
  }, [visibleStepIndex]);

  // Scroll handler for animations
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  /**
   * Find the next valid step index by iterating forward from current position
   * and checking shouldSkip conditions
   */
  const findNextValidStep = useCallback((fromIndex) => {
    let targetIndex = fromIndex + 1;

    while (targetIndex < steps.length) {
      const step = steps[targetIndex];
      const shouldSkip = step.shouldSkip?.(state) ?? false;

      if (!shouldSkip) {
        return targetIndex;
      }

      targetIndex++;
    }

    // No valid next step found, return current
    return fromIndex;
  }, [steps, state]);

  /**
   * Find the previous valid step index by iterating backward from current position
   * and checking shouldSkip conditions
   */
  const findPrevValidStep = useCallback((fromIndex) => {
    let targetIndex = fromIndex - 1;

    while (targetIndex >= 0) {
      const step = steps[targetIndex];
      const shouldSkip = step.shouldSkip?.(state) ?? false;

      if (!shouldSkip) {
        return targetIndex;
      }

      targetIndex--;
    }

    // No valid previous step, return -1 to signal navigation back
    return -1;
  }, [steps, state]);

  /**
   * Navigate to a specific step index with animation
   */
  const navigateToStep = useCallback((targetIndex) => {
    if (targetIndex >= 0 && targetIndex < steps.length) {
      flatListRef.current?.scrollToIndex({
        animated: true,
        index: targetIndex,
      });
      onStepChange(targetIndex);
    }
  }, [steps.length, onStepChange]);

  /**
   * Handle next navigation - finds next valid step and scrolls to it
   */
  const handleNext = useCallback(() => {
    const nextIndex = findNextValidStep(currentStepIndex);

    if (nextIndex !== currentStepIndex) {
      navigateToStep(nextIndex);
    }
  }, [currentStepIndex, findNextValidStep, navigateToStep]);

  /**
   * Handle back navigation - finds previous valid step or triggers onNavigateBack
   */
  const handleBack = useCallback(() => {
    const prevIndex = findPrevValidStep(currentStepIndex);

    if (prevIndex >= 0) {
      navigateToStep(prevIndex);
    } else if (onNavigateBack) {
      // First step - delegate to parent
      onNavigateBack();
    }
  }, [currentStepIndex, findPrevValidStep, navigateToStep, onNavigateBack]);

  /**
   * Update wizard state - performs shallow merge
   */
  const updateState = useCallback((updates) => {
    onStateChange({ ...state, ...updates });
  }, [state, onStateChange]);

  /**
   * Render individual step with standardized props contract
   */
  const renderStep = useCallback(({ item, index }) => {
    const StepComponent = item.component;

    return (
      <AnimatedStep index={index} scrollX={scrollX}>
        <StepComponent
          state={state}
          updateState={updateState}
          onNext={handleNext}
          onBack={handleBack}
        />
      </AnimatedStep>
    );
  }, [state, updateState, handleNext, handleBack, scrollX]);

  /**
   * Filter steps to only include non-skipped ones
   */
  const visibleSteps = useMemo(() => {
    return steps.filter(step => {
      const shouldSkip = step.shouldSkip?.(state) ?? false;
      return !shouldSkip;
    });
  }, [steps, state]);

  /**
   * FlatList optimization - calculate item layout for performance
   */
  const getItemLayout = useCallback((data, index) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  return (
    <Animated.FlatList
      ref={flatListRef}
      data={visibleSteps}
      renderItem={renderStep}
      keyExtractor={(item) => item.key}
      horizontal
      pagingEnabled
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      getItemLayout={getItemLayout}
      initialScrollIndex={visibleStepIndex}
    />
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
});

export default Wizard;
