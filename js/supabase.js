import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
const SUPABASE_URL = "https://hrrirlamghailptnxnat.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycmlybGFtZ2hhaWxwdG54bmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Njg4MjcsImV4cCI6MjA5NjU0NDgyN30.v_uyQbGDjhVpPXq1SEfj4zvLG2SZZ69y-jVsIXUMiFc"
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

if (supabase.auth){
    console.log("Холбогдсон байна!")
    console.log(supabase.auth)
}