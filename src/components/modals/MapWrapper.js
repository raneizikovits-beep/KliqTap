// MapWrapper.js
import { Platform } from 'react-native';

let MapView, Marker, UrlTile;

if (Platform.OS !== 'web') {
  // בטלפון: טוען את הספריות האמיתיות
  MapView = require('react-native-map-clustering').default;
  const maps = require('react-native-maps');
  Marker = maps.Marker;
  UrlTile = maps.UrlTile;
} else {
  // ב-Web: מחזיר רכיבים ריקים כדי לא לקרוס
  MapView = () => null;
  Marker = () => null;
  UrlTile = () => null;
}

export { Marker, UrlTile };
export default MapView;