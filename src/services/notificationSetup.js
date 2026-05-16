// client/src/services/notificationSetup.js
// ⭐️ KliqMind V6.0: Pure Expo Go Push Setup (No Native Crashes) ⭐️
//
// הוסר השימוש ב- @react-native-firebase/messaging כדי למנוע קריסות באפליקציית Expo Go.
// אנו משתמשים אך ורק ב-expo-notifications כדי להשיג את טוקן המכשיר ולשלוח לשרת.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { fetchAPI } from '../store/api'; // פונקציית התקשורת מול השרת שלך
import { navigate } from '../navigation/RootNavigation'; // ⭐️ הוסף ייבוא למעלה

// ─── הגדרות התנהגות כשהאפליקציה פתוחה (Foreground) ───
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── הפונקציה המרכזית (נקראת מתוך App.js) ───
export async function setupPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push Notifications only work on physical devices.');
    return null;
  }

  // 1. בקשת הרשאות מהמשתמש ברמת מערכת ההפעלה
  const granted = await requestPermissions();
  if (!granted) {
    if (__DEV__) console.warn('Push permission denied — user will not receive OS notifications.');
    return null;
  }

  // 2. יצירת ערוץ אנדרואיד (Channel) - קריטי להופעת ההתראה "ליד השעון"
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('kliqtap_default', {
      name: 'KliqTap Alerts',
      importance: Notifications.AndroidImportance.MAX, // חשיבות מקסימלית לתצוגה עילית
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a56db',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  let fcmToken = null;

  try {
    // 3. משיכת הטוקן הייחודי של המכשיר דרך Expo (תחליף ל-Firebase Native)
    const pushTokenData = await Notifications.getDevicePushTokenAsync();
    fcmToken = pushTokenData.data;

    if (fcmToken) {
      await registerTokenWithServer(fcmToken);
    }
  } catch (e) {
    console.error("Error getting push token:", e);
  }

  // 4. האזנה לשינויים בטוקן (במידה והוא מתחלף על ידי גוגל/אפל)
  Notifications.addPushTokenListener(async (pushTokenData) => {
    if (pushTokenData && pushTokenData.data) {
      await registerTokenWithServer(pushTokenData.data);
    }
  });

  // 5. ניתוב כשהמשתמש לוחץ על התראה מחוץ לאפליקציה (Deep Link)
 // ... בתוך הפונקציה setupPushNotifications:
  Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data ?? {};
  
  // ⭐️ ניתוב חכם לכל סוגי ההתראות (הודעות, לייקים ותגובות)
  if (data.type === 'MESSAGE' && data.chatId) {
    navigate('ChatDetail', { chatId: data.chatId });
  } else if ((data.type === 'LIKE' || data.type === 'COMMENT') && data.postId) {
    navigate('PostDetail', { postId: data.postId });
  }
});

  return fcmToken;
}

// ─── פונקציות עזר ───

// בקשת הרשאות מאפל/גוגל
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

// שליחת הטוקן לשרת שלנו לשמירה בבסיס הנתונים
async function registerTokenWithServer(fcmToken) {
  try {
    await fetchAPI('/users/me/fcm-token', {
      method: 'POST',
      body: JSON.stringify({ fcmToken, platform: Platform.OS }),
    });
    console.log('✅ FCM Token registered with server successfully.');
  } catch (e) {
    if (__DEV__) console.warn('Failed to register FCM token with server:', e);
  }
}