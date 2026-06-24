// App.js (Entry Point)
// ⭐️ KliqMind V6.2: Final Integration for Premium & OTA Updates ⭐️

import { setupPushNotifications } from './src/services/notificationSetup'; 
import * as React from "react";
import { ActivityIndicator, Text, View, Platform, StyleSheet, useWindowDimensions } from "react-native";

// --- KliqMind Web Fix: Polyfill for setNativeProps ---
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined' && typeof window.HTMLElement !== 'undefined') {
    window.HTMLElement.prototype.setNativeProps = function (props) {
      if (props && props.style) {
        Object.assign(this.style, props.style);
      }
    };
  }
}
// -----------------------------------------------------

import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer } from '@react-navigation/native'; 
import { createStackNavigator } from '@react-navigation/stack'; 
import Toast from 'react-native-toast-message'; 
import * as Linking from 'expo-linking';

import { useAppStore } from './src/store/useAppStore'; 
import { styles } from './src/constants/styles';
import * as Data from './src/constants/data';
import { navigationRef } from './src/navigation/RootNavigation'; 

// ⭐️ שילוב מנגנון עדכוני האוויר (OTA) ופרימיום ⭐️
import { useAppUpdate } from './src/utils/useAppUpdate';
import PremiumUpgradeSheet from './src/components/modals/PremiumUpgradeSheet';

// --- Screen & Component Imports ---
import AppRoot from './src/AppRoot'; 
import AdminNoticeScreen from './src/screens/AdminNoticeScreen'; 
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen'; 
import FeedScreen from './src/screens/FeedScreen';
import ArenaScreen from './src/screens/ArenaScreen';

import { KliqCameraFilters } from './src/components/KliqCameraFilters'; 

import * as PulseModalModule from './src/components/modals/PulseCreateModal';
import * as PeekModalsModule from './src/components/modals/PeekModals';

const PulseCreateModal = PulseModalModule.PulseCreateModal || PulseModalModule.default || (() => null);
const ProfilePeekModal = PeekModalsModule.ProfilePeekModal || PeekModalsModule.default || (() => null);

const Stack = createStackNavigator();

const linking = {
  prefixes: ['kliqtap://', 'https://kliqtap.com'], 
  config: {
    screens: {
      ResetPassword: 'reset-password', 
    },
  },
};

function AppContent() {
    const loadAuthAndMotivation = useAppStore(state => state.loadAuthAndMotivation);
    const isAuthLoading = useAppStore(state => state.isAuthLoading);
    
    const pulseCreateOpen = useAppStore(state => state.pulseCreateOpen);
    const setPulseCreateOpen = useAppStore(state => state.setPulseCreateOpen);
    const pulseImageUri = useAppStore(state => state.pulseImageUri);
    const setPulseImageUri = useAppStore(state => state.setPulseImageUri);
    const createPulse = useAppStore(state => state.createPulse);
    const user = useAppStore(state => state.user);
    
    // ⭐️ שימוש במשתנים החדשים מהפרימיום ⭐️
    const premiumModalOpen = useAppStore(state => state.premiumModalOpen);
    const setPremiumModalOpen = useAppStore(state => state.setPremiumModalOpen);
    
    React.useEffect(() => { 
        if (loadAuthAndMotivation) {
            loadAuthAndMotivation(); 
            
      const hasUser = useAppStore.getState().user;
      setupPushNotifications({ isAuthenticated: !!hasUser }).catch(err => {
      if (__DEV__) console.warn("Push setup failed during App initialization:", err);
    });

        }
    }, [loadAuthAndMotivation]);

    if (isAuthLoading) { 
        return (
            <SafeAreaView style={[styles.appFrame, localStyles.loadingContainer]}>
                <ActivityIndicator size="large" color={Data.brand?.blue || '#1a56db'} />
                <Text style={localStyles.loadingText}>Initializing {Data.APP_NAME}...</Text>
            </SafeAreaView>
        ); 
    }
    
    return (
        <>
           <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainApp" component={AppRoot} />
                <Stack.Screen name="AdminNotice" component={AdminNoticeScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                <Stack.Screen name="KliqCameraFilters" component={KliqCameraFilters} />
                <Stack.Screen name="Feed" component={FeedScreen} />
                <Stack.Screen name="Arena" component={ArenaScreen} />
            </Stack.Navigator>

            <PulseCreateModal 
                visible={pulseCreateOpen} 
                onClose={() => {
                    setPulseCreateOpen(false);
                    setPulseImageUri(null);
                }}
                user={user}
                imageUri={pulseImageUri}
                onSubmit={async (text, imageUri, vibe) => {
                    if (createPulse) {
                        try {
                            await createPulse(text, imageUri, vibe);
                            setPulseCreateOpen(false);
                            setPulseImageUri(null);
                        } catch (err) {
                            console.error("Pulse creation failed:", err);
                        }
                    }
                }}
            />
            
            <ProfilePeekModal />

            {/* ⭐️ הוספת מודאל הפרימיום לכל עמוד ⭐️ */}
            <PremiumUpgradeSheet 
                visible={premiumModalOpen} 
                onClose={() => setPremiumModalOpen(false)} 
            />
        </>
    );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;

  useAppUpdate();

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <View style={[
            localStyles.webBackground, 
            !isDesktopWeb && { backgroundImage: 'none', backgroundColor: '#fff', padding: 0 }
        ]}>
          <View style={[
              localStyles.appContainer, 
              isDesktopWeb ? localStyles.desktopContainer : localStyles.mobileContainer
          ]}>
            <AppContent />
          </View>
        </View>
        <Toast position="bottom" bottomOffset={80} visibilityTime={2000} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const localStyles = StyleSheet.create({
  webBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', 
    backgroundColor: '#fff',
    ...Platform.select({
      web: {
        backgroundImage: 'url("https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    })
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 550, 
    backgroundColor: '#fff',
  },
  desktopContainer: {
    maxWidth: 550, 
    maxHeight: 950, 
    borderRadius: 24, 
    ...Platform.select({
        web: { boxShadow: '0px 25px 50px rgba(0,0,0,0.6)' }
    }),
  },
  mobileContainer: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    ...Platform.select({
      web: {
        height: '100dvh', 
      }
    })
  },
  loadingContainer: {
    justifyContent: 'center', 
    alignItems: 'center',
    flex: 1
  },
  loadingText: {
    marginTop: 10, 
    color: '#64748b',
    fontWeight: '500'
  }
});