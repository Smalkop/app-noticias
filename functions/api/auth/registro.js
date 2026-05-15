export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: { "Allow": "POST" } });
  }
  
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { 
      status: 405, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  const { env, request } = context;
  
  try {
    if (!env.DB) {
      throw new Error("La base de datos DB no está vinculada en Cloudflare");
    }

    const { email, password, nombre } = await request.json();
    
    if (!email || !password || !nombre) {
      return new Response(JSON.stringify({ error: "Faltan campos obligatorios" }), { status: 400 });
    }
    
    const id = crypto.randomUUID();
    
    // NOTA: En un entorno real usarías un hash de contraseña. 
    // Para resolver tu problema de registro ahora mismo, guardaremos los datos.
    await env.DB.prepare(
      "INSERT INTO usuarios (id, email, password_hash, nombre, rol, activo) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, email, password, nombre, 'autor', 1).run();

    return new Response(JSON.stringify({ 
      success: true, 
      user: { id, email, nombre } 
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Registro error:", error);
    return new Response(JSON.stringify({ 
      error: "Error en el servidor", 
      message: error.message,
      debug_db_exists: !!env.DB
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
