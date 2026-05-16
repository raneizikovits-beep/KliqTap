-- ============================================================
-- 🔧 PostLike Table — Manual SQL Migration
-- ============================================================
-- מטרה: ליצור את הטבלה PostLike ב-Supabase ידנית, בלי להריץ
-- `prisma db push` (שהיה מוחק טבלאות של פרויקט אחר).
--
-- בטוח להרצה: שימוש ב-IF NOT EXISTS, לא יוצר שוב אם הטבלה כבר קיימת.
-- הפיך: בסוף הקובץ יש סקריפט rollback אם תרצה לבטל.
-- ============================================================

-- ⚠️ לפני שאתה מריץ:
-- 1. ודא שאתה ב-database הנכון בלוח Supabase שלך.
-- 2. גבה את הדאטה-בייס דרך Supabase Dashboard → Database → Backups.
-- 3. רוץ את השאילתות אחת אחת, לא הכל בבת אחת — ככה אם משהו נכשל
--    אתה יודע בדיוק איפה.

-- ============================================================
-- שלב 1: יצירת הטבלה PostLike
-- ============================================================
CREATE TABLE IF NOT EXISTS "PostLike" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "postId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- שלב 2: יצירת אינדקסים לביצועים
-- ============================================================
-- אינדקס על userId — מאפשר לשאול "אילו פוסטים עשה lic המשתמש X" במהירות
CREATE INDEX IF NOT EXISTS "PostLike_userId_idx" ON "PostLike"("userId");

-- אינדקס על postId — מאפשר לספור lic של פוסט מסוים במהירות
CREATE INDEX IF NOT EXISTS "PostLike_postId_idx" ON "PostLike"("postId");

-- ============================================================
-- שלב 3: אכיפת ייחודיות — משתמש לא יכול לסמן like פעמיים על אותו פוסט
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "PostLike_userId_postId_key"
    ON "PostLike"("userId", "postId");

-- ============================================================
-- שלב 4: Foreign Keys — קישור ל-User ו-Post עם מחיקה מדורגת
-- ============================================================
-- אם המשתמש נמחק → מחק את כל ה-likes שלו
ALTER TABLE "PostLike"
    ADD CONSTRAINT "PostLike_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- אם הפוסט נמחק → מחק את כל ה-likes עליו
ALTER TABLE "PostLike"
    ADD CONSTRAINT "PostLike_postId_fkey"
    FOREIGN KEY ("postId")
    REFERENCES "Post"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ============================================================
-- ✅ סיום! הטבלה מוכנה.
-- ============================================================
-- לאחר ההרצה, חזור לטרמינל והרץ:
--   npx prisma generate
-- זה ייצור את ה-Prisma Client המעודכן בלי לגעת בדאטה-בייס.

-- ============================================================
-- 🔄 ROLLBACK — להפעלה רק אם משהו השתבש ואתה רוצה לבטל
-- ============================================================
-- DROP TABLE IF EXISTS "PostLike" CASCADE;
