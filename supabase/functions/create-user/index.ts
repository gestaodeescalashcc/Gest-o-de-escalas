import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: currentUser }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !currentUser) {
      console.error('Auth error:', authError);
      throw new Error('Não autenticado');
    }

    const { data: userData, error: userError } = await supabaseClient
      .from('system_users')
      .select('role_id, user_roles!inner(permissions)')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (userError) {
      console.error('User lookup error:', userError);
      throw new Error('Erro ao buscar usuário no sistema');
    }

    if (!userData) {
      throw new Error('Usuário não encontrado no sistema');
    }

    const permissions = userData.user_roles?.permissions;
    if (!permissions?.users?.create) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar usuários' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { email, password, full_name, role_id }: CreateUserRequest = await req.json();

    if (!email || !password || !full_name || !role_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 8 caracteres' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!/[A-Z]/.test(password)) {
      return new Response(
        JSON.stringify({ error: 'Senha deve conter pelo menos uma letra maiúscula' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!/[0-9]/.test(password)) {
      return new Response(
        JSON.stringify({ error: 'Senha deve conter pelo menos um número' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Client-Info': 'supabase-js-node'
        }
      }
    });

    console.log('Creating auth user with email:', email);

    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createAuthError) {
      console.error('==== AUTH CREATION ERROR ====');
      console.error('Full error object:', JSON.stringify(createAuthError, null, 2));
      console.error('Error message:', createAuthError.message);
      console.error('Error status:', createAuthError.status);
      console.error('Error code:', createAuthError.code);
      console.error('Error name:', createAuthError.name);
      console.error('All error keys:', Object.keys(createAuthError));
      console.error('============================');

      if (createAuthError.message?.includes('User already registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: `Erro ao criar autenticação: ${createAuthError.message}`,
          details: {
            code: createAuthError.code,
            status: createAuthError.status,
            name: createAuthError.name
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!authData.user) {
      throw new Error('Falha ao criar usuário de autenticação');
    }

    console.log('Auth user created successfully:', authData.user.id);
    console.log('Now inserting into system_users table...');
    console.log('Insert data:', { id: authData.user.id, email, full_name, role_id, active: true, created_by: currentUser.id });

    const { error: dbError } = await supabaseAdmin
      .from('system_users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role_id,
        active: true,
        created_by: currentUser.id,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      console.error('Database error code:', dbError.code);
      console.error('Database error details:', dbError.details);
      console.error('Database error hint:', dbError.hint);
      console.error('Database error message:', dbError.message);
      
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        console.log('Rolled back auth user creation');
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      if (dbError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado no sistema' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`Database error: ${dbError.message} (code: ${dbError.code})`);
    }

    console.log('Database user created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email,
          full_name,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in create-user function:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro ao criar usuário',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});