// index.js
import 'react-native-gesture-handler'; // 👈 חובה להוסיף את השורה הזו ראשונה!
import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);