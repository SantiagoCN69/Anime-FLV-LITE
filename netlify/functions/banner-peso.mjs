const ALLOWED_HOSTS = new Set([
  'cdn.animeav1.com',
  'cdn.jkdesa.com'
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

const response = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  const url = event.queryStringParameters?.url;

  if (!url) {
    return response(400, {
      error: 'URL requerida'
    });
  }

  try {
    const parsed = new URL(url);

    // Seguridad
    if (
      parsed.protocol !== 'https:' ||
      !ALLOWED_HOSTS.has(parsed.hostname)
    ) {
      return response(403, {
        error: 'Host no permitido'
      });
    }

    // Primero intentamos obtener únicamente los headers
    const res = await fetch(parsed.href, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      redirect: 'follow'
    });

    if (!res.ok) {
      return response(200, {
        ok: false,
        bytes: 0
      });
    }

    const contentLength = res.headers.get('content-length');

    // Si el servidor informa el tamaño, no necesitamos descargarlo
    if (contentLength) {
      const size = Number(contentLength);

      if (!Number.isFinite(size) || size < 0 || size > MAX_SIZE) {
        return response(200, {
          ok: false,
          bytes: 0
        });
      }

      return response(200, {
        ok: true,
        bytes: size
      });
    }

    // Si no existe Content-Length, descargamos para determinar el tamaño
    const resGet = await fetch(parsed.href, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      redirect: 'follow'
    });

    if (!resGet.ok) {
      return response(200, {
        ok: false,
        bytes: 0
      });
    }

    const buf = await resGet.arrayBuffer();

    if (buf.byteLength > MAX_SIZE) {
      return response(200, {
        ok: false,
        bytes: 0
      });
    }

    return response(200, {
      ok: true,
      bytes: buf.byteLength
    });

  } catch {
    return response(200, {
      ok: false,
      bytes: 0
    });
  }
};