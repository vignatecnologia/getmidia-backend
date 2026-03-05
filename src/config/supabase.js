const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qyruweidqlqniqdatnxx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase URL or Key missing in environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
