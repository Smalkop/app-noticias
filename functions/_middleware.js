export async function onRequest(context) {
  try {
    const response = await context.next();
    
    // Clonamos la respuesta para poder modificar las cabeceras sin errores de inmutabilidad
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Debug-Functions', 'true');
    newResponse.headers.set('X-Routes-Path', context.request.url);
    
    return newResponse;
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: "Error en Middleware", 
      message: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
