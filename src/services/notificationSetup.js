// client/src/services/notificationSetup.js
// ⭐️ KliqMind V8.1: Push → IncomingCallModal via Zustand store ⭐️
//
// Changes vs V8.0:
//   [FIX]   Require cycle broken — authSlice no longer imports directly from
//           this file. Instead, notificationBridge event bus is used:
//           authSlice emits 'auth:login' → bridge → registerPushTokenAfterLogin()
//   [FIX]   Expo listener subscriptions now stored in _notifSubscriptions[].
//           teardownPushNotifications() removes them cleanly — prevents
//           duplicate listeners on Fast Refresh in dev and on logout/re-login.
//
// V8.0 preserved:
//   - Push → IncomingCallModal via Zustand store
//   - Foreground push triggers modal immediately
//   - Auth-aware token registration
//   - Cached device token
//   - Both Android channels (default + calls)

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { fetchAPI } from '../store/api';
import { navigate } from '../navigation/RootNavigation';
import { useAppStore } from '../store/useAppStore';
import { notificationBridge } from './notificationBridge';

// ─── הגדרות התנהגות כשהאפליקציה פתוחה (Foreground) ───
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let cachedDeviceToken = null;
let listenersInstalled = false;
let _notifSubscriptions = []; // ⭐️ V8.1: stored so teardownPushNotifications() can .remove() them

// ─────────────────────────────────────────────────────────────────────────
// ⭐️ V8 HELPER — מציג את מודאל שיחה נכנסת על ידי הצבת state ב-store.
// CallModals.js כבר מאזין ל-incomingCall ומציג את ה-UI עם כפתורים+צלצול.
// ─────────────────────────────────────────────────────────────────────────
function triggerIncomingCallModal(data) {
  const roomId = data.roomId || data.entityId;
  const callerId = data.callerId || data.actorId;
  const callerName = data.callerName || 'Someone';

  if (!roomId || !callerId) {
    if (__DEV__) console.warn('[notificationSetup] Missing call data:', data);
    return;
  }

  if (__DEV__) console.log(`📞 Triggering IncomingCallModal: ${callerName} → room=${roomId}`);

  useAppStore.setState({
    incomingCall: {
      callerId,
      callerName,
      callerAvatar: data.callerAvatar || null,
      roomId,
    },
  });
}

export async function setupPushNotifications({ isAuthenticated = false } = {}) {
  if (!Device.isDevice) {
    console.log('Push Notifications only work on physical devices.');
    return null;
  }

  const granted = await requestPermissions();
  if (!granted) {
    if (__DEV__) console.warn('Push permission denied — user will not receive OS notifications.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('kliqtap_default', {
      name: 'KliqTap Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a56db',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync('kliqtap_calls', {
      name: 'KliqTap Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [
        0,    1000, 500, 1000, 500, 1000, 500,
        1000, 500,  1000, 500, 1000, 500, 1000,
        500,  1000, 500,  1000, 500, 1000,
      ],
      enableVibrate: true,
      lightColor: '#34D399',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      enableLights: true,
    });
  }

  try {
    const pushTokenData = await Notifications.getDevicePushTokenAsync();
    cachedDeviceToken = pushTokenData?.data ?? null;
  } catch (e) {
    if (__DEV__) console.warn('Error getting device push token:', e);
    cachedDeviceToken = null;
  }

  if (cachedDeviceToken && isAuthenticated) {
    await registerTokenWithServer(cachedDeviceToken);
  } else if (cachedDeviceToken && !isAuthenticated) {
    if (__DEV__) console.log('🔐 FCM token cached — will register after login.');
  }

  if (!listenersInstalled) {
    // ⭐️ V8.1 FIX: כל addXxxListener מחזיר Subscription — חייבים לשמור
    // ולקרוא .remove() בעת teardown. בלי זה, Fast Refresh ב-dev גורם
    // לרישום חוזר ללא הסרה של הישנים → duplicate notifications.
    const tokenSub = Notifications.addPushTokenListener(async (pushTokenData) => {
      if (pushTokenData?.data) {
        cachedDeviceToken = pushTokenData.data;
        await registerTokenWithServer(cachedDeviceToken).catch(() => {});
      }
    });

    // ⭐️ V8: Foreground push — אם FCM מגיע בזמן שהאפליקציה פתוחה,
    // למשל שיחה נכנסת — אנחנו רוצים שהמודאל יקפוץ מיד.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data ?? {};
      if (data.type === 'INCOMING_CALL') {
        triggerIncomingCallModal(data);
      }
    });

    // ניתוב כשהמשתמש לוחץ על התראה
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};

      if (data.type === 'INCOMING_CALL' && (data.roomId || data.entityId)) {
        triggerIncomingCallModal(data);
      } else if (data.type === 'MESSAGE' && (data.chatId || data.entityId)) {
        navigate('ChatDetail', { chatId: data.chatId || data.entityId });
      } else if ((data.type === 'LIKE' || data.type === 'COMMENT') && data.postId) {
        navigate('PostDetail', { postId: data.postId });
      }
    });

    _notifSubscriptions = [tokenSub, receivedSub, responseSub];
    listenersInstalled = true;
  }

  return cachedDeviceToken;
}

export async function registerPushTokenAfterLogin() {
  if (!Device.isDevice) return null;

  if (cachedDeviceToken) {
    await registerTokenWithServer(cachedDeviceToken);
    return cachedDeviceToken;
  }

  return await setupPushNotifications({ isAuthenticated: true });
}

// ⭐️ V8.1 NEW: מסיר את כל ה-subscriptions בצורה נקייה.
// קרא לפונקציה זו בעת logout או ב-app teardown כדי למנוע memory leaks
// ו-duplicate listeners במקרה של hot reload בפיתוח.
export function teardownPushNotifications() {
  _notifSubscriptions.forEach(sub => sub?.remove());
  _notifSubscriptions = [];
  listenersInstalled = false;
}

async function requestPermissions() {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;

  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    status = request.status;
  }
  return status === 'granted';
}

async function registerTokenWithServer(fcmToken) {
  try {
    await fetchAPI('/users/me/fcm-token', {
      method: 'POST',
      body: JSON.stringify({ fcmToken, platform: Platform.OS }),
    });
    if (__DEV__) console.log('✅ FCM Token registered with server successfully.');
  } catch (e) {
    if (__DEV__) console.warn('Failed to register FCM token with server:', e);
  }
}

// ─── Bridge listener — שובר את ה-require cycle עם authSlice ───────────────
// authSlice קורא notificationBridge.emit('auth:login') במקום לייבא ישירות.
notificationBridge.on('auth:login', async () => {
  await registerPushTokenAfterLogin();
});