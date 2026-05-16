// client/src/store/mimeUtils.js
// ⭐️ Central MIME type detection — מבטל 3 עותקים שונים שהיו פזורים בקוד ⭐️
//
// מקומות שהשתמשו בלוגיקה כפולה לפני:
//   1. useAppStore.uploadFile      ← הייתה גרסה עם באג (image/jpg במקום image/jpeg)
//   2. pulse.service.createPulse   ← גרסה תקינה
//   3. pulse.service.magicUpload   ← עוד גרסה, קצת שונה
//
// אחרי השינוי הזה — כל שלושת המקומות משתמשים בקובץ אחד מרכזי.

/**
 * מקבל URI של קובץ ומחזיר { filename, type } תקני.
 * 
 * @param {string} uri - הנתיב לקובץ (מה-ImagePicker, המצלמה וכו')
 * @param {string} fallbackName - שם ברירת מחדל אם ה-URI ריק
 * @returns {{ filename: string, type: string }}
 */
export function describeFileFromUri(uri: string, fallbackName: string = 'upload') {
  const rawName = (uri || '').split('/').pop() || fallbackName;
  // הסרה של query/hash שלפעמים מצורפים ל-URIs מסוג content://
  const filename = rawName.split('?')[0].split('#')[0] || fallbackName;

  const extMatch = /\.([a-z0-9]+)$/i.exec(filename);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  const type = mimeForExtension(ext);
  return { filename, type };
}

/**
 * ממפה סיומת קובץ (בלי הנקודה) ל-MIME תקני.
 * מחזיר 'application/octet-stream' לסיומות לא מוכרות.
 */
export function mimeForExtension(ext: string): string {
  switch (ext) {
    // תמונות
    case 'jpg':
    case 'jpeg':  return 'image/jpeg';   // ⭐️ נכון (לא 'image/jpg' שהיה לפני)
    case 'png':   return 'image/png';
    case 'gif':   return 'image/gif';
    case 'webp':  return 'image/webp';
    case 'heic':  return 'image/heic';
    case 'heif':  return 'image/heif';
    case 'bmp':   return 'image/bmp';
    case 'svg':   return 'image/svg+xml';

    // וידאו
    case 'mp4':   return 'video/mp4';
    case 'mov':   return 'video/quicktime';
    case 'avi':   return 'video/x-msvideo';
    case 'webm':  return 'video/webm';
    case 'mkv':   return 'video/x-matroska';
    case '3gp':   return 'video/3gpp';

    // אודיו
    case 'mp3':   return 'audio/mpeg';
    case 'wav':   return 'audio/wav';
    case 'm4a':   return 'audio/mp4';
    case 'ogg':   return 'audio/ogg';

    // מסמכים
    case 'pdf':   return 'application/pdf';
    case 'json':  return 'application/json';
    case 'txt':   return 'text/plain';

    default:      return 'application/octet-stream';
  }
}

/**
 * נוחות עבור FormData — מחזיר את האובייקט { uri, name, type }
 * שצריך להשתמש בו עם formData.append() ב-React Native.
 * 
 * דוגמה:
 *   formData.append('file', fileFormDataPart(imageUri));
 */
export function fileFormDataPart(uri: string, fallbackName: string = 'upload') {
  const { filename, type } = describeFileFromUri(uri, fallbackName);
  return { uri, name: filename, type };
}