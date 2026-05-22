const ALLOWED_HOST = /^https:\/\/(www\d*\.)?animeflv\.net\//i;

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const url = event.queryStringParameters?.url;
  if (!url || !ALLOWED_HOST.test(url)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL no válida' }) };
  }

  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    let bytes = Number(res.headers.get('content-length')) || 0;

    if (!bytes) {
      const full = await fetch(url, { redirect: 'follow' });
      if (!full.ok) {
        return { statusCode: full.status, headers, body: JSON.stringify({ error: 'No se pudo obtener la imagen' }) };
      }
      const buf = await full.arrayBuffer();
      bytes = buf.byteLength;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ bytes }) };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message || 'Error al consultar el banner' }),
    };
  }
};
