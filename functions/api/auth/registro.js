export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { email, password, nombre } = await request.json();
    
    // En producción deberías usar un hash (bcryptjs no funciona directo en Workers sin polyfills)
    // Para este ejemplo de Cloudflare usaremos una versión simplificada o una librería compatible
    const id = crypto.randomUUID();
    
    await env.DB.prepare(
      "INSERT INTO usuarios (id, email, password_hash, nombre, rol) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, email, password, nombre, 'autor').run();

    return new Response(JSON.stringify({ id, email, nombre }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "El email ya existe o datos inválidos: " + error.message }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
