const ALLOWED_HOST = /^https:\/\/cdn\.animeav1\.com\//i;

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL requerida' }) };
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow'
    });

    if (!res.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, bytes: 0 })
      };
    }

    const buf = await res.arrayBuffer();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        bytes: buf.byteLength
      })
    };

  } catch {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, bytes: 0 })
    };
  }
};