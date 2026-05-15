export async function onRequest(context) {
  return new Response(JSON.stringify({ status: "ok", message: "Functions are working" }), {
    headers: { "Content-Type": "application/json" }
  });
}
