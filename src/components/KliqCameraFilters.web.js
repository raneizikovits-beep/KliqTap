// client/src/components/KliqCameraFilters.web.js
// ⭐️ FIX: added the missing `export default`. The native KliqCameraFilters.js
// exports both named AND default; this file only had the named export — any
// call site using a default import would resolve to undefined on web builds.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const KliqCameraFilters = () => (
  <View style={styles.wrap}>
    <Text style={styles.text}>📷 Camera filters are available in the mobile app only.</Text>
  </View>
);

export default KliqCameraFilters;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
});