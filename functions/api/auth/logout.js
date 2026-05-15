export async function onRequestPost(context) {
  const { env, request } = context;
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/token=([^;]+)/);
  const token = match ? match[1] : null;

  if (token) {
    await env.SESSIONS.delete(token);
  }

  return new Response(JSON.stringify({ message: "Sesión cerrada" }), {
    headers: { 
      "Content-Type": "application/json",
      "Set-Cookie": "token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    }
  });
}
