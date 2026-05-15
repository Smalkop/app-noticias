export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password } = await request.json();
    
    const user = await env.DB.prepare(
      "SELECT * FROM usuarios WHERE email = ?"
    ).bind(email).first();

    if (!user || user.password_hash !== password) {
      return new Response(JSON.stringify({ error: "Credenciales inválidas" }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Generamos un token simple (en prod usa JWT real o sesiones en KV)
    const sessionToken = crypto.randomUUID();
    await env.SESSIONS.put(sessionToken, JSON.stringify(user), { expirationTtl: 3600 * 24 * 7 });

    return new Response(JSON.stringify({ 
      id: user.id, 
      email: user.email, 
      nombre: user.nombre, 
      rol: user.rol, 
      foto_perfil: user.foto_perfil 
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Set-Cookie": `token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
