export async function onRequest(context) {
  return new Response(JSON.stringify({ 
    status: "ok", 
    message: "Functions are working!",
    env: Object.keys(context.env)
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
