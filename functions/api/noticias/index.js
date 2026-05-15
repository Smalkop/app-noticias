export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const categoria = url.searchParams.get('categoria');
  const query = url.searchParams.get('q');
  
  try {
    // Usamos el binding "DB" definido en wrangler.toml
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

    // Ejecución en Cloudflare D1
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
