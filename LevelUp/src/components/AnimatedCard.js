import React from 'react';
import { Animated } from 'react-native';
import { useSlideUp } from '../hooks/useAnimations';

const AnimatedCard = ({ index = 0, stagger = 60, style, children }) => {
  const anim = useSlideUp(index * stagger);
  return (
    <Animated.View style={[anim, style]}>
      {children}
    </Animated.View>
  );
};

export default AnimatedCard;
