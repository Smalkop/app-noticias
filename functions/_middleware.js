export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Debug header to see what's happening
  console.log(`[Middleware] Requesting: ${url.pathname} (${request.method})`);

  try {
    const response = await context.next();
    
    // Clonamos la respuesta para poder modificar las cabeceras
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Debug-Functions', 'true');
    newResponse.headers.set('X-Request-Path', url.pathname);
    
    return newResponse;
  } catch (err) {
    console.error(`[Middleware Error] ${url.pathname}:`, err);
    return new Response(JSON.stringify({ 
      error: "Error en el servidor backend", 
      message: err.message,
      path: url.pathname
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
