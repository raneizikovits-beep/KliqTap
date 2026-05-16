// client/src/components/PeopleHeartLogo.js
// ⭐️ FIX: Inline Styles Extracted to StyleSheet + Memoized ⭐️
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

const PeopleHeartLogo = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftHeart} />
      <View style={styles.rightHeart} />
    </View>
  );
};

export default memo(PeopleHeartLogo);

const styles = StyleSheet.create({
  container: {
      flexDirection: "row", 
      alignItems: "center", 
      justifyContent: "center"
  },
  leftHeart: {
      width: 22, 
      height: 22, 
      borderRadius: 6, 
      backgroundColor: "#FFB27E", 
      transform: [{ rotate: "45deg" }]
  },
  rightHeart: {
      width: 22, 
      height: 22, 
      borderRadius: 6, 
      backgroundColor: "#FF7F7A", 
      transform: [{ rotate: "45deg" }], 
      marginLeft: -12
  }
});