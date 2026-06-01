// hooks/useWebScrollFix.js — v5.1 SAFE COLOR FIX
//
// תיקון בטוח לפס הלבן:
//   1. צביעת body+html בלבן מלא (#FFFFFF) במקום אפור-לבן (#F9FAFB)
//   2. ביטול overscroll של הדפדפן
//   3. אין שינויים ב-layout (#root נשאר כפי שהוא)
//   4. הקוד רץ רק ב-Web — לא משפיע על iOS/Android
//
// שינוי מ-v5: צבע בלבד. #F9FAFB → #FFFFFF.
// אין שינויים ב-height, width, או ב-#root structure.

import { useEffect } from 'react';
import { Platform } from 'react-native';

const OLD_STYLE_IDS = [
    'kliqtap-scroll-fix',
    'kliqtap-scroll-fix-v2',
    'kliqtap-scroll-fix-v3',
    'kliqtap-scroll-fix-v3-2',
    'kliqtap-scroll-fix-v4',
    'kliqtap-scroll-fix-v5',
    'kliqtap-scroll-fix-v5-1',
    'kliqtap-scroll-fix-v6',
];

const STYLE_ID = 'kliqtap-scroll-fix-v5-1';

export const useWebScrollFix = (isDark = false) => {
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        // הסרת כל הגרסאות הקודמות
        OLD_STYLE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // ניקוי inline styles ישנים
        document.body.style.removeProperty('background-color');
        const rootDiv = document.querySelector('#root > div');
        if (rootDiv) {
            rootDiv.style.removeProperty('background-color');
            rootDiv.style.removeProperty('height');
            rootDiv.style.removeProperty('min-height');
        }

        // צבע אחיד: לבן מלא ב-light, שחור עמוק ב-dark
        const bgColor = isDark ? '#000000' : '#FFFFFF';

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.innerHTML = `
            /* תיקון Overscroll: צביעת html ו-body בצבע הרקע של האפליקציה */
            html, body {
                background-color: ${bgColor} !important;
                overscroll-behavior: none !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* כלל הגלילה הקיים — נשאר בלי שינוי */
            #root > div {
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
                touch-action: pan-y !important;
                overscroll-behavior: none !important;
            }

            body {
                touch-action: pan-y !important;
            }
        `;
        document.head.appendChild(style);

        // שחרור touch events מ-RN Web responder
        const passiveTouchMove = () => {};
        document.addEventListener('touchmove', passiveTouchMove, { passive: true });
        return () => document.removeEventListener('touchmove', passiveTouchMove);
    }, [isDark]);
};