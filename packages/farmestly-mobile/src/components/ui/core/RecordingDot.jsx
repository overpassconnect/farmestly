import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Image } from 'react-native';

const RecordingDot = ({ size = 10, color = '#FFFFFF', blink = false, blinking = false, duration = 800, style, icon, iconTintColor }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  const shouldBlink = blink || blinking;

  useEffect(() => {
    if (!shouldBlink) {
      opacity.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration - 400),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shouldBlink, duration, opacity]);

  if (icon) {
    return (
      <Animated.View style={[{ opacity }, style]}>
        <Image
          source={icon}
          style={{ width: size, height: size, tintColor: iconTintColor || color }}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity },
        style,
      ]}
    />
  );
};

export default RecordingDot;
