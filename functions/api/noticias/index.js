export async function onRequestPost(context) {
  const { env, request } = context;
  
  // Auth Check
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/token=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  const session = await env.SESSIONS.get(token);
  if (!session) return new Response(JSON.stringify({ error: "Sesión expirada" }), { status: 401 });
  const user = JSON.parse(session);

  try {
    const { titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado = 'borrador' } = await request.json();
    const publicado_en = estado === 'publicado' ? new Date().toISOString() : null;
    const noticiaId = crypto.randomUUID();

    await env.DB.prepare(
      'INSERT INTO noticias (id, autor_id, titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado, publicado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(noticiaId, user.id, titulo, subtitulo, contenido, categoria_id, imagen_destacada, estado, publicado_en).run();

    return new Response(JSON.stringify({ id: noticiaId }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const categoria = url.searchParams.get('categoria');
  const query = url.searchParams.get('q');
  
  try {
    let sql = "SELECT n.*, u.nombre as autor_nombre, c.nombre as categoria_nombre " +
              "FROM noticias n " +
              "JOIN usuarios u ON n.autor_id = u.id " +
              "JOIN categorias c ON n.categoria_id = c.id " +
              "WHERE n.estado = 'publicado'";
    
    const params = [];
    
    if (categoria) {
      sql += " AND c.slug = ?";
      params.push(categoria);
    }
    
    if (query) {
      sql += " AND (n.titulo LIKE ? OR n.subtitulo LIKE ?)";
      params.push(`%${query}%`, `%${query}%`);
    }
    
    sql += " ORDER BY n.publicado_en DESC LIMIT 20";

    const { results } = await env.DB.prepare(sql).bind(...params).all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
