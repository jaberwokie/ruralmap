import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the caller's JWT and get their user id
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role using service role (bypasses RLS)
    const { data: roleRow } = await adminClient
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .single();

    if (roleRow?.role !== 'admin' || !roleRow?.is_active) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, role = 'viewer' } = await req.json();
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pre-register the role
    const { error: rpcError } = await adminClient.rpc('admin_invite_user', {
      _email: email.toLowerCase().trim(),
      _role: role,
    });
    if (rpcError) throw new Error(rpcError.message ?? JSON.stringify(rpcError));

    // Send the magic link invite email via Supabase Auth
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      { data: { invited_role: role } }
    );
    if (inviteError) throw new Error(inviteError.message ?? JSON.stringify(inviteError));

    return new Response(JSON.stringify({ success: true, email, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const message = err?.message ?? err?.error_description ?? err?.msg ?? JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
