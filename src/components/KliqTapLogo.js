// client/src/components/KliqTapLogo.js
import React, { memo } from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native'; // 👈 ייבוא כלי הניווט

const KliqTapLogo = ({ style }) => {
  const navigation = useNavigation(); // 👈 הפעלת הניווט

  return (
    <TouchableOpacity 
      style={style}
      activeOpacity={1} // מונע מהלוגו לההבהב בלחיצה רגילה כדי שאף אחד לא יחשוד
      delayLongPress={800} // זמן לחיצה (0.8 שניות)
      onLongPress={() => navigation.navigate('AdminNotice')} // 👈 הדלת הסודית שלנו!
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