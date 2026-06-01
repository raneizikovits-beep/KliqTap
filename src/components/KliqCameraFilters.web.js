// client/src/components/KliqCameraFilters.web.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const KliqCameraFilters = () => (
  <View style={styles.wrap}>
    <Text style={styles.text}>📷 Camera filters are available in the mobile app only.</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
});