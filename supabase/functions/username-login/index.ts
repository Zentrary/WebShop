import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const { identifier, password } = await req.json();

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check (simple in-memory or Redis-based in production)
    // For now, we just validate the user exists

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, user_name, email, role')
      .or(`user_name.eq.${identifier},email.eq.${identifier}`)
      .single();

    if (error || !profiles) {
      return new Response(
        JSON.stringify({ success: false, error: 'ไม่พบผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify password via Supabase Auth (signInWithPassword)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profiles.email,
      password: password,
    });

    if (authError) {
      return new Response(
        JSON.stringify({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: profiles.id,
          user_name: profiles.user_name,
          email: profiles.email,
          role: profiles.role,
        },
        session_token: authData.session?.access_token,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});