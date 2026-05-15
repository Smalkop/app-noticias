export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { credential } = await request.json();
    
    // Validar el token con Google
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Token de Google inválido" }), { status: 401 });
    }
    
    const payload = await response.json();
    const { email, name, picture, sub: googleId } = payload;

    // Verificar si el usuario existe en D1
    let user = await env.DB.prepare(
      "SELECT * FROM usuarios WHERE email = ?"
    ).bind(email).first();

    if (!user) {
      // Crear usuario si no existe
      const userId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO usuarios (id, email, nombre, rol, foto_perfil) VALUES (?, ?, ?, ?, ?)"
      ).bind(userId, email, name, 'autor', picture).run();
      
      user = { id: userId, email, nombre: name, rol: 'autor', foto_perfil: picture };
    }

    // Crear sesión en KV
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
