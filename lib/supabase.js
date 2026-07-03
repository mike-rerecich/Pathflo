import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jdvbfixrwhtwolbhwrzb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uiHYPsJomoaKXYQi_QOSPg_dmI6CYKd";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
