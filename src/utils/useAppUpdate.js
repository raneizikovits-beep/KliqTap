import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

export const useAppUpdate = () => {
    useEffect(() => {
        // מנגנון העדכון עובד רק באפליקציה האמיתית (Production), לא ב-Expo Go
        if (__DEV__) return;

        const checkForUpdates = async () => {
            try {
                // 1. בדיקה שקטה מול השרת האם קיימת גרסה חדשה
                const update = await Updates.checkForUpdateAsync();

                if (update.isAvailable) {
                    // 2. אם יש גרסה, אנחנו מורידים אותה ברקע
                    await Updates.fetchUpdateAsync();

                    // 3. מקפיצים למשתמש הודעה שהגרסה מוכנה
                    Alert.alert(
                        "עדכון גרסה זמין 🚀",
                        "שחררנו גרסה חדשה ומשופרת ל-KliqTap! כדי ליהנות מהפיצ'רים החדשים, האפליקציה תתרענן כעת.",
                        [
                            { 
                                text: "אולי אחר כך", 
                                style: "cancel" 
                            },
                            {
                                text: "עדכן עכשיו",
                                onPress: async () => {
                                    // 4. מרעננים את האפליקציה מיידית לגרסה החדשה
                                    await Updates.reloadAsync();
                                }
                            }
                        ],
                        { cancelable: false }
                    );
                }
            } catch (error) {
                console.log("Error checking for OTA updates:", error);
            }
        };

        // נבדוק עדכונים כשהאפליקציה עולה
        checkForUpdates();

        // בונוס UX: נבדוק שוב גם בכל פעם שהמשתמש חוזר לאפליקציה מהרקע
        const subscription = AppState.addEventListener("change", nextAppState => {
            if (nextAppState === "active") {
                checkForUpdates();
            }
        });

        return () => subscription.remove();
    }, []);
};