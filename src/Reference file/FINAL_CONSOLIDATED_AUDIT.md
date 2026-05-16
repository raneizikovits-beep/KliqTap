# 🎯 דוח ביקורת סופי מאוחד — KliqTap

**תאריך:** 5 במאי 2026
**היקף:** 55 קבצים, ~12,000 שורות קוד (לקוח + שרת)
**מטרה:** רשימה אחת מאוחדת של **כל הבאגים שמצאתי בכל הסבבים**, ממוינים לפי דחיפות אמיתית.

---

## 🚨 הבאג הקריטי שנשכח — `chat_gateway.ts`

זכרת נכון. זה הבאג הכי חמור באפליקציה, ועדיין לא תיקנו אותו.

### הקוד הבעייתי (שורה 559-571):

```typescript
private getAuthenticatedUserId(client: Socket): string | null {
    const userId = client.handshake.auth?.userId ?? client.handshake.query?.userId;
    if (userId && typeof userId === 'string' && ...) {
        return userId.trim();
    }
    return null;
}
```

### למה זה אסון אבטחה:

המערכת **מאמינה למה שהלקוח אומר על עצמו**. כל אחד יכול להתחבר ל-Socket.IO ולשלוח:
```js
io.connect('https://api.kliqtap.com', { auth: { userId: 'אני_משתמש_אחר' } })
```
ו**השרת יקבל את זה כאמת**.

### מה שתוקף יכול לעשות:
- 🔴 **לקרוא הודעות פרטיות של כל משתמש** — `joinChat` בודק רק חברות בקבוצה, אבל אם אני יכול להתחזות למישהו שכן בקבוצה, אקבל את כל הודעותיו
- 🔴 **לשלוח הודעות בשם מישהו אחר** — `sendMessage` משתמש ב-`userId` שהותקף שלח
- 🔴 **למחוק/לערוך הודעות של אחרים** — אם הוא מתחזה ל-sender המקורי
- 🔴 **WebRTC signaling** — להיכנס לשיחות וידאו של אחרים

**זה לא תיאורטי — זה מה שמשתמש זדוני יעשה תוך 30 שניות עם DevTools.**

### התיקון:

צריך לאמת JWT מהטוקן ב-handshake, לא לסמוך על מה שהלקוח שולח. הקובץ המתוקן ב-`outputs/refactored/chat.gateway.ts`.

---

## 📊 סיכום כללי של כל הבאגים — לפי דחיפות

### 🔴 דחוף — שובר את האפליקציה ב-Production

| # | קובץ | בעיה | סטטוס |
|---|---|---|---|
| 1 | `chat_gateway.ts` | אימות מזויף — תוקף יכול להתחזות | ❌ **לא תוקן** |
| 2 | `AlertsScreen.js` | IP מקומי `192.168.1.60` — שובר Mark-as-Read ב-production | יש קובץ מתוקן ב-outputs |
| 3 | `AdminNoticeScreen.js` | IP מקומי + PIN `120687` בקוד הלקוח | ❌ **לא תוקן** |

### 🟠 חמור — איבוד נתונים או UX רע

| # | קובץ | בעיה | סטטוס |
|---|---|---|---|
| 4 | `EditProfileView.js` | באג כפילות "My Anthem" + location/website לא נשמרים | יש קובץ מתוקן ב-outputs |
| 5 | `api.ts` | Timeout race ב-token refresh | יש קובץ מתוקן ב-outputs |
| 6 | `useAppStore.js` | MIME type `image/jpg` לא תקני | יש קובץ מתוקן ב-outputs |

### 🟡 בינוני — איכות קוד

| # | קובץ | בעיה |
|---|---|---|
| 7 | רוב הקבצים | 40+ `console.log` ב-production |
| 8 | `authSlice.js` | webClientId של Google בקוד |
| 9 | `pulse.service.js` | כפילות לוגיקת MIME |

### ✅ בסדר — אל תיגע

`Header.js`, `MainNavigator.js`, `RootNavigation.js`, `TabBar.js`, `GroupDetailsSheet.js`, `styles.js`, `chat_service.ts` (פותח עם בדיקות בעלות נכונות), `posts_service.ts` (גם הוא עם בדיקות `authorId !== userId`).

---

## 🎯 הצעד הבא הקריטי

**תקן את `chat_gateway.ts` עכשיו.** זה היחיד מבין הבאגים שעדיין משאיר חור אבטחה אקטיבי. 3 צעדים פשוטים:

1. **קובץ חדש:** `server/src/auth/socket-auth.guard.ts` — מאמת JWT
2. **החלפת קובץ:** `server/src/chat/chat.gateway.ts` — משתמש ב-Guard החדש
3. **שינוי 1 שורה ב-Client:** ב-`socketSlice.js` או איפה שמתחברים ל-Socket — להעביר את ה-token כ-`auth.token` במקום `auth.userId`

הקוד המלא יושב ב-`outputs/refactored/chat.gateway.ts`. אכין אותו עכשיו עם הסבר מלא.
