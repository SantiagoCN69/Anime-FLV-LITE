const ALLOWED_HOSTS = new Set([
  'cdn.animeav1.com',
  'cdn.jkdesa.com'
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'URL requerida' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      const parsed = new URL(targetUrl);

      // Seguridad
      if (
        parsed.protocol !== 'https:' ||
        !ALLOWED_HOSTS.has(parsed.hostname)
      ) {
        return new Response(JSON.stringify({ error: 'Host no permitido' }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
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
        return new Response(JSON.stringify({ ok: false, bytes: 0 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const contentLength = res.headers.get('content-length');

      // Si el servidor informa el tamaño, no necesitamos descargarlo
      if (contentLength) {
        const size = Number(contentLength);

        if (!Number.isFinite(size) || size < 0 || size > MAX_SIZE) {
          return new Response(JSON.stringify({ ok: false, bytes: 0 }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        return new Response(JSON.stringify({ ok: true, bytes: size }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
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
        return new Response(JSON.stringify({ ok: false, bytes: 0 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const buf = await resGet.arrayBuffer();

      if (buf.byteLength > MAX_SIZE) {
        return new Response(JSON.stringify({ ok: false, bytes: 0 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({ ok: true, bytes: buf.byteLength }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch {
      return new Response(JSON.stringify({ ok: false, bytes: 0 }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
