// client/src/components/KliqTapLogo.js
import React, { memo, useRef } from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const KliqTapLogo = ({ style }) => {
  const navigation = useNavigation();
  const timerRef = useRef(null);

  const handlePressIn = () => {
    timerRef.current = setTimeout(() => {
      navigation.navigate('AdminNotice');
    }, 10000); // 10 שניות בדיוק
  };

  const handlePressOut = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <TouchableOpacity 
      style={style}
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Image 
        source={require('../assets/splash-icon.png')} 
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain" 
      />
    </TouchableOpacity>
  );
};

export default memo(KliqTapLogo);