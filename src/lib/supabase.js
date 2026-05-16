// client/src/lib/supabase.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// הכתובת הבסיסית (בלי ה-/rest/v1/ בסוף)
const supabaseUrl = 'https://yocrdrdbliooioymepfk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvY3JkcmRibGlvb2lveW1lcGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Nzg0NzIsImV4cCI6MjA4MDI1NDQ3Mn0.JoCtY1ALHsnF0Zku71ktoBlz-7cw35AS6mzbHG6QY5M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, 
    autoRefreshToken: false,
  },
});