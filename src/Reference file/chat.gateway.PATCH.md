// server/src/chat/chat.gateway.PATCH.md
// 🔴 CRITICAL SECURITY FIX — chat.gateway.ts
//
// סטטוס: כירורגי. רק 2 שינויים. שאר 580+ שורות נשארות כמו שהן.
// סיבה: הקובץ הקיים מאמין למה שהלקוח אומר על עצמו ב-handshake — תוקף יכול להתחזות.

# 🔴 תיקון אבטחה קריטי ל-chat.gateway.ts

## הבעיה (3 משפטים)

הפונקציה `getAuthenticatedUserId` בשורה 559 קוראת `userId` ישירות מה-handshake של ה-Socket, **בלי לאמת חתימה**. זה אומר שכל אחד יכול להתחבר ל-WebSocket שלך עם `userId` של מישהו אחר ולהתחזות אליו לחלוטין: לקרוא הודעות פרטיות, לשלוח הודעות בשם אחר, להיכנס לשיחות וידאו של זרים. זה לא תיאורטי — תוקף יבצע את זה תוך 30 שניות מ-DevTools.

## מה הפתרון

במקום לקבל `userId` מהלקוח, נקבל **JWT token** (החתום ע"י השרת), נאמת אותו, ונחלץ את ה-userId מה-payload החתום. הלקוח לא יוכל לזייף את זה בלי המפתח הסודי של השרת.

---

## השינויים (3 שינויים בלבד, ~20 שורות בסה"כ)

### שינוי 1: ייבוא JwtService (חדש)

**איפה:** בראש הקובץ `chat.gateway.ts`, באזור ה-imports.

**הוסף שורה אחת:**
```typescript
import { JwtService } from '@nestjs/jwt';
```

---

### שינוי 2: הזריקה של JwtService בקונסטרקטור

**איפה:** שורות 88-92 בקובץ הקיים:

**מצא:**
```typescript
constructor(
    private readonly usersService: UsersService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
) {}
```

**החלף ב:**
```typescript
constructor(
    private readonly usersService: UsersService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,        // ⭐️ הוספה
) {}
```

---

### שינוי 3: החלפת הפונקציה `getAuthenticatedUserId`

**איפה:** שורות 559-571 בקובץ הקיים.

**מצא את הפונקציה הזו:**
```typescript
private getAuthenticatedUserId(client: Socket): string | null {
    const userId = client.handshake.auth?.userId ?? client.handshake.query?.userId;
    if (
      userId &&
      typeof userId === 'string' &&
      userId !== 'undefined' &&
      userId !== 'null' &&
      userId.trim().length > 0
    ) {
      return userId.trim();
    }
    return null;
}
```

**החלף ב:**
```typescript
/**
 * Verify the JWT from the socket handshake and return the userId from
 * the *signed* payload. Never trusts client-supplied userId.
 *
 * Token can be supplied via:
 *   io.connect(URL, { auth: { token: '<JWT>' } })   ← preferred
 * Or via:
 *   io.connect(`${URL}?token=<JWT>`)                ← fallback
 */
private getAuthenticatedUserId(client: Socket): string | null {
    const token =
        client.handshake.auth?.token ??
        (typeof client.handshake.query?.token === 'string'
            ? client.handshake.query.token
            : null);

    if (!token || typeof token !== 'string') {
        return null;
    }

    try {
        // verify() throws on invalid/expired/tampered tokens.
        const payload = this.jwtService.verify<{ sub?: string; userId?: string }>(token);
        const userId = payload?.sub ?? payload?.userId;

        if (typeof userId === 'string' && userId.trim().length > 0) {
            return userId.trim();
        }
        return null;
    } catch (err) {
        this.logger.warn(`Invalid JWT in socket handshake: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
```

זהו. זה כל השינוי בצד השרת.

---

## שינוי בצד הלקוח (1 שורה)

הלקוח עכשיו צריך לשלוח את ה-**token** ולא את ה-userId. תחפש בקוד הלקוח שלך איפה מתחברים ל-Socket. סביר להניח שזה ב-`socketSlice.js` או דומה.

**מצא משהו כזה:**
```javascript
const socket = io(API_BASE_URL, {
    auth: { userId: user.id }    // ❌ זה היה הבאג
});
```

**החלף ב:**
```javascript
const socket = io(API_BASE_URL, {
    auth: { token: get().token }   // ✅ שולח את ה-JWT
});
```

(`get().token` הוא הטוקן מה-Zustand store שלך — `useAppStore.getState().token`.)

---

## בדיקה שהתיקון עובד

אחרי שתחיל את 3 השינויים:

1. **בדיקה חיובית:** משתמש מחובר אמור להצליח לשלוח ולקבל הודעות כרגיל. אם זה עובד → הטוקן מאומת בהצלחה.

2. **בדיקה שלילית (חשוב!):** פתח DevTools במכשיר, נסה להתחבר ידנית עם token פגום:
   ```js
   io.connect('https://api.kliqtap.com', { auth: { token: 'bla-bla' } })
   ```
   הסוקט יתחבר אבל **כל הודעה ינסה לשלוח תקבל תשובה `Unauthorized`**. זה הסימן שזה עובד.

3. **בדיקת Logs:** ב-server logs אמור להופיע `Invalid JWT in socket handshake: ...` עבור הניסיון השלילי.

---

## מה לא נגעתי

- ה-CORS settings (שורות 63-77) — הם בסדר.
- כל ה-handlers (sendMessage, joinChat, editMessage, וכו') — הם בסדר. הם משתמשים ב-`getAuthenticatedUserId()` ש-עכשיו תוקן.
- Socket-ID cache, roulette queue, ICE candidates handling — כולם בסדר.
- ה-`chat.service.ts` — בסדר. כבר יש לו בדיקות בעלות נכונות (`senderId !== userId` וכו').
- ה-`chat.module.ts` — בסדר. `AuthModule` כבר מיובא, ולכן `JwtService` כבר זמין דרך הזרקת תלויות.

---

## אזהרה אחת חשובה

אחרי שתחיל את התיקון בשרת, **כל הלקוחות הפעילים שיש להם רק userId יתנתקו**. זה צפוי. הם יחזרו אוטומטית כשהאפליקציה תרענן עם הקוד החדש שמשתמש ב-token. אם רוצים מעבר חלק יותר ל-production, אפשר להוסיף תקופת חסד של 24 שעות שמקבלת את שתי השיטות, ואז להסיר את הישנה.

לצורך פיתוח/בדיקה ראשונית — פשוט להחליף ולהמשיך.
