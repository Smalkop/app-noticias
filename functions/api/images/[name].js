export async function onRequestGet(context) {
  const { env, params } = context;
  const name = params.name;

  try {
    const object = await env.IMAGES.get(name);

    if (!object) {
      return new Response("Archivo no encontrado", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}
