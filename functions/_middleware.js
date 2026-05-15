export async function onRequest(context) {
  try {
    const response = await context.next();
    response.headers.set('X-Debug-Functions', 'true');
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
