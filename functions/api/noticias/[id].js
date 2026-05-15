export async function onRequest(context) {
  const { env, params } = context;
  const id = params.id;

  try {
    const noticia = await env.DB.prepare(
      "SELECT n.*, u.nombre as autor_nombre, u.bio as autor_bio, c.nombre as categoria_nombre " +
      "FROM noticias n " +
      "JOIN usuarios u ON n.autor_id = u.id " +
      "JOIN categorias c ON n.categoria_id = c.id " +
      "WHERE n.id = ?"
    ).bind(id).first();

    if (!noticia) {
      return new Response(JSON.stringify({ error: "Noticia no encontrada" }), { status: 404 });
    }

    // Actualizar métricas en D1 de forma atómica
    await env.DB.prepare(
      "INSERT INTO metricas_visitas (noticia_id, fecha, visitas) VALUES (?, date('now'), 1) " +
      "ON CONFLICT(noticia_id, fecha) DO UPDATE SET visitas = visitas + 1"
    ).bind(noticia.id).run();

    return new Response(JSON.stringify(noticia), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
