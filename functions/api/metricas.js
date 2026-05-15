export async function onRequestGet(context) {
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
    let sql = 'SELECT n.titulo, SUM(m.visitas) as total_visitas FROM metricas_visitas m JOIN noticias n ON m.noticia_id = n.id';
    const params = [];

    if (user.rol !== 'admin') {
      sql += ' WHERE n.autor_id = ?';
      params.push(user.id);
    }
    sql += ' GROUP BY n.id ORDER BY total_visitas DESC LIMIT 5';
    
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
