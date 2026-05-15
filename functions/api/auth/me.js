export async function onRequestGet(context) {
  const { env, request } = context;
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/token=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return new Response("null", { headers: { "Content-Type": "application/json" } });

  const session = await env.SESSIONS.get(token);
  if (!session) return new Response("null", { headers: { "Content-Type": "application/json" } });

  const user = JSON.parse(session);
  // Refrescar datos desde DB por si cambiaron
  const freshUser = await env.DB.prepare("SELECT id, email, nombre, rol, foto_perfil, bio FROM usuarios WHERE id = ?").bind(user.id).first();

  return new Response(JSON.stringify(freshUser || null), {
    headers: { "Content-Type": "application/json" }
  });
}
