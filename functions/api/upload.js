export async function onRequestPost(context) {
  const { env, request } = context;
  
  // Auth Check
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/token=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  const session = await env.SESSIONS.get(token);
  if (!session) return new Response(JSON.stringify({ error: "Sesión expirada" }), { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('image');
    
    if (!file) {
      return new Response(JSON.stringify({ error: "No se subió ninguna imagen" }), { status: 400 });
    }

    const filename = `${crypto.randomUUID()}-${file.name}`;
    
    // Subir a R2 (el binding IMAGES en wrangler.toml)
    await env.IMAGES.put(filename, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });

    // En Cloudflare Pages, puedes acceder a los archivos de R2 a través de una ruta pública
    // o usando otra Function como proxy. Por simplicidad, usaremos una ruta que servirá de proxy.
    const url = `/api/images/${filename}`;

    return new Response(JSON.stringify({ url }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
