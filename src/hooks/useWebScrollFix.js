// hooks/useWebScrollFix.js — v4 DEFINITIVE
//
// תיקון אחד בלבד: overflow:hidden → overflow-y:auto על #root > div
// שום שינוי ב-height, position, background, min-height — כלום אחר.
//
// הסיבה לפס הלבן עד כה: v2 הכניס height:auto על #root>div,
// מה שגרם לו להתכווץ לגובה התוכן. body הלבן נחשף מתחתיו.

import { useEffect } from 'react';
import { Platform } from 'react-native';

// כל ה-IDs של גרסאות קודמות — מוסרים בכוח
const OLD_STYLE_IDS = [
    'kliqtap-scroll-fix',
    'kliqtap-scroll-fix-v2',
    'kliqtap-scroll-fix-v3',
    'kliqtap-scroll-fix-v3-2',
    'kliqtap-scroll-fix-v4', // גם ה-ID הנוכחי — נאכוף re-inject תמיד
];

const STYLE_ID = 'kliqtap-scroll-fix-v4';

export const useWebScrollFix = () => {
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        // הסרה בכוח של כל הגרסאות הישנות + הנוכחית (כדי להבטיח CSS נקי)
        OLD_STYLE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // גם הסרת כל inline style שהוכנס ישירות ל-body / #root > div
        document.body.style.removeProperty('background-color');
        const rootDiv = document.querySelector('#root > div');
        if (rootDiv) {
            rootDiv.style.removeProperty('background-color');
            rootDiv.style.removeProperty('height');
            rootDiv.style.removeProperty('min-height');
        }

        // הזרקת CSS נקי — רק overflow, שום דבר אחר
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.innerHTML = `
            /*
             * הכלל היחיד הנדרש:
             * RN Web שם overflow:hidden על #root>div — זה בלבד חוסם גלילה.
             * position:fixed + height:100% נשארים (חיוניים ל-layout).
             * שינוי overflow:hidden → overflow-y:auto = גלילה עובדת.
             */
            #root > div {
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
                touch-action: pan-y !important;
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
    }, []);
};