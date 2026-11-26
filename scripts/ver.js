const TMDB_API_KEY = "2e33599c8f4125cdb44029031486d35f";
const MODO_DIAGNOSTICO_REPRODUCTOR = false;
const esDesarrollo = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
const debugLog = (esDesarrollo || MODO_DIAGNOSTICO_REPRODUCTOR) ? console.log.bind(console) : () => {};

// Petición TMDB compartida: construye la URL, registra la llamada en
// desarrollo y devuelve el JSON. Lanza error si la API responde !ok.
async function consultarTMDB(ruta, parametros) {
  const url = new URL(`https://api.themoviedb.org/3/${ruta}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  for (const [clave, valor] of Object.entries(parametros)) {
    url.searchParams.set(clave, valor);
  }

  debugLog(`[Vidrift] Petición TMDB ${ruta}`, url.toString());
  const respuesta = await fetch(url, {
    headers: { accept: "application/json" }
  });

  if (!respuesta.ok) {
    throw new Error(`Error TMDB ${ruta}: ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  debugLog(`[Vidrift] Respuesta TMDB ${ruta}`, datos.results ?? datos);
  return datos;
}

// Búsqueda en series/anime (endpoint /search/tv).
async function buscarAnimeTMDB(titulo) {
  const datos = await consultarTMDB("search/tv", { query: titulo });
  return (datos.results || []).map(anime => ({
    id: anime.id,
    titulo: anime.name,
    tituloOriginal: anime.original_name,
    fecha: anime.first_air_date,
    popularidad: anime.popularity,
    mediaType: "tv"
  }));
}

// Respaldo global: /search/multi cubre series y películas. Solo interesan
// esos dos tipos; se descartan personas y colecciones.
async function buscarTMDBGlobal(titulo) {
  const datos = await consultarTMDB("search/multi", { query: titulo });
  return (datos.results || [])
    .filter(item => item.media_type === "tv" || item.media_type === "movie")
    .map(item => ({
      id: item.id,
      titulo: item.title || item.name,
      tituloOriginal: item.original_title || item.original_name,
      fecha: item.release_date || item.first_air_date,
      popularidad: item.popularity,
      mediaType: item.media_type
    }));
}

function quitarSufijoTemporada(titulo) {
  return String(titulo || "")
    .replace(/(?:\s|-)\d+(?:st|nd|rd|th)[\s-]+season\b.*$/i, "")
    .replace(/(?:\s|-)(?:season|temporada)[\s-]*\d+\b.*$/i, "")
    .replace(/(?:\s|-)(?:second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|primera|segunda|tercera|cuarta|quinta|sexta|séptima|septima|octava|novena|décima|decima)[\s-]+(?:season|temporada)\b.*$/i, "")
    .replace(/(?:\s|-)dai[\s-]+\d+[\s-]+ki\b.*$/i, "")
    .replace(/(?:\s|-)r\d+\b.*$/i, "")
    .replace(/[\s-]+(?:season|temporada)[\s-]*(?:i{1,3}|iv|vi{0,3}|ix|x)\b.*$/i, "")
    .replace(/[\s-]+(?:i{1,3}|iv|vi{0,3}|ix|x)[\s-]*$/i, "")
    .replace(/[\s-]+$/, "")
    .trim();
}

function normalizarNombre(nombre) {
  return String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[^a-z0-9]/g, "") // Solo letras y números
    .trim();
}

// Prueba primero /search/tv con el título y su variante sin temporada; si
// ninguna devuelve nada, repite con /search/multi (series + películas).
// Las consultas de cada etapa van en paralelo y una petición fallida no
// arrastra a las demás.
async function buscarAnimeTMDBConRespaldo(titulo) {
  const tituloBase = quitarSufijoTemporada(titulo);
  const consultas = [...new Set([titulo, tituloBase].filter(Boolean))];
  const tolerante = fn => consulta => fn(consulta).catch(() => []);

  const series = await Promise.all(
    consultas.map(tolerante(async consulta => {
      const resultados = await buscarAnimeTMDB(consulta);
      debugLog("[Vidrift] Consulta TMDB", { consulta, resultados });
      return resultados;
    }))
  );
  const resultadoTv = series.find(resultados => resultados.length);
  if (resultadoTv) return resultadoTv;

  const globales = await Promise.all(
    consultas.map(tolerante(async consulta => {
      const resultados = await buscarTMDBGlobal(consulta);
      debugLog("[Vidrift] Consulta TMDB global", { consulta, resultados });
      return resultados;
    }))
  );

  return globales.find(resultados => resultados.length) || [];
}

function detectarTemporadaDesdeAnimeId(id) {
  const slug = String(id || "").toLowerCase();
  const ordinales = {
    first: 1, primera: 1, primer: 1,
    second: 2, segunda: 2, segundo: 2,
    third: 3, tercera: 3, tercero: 3,
    fourth: 4, cuarta: 4, cuarto: 4,
    fifth: 5, quinta: 5, quinto: 5,
    sixth: 6, sexta: 6, sexto: 6,
    seventh: 7, septima: 7, séptima: 7,
    eighth: 8, octava: 8, octavo: 8,
    ninth: 9, novena: 9, noveno: 9,
    tenth: 10, decima: 10, décima: 10
  };
  const romanos = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5,
    vi: 6, vii: 7, viii: 8, ix: 9, x: 10
  };
  const patrones = [
    /(?:^|-)(\d+)(?:st|nd|rd|th)-(?:season|temporada)(?:-|$)/,
    /(?:^|-)(?:season|temporada)-(\d+)(?:-|$)/,
    /(?:^|-)(\d+)-(?:season|temporada)(?:-|$)/,
    /(?:^|-)(?:s|t)-(\d+)(?:-|$)/,
    /(?:^|-)(?:s|t)(\d+)(?:-|$)/,
    /(?:^|-)(?:season|temporada)(\d+)(?:-|$)/,
    /(?:^|-)dai-(\d+)-ki(?:-|$)/,
    /-r(\d+)(?:-|$)/,
    /(?:^|-)r(\d+)(?:-|$)/
  ];

  for (const patron of patrones) {
    const coincidencia = slug.match(patron);
    const temporada = Number(coincidencia?.[1]);
    if (Number.isInteger(temporada) && temporada > 0) return temporada;
  }

  const marcadorOrdinal = slug.match(/(?:^|-)(first|primera|primer|second|segunda|segundo|third|tercera|tercero|fourth|cuarta|cuarto|fifth|quinta|quinto|sixth|sexta|sexto|seventh|septima|séptima|eighth|octava|octavo|ninth|novena|noveno|tenth|decima|décima)-(?:season|temporada)(?:-|$)/)
    || slug.match(/(?:^|-)(?:season|temporada)-(first|primera|primer|second|segunda|segundo|third|tercera|tercero|fourth|cuarta|cuarto|fifth|quinta|quinto|sixth|sexta|sexto|seventh|septima|séptima|eighth|octava|octavo|ninth|novena|noveno|tenth|decima|décima)(?:-|$)/);
  if (marcadorOrdinal) return ordinales[marcadorOrdinal[1]];

  const marcadorRomano = slug.match(/(?:^|-)(?:season|temporada)-(i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:-|$)/)
    || slug.match(/(?:^|-)(i|ii|iii|iv|v|vi|vii|viii|ix|x)-(?:season|temporada)(?:-|$)/)
    || slug.match(/(?:^|-)(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/);
  if (marcadorRomano) return romanos[marcadorRomano[1]];

  return 1;
}

const cacheVerificacionTemporada = new Map();

async function verificarTemporadaTMDB(tmdbId, temporada) {
  const clave = `${tmdbId}:${temporada}`;
  if (cacheVerificacionTemporada.has(clave)) {
    return cacheVerificacionTemporada.get(clave);
  }

  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${temporada}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");

  try {
    const respuesta = await fetch(url, { headers: { accept: "application/json" } });
    if (!respuesta.ok) {
      cacheVerificacionTemporada.set(clave, false);
      return false;
    }

    const datos = await respuesta.json();
    const existe = Number(datos.season_number) === temporada;
    cacheVerificacionTemporada.set(clave, existe);
    return existe;
  } catch {
    return false;
  }
}

async function resolverTemporadaVidrift(tmdbId, temporadaGuardada) {
  const temporadaDetectada = await resolverTemporadaEfectivaSlug();
  const temporadaManual = Number(temporadaGuardada);
  const temporadaGuardadaValida = Number.isInteger(temporadaManual) && temporadaManual > 0;
  const tieneSufijoTemporada = temporadaDetectada !== 1;

  if (temporadaGuardadaValida && (!tieneSufijoTemporada || temporadaManual === temporadaDetectada)) {
    debugLog("[Vidrift] Temporada recuperada de Firestore", { animeId, tmdbId, temporada: temporadaManual });
    return temporadaManual;
  }

  debugLog("[Vidrift] Temporada detectada desde el slug", { animeId, tmdbId, temporada: temporadaDetectada });

  const existe = await verificarTemporadaTMDB(tmdbId, temporadaDetectada);
  if (!existe) {
    // La web puede repartir en varias temporadas lo que TMDB/Vidrift une en
    // una sola (Jujutsu Kaisen: 3 temporadas aquí, 1 de 59 caps en TMDB).
    // Si la temporada del slug no existe en TMDB, se reproduce desde la
    // temporada 1 sumando los capítulos de las temporadas anteriores.
    if (temporadaDetectada > 1) {
      const offset = await resolverOffsetTemporadaMultiTmdb();
      if (offset !== null) {
        debugLog("[Vidrift] Temporada ausente en TMDB; se usa la temporada base con offset", {
          animeId, tmdbId, temporada: temporadaDetectada, offset
        });
        return 1;
      }
    }
    debugLog("[Vidrift] La temporada detectada no existe en TMDB", { animeId, tmdbId, temporada: temporadaDetectada });
    return temporadaGuardadaValida ? temporadaManual : null;
  }

  debugLog("[Vidrift] Temporada confirmada por TMDB", { animeId, tmdbId, temporada: temporadaDetectada });
  return temporadaDetectada;
}

// --- Temporadas repartidas en la web pero unificadas en TMDB/Vidrift ---
// Algunas series están divididas en varias temporadas en la página pero
// TMDB/Vidrift las trata como una sola (Jujutsu Kaisen: 3 temporadas aquí,
// 1 temporada de 59 caps en TMDB). Cuando la temporada del slug no existe
// en TMDB se reproduce desde la temporada 1 sumando los capítulos de las
// temporadas anteriores: la temporada N, capítulo E local pasa a ser el
// capítulo E + (caps de las temporadas 1..N-1) dentro de la temporada TMDB.

// Capítulos extra que hay que sumar al número de episodio local para
// obtener el episodio real dentro de la temporada unificada de TMDB.
let episodioOffsetTemporadaVidrift = 0;
let promesaOffsetTemporada = null;
const cacheAnimeApi = new Map();

async function consultarAnimeApi(slug) {
  const clave = String(slug || "");
  if (cacheAnimeApi.has(clave)) return cacheAnimeApi.get(clave);

  const promesa = (async () => {
    try {
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${encodeURIComponent(clave)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  cacheAnimeApi.set(clave, promesa);
  return promesa;
}

const PALABRAS_ORDINAL_TEMPORADA = "first|primera|primer|second|segunda|segundo|third|tercera|tercero|fourth|cuarta|cuarto|fifth|quinta|quinto|sixth|sexta|sexto|seventh|septima|séptima|eighth|octava|octavo|ninth|novena|noveno|tenth|decima|décima";

// Quita el marcador de temporada del final del slug para obtener el anime
// base ("jujutsu-kaisen-2nd-season" -> "jujutsu-kaisen").
function obtenerSlugBaseDeTemporada(id) {
  const slug = String(id || "");
  const patrones = [
    /-\d+(?:st|nd|rd|th)-(?:season|temporada)$/i,
    /-(?:season|temporada)-\d+$/i,
    /-\d+-(?:season|temporada)$/i,
    /-(?:s|t)-\d+$/i,
    /-(?:s|t)\d+$/i,
    /-(?:season|temporada)\d+$/i,
    /-dai-\d+-ki$/i,
    /-r\d+$/i,
    new RegExp(`-(?:${PALABRAS_ORDINAL_TEMPORADA})-(?:season|temporada)$`, "i"),
    new RegExp(`-(?:season|temporada)-(?:${PALABRAS_ORDINAL_TEMPORADA})$`, "i"),
    /-(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i
  ];

  for (const patron of patrones) {
    const base = slug.replace(patron, "");
    if (base && base !== slug) return base;
  }
  return slug;
}

const ORDENES_TEMPORADA_POR_NUMERO = {
  1: ["first", "primera", "primer"],
  2: ["second", "segunda", "segundo"],
  3: ["third", "tercera", "tercero"],
  4: ["fourth", "cuarta", "cuarto"],
  5: ["fifth", "quinta", "quinto"],
  6: ["sixth", "sexta", "sexto"],
  7: ["seventh", "septima", "séptima"],
  8: ["eighth", "octava", "octavo"],
  9: ["ninth", "novena", "noveno"],
  10: ["tenth", "decima", "décima"]
};

function sufijoOrdinalNumero(numero) {
  if (numero === 1) return "1st";
  if (numero === 2) return "2nd";
  if (numero === 3) return "3rd";
  return `${numero}th`;
}

// Genera los slugs candidatos para una temporada intermedia a partir del
// slug base, cubriendo las convenciones más usadas (2nd-season, season-2,
// segunda-temporada, etc.). Se prueban en orden hasta que la API responda.
function generarCandidatosSlugTemporada(slugBase, temporada) {
  const candidatos = [
    `${slugBase}-${sufijoOrdinalNumero(temporada)}-season`,
    `${slugBase}-season-${temporada}`,
    `${slugBase}-${temporada}-season`,
    `${slugBase}-${temporada}-temporada`,
    `${slugBase}-temporada-${temporada}`,
    `${slugBase}-season${temporada}`,
    `${slugBase}-t${temporada}`,
    `${slugBase}-s${temporada}`
  ];

  for (const palabra of ORDENES_TEMPORADA_POR_NUMERO[temporada] || []) {
    candidatos.push(
      `${slugBase}-${palabra}-season`,
      `${slugBase}-season-${palabra}`,
      `${slugBase}-${palabra}-temporada`,
      `${slugBase}-temporada-${palabra}`
    );
  }

  return [...new Set(candidatos)].filter(slug => slug && slug !== slugBase);
}

// Dos slugs pertenecen a la misma serie si comparten el slug base o uno es
// prefijo del otro. Esto evita mezclar spin-offs o series sin relación que
// aparezcan en el campo relations de la API.
function mismaSerieSlugs(slugA, slugB) {
  const baseA = obtenerSlugBaseDeTemporada(slugA);
  const baseB = obtenerSlugBaseDeTemporada(slugB);
  const esPrefijo = (x, y) => x === y || x.startsWith(`${y}-`) || y.startsWith(`${x}-`);
  return esPrefijo(slugA, slugB) || esPrefijo(baseA, baseB) || esPrefijo(slugA, baseB) || esPrefijo(baseA, slugB);
}

// Solo las entradas de TV cuentan como temporadas: las películas, OVAs y
// especiales quedan fuera aunque compartan la misma serie.
function esTemporadaTvAnime(data) {
  const categoria = String(data?.category || "").toLowerCase();
  if (!categoria) return true;
  return !/(pel[ií]cula|movie|film|ova|ona|especial|special|short|recap|recuento)/.test(categoria);
}

let promesaCadenaTemporadas = null;

// Recorre el campo relations de la API (BFS acotado) y devuelve las
// temporadas de TV de la serie ordenadas por startDate. A diferencia del
// marcador del slug, esto también reconoce temporadas con nombre propio
// (p. ej. "jujutsu-kaisen-shimetsu-kaiyuu-zenpen" = temporada 3).
async function obtenerCadenaTemporadasTv() {
  if (!promesaCadenaTemporadas) {
    promesaCadenaTemporadas = (async () => {
      const visitados = new Set();
      const cola = [animeId];
      const encontrados = new Map();

      while (cola.length && visitados.size < 20) {
        const slug = cola.shift();
        if (visitados.has(slug)) continue;
        visitados.add(slug);

        const datos = await consultarAnimeApi(slug);
        if (!datos) continue;

        const episodios = Array.isArray(datos.episodes) ? datos.episodes.length : 0;
        encontrados.set(slug, {
          slug,
          episodios,
          startDate: datos.startDate || "",
          esTv: esTemporadaTvAnime(datos)
        });

        for (const rel of datos.relations || []) {
          const relSlug = typeof rel?.slug === "string" ? rel.slug : "";
          if (relSlug && !visitados.has(relSlug) && mismaSerieSlugs(animeId, relSlug)) {
            cola.push(relSlug);
          }
        }
      }

      return [...encontrados.values()]
        .filter(nodo => nodo.esTv && nodo.episodios > 0)
        .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) || a.slug.localeCompare(b.slug));
    })();
  }
  return promesaCadenaTemporadas;
}

let promesaTemporadaEfectiva = null;

// Número de temporada real dentro de la serie: el marcador del slug si lo
// tiene; si no, la posición en la cadena de relations de la API (una
// temporada con nombre propio también cuenta). Devuelve 1 cuando el slug
// es la primera temporada o una serie suelta.
async function resolverTemporadaEfectivaSlug() {
  const detectada = detectarTemporadaDesdeAnimeId(animeId);
  if (detectada > 1) return detectada;
  if (!promesaTemporadaEfectiva) {
    promesaTemporadaEfectiva = (async () => {
      const datos = await consultarAnimeApi(animeId);
      const relaciones = Array.isArray(datos?.relations) ? datos.relations : [];
      if (!relaciones.length) return detectada;

      const nodos = await obtenerCadenaTemporadasTv();
      const posicion = nodos.findIndex(nodo => nodo.slug === animeId);
      // La posición solo cuenta como temporada si la serie usa marcadores
      // reales: sin ellos, un spin-off con subtítulo propio
      // ("dragon-ball-super-beerus") no es una temporada de la serie base.
      const hayMarcadoresTemporada = nodos.some(nodo =>
        nodo.slug !== animeId && obtenerSlugBaseDeTemporada(nodo.slug) !== nodo.slug
      );
      return posicion > 0 && hayMarcadoresTemporada ? posicion + 1 : detectada;
    })();
  }
  return promesaTemporadaEfectiva;
}

// Suma los capítulos de las temporadas 1..N-1 del slug actual usando solo
// la API del backend. Devuelve null si no se puede determinar (así el
// caller conserva el fallo anterior en vez de reproducir un episodio
// equivocado).
async function resolverOffsetTemporadaMultiTmdb() {
  const temporada = await resolverTemporadaEfectivaSlug();
  if (temporada <= 1) {
    episodioOffsetTemporadaVidrift = 0;
    return 0;
  }
  if (!promesaOffsetTemporada) {
    promesaOffsetTemporada = (async () => {
      // Camino principal: la cadena de relations ordena las temporadas
      // reales de la serie, incluidas las que no tienen marcador en el
      // slug. El offset es la suma de capítulos de las temporadas
      // anteriores a la actual.
      const nodos = await obtenerCadenaTemporadasTv();
      const posicion = nodos.findIndex(nodo => nodo.slug === animeId);
      if (posicion > 0) {
        const total = nodos.slice(0, posicion).reduce((acc, nodo) => acc + nodo.episodios, 0);
        episodioOffsetTemporadaVidrift = total;
        debugLog("[Vidrift] Temporada unificada en TMDB (cadena de relations)", {
          animeId, temporada, offset: total
        });
        return total;
      }

      // Respaldo: marcador de temporada en el slug + slugs candidatos.
      const slugBase = obtenerSlugBaseDeTemporada(animeId);
      let total = 0;

      // Temporada 1: el anime base sin sufijo de temporada.
      const datosBase = await consultarAnimeApi(slugBase);
      const capsBase = Array.isArray(datosBase?.episodes) ? datosBase.episodes.length : 0;
      if (!capsBase) {
        debugLog("[Vidrift] Sin episodios para la temporada base", { animeId, slugBase });
        return null;
      }
      total += capsBase;

      // Temporadas intermedias: 2..temporada-1. Se prueban los slugs
      // candidatos generados a partir del slug base hasta que la API
      // devuelva una temporada con episodios.
      for (let k = 2; k < temporada; k++) {
        let caps = 0;
        for (const candidato of generarCandidatosSlugTemporada(slugBase, k)) {
          const datos = await consultarAnimeApi(candidato);
          caps = Array.isArray(datos?.episodes) ? datos.episodes.length : 0;
          if (caps) break;
        }

        if (!caps) {
          debugLog("[Vidrift] No se pudo resolver la temporada intermedia", {
            animeId, slugBase, temporada: k
          });
          return null;
        }
        total += caps;
      }

      episodioOffsetTemporadaVidrift = total;
      debugLog("[Vidrift] Temporada unificada en TMDB", { animeId, temporada, offset: total });
      return total;
    })();
  }
  return promesaOffsetTemporada;
}

async function seleccionarResultadoTMDBParaVidrift(resultados) {
  debugLog("[Vidrift] Seleccionando resultado TMDB", { animeId, resultadosCount: resultados.length });
  const temporadaDetectada = await resolverTemporadaEfectivaSlug();

  // Las verificaciones son independientes: en paralelo el camino "frío"
  // (sin caché TMDB) tarda una sola llamada a TMDB en vez de una por resultado.
  // Las películas no tienen temporadas: se aceptan directamente.
  const intentarConTemporada = async (temporada) => {
    const comprobaciones = await Promise.all(resultados.map(async resultado => {
      const esPelicula = resultado.mediaType === "movie";
      const existe = esPelicula || await verificarTemporadaTMDB(resultado.id, temporada);
      debugLog("[Vidrift] Comprobando resultado TMDB para la temporada", {
        tmdbId: resultado.id,
        titulo: resultado.titulo,
        tituloOriginal: resultado.tituloOriginal,
        temporada,
        existe
      });
      return existe
        ? { ...resultado, tmdbId: resultado.id, tmdbSeason: esPelicula ? 1 : temporada }
        : null;
    }));
    const resultadosValidos = comprobaciones.filter(Boolean);

    if (resultadosValidos.length === 0) return null;

    // Agrupar por nombre normalizado
    const gruposPorNombre = new Map();
    for (const resultado of resultadosValidos) {
      const nombreNormalizado = normalizarNombre(resultado.titulo);
      if (!gruposPorNombre.has(nombreNormalizado)) {
        gruposPorNombre.set(nombreNormalizado, []);
      }
      gruposPorNombre.get(nombreNormalizado).push(resultado);
    }

    // Si hay grupos con múltiples resultados del mismo nombre, elegir el más popular de cada grupo
    const mejoresDeCadaGrupo = [];
    for (const [nombre, grupo] of gruposPorNombre) {
      if (grupo.length > 1) {
        // Ordenar por popularidad descendente y tomar el primero
        grupo.sort((a, b) => (b.popularidad || 0) - (a.popularidad || 0));
        debugLog("[Vidrift] Múltiples resultados con mismo nombre, eligiendo el más popular", {
          nombre,
          cantidad: grupo.length,
          seleccionado: grupo[0]
        });
      }
      mejoresDeCadaGrupo.push(grupo[0]);
    }

    // Retornar el primero de los mejores (o el único si no hubo agrupación)
    return { tmdbId: mejoresDeCadaGrupo[0].tmdbId, tmdbSeason: mejoresDeCadaGrupo[0].tmdbSeason, resultado: mejoresDeCadaGrupo[0] };
  };

  let seleccion = await intentarConTemporada(temporadaDetectada);

  // Serie repartida en varias temporadas en la web pero unificada en TMDB:
  // si ningún resultado contiene la temporada del slug, se reintenta con
  // la temporada 1 y los capítulos se reproducen con el offset acumulado.
  if (!seleccion && temporadaDetectada > 1) {
    const offset = await resolverOffsetTemporadaMultiTmdb();
    if (offset !== null) {
      seleccion = await intentarConTemporada(1);
      if (seleccion) {
        debugLog("[Vidrift] Temporada no existe en TMDB; se usa la temporada base con offset", {
          animeId,
          temporada: temporadaDetectada,
          offset
        });
      }
    }
  }

  return seleccion;
}

const params = new URLSearchParams(location.search);
const animeId = params.get("id");
const episodeNumber = params.get("episode");
const serversParam = params.get("servers"); // "sub" o "dob"

// Algunos proveedores pueden forzar una navegación del documento superior. El
// navegador limpia la consola en ese caso, así que conservamos el último salto
// durante unos segundos y lo restauramos tras la recarga para diagnosticarlo.
const CLAVE_ULTIMO_SALTO_SERVIDOR = "anizen:ultimo-salto-servidor";
try {
  const saltoPendiente = sessionStorage.getItem(CLAVE_ULTIMO_SALTO_SERVIDOR);
  if (saltoPendiente) {
    sessionStorage.removeItem(CLAVE_ULTIMO_SALTO_SERVIDOR);
  }
} catch {
  // sessionStorage puede no estar disponible en navegadores con privacidad estricta.
}

function registrarCambioAutomaticoServidor(detalles) {
  try {
    sessionStorage.setItem(CLAVE_ULTIMO_SALTO_SERVIDOR, JSON.stringify({
      ...detalles,
      fecha: new Date().toISOString()
    }));
    setTimeout(() => sessionStorage.removeItem(CLAVE_ULTIMO_SALTO_SERVIDOR), 15000);
  } catch {
    // No se puede persistir
  }
}

function cancelarFallbackDeCarga() {
  if (loadingTimeout) clearTimeout(loadingTimeout);
  loadingTimeout = null;
}

function programarFallbackDeCarga(reproduccionId, demora, motivo) {
  cancelarFallbackDeCarga();
  loadingTimeout = setTimeout(() => {
    if (reproduccionId === reproduccionActualId) {
      intentarSiguienteServidor(reproduccionId, motivo);
    }
  }, demora);
}

function mostrarEstadoDeServidores(mensaje, limpiarControles = false) {
  videoContenedorGlobal.innerHTML = `<p class='span-carga'>${mensaje}</p>`;
  if (limpiarControles) document.getElementById("controles").innerHTML = "";
}

function ejecutarEnSegundoPlano(promesa, contexto) {
  Promise.resolve(promesa).catch(error => debugLog(`${contexto}:`, error));
}
const btnVolverAnime = document.getElementById("btn-volver-anime");
if (btnVolverAnime && animeId) {
  btnVolverAnime.href = `/anime?id=${encodeURIComponent(animeId)}`;
}

// Leer preferencia de servidores de localStorage
const serversPreference = localStorage.getItem("serverPreference");

document.title = animeId
  ? "AniZen - " + animeId.replaceAll("-", " ") + " - " + (episodeNumber || "")
  : "AniZen";

const btnSiguiente = document.getElementById("btn-siguiente-episodio");
const btnAnterior = document.getElementById("btn-anterior-episodio");
const btnSelectorCapitulo = document.getElementById("btn-selector-episodio");
const dropdownCapitulos = document.getElementById("dropdown-capitulos");
const textoAnterior = document.getElementById("texto-anterior");
const textoSiguiente = document.getElementById("texto-siguiente");
const textoSelectorEpisodio = document.getElementById("texto-selector-episodio");
const videoContenedorGlobal = document.getElementById("video");

// Variable global para capítulos vistos (compartida con refrescarUIEstadoCapitulo)
let capitulosVistosGlobales = [];
// Usuario para el que se cargó capitulosVistosGlobales: si cambia la sesión
// en la misma página, la caché se descarta y se vuelve a leer una vez.
let capitulosVistosCargadosPara = null;

// Lee el documento caps-vistos una sola vez por usuario/página. Antes cada
// salto de capítulo hacía 2 getDoc (toggle + refrescarUI) sobre el mismo doc.
// La promesa compartida evita lecturas dobles si dos consumidores la piden
// antes de que termine la primera.
let promesaCapitulosVistos = null;
async function asegurarCapitulosVistos(user) {
  if (capitulosVistosCargadosPara !== user) {
    if (!promesaCapitulosVistos) {
      promesaCapitulosVistos = (async () => {
        const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
        const docSnap = await getDoc(animeRef);
        capitulosVistosGlobales = docSnap.exists() ? docSnap.data().episodiosVistos || [] : [];
        capitulosVistosCargadosPara = user;
      })().finally(() => { promesaCapitulosVistos = null; });
    }
    await promesaCapitulosVistos;
  }
  return capitulosVistosGlobales;
}

// Cache del dropdown generado para evitar regeneraciones innecesarias
let dropdownGenerado = false;

let episodios = [];
// false mientras la lista de episodios no haya llegado de Firestore/API: en
// ese caso cargarVideoDesdeEpisodio puede arrancar Vidrift con un episodio
// mínimo { number } en vez de esperar o consultar la API de episodios.
let episodiosCargados = false;
// true cuando cargarEpisodios() terminó (con o sin episodios). Sirve para
// no ocultar la barra de navegación durante la carga inicial: sin esto la
// barra se esconde y reaparece en cada visita (parpadeo).
let episodiosCargaTerminada = false;
let tituloAnime = (animeId || "").replaceAll("-", " ");
let portadaAnime = '';
let episodioActualIndex = Number.parseInt(episodeNumber, 10);
// Algunas series incluyen el episodio 0 (especial, prólogo, etc.).
if (!Number.isInteger(episodioActualIndex) || episodioActualIndex < 0) {
  episodioActualIndex = 1;
}
let embeds = [];
let bloquearAnuncios = localStorage.getItem("bloquearAnuncios") !== "false";
// Esta preferencia se lee al abrir el reproductor. Vidrift recibe los
// parámetros correspondientes al crear el iframe.
let modoMaratonActivo = localStorage.getItem("modoMaraton") === "true";
// Prioridad: parámetro URL > preferencia localStorage > default (sub)
let preferenciaDoblado = serversParam === "dob" || (serversParam === null && serversPreference === "dob");
// Puede cambiar temporalmente si un episodio solo tiene enlaces en el otro
// idioma; no usarlo como preferencia del usuario dentro de Vidrift.
let modoDoblado = preferenciaDoblado;
let servidorActualIndex = 0;
let loadingTimeout = null;
// Identifica la carga activa para que un timeout/error tardío de un servidor
// anterior no cambie el servidor que el usuario ya seleccionó.
let reproduccionActualId = 0;
let limpiarPreferenciaSubtitulos = null;
let ventanaVidriftActiva = null;
let cambioEpisodioVidriftEnCurso = false;
let saltoOutroVidriftEnCurso = false;
let cacheTmdbVidrift = null;
let promesaTmdbVidrift = null;
let firestoreTmdbConsultado = false;
let documentoAnimeCache = undefined;

const CACHE_TTL = 5 * 60 * 1000;
const serverCache = new Map();
let firestoreEnPausaPorCuota = false;

// --- Caché persistida de la asociación TMDB de Vidrift ---
// La resolución (Firestore/TMDB/relations de la API) solo hace falta una
// vez por anime: el resultado se guarda en localStorage y las siguientes
// visitas o cambios de capítulo lo usan sin volver a preguntar a la API.
// `confiable` marca que viene de esta caché: como animeId y la temporada
// efectiva son fijos por página, se puede usar sin revalidar la temporada.
const CLAVE_CACHE_VIDRIFT = animeId ? `vidrift:tmdb:${animeId}` : null;
const CACHE_VIDRIFT_TTL = 7 * 24 * 60 * 60 * 1000;

function persistirCacheTmdbVidrift() {
  if (!CLAVE_CACHE_VIDRIFT || !cacheTmdbVidrift?.tmdbId) return;
  try {
    localStorage.setItem(CLAVE_CACHE_VIDRIFT, JSON.stringify({
      tmdbId: cacheTmdbVidrift.tmdbId,
      tmdbSeason: cacheTmdbVidrift.tmdbSeason,
      mediaType: cacheTmdbVidrift.mediaType,
      temporadaEfectiva: cacheTmdbVidrift.temporadaEfectiva,
      offsetEpisodio: cacheTmdbVidrift.offsetEpisodio,
      tipoVerificado: cacheTmdbVidrift.tipoVerificado === true,
      guardadoEn: Date.now()
    }));
  } catch {
    // localStorage puede no estar disponible; la caché en memoria sigue.
  }
}

function cargarCacheTmdbVidriftPersistida() {
  if (!CLAVE_CACHE_VIDRIFT) return;
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_CACHE_VIDRIFT) || "null");
    if (!datos?.tmdbId || !datos.tmdbSeason) return;
    if (Date.now() - (Number(datos.guardadoEn) || 0) > CACHE_VIDRIFT_TTL) {
      localStorage.removeItem(CLAVE_CACHE_VIDRIFT);
      return;
    }
    cacheTmdbVidrift = {
      animeId,
      tmdbId: datos.tmdbId,
      tmdbSeason: Number(datos.tmdbSeason) || 1,
      mediaType: datos.mediaType === "movie" ? "movie" : "tv",
      temporadaEfectiva: datos.temporadaEfectiva ?? null,
      offsetEpisodio: Number(datos.offsetEpisodio) || 0,
      tipoVerificado: datos.tipoVerificado === true,
      confiable: true
    };
    episodioOffsetTemporadaVidrift = cacheTmdbVidrift.offsetEpisodio;
    // debugLog("[Vidrift] Asociación TMDB restaurada desde caché local", {
    //   animeId,
    //   tmdbId: cacheTmdbVidrift.tmdbId,
    //   temporada: cacheTmdbVidrift.tmdbSeason,
    //   offset: cacheTmdbVidrift.offsetEpisodio
    // });
  } catch {
    // JSON corrupto o storage no disponible: se resuelve por la vía normal.
  }
}

cargarCacheTmdbVidriftPersistida();
let avisoCuotaMostrado = false;

function esErrorDeCuotaFirestore(error) {
  return error?.code === "resource-exhausted" || error?.code === "quota-exceeded";
}

function activarModoApiDirecta(error) {
  if (!esErrorDeCuotaFirestore(error)) return false;

  firestoreEnPausaPorCuota = true;
  if (!avisoCuotaMostrado) {

    avisoCuotaMostrado = true;
  }
  return true;
}

const btnBloquear = document.getElementById("btn-bloquear-anuncios");

// Función helper simple para obtener el número de capítulo
function getNumeroCapitulo(episodio, index) {
  if (episodio && typeof episodio === 'object' && 'number' in episodio) {
    // Convertir a número para evitar problemas de comparación string vs number
    return parseInt(episodio.number, 10);
  }
  // Para arrays simples: detectar si el primer capítulo es 0
  if (episodios.length > 0 && episodios[0] === 0) {
    return index;
  }
  return index + 1;
}

// Posición del episodio dentro de la lista. La navegación (siguiente,
// anterior y maratón) usa la posición y no `number ± 1`, así tolera
// especiales y saltos de numeración (ej. 12 -> 14 sin 13).
function obtenerPosicionEpisodio(numeroEpisodio) {
  const buscado = String(numeroEpisodio);
  let pos = episodios.findIndex(ep => String(ep.number) === buscado);
  if (pos === -1) {
    const num = parseInt(numeroEpisodio, 10);
    pos = episodios.findIndex((ep, idx) => getNumeroCapitulo(ep, idx) === num);
  }
  return pos;
}

// Funciones globales para el selector de capítulos
function generarDropdownCapitulos() {
  if (!dropdownCapitulos || !episodios || episodios.length === 0) return;
  
  if (dropdownGenerado) {
    actualizarEstadoActivoDropdown();
    return;
  }
  
  dropdownCapitulos.innerHTML = "";
  
  const titulo = document.createElement("div");
  titulo.className = "dropdown-titulo";
  const textoTitulo = document.createElement("span");
  textoTitulo.textContent = "Seleccionar episodio";
  const contador = document.createElement("span");
  contador.id = "contador-dropdown";
  contador.className = "dropdown-contador";
  titulo.append(textoTitulo, contador);
  dropdownCapitulos.appendChild(titulo);
  
  const grid = document.createElement("div");
  grid.className = "dropdown-grid";
  
  const capitulosVistosSet = new Set(capitulosVistosGlobales);
  
  grid.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      const numCapitulo = parseInt(e.target.dataset.episode, 10);
      seleccionarCapitulo(numCapitulo);
    }
  });
  
  const fragment = document.createDocumentFragment();
  
  episodios.forEach((episodio, index) => {
    const btn = document.createElement("button");
    const numCapitulo = getNumeroCapitulo(episodio, index);
    btn.textContent = numCapitulo;
    btn.dataset.episode = numCapitulo;
    
    if (numCapitulo === episodioActualIndex) {
      btn.classList.add("activo");
    }
    
    if (capitulosVistosSet.has(String(numCapitulo))) {
      btn.classList.add("visto");
    }
    
    fragment.appendChild(btn);
  });
  
  grid.appendChild(fragment);
  dropdownCapitulos.appendChild(grid);
  dropdownGenerado = true;
}

// Función optimizada para actualizar solo el estado activo sin regenerar todo
function actualizarEstadoActivoDropdown() {
  const grid = dropdownCapitulos.querySelector('.dropdown-grid');
  if (!grid) return;
  
  const capitulosVistosSet = new Set(capitulosVistosGlobales);
  const botones = grid.querySelectorAll('button');
  
  botones.forEach(btn => {
    const numCapitulo = parseInt(btn.dataset.episode);
    btn.classList.toggle('activo', numCapitulo === episodioActualIndex);
    btn.classList.toggle('visto', capitulosVistosSet.has(String(numCapitulo)));
  });
}

function seleccionarCapitulo(numCapitulo) {
  if (numCapitulo === episodioActualIndex) return;
  
  // Actualizar estado
  episodioActualIndex = numCapitulo;
  
  // Actualizar URL sin recargar la página (incluyendo el modo actual)
  const newUrl = new URL(window.location);
  newUrl.searchParams.set("episode", numCapitulo);
  newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
  window.history.pushState({}, "", newUrl);
  
  // Cerrar dropdown inmediatamente
  if (dropdownCapitulos) {
    dropdownCapitulos.classList.add("oculto");
  }
  if (btnSelectorCapitulo) {
    btnSelectorCapitulo.classList.remove("open");
  }
  
  sincronizarUINavegacion();
  
  // Cargar el nuevo episodio (async, no bloquea UI)
  cargarVideoDesdeEpisodio(numCapitulo);
  
  // Refrescar estado de visto (async, no bloquea UI)
  refrescarUIEstadoCapitulo();
}

function actualizarNumeroCapitulo() {
  document.title = "AniZen - " + animeId + " - " + episodioActualIndex;
  const btnCapElement = document.getElementById("btn-cap");
  if (btnCapElement) {
    btnCapElement.textContent = `Episodio ${episodioActualIndex}`;
  }
  actualizarTextoBotonesNavegacion();
}

function actualizarTextoBotonesNavegacion() {
  const tieneEpisodios = Array.isArray(episodios) && episodios.length > 0;
  // Mientras la lista no haya terminado de cargar no se tocan los
  // textos: episodios=[] es "cargando", no "sin capítulos".
  if (!tieneEpisodios && !episodiosCargaTerminada) return;

  // Sin episodios no hay navegación: textos limpios y dropdown
  // cerrado. El estado desactivado de los botones lo maneja
  // actualizarEstadoBotones().
  if (!tieneEpisodios) {
    if (dropdownCapitulos) {
      dropdownCapitulos.classList.add("oculto");
      btnSelectorCapitulo?.classList.remove("open");
    }
    if (textoAnterior) textoAnterior.textContent = "";
    if (textoSiguiente) textoSiguiente.textContent = "";
    if (textoSelectorEpisodio) textoSelectorEpisodio.textContent = "Episodios";
    return;
  }

  // Misma posición que usa la navegación (botones y maratón): buscar por
  // `number - 1` asumía numeración correlativa y mostraba capítulos
  // equivocados en series con especiales o huecos en la numeración.
  const currentIndex = obtenerPosicionEpisodio(episodioActualIndex);

  // El texto del botón solo se muestra cuando existe el episodio
  // vecino; si no, queda vacío y el botón se ve desactivado.
  const hayAnterior = currentIndex > 0;
  const haySiguiente = currentIndex >= 0 && currentIndex < episodios.length - 1;

  if (textoAnterior && btnAnterior) {
    if (hayAnterior) {
      const epAnterior = episodios[currentIndex - 1];
      const numAnterior = getNumeroCapitulo(epAnterior, currentIndex - 1);
      textoAnterior.textContent = `EP ${numAnterior}`;
    } else {
      textoAnterior.textContent = "";
    }
  }

  if (textoSiguiente && btnSiguiente) {
    if (haySiguiente) {
      const epSiguiente = episodios[currentIndex + 1];
      const numSiguiente = getNumeroCapitulo(epSiguiente, currentIndex + 1);
      textoSiguiente.textContent = `EP ${numSiguiente}`;
    } else {
      textoSiguiente.textContent = "";
    }
  }

  if (textoSelectorEpisodio) {
    textoSelectorEpisodio.textContent = "Episodios";
  }

  // Contador "actual/total" junto al título del dropdown (si ya fue
  // generado; se genera la primera vez que se abre el selector).
  const contadorDropdown = document.getElementById("contador-dropdown");
  if (contadorDropdown) {
    const numActual = currentIndex >= 0 ? currentIndex + 1 : episodioActualIndex;
    contadorDropdown.textContent = `${numActual}/${episodios.length}`;
  }
}

// Unifica las cuatro actualizaciones de UI que se repetían tras cambiar
// de capítulo (selector, botones y dropdown).
function sincronizarUINavegacion() {
  requestAnimationFrame(() => {
    actualizarNumeroCapitulo();
    actualizarEstadoBotones();
    generarDropdownCapitulos();
    actualizarTextoBotonesNavegacion();
  });
}

// Funcionalidad del selector de capítulos
if (btnSelectorCapitulo && dropdownCapitulos) {
  // Toggle del dropdown
  btnSelectorCapitulo.addEventListener("click", (e) => {
    e.stopPropagation();
    // El dropdown se genera una sola vez: al abrirlo se repintan las clases
    // "visto"/"activo" desde capitulosVistosGlobales, que ya está en memoria.
    actualizarEstadoActivoDropdown();
    dropdownCapitulos.classList.toggle("oculto");
    btnSelectorCapitulo.classList.toggle("open");
  });

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!btnSelectorCapitulo.contains(e.target) && !dropdownCapitulos.contains(e.target)) {
      dropdownCapitulos.classList.add("oculto");
      btnSelectorCapitulo.classList.remove("open");
    }
  });
}


if (btnBloquear) {
  actualizarEstadoSwitch(btnBloquear, bloquearAnuncios);
}

btnBloquear?.addEventListener("click", () => {
  bloquearAnuncios = !bloquearAnuncios;
  localStorage.setItem("bloquearAnuncios", String(bloquearAnuncios));
  actualizarEstadoSwitch(btnBloquear, bloquearAnuncios);
  const servidorActivoBtn = document.querySelector("#controles .servidor-activo");
  if (embeds.length && servidorActivoBtn) {
    const botonesServidor = Array.from(document.querySelectorAll("#controles button"));
    const indiceServidorActivo = botonesServidor.indexOf(servidorActivoBtn);
    if (indiceServidorActivo !== -1) {
      mostrarVideo(embeds[indiceServidorActivo], servidorActivoBtn);
    }
  }
});
// Variable global para controlar el idioma

// Los controles de opciones son switches: .activo pinta el estado y
// aria-checked lo expone a lectores de pantalla.
function actualizarEstadoSwitch(btn, activo) {
  if (!btn) return;
  btn.classList.toggle("activo", activo);
  btn.setAttribute("aria-checked", String(activo));
}

// Evento para el botón de cambio de servidores
const btnCambioServers = document.getElementById("btn-cambio-servers");
if (btnCambioServers) {
  // La etiqueta es fija ("Doblado"): el switch ya indica el estado.
  // Si el botón arranca deshabilitado (aún no se sabe si hay doblado),
  // el switch no se pinta activo hasta que se confirme.
  actualizarEstadoSwitch(btnCambioServers, modoDoblado && !btnCambioServers.disabled);
  
  btnCambioServers.addEventListener("click", function() {
    modoDoblado = !modoDoblado;
    preferenciaDoblado = modoDoblado;
    actualizarEstadoSwitch(this, modoDoblado);
    
    // Guardar preferencia en localStorage
    localStorage.setItem("serverPreference", modoDoblado ? "dob" : "sub");
    
    // Actualizar URL con el nuevo modo
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
    window.history.pushState({}, "", newUrl);
    
    // Al cambiar de modo, recargamos la vista del episodio actual (usará caché, así que es instantáneo)
    if (typeof episodioActualIndex !== 'undefined' && episodioActualIndex !== null) {
      cargarVideoDesdeEpisodio(episodioActualIndex);
    }
  });
}

// Botón de modo maratón: misma preferencia que el toggle de preferencias.
// Solo recarga el episodio cuando Vidrift es el servidor activo, porque
// autoskip/autonext se envían como parámetros al crear su iframe.
const btnModoMaraton = document.getElementById("btn-modo-maraton");
if (btnModoMaraton) {
  actualizarEstadoSwitch(btnModoMaraton, modoMaratonActivo);

  btnModoMaraton.addEventListener("click", function() {
    modoMaratonActivo = !modoMaratonActivo;
    localStorage.setItem("modoMaraton", String(modoMaratonActivo));
    actualizarEstadoSwitch(this, modoMaratonActivo);

    const servidorActivo = embeds[servidorActualIndex];
    if (servidorActivo?.vidrift) {
      cargarVideoDesdeEpisodio(episodioActualIndex);
    }
  });
}

function actualizarEstadoBotonDoblado(servidores) {
  const btn = document.getElementById("btn-cambio-servers");
  if (!btn) return;

  // Lista vacía = render provisional solo-Vidrift: no hay datos
  // reales de servidores y no debe revertir la preferencia sub/dob.
  if (!servidores?.length) {
    // Mientras tanto, si el botón está deshabilitado el switch no debe
    // mostrar el estado activo (p. ej. preferencia "dob" aún sin confirmar).
    if (btn.disabled) actualizarEstadoSwitch(btn, false);
    return;
  }

  const tienedoblado = servidores.some(s => 
    (s.name || "").toLowerCase().includes("(lat)")
  );

  if (!tienedoblado) {
    btn.disabled = true;
    // Sin doblado el switch queda apagado aunque la preferencia diga "dob":
    // un toggle activo sobre un botón deshabilitado sería contradictorio.
    actualizarEstadoSwitch(btn, false);
    if (modoDoblado) {
      modoDoblado = false;
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("servers", "sub");
      window.history.replaceState({}, "", newUrl);
      // No guardar en localStorage en cambio automático
    }
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    actualizarEstadoSwitch(btn, modoDoblado);
  }
}

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, arrayUnion } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";
import { mostrarPildora, crearAnimeCard, observerAnimeCards, scrollFilaUnaTarjeta, scrollContenedorUnaTarjeta, attachWheelScrollHorizontal } from "./utils.js";
import { attachIaGridWheelScroll, loadIaRecommendationsIntoGrid, buildFavoritesAnimePrompt } from "./ai-recommendations.js";

// Inicialización de Firebase optimizada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

const btnCap = document.getElementById("btn-cap");
if (btnVolverAnime) btnVolverAnime.textContent = tituloAnime;
if (btnCap) btnCap.textContent = `Episodio ${episodioActualIndex}`;

// Inicializar el número del capítulo y los textos de navegación
actualizarNumeroCapitulo();

const btnEstadoCapitulo = document.getElementById("btn-estado-episodio");
const textoEstado = document.getElementById("texto-estado-episodio");
let toggleInProgress = false;

async function refrescarUIEstadoCapitulo() {
  const user = localStorage.getItem("userID");
  if (!user) {
    debugLog("No hay usuario autenticado; no se actualiza el estado del capítulo.");
    return;
  }

  let capitulosVistos;
  try {
    capitulosVistos = await asegurarCapitulosVistos(user);
  } catch (error) {
    debugLog("No se pudo leer el progreso de capítulos.", error);
    return;
  }

  if (!episodios || episodios.length === 0 || episodioActualIndex < 0 ) {
    debugLog("Lista de episodios no disponible o índice inválido.");
    return;
  }

  const episodioId = String(episodioActualIndex);
  const estaVisto = capitulosVistos.includes(episodioId);

  if (!btnEstadoCapitulo || !textoEstado) {
    debugLog("No se encontraron elementos de UI para el estado del capítulo.");
    return;
  }
  estaVisto ? btnEstadoCapitulo.classList.add("visto") : btnEstadoCapitulo.classList.remove("visto");
}

async function toggleYGuardarEstadoCapitulo() {
  if (toggleInProgress) {
    debugLog("Operación de capítulo en progreso; clic ignorado.");
    return;
  }
  const user = localStorage.getItem("userID");
  if (!user) {
    mostrarPildora("Inicia sesión para guardar tu progreso", "no-user",
      () => document.getElementById("confirm-login")?.click());
    return;
  }
  mostrarPildora("Actualizando...", "default");
  toggleInProgress = true;
  // Se captura antes del primer await: el salto automático de capítulo puede
  // ejecutar este guardado en paralelo con cargarVideoDesdeEpisodio, que
  // cambia episodioActualIndex. Sin la captura se marcaría el capítulo nuevo.
  const indiceCapitulo = episodioActualIndex;

  try {
    const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
    // Reutiliza la lectura cacheada: al marcar se usa arrayUnion y al quitar
    // se valida el estado más reciente dentro de una transacción.
    const episodiosVistos = await asegurarCapitulosVistos(user);

    if (!episodios || episodios.length === 0 || indiceCapitulo < 0) {
      debugLog("Lista de episodios no disponible o índice inválido.");
      return;
    }

    const episodioId = String(indiceCapitulo);
    const titulo = btnVolverAnime?.textContent || tituloAnime;

    const estaVistoActualmente = episodiosVistos.includes(episodioId);
    const nuevoEstadoVisto = !estaVistoActualmente;

    const episodiosActuales = new Set(episodiosVistos);

    // Mantenemos la estructura condicional if/else
    if (nuevoEstadoVisto) {
      episodiosActuales.add(episodioId);
    } else {
      episodiosActuales.delete(episodioId);
    }

    const arrayNuevosVistos = Array.from(episodiosActuales);

    try {
      const statusElement = document.getElementById('statuscargado');
      const estadoTexto = statusElement ? statusElement.textContent : '';
      const esFinalizadoPorEstado = (estadoTexto === 'Finalizado' || estadoTexto === 'Concluido');
      const totalEpisodios = episodios.length;
      const vistosTodosLosCaps = arrayNuevosVistos.length >= totalEpisodios && totalEpisodios > 0;

      if (nuevoEstadoVisto) {
        await setDoc(animeRef, {
          titulo,
          portada: portadaAnime,
          fechaAgregado: serverTimestamp(),
          episodiosVistos: arrayUnion(episodioId),
          esFinalizadoPorVistos: esFinalizadoPorEstado && vistosTodosLosCaps
        }, { merge: true });
      } else {
        // La caché sirve para la UI, pero no decide qué se elimina. La
        // transacción lee el estado más reciente y solo borra el documento
        // si de verdad no quedan episodios vistos en ninguna sesión.
        await runTransaction(db, async transaction => {
          const snapActual = await transaction.get(animeRef);
          if (!snapActual.exists()) return;

          const restantes = (snapActual.data().episodiosVistos || [])
            .map(String)
            .filter(numero => numero !== episodioId);

          if (restantes.length === 0) {
            transaction.delete(animeRef);
            return;
          }

          transaction.set(animeRef, {
            titulo,
            portada: portadaAnime,
            fechaAgregado: serverTimestamp(),
            episodiosVistos: restantes,
            esFinalizadoPorVistos: false
          }, { merge: true });
        });
      }

      capitulosVistosGlobales = arrayNuevosVistos;
      dropdownGenerado = false;
      generarDropdownCapitulos();

      mostrarPildora(
        `Episodio ${indiceCapitulo} ${nuevoEstadoVisto ? "Visto" : "Quitado de vistos"}`,
        nuevoEstadoVisto ? "visto" : "eliminado"
      );
    } catch (error) {

      // Revertir UI en caso de error
      // await refrescarUIEstadoCapitulo();
    }
  } finally {
    toggleInProgress = false;
  }
}
// A diferencia del botón, este flujo nunca desmarca un capítulo ya visto.
async function marcarCapituloActualComoVisto() {
  const usuario = localStorage.getItem("userID");
  if (!usuario || toggleInProgress || btnEstadoCapitulo?.classList.contains("visto")) return;

  await toggleYGuardarEstadoCapitulo();
}

// Esperar a que el estado de autenticación esté listo
document.addEventListener("authStateReady", async (event) => {
  if (event.detail.user) {
    try {
      await refrescarUIEstadoCapitulo();
    } catch (error) {
      debugLog("Error al refrescar el estado del capítulo tras authStateReady:", error);
    }
  } else {
    debugLog("Usuario no autenticado según authStateReady.");
  }
});

btnEstadoCapitulo?.addEventListener("click", async () => {
  const user = localStorage.getItem("userID");
  if (!user) {
    mostrarPildora("Inicia sesión para guardar tu progreso", "no-user",
      () => document.getElementById("confirm-login")?.click());
    return
  }
  if (toggleInProgress) {
    debugLog("Clic ignorado: operación en progreso.");
    return;
  }
  try {
//carga instatanea segun la clase actual 
    const isVisto = btnEstadoCapitulo.classList.contains('visto');
    if (isVisto) {
      btnEstadoCapitulo.classList.remove('visto');
      btnEstadoCapitulo.classList.add('no-visto');
    } else {
      btnEstadoCapitulo.classList.remove('no-visto');
      btnEstadoCapitulo.classList.add('visto');
    }

    await toggleYGuardarEstadoCapitulo();
    await refrescarUIEstadoCapitulo();
  } catch (error) {

  }
});

// Funcionalidad del botón de compartir
const btnShare = document.getElementById("share");
if (btnShare) {
  btnShare.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          text: `Mira ${animeId} - Episodio ${episodioActualIndex}`,
          url: window.location.href
        });
      } else {
        // Fallback para navegadores que no soportan Web Share API
        navigator.clipboard.writeText(window.location.href).then(() => {
          const originalText = btnShare.innerHTML;
          btnShare.innerHTML = '<img src="icons/check-solid.svg" alt="Copiado">';
          setTimeout(() => {
            btnShare.innerHTML = originalText;
          }, 2000);
        });
      }
    } catch (error) {

    }
  });
}


function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlNoticiaSegura(url) {
  const valor = String(url || "").trim();
  const protocolo = valor.slice(0, valor.indexOf(":") + 1).toLowerCase();
  if (protocolo === "javascript:" || protocolo === "data:") return "";
  return valor;
}

function crearNoticiaHTML(noticia) {
  const tarjeta = document.createElement('a');
  tarjeta.className = 'tarjeta-noticia';
  
  const enlace = urlNoticiaSegura(noticia.enlace || noticia.slug || '');
  tarjeta.href = enlace || '#';
  if (enlace) {
    tarjeta.target = '_blank';
    tarjeta.rel = 'noopener noreferrer';
  }
  
  const imagenSrc = urlNoticiaSegura(noticia.imagenUrl || noticia.image || '');
  const titulo = escaparHTML(noticia.titulo || noticia.title || 'Sin título');
  const fechaOriginal = noticia.fechaAutor || noticia.date || '';
  const fechaFiltrada = fechaOriginal.includes(' por ') 
    ? fechaOriginal.split(' por ')[0] 
    : fechaOriginal;
  
  tarjeta.innerHTML = `
    <img src="${escaparHTML(imagenSrc)}" 
        alt="${titulo}" 
        class="noticia-imagen"
        loading="lazy"
        onerror="this.style.display='none'">
    <h3 class="noticia-titulo">${titulo}</h3>
    <p class="noticia-fecha">${escaparHTML(fechaFiltrada || 'Sin fecha')}</p>
  `;

  return tarjeta;
}

function extraerListaNoticias(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.noticias)) return payload.noticias;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

async function manejarNoticias() {
  const contenedorNoticias = document.getElementById('noticias_container');
  const initLoadingNoticias = document.getElementById('init-loading-noticias');

  if (!contenedorNoticias || !initLoadingNoticias) return;

  const renderizarNoticias = (noticias) => {
    contenedorNoticias.innerHTML = '';
    noticias.forEach((noticia) => {
      const tarjeta = crearNoticiaHTML(noticia);
      contenedorNoticias.appendChild(tarjeta);
    });
  };

  const cargarDesdeFirestore = async () => {
    try {
      const noticiasRef = doc(db, "noticias", "noticias");
      const docSnap = await getDoc(noticiasRef);

      if (docSnap.exists()) {
        const noticiasFirestore = extraerListaNoticias(docSnap.data()?.noticias);
        if (noticiasFirestore.length) {
          initLoadingNoticias.style.display = 'none';
          renderizarNoticias(noticiasFirestore);
        }
      }
    } catch (error) {

    }
  };

  const guardarEnFirestore = async (noticiasAPI) => {
    try {
      const noticiasRef = doc(db, "noticias", "noticias");
      await setDoc(noticiasRef, { noticias: noticiasAPI });
    } catch (error) {

    }
  };

  const fetchNoticiasAPI = async () => {
    const respuesta = await fetch("https://backend-noticias-anime.onrender.com/api/noticias");
    const payloadAPI = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      throw new Error(`API noticias ${respuesta.status}`);
    }

    const noticiasAPI = extraerListaNoticias(payloadAPI);
    if (!noticiasAPI.length) {
      throw new Error('API noticias vacía');
    }

    return noticiasAPI;
  };

  // La API envuelta para que nunca rechace la carrera
  const apiPromise = fetchNoticiasAPI()
    .then((noticias) => ({ noticias }))
    .catch(() => ({ noticias: null }));

  // 1 segundo de espera: si la API responde antes, Firestore no se toca
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ timeout: true }), 1000)
  );

  const primerResultado = await Promise.race([apiPromise, timeoutPromise]);

  if (!primerResultado.timeout && primerResultado.noticias) {
    // API rápida: render directo, sin leer ni escribir Firestore
    initLoadingNoticias.style.display = 'none';
    renderizarNoticias(primerResultado.noticias);
  } else {
    // API lenta o fallida: mostrar caché de Firestore mientras tanto
    await cargarDesdeFirestore();

    // Cuando la API responda, actualizar render y Firestore
    const resultadoFinal = await apiPromise;
    if (resultadoFinal.noticias) {
      initLoadingNoticias.style.display = 'none';
      renderizarNoticias(resultadoFinal.noticias);
      await guardarEnFirestore(resultadoFinal.noticias);
    }
  }

  initLoadingNoticias.style.display = 'none';

  // En pantallas pequeñas la lista es horizontal y la rueda la mueve;
  // en escritorio es vertical y el scroll nativo ya funciona.
  attachWheelScrollHorizontal(contenedorNoticias, () => window.innerWidth <= 1100);

  // Botones de scroll: el eje lo decide el layout (fila <=1100px, columna arriba).
  const noticiasHeader = document.querySelector('.noticias-header');
  ['prev', 'next'].forEach(dir => {
    const btn = noticiasHeader?.querySelector(`.scroll-btn-${dir}`);
    if (btn) btn.onclick = () => scrollContenedorUnaTarjeta(contenedorNoticias, dir);
  });
}

manejarNoticias();


function filtrarServidores(servidores, solodoblado = false) {
  if (!servidores) return [];
  return servidores.filter(servidor => {
    // Buscamos en 'name' (el de la API original)
    const nombreOriginal = (servidor.name || "").toLowerCase();
    const tieneLat = nombreOriginal.includes('(lat)');
    
    return solodoblado ? tieneLat : !tieneLat;
  });
}

function mapearServidoresApi(servidoresApi) {
  return servidoresApi.map((servidor) => ({
    name: servidor.name || "", // 🔥 NUEVO: Conservamos el nombre original para saber si tiene (Lat)
    type: servidor.type || "", // 🔥 NUEVO: Conservamos el tipo (player, download)
    url: typeof servidor === "string" ? servidor : servidor.url
  }));
}

function reordenarServidores(servidores) {
  if (!servidores || servidores.length === 0) return servidores;

  const jkanimePriority = [];
  const priority = [];
  const other = [];
  const mediafire = [];

  servidores.forEach(srv => {
    if (!srv?.url) {
      other.push(srv);
      return;
    }

    const url = srv.url.toLowerCase();

    // Zilla-Networks filtrado completamente (no funciona por hotlinking)
    if (url.includes('zilla-networks.com')) {
      return; // Omitir este servidor
    }
    // Solo jkanime con /umv?e= tiene prioridad máxima.
    // Los /um?e= se tratan como servidores normales (sin preferencia).
    else if ((url.includes('jkanime.net') || url.includes('jkplayer')) &&
             url.includes('/umv?e=')) {
      jkanimePriority.push({ ...srv, preferido: true });
    }
    else if (url.includes('yourupload.com/embed/')) {
      priority.push({ ...srv, preferido: true });
    }
    else if (url.includes('mega.nz/')) {
      priority.push({ ...srv, preferido: true });
    }
    else if (url.includes('mdy48tn97.com')) {
      priority.push({ ...srv, preferido: true });
    }
    else if (url.includes('mixdrop.top/e/')) {
      priority.push({ ...srv, preferido: true });
    }
    else if (url.includes('mp4upload.com')) {
      priority.push({ ...srv, preferido: true, mp4upload: true });
    }
    else if (url.includes('mediafire.com')) {
      mediafire.push({ ...srv, name: "Descargar" });
    }
    else {
      other.push(srv);
    }
  });

  return [...jkanimePriority, ...priority, ...other, ...mediafire];
}

async function obtenerServidoresDesdeApi(episodio) {
  const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?animeid=${animeId}&cap=${episodio.number}`);
  if (!res.ok) {
    debugLog(`La API respondió ${res.status} para el capítulo ${episodio.number}.`);
    return null; // Retornar null en lugar de lanzar error
  }

  const data = await res.json();

  if (!data.servidores?.length) {

    return [];
  }

  const servidoresMapeados = mapearServidoresApi(data.servidores);
  return servidoresMapeados;
}

async function guardarServidoresEnFirestore(ep, servidores) {
  if (firestoreEnPausaPorCuota) return false;

  const animeDatosRef = doc(db, "datos-animes", animeId);
  try {
    await runTransaction(db, async (transaction) => {
      const animeDatosSnap = await transaction.get(animeDatosRef);
      const animeDatos = animeDatosSnap.data() || {};
      const episodios = Array.isArray(animeDatos.episodios) ? [...animeDatos.episodios] : [];
      const episodioIndex = episodios.findIndex(e => String(e.number) === String(ep.number));
      const servidoresExistentes = (episodioIndex === -1
        ? []
        : Array.isArray(episodios[episodioIndex].servidores) ? episodios[episodioIndex].servidores : []
      ).map(normalizarServidor);

      // Conservar todos los servidores ya guardados (incluidos los manuales),
      // y sumar solamente URLs nuevas de la API.
      const clavesExistentes = new Set(servidoresExistentes.map(s => s?.url || s?.code).filter(Boolean));
      const servidoresFinales = [...servidoresExistentes];
      servidores.forEach(servidor => {
        const clave = servidor?.url || servidor?.code;
        if (!clave || !clavesExistentes.has(clave)) {
          servidoresFinales.push(servidor);
          if (clave) clavesExistentes.add(clave);
        }
      });

      if (episodioIndex !== -1) {
        episodios[episodioIndex] = { ...episodios[episodioIndex], servidores: servidoresFinales };
      } else {
        episodios.push({ number: ep.number, servidores: servidoresFinales });
      }

      transaction.set(animeDatosRef, { episodios }, { merge: true });
      if (documentoAnimeCache) {
        documentoAnimeCache = { ...documentoAnimeCache, episodios };
      }
    });
    return true;
  } catch (error) {
    if (activarModoApiDirecta(error)) return false;
    throw error;
  }
}

// El formato viejo guardaba el nombre en `nombre`; el actual usa `name`.
// Se normaliza al leer y al escribir para que Firestore se limpie solo.
function normalizarServidor(servidor) {
  if (servidor?.name === undefined && servidor?.nombre !== undefined) {
    const { nombre, ...resto } = servidor;
    return { ...resto, name: nombre };
  }
  return servidor;
}

function obtenerServidoresValidosDeFirestore(animeDatos, episodio) {
  // 🔥 CAMBIO: Buscar por number en lugar de url (ya que url puede estar vacío)
  const episodioGuardado = animeDatos?.episodios?.find(e => String(e.number) === String(episodio.number));
  const servidores = episodioGuardado?.servidores;

  if (!servidores?.length) return [];

  return servidores.map(normalizarServidor);
}

function guardarServidoresEnCache(episodio, servidores) {
  const servidoresOrdenados = reordenarServidores(servidores);
  const cacheKey = `servers_${animeId}_${episodio.number}`;
  serverCache.set(cacheKey, { data: servidoresOrdenados, time: Date.now() });
  return servidoresOrdenados;
}

function obtenerSiguienteEpisodio(index) {
  const pos = obtenerPosicionEpisodio(index);
  return pos === -1 ? undefined : episodios[pos + 1];
}

async function precargarSiguienteEpisodio(index, datosFirestore = undefined) {
  const siguiente = obtenerSiguienteEpisodio(index);
  if (!siguiente) return;

  const cacheKey = `servers_${animeId}_${siguiente.number}`;
  const cached = serverCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    siguiente.servidores = cached.data;
    return;
  }

  // La primera lectura ya trae todos los episodios del anime. Reutilizarla evita
  // una petición adicional y deja listo el siguiente capítulo de inmediato.
  const servidoresFirestore = obtenerServidoresValidosDeFirestore(datosFirestore, siguiente);
  if (servidoresFirestore.length) {
    siguiente.servidores = guardarServidoresEnCache(siguiente, servidoresFirestore);
    return;
  }

  // Si Firestore no tiene servidores válidos, conservar la precarga actual desde API.
  const servidores = await sincronizarServidoresConApi(siguiente, datosFirestore);
  if (servidores?.length) {
    siguiente.servidores = servidores;
  }
}

async function sincronizarServidoresConApi(ep, datosFirestore = undefined) {
  // Si no recibimos la lectura inicial, reutilizar la caché del documento
  // y solo consultar Firestore cuando todavía no se haya leído.
  if (!firestoreEnPausaPorCuota) try {
    if (!datosFirestore) {
      datosFirestore = documentoAnimeCache;
    }
    if (!datosFirestore) {
      const animeDatosRef = doc(db, "datos-animes", animeId);
      const animeDatosSnap = await getDoc(animeDatosRef);
      datosFirestore = animeDatosSnap.data() || {};
      recordarDocumentoAnime(datosFirestore);
    }

    const servidoresFirestore = obtenerServidoresValidosDeFirestore(datosFirestore, ep);
    if (servidoresFirestore.length) {
      return guardarServidoresEnCache(ep, servidoresFirestore);
    }
  } catch (error) {
    if (!activarModoApiDirecta(error)) {

    }
  }

  // Firestore no tenía servidores válidos: usar el respaldo actual de la API.
  try {
    const servidoresApi = await obtenerServidoresDesdeApi(ep);
    if (!servidoresApi?.length) {
      return [];
    }

    await guardarServidoresEnFirestore(ep, servidoresApi);
    return guardarServidoresEnCache(ep, servidoresApi);
  } catch (error) {

    throw error;
  }
}

async function cargarEpisodios() {

  if (!firestoreEnPausaPorCuota) try {
    // Reutiliza la promesa/caché compartida: la carga temprana de Vidrift
    // pide el mismo documento, así solo se hace una lectura de Firestore.
    const data = await obtenerDatosAnimeParaServidores();

    if (data && Object.keys(data).length) {
      tituloAnime = data.titulo || data.title || tituloAnime;
      portadaAnime = data.portada || data.cover || '';
      episodios = data.episodios || [];
      episodiosCargados = true;
      aplicarFondoAnime(data);
      if (episodios.length) {
        // Generar dropdown después de cargar episodios
        if (typeof generarDropdownCapitulos === 'function') {
          generarDropdownCapitulos();
        }
        // Actualizar texto de botones de navegación
        actualizarTextoBotonesNavegacion();
        if (episodioCargadoIndex !== episodioActualIndex) {
          await cargarVideoDesdeEpisodio(episodioActualIndex);
        }
        return episodios;
      }
    }
    throw new Error("No hay episodios en Firestore");
  } catch (err) {
    if (!activarModoApiDirecta(err)) {
      debugLog("Error al cargar desde Firestore; se intentará la API.", err);
    }
  }

  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${encodeURIComponent(animeId)}`);
    if (!res.ok) throw new Error(`API anime respondió ${res.status}`);

    const data = await res.json();
    tituloAnime = data.title || tituloAnime;

    episodios = (data.episodes || []).map(ep => ({ number: ep.number }));
    episodiosCargados = true;

    if (!episodios.length) {
      throw new Error("La API no devolvió episodios");
    }

    const animeData = {
      cover: data.cover || '',
      banner: data.banner || ''
    };

    aplicarFondoAnime(animeData);

    if (!firestoreEnPausaPorCuota) {
      try {
        const animeRef = doc(db, "datos-animes", animeId);
        let datosDocumentoPrevio = null;
        await runTransaction(db, async (transaction) => {
          const actual = await transaction.get(animeRef);
          datosDocumentoPrevio = actual.exists() ? actual.data() : null;
          const episodiosGuardados = datosDocumentoPrevio?.episodios || [];
          const guardadosPorNumero = new Map(episodiosGuardados.map(ep => [String(ep.number), ep]));
          const episodiosFusionados = episodios.map(ep => {
            const guardado = guardadosPorNumero.get(String(ep.number));
            if (!guardado) return ep;
            guardadosPorNumero.delete(String(ep.number));
            return {
              ...guardado,
              ...ep,
              ...(Array.isArray(guardado.servidores) ? { servidores: guardado.servidores } : {})
            };
          });

          // No eliminar capítulos que la API no haya devuelto todavía.
          episodios = [...episodiosFusionados, ...guardadosPorNumero.values()];
          transaction.set(animeRef, {
            episodios,
            titulo: data.title || animeId,
            cover: data.cover || '',
            banner: data.banner || ''
          }, { merge: true });
        });
        // Refrescar la caché con lo que quedó en Firestore para que las
        // funciones siguientes no tengan que volver a leer el documento.
        recordarDocumentoAnime({
          ...(datosDocumentoPrevio || {}),
          episodios,
          titulo: data.title || animeId,
          cover: data.cover || '',
          banner: data.banner || ''
        });
      } catch (error) {
        if (!activarModoApiDirecta(error)) {

        }
      }
    }

    // Generar dropdown después de cargar episodios
    if (typeof generarDropdownCapitulos === 'function') {
      generarDropdownCapitulos();
    }
    // Actualizar texto de botones de navegación
    actualizarTextoBotonesNavegacion();
    if (episodioCargadoIndex !== episodioActualIndex) {
      await cargarVideoDesdeEpisodio(episodioActualIndex);
    }
    return episodios;
  } catch (err) {
    throw err;
  }
}

let sugerenciasController = null;
let ultimoIdSugerencias = null;

// Sugerencias generadas por IA a partir del anime actual.
// La sección nace oculta en el HTML y solo se muestra si hay tarjetas.
async function cargarSugerenciasIA() {
  const section = document.getElementById('sugerencias');
  const grid = document.getElementById('anime-grid-sugerencias');
  if (!section || !grid || !animeId) return;

  if (ultimoIdSugerencias === animeId) return;
  ultimoIdSugerencias = animeId;

  if (sugerenciasController) sugerenciasController.abort();
  sugerenciasController = new AbortController();
  const signal = sugerenciasController.signal;

  attachIaGridWheelScroll(grid);

  // Mismo patrón que "Continuar Viendo": botones que desplazan la fila.
  ['prev', 'next'].forEach(dir => {
    const btn = section.querySelector(`.scroll-btn-${dir}`);
    if (btn) btn.onclick = () => scrollFilaUnaTarjeta(grid, dir);
  });

  const tituloActual = tituloAnime || animeId.replaceAll('-', ' ');
  const prompt = buildFavoritesAnimePrompt([tituloActual], [tituloActual], '', 7);

  await loadIaRecommendationsIntoGrid({
    prompt,
    grid,
    isStale: () => ultimoIdSugerencias !== animeId,
    signal,
    crearAnimeCard,
    observerAnimeCards,
    max: 7
  });

  if (!signal.aborted && ultimoIdSugerencias === animeId && grid.querySelector('.anime-card')) {
    section.style.display = 'flex';
  }
}
cargarSugerenciasIA();
function aplicarFondoAnime(anime) {
  const bannerUrl = anime.banner;
  const portadaUrl = anime.portada || anime.cover;

  // Función auxiliar para no repetir código al inyectar el CSS
  const aplicarEstilos = (url) => {
    if (url) {
      document.body.style.setProperty('--background-image', `url('${url}')`);
      document.body.classList.add('fondo-animado');
    }
  };

  // Si por alguna razón el banner viene vacío o nulo de origen, aplicamos portada directamente
  if (!bannerUrl) {
    aplicarEstilos(portadaUrl);
    return;
  }

  // Creamos una imagen en memoria para comprobar si el link es accesible
  const img = new Image();

  img.onload = () => {
    // El link es válido y la imagen cargó correctamente
    aplicarEstilos(bannerUrl);
  };

  img.onerror = () => {
    // El link está roto, la imagen no existe o tiene bloqueos de CORS
    debugLog(`Error al cargar el banner ${bannerUrl}; se usa la portada como respaldo.`);
    aplicarEstilos(portadaUrl);
  };

  // Al asignar el src, el navegador intenta descargarla y dispara onload u onerror
  img.src = bannerUrl;
}

// Firestore puede tener el anime, pero no todos sus capítulos (por ejemplo,
// después de limitar las escrituras para proteger la cuota). En ese caso no
// debemos terminar en un 404 local: recuperamos el listado actual desde la API
// y conservamos los servidores que ya estaban disponibles en memoria.
async function recuperarEpisodioFaltanteDesdeApi(numeroEpisodio) {
  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${encodeURIComponent(animeId)}`);
    if (!res.ok) {
      throw new Error(`API anime respondió ${res.status}`);
    }

    const data = await res.json();
    const episodiosApi = (data.episodes || []).map(ep => ({ number: ep.number }));
    const episodioSolicitado = episodiosApi.find(ep => String(ep.number) === String(numeroEpisodio));

    if (!episodioSolicitado) return null;

    const episodiosLocales = new Map(episodios.map(ep => [String(ep.number), ep]));
    const hayEpisodioNuevo = episodiosApi.some(ep => !episodiosLocales.has(String(ep.number)));
    episodios = episodiosApi.map(ep => {
      const episodioLocal = episodiosLocales.get(String(ep.number));
      return episodioLocal
        ? { ...ep, ...episodioLocal }
        : ep;
    });
    episodiosCargados = true;

    if (hayEpisodioNuevo) {
      // El capítulo nuevo puede haber llegado a Firestore con sus servidores;
      // soltar la caché para que la siguiente lectura no use datos viejos.
      documentoAnimeCache = undefined;
    }

    aplicarFondoAnime({ cover: data.cover || '', banner: data.banner || '' });
    dropdownGenerado = false;
    generarDropdownCapitulos();
    actualizarTextoBotonesNavegacion();
    return episodioSolicitado;
  } catch (error) {

    return null;
  }
}

// La carga temprana de Vidrift y la de servidores pueden pedir el documento
// al mismo tiempo: una sola promesa evita dos lecturas de Firestore.
let promesaDatosAnime = null;

async function obtenerDatosAnimeParaServidores() {
  if (firestoreEnPausaPorCuota) return null;
  if (documentoAnimeCache) return documentoAnimeCache;
  if (!promesaDatosAnime) {
    promesaDatosAnime = (async () => {
      try {
        const animeDatosSnap = await getDoc(doc(db, "datos-animes", animeId));
        const datos = animeDatosSnap.data() || {};
        recordarDocumentoAnime(datos);
        return datos;
      } catch (error) {
        activarModoApiDirecta(error);
        return null;
      } finally {
        promesaDatosAnime = null;
      }
    })();
  }
  return promesaDatosAnime;
}

function sonElMismoServidor(a, b) {
  return (a.url && a.url === b.url)
    || (a.code && a.code === b.code)
    || (a.name === b.name && a.url === b.url);
}

function combinarServidores(guardados, recibidos) {
  return [...guardados, ...recibidos.filter(nuevo =>
    !guardados.some(existente => sonElMismoServidor(existente, nuevo))
  )];
}

function aplicarServidoresDeApi(ep, servidores, mantenerReproduccion) {
  ep.servidores = guardarServidoresEnCache(ep, servidores);
  renderizarServidores(ep.servidores, { mantenerReproduccion });
  ejecutarEnSegundoPlano(
    guardarServidoresEnFirestore(ep, ep.servidores),
    "No se pudieron guardar los servidores obtenidos de la API"
  );
}

// Evita cargas duplicadas del mismo episodio: la carga temprana de Vidrift y
// la que dispara cargarEpisodios() al terminar comparten esta guarda, así el
// iframe no se recrea dos veces.
const cargasEpisodioEnCurso = new Set();
// Último episodio cargado con éxito: evita que cargarEpisodios() dispare
// una segunda carga del episodio que la carga temprana ya resolvió.
let episodioCargadoIndex = null;

function cargarVideoDesdeEpisodio(index) {
  // ep.number puede llegar como string desde la API/Firestore: sin esta
  // conversión "12" + offset produce "124" en la URL de Vidrift.
  const indice = Number(index);
  if (!Number.isFinite(indice)) return Promise.resolve();
  if (cargasEpisodioEnCurso.has(indice)) return Promise.resolve();
  cargasEpisodioEnCurso.add(indice);
  return cargarVideoDesdeEpisodioInterno(indice)
    .finally(() => cargasEpisodioEnCurso.delete(indice));
}

async function cargarVideoDesdeEpisodioInterno(index) {
  const t0Carga = performance.now();
  const controles = document.getElementById("controles");
  controles.innerHTML = "<span id='cargando-servidores'></span>";
  btnCap.textContent = `Episodio ${index}`;

  const tEp = performance.now();
  let ep = episodios.find(ep => String(ep.number) === String(index));
  if (!ep && !episodiosCargados) {
    // La lista de episodios todavía no llegó, pero Vidrift solo necesita el
    // número: arrancamos en paralelo con un episodio mínimo.
    ep = { number: index };
  }
  if (!ep) {
    debugLog(tSalto(), "episodio", index, "no está en la lista, consultando API...");
    ep = await recuperarEpisodioFaltanteDesdeApi(index);
    debugLog(tSalto(), "recuperarEpisodioFaltanteDesdeApi tardó", Math.round(performance.now() - tEp), "ms");
  }
  if (!ep) {
    // No reemplazar el reproductor ni los controles con una pantalla 404.
    // La ausencia puede ser momentánea mientras se actualiza la API.
    controles.innerHTML = "";
    debugLog("[Reproducción] El episodio no está disponible en la lista actual.", {
      animeId,
      episodio: index
    });
    return;
  }

  episodioActualIndex = index;
  history.replaceState(
    {},
    "",
    `${window.location.pathname}?id=${animeId}&episode=${ep.number}&servers=${modoDoblado ? "dob" : "sub"}`
  );

  // Los botones anterior/siguiente y el dropdown reflejan el nuevo episodio
  // de inmediato: la carga de servidores (Firestore/API) puede tardar o
  // fallar y no debe dejar la navegacion con los numeros del episodio viejo.
  sincronizarUINavegacion();

  // Vidrift solo necesita tmdbId + temporada + episodio: no depende de la
  // lista de servidores. Se renderiza de inmediato y el cache, Firestore o
  // la API solo agregan el resto de botones después, sin recargar el iframe.
  renderizarServidores([]);

  // Vidrift ya está reproduciendo: el episodio cuenta como cargado aunque la
  // API de servidores falle después, así cargarEpisodios() no lo recarga.
  episodioCargadoIndex = index;

  const cacheKey = `servers_${animeId}_${ep.number}`;
  const cached = serverCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    debugLog(tSalto(), "servers en cache para cap", ep.number);
    renderizarServidores(cached.data, { mantenerReproduccion: true });
    ejecutarEnSegundoPlano(precargarSiguienteEpisodio(index), "No se pudo precargar el siguiente episodio");
    return;
  }
  // debugLog(tSalto(), "cache de servers MISS para cap", ep.number, "edad:", cached ? `${Math.round((Date.now() - cached.time) / 1000)}s` : "nunca");

  let datosFirestore = await obtenerDatosAnimeParaServidores();
  debugLog(tSalto(), "datos Firestore listos", Math.round(performance.now() - t0Carga), "ms");
  const servidoresFirestore = obtenerServidoresValidosDeFirestore(datosFirestore, ep);
  ejecutarEnSegundoPlano(
    precargarSiguienteEpisodio(index, datosFirestore),
    "No se pudo precargar el siguiente episodio"
  );

  if (servidoresFirestore.length) {
    ep.servidores = guardarServidoresEnCache(ep, servidoresFirestore);
    renderizarServidores(ep.servidores, { mantenerReproduccion: true });
    debugLog(tSalto(), "servidores Firestore renderizados", servidoresFirestore.length);
  } else {
    debugLog(tSalto(), "sin servidores en Firestore, la API solo agregará botones");
  }

  try {
    const tApi = performance.now();
    const servidoresApi = await obtenerServidoresDesdeApi(ep);
    debugLog(tSalto(), "API servidores respondió en", Math.round(performance.now() - tApi), "ms");
    if (servidoresApi === null) {
      return ep;
    }

    const servidoresCombinados = combinarServidores(servidoresFirestore, servidoresApi);
    if (servidoresCombinados.length > servidoresFirestore.length) {
      aplicarServidoresDeApi(ep, servidoresCombinados, true);
    }
  } catch (error) {
    debugLog("Error al cargar servidores de la API; Vidrift sigue reproduciendo.", error);
  } finally {
    actualizarEstadoBotones();
  }

  return ep;
}

let animacionInicialCompletada = false;

attachWheelScrollHorizontal(document.getElementById("controles"));

function renderizarServidores(todosLosServidores, opciones = {}) {
  const servidorAnterior = embeds[servidorActualIndex];
  const mantenerReproduccion = Boolean(opciones.mantenerReproduccion && reproduccionActualId);

  let servidores = filtrarServidores(todosLosServidores, modoDoblado);

  if (!servidores?.length) {
    const modoAlternativo = !modoDoblado;
    const servidoresAlternativos = filtrarServidores(todosLosServidores, modoAlternativo);

    if (servidoresAlternativos.length) {
      modoDoblado = modoAlternativo;
      servidores = servidoresAlternativos;

      const newUrl = new URL(window.location);
      newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
      window.history.replaceState({}, "", newUrl);

      const btn = document.getElementById("btn-cambio-servers");
      if (btn) {
        actualizarEstadoSwitch(btn, modoDoblado);
      }
    }
  }

  const vidriftServer = {
    name: "Vidrift",
    type: "player",
    url: "",
    vidrift: true
  };
  servidores = [vidriftServer, ...servidores];

  embeds = [...servidores];

  const controles = document.getElementById("controles");
  controles.innerHTML = "";
  controles.classList.remove("cargado-otros", "cargado");

  let cantidadBotones = 0;

  embeds.forEach((srv, i) => {
    if ((srv.url?.toLowerCase?.() || "").includes("mediafire.com")) return;

    const btn = document.createElement("button");
    btn.dataset.serverIndex = i;

    const nombre = document.createElement("span");
    nombre.className = "server-name";
    nombre.textContent = nombreVisibleServidor(srv, i);
    btn.appendChild(nombre);

    const badge = document.createElement("span");
    badge.className = "server-badge";
    if (srv.vidrift) {
      badge.classList.add("hd");
      badge.textContent = "TOP";
    } else if (srv.mp4upload) {
      badge.classList.add("ads");
      badge.textContent = "ADS";
    } else if (srv.preferido) {
      badge.classList.add("fast");
      badge.textContent = "HD";
    } else {
      badge.classList.add("ad");
      badge.textContent = "AD";
    }
    btn.appendChild(badge);

    btn.onclick = () => mostrarVideo(srv, btn);
    controles.appendChild(btn);
    cantidadBotones++;
  });

  const servidorDescarga = servidores.find(srv => (srv.url?.toLowerCase?.() || "").includes("mediafire.com"));
  const btnDescargar = document.getElementById("descargar");
  const botonesContainer = document.querySelector(".buttons-container");
  if (btnDescargar && botonesContainer) {
    if (servidorDescarga) {
      btnDescargar.href = servidorDescarga.url;
      btnDescargar.hidden = false;
      botonesContainer.classList.add("con-descarga");
    } else {
      btnDescargar.hidden = true;
      btnDescargar.removeAttribute("href");
      botonesContainer.classList.remove("con-descarga");
    }
  }

  if (cantidadBotones > 0) {
    controles.classList.add("cargado");

    const firstPlayable = embeds.find(s => !s.url?.toLowerCase?.().includes("mediafire.com"));
    let indexInEmbeds = embeds.indexOf(firstPlayable || embeds[0]);

    if (mantenerReproduccion) {
      if (servidorAnterior?.vidrift) {
        indexInEmbeds = embeds.findIndex(servidor => servidor.vidrift);
      } else if (servidorAnterior?.url) {
        indexInEmbeds = embeds.findIndex(servidor => servidor.url === servidorAnterior.url);
      }
      if (indexInEmbeds < 0) indexInEmbeds = servidorActualIndex;
    }

    servidorActualIndex = indexInEmbeds;
    const buttonToSelect = controles.querySelector(`button[data-server-index="${indexInEmbeds}"]`) || controles.querySelector("button");

    if (mantenerReproduccion) {
      buttonToSelect?.classList.add("servidor-activo");
    } else {
      mostrarVideo(embeds[indexInEmbeds], buttonToSelect);
    }
  } else {
    videoContenedorGlobal.innerHTML = "No se encontraron botones de servidor.";
  }

  if (cantidadBotones > 1) {
    embeds.forEach((srv, i) => {
      const btn = controles.querySelector(`button[data-server-index="${i}"]`);
      if (!btn) return;
      if (srv.vidrift) {
        btn.classList.add("prefer", "vidrift");
      } else if (srv.preferido) {
        btn.classList.add("prefer");
      }
    });

    if (!animacionInicialCompletada && controles.querySelector(".servidor-activo")) {
      void controles.offsetHeight;
      animacionInicialCompletada = true;
    }
    controles.classList.add("cargado-otros");
  }

  actualizarEstadoBotonDoblado(todosLosServidores);
}

const controles = document.getElementById("controles");

function nombreServidorDesdeUrl(url, fallback) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return host ? host.charAt(0).toUpperCase() + host.slice(1) : fallback;
  } catch {
    return fallback;
  }
}

function nombreBaseServidor(srv) {
  return String(srv?.name || "").split(" ")[0]
    || nombreServidorDesdeUrl(srv?.url, "");
}

function nombreVisibleServidor(srv, indice) {
  const base = nombreBaseServidor(srv);
  if (!base) return `Servidor ${indice + 1}`;

  // Si el mismo nombre aparece varias veces en embeds, se numera por orden:
  // el primero queda igual y los siguientes llevan " 2", " 3", etc.
  const lista = Array.isArray(embeds) ? embeds : [];
  const baseNormalizada = base.toLowerCase();
  let apariciones = 0;
  for (let i = 0; i < lista.length; i++) {
    const otro = nombreBaseServidor(lista[i]);
    if (otro.toLowerCase() === baseNormalizada) {
      apariciones++;
      if (i === indice) break;
    }
  }
  return apariciones > 1 ? `${base} ${apariciones}` : base;
}

async function esEnlaceValidoMega(fileId) {
  debugLog("Verificando si el enlace de Mega es válido.", fileId);
  try {
    const response = await fetch('https://g.api.mega.co.nz/cs', {
      method: 'POST',
      body: JSON.stringify([{ a: 'g', p: fileId }])
    });

    const data = await response.json();

    // Si Mega responde con un entero negativo (ej. -9), el archivo no existe
    if (Array.isArray(data) && typeof data[0] === 'number' && data[0] < 0) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// La caché solo es válida para la temporada efectiva del slug actual: un
// slug sin marcador puede ser una temporada posterior de la serie (p. ej.
// "shimetsu-kaiyuu-zenpen") y un tmdbSeason=1 cacheado no debe reproducir
// el episodio 1 de la temporada unificada sin el offset correspondiente.
function cacheTmdbEsValida(temporadaEfectiva) {
  return cacheTmdbVidrift?.animeId === animeId
    && Boolean(cacheTmdbVidrift?.tmdbId)
    && cacheTmdbVidrift.temporadaEfectiva === temporadaEfectiva;
}

function guardarCacheTmdbVidrift(
  tmdbId,
  tmdbSeason,
  mediaType,
  temporadaEfectiva = null,
  offsetEpisodio = 0,
  tipoVerificado = true
) {
  cacheTmdbVidrift = {
    animeId,
    tmdbId,
    tmdbSeason: Number(tmdbSeason) > 0 ? Number(tmdbSeason) : detectarTemporadaDesdeAnimeId(animeId),
    mediaType: mediaType === "movie" ? "movie" : "tv",
    temporadaEfectiva,
    offsetEpisodio,
    tipoVerificado,
    confiable: true
  };
  persistirCacheTmdbVidrift();
}

function sembrarCacheTmdbDesdeDatos(datos) {
  // Solo marca Firestore como consultado: la temporada efectiva puede
  // requerir la cadena de relations de la API (async), así que la
  // validación real de la caché ocurre en resolverDatosTmdbVidrift.
  firestoreTmdbConsultado = true;
}

function recordarDocumentoAnime(datos) {
  if (!datos) return;
  documentoAnimeCache = datos;
  sembrarCacheTmdbDesdeDatos(datos);
}

// Algunos enlaces llegan con el ID numérico de TMDB directamente en `id`
// (por ejemplo, /ver?id=671&episode=1). Buscar el texto "671" como título
// nunca encuentra una coincidencia útil; Vidrift puede usar ese ID de forma
// directa incluso si Firestore y la API del catálogo no están disponibles.
function obtenerTmdbIdDirectoDesdeAnimeId() {
  const id = String(animeId || "").trim();
  return /^\d+$/.test(id) && Number(id) > 0 ? Number(id) : null;
}

// Un ID numérico puede apuntar a una serie o a una película. Se consultan
// ambos recursos concretos, no el buscador de títulos. Si TMDB no responde,
// se conserva TV como intento de última instancia para que Vidrift siga
// mostrando su propio estado en vez de sustituir el iframe.
async function resolverTipoDirectoParaVidrift(tmdbId) {
  const existe = ruta => consultarTMDB(ruta, {}).then(() => true).catch(() => false);
  const [esTv, esPelicula] = await Promise.all([
    existe(`tv/${tmdbId}`),
    existe(`movie/${tmdbId}`)
  ]);

  if (esTv) return { mediaType: "tv", verificado: true };
  if (esPelicula) return { mediaType: "movie", verificado: true };
  return { mediaType: "tv", verificado: false };
}

// Los espacios de IDs de película y serie en TMDB son independientes: el
// mismo número puede existir en ambos (p. ej. 671 = una serie y Harry
// Potter). Cuando el embed /tv/ agota sus fuentes se usa esto para saber
// si existe un /movie/ alternativo antes de rendirse.
async function existePeliculaTmdb(tmdbId) {
  try {
    await consultarTMDB(`movie/${tmdbId}`, {});
    return true;
  } catch {
    return false;
  }
}

async function resolverDatosTmdbVidrift() {
  if (promesaTmdbVidrift) return promesaTmdbVidrift;

  promesaTmdbVidrift = (async () => {
    const tmdbIdDirecto = obtenerTmdbIdDirectoDesdeAnimeId();
    if (tmdbIdDirecto) {
      // Las cachés previas no tenían `tipoVerificado`; se recalculan una vez
      // para poder corregir el caso en que el ID numérico sea una película.
      if (
        cacheTmdbVidrift?.animeId === animeId
        && Number(cacheTmdbVidrift.tmdbId) === tmdbIdDirecto
        && cacheTmdbVidrift.tipoVerificado
      ) {
        episodioOffsetTemporadaVidrift = 0;
        return cacheTmdbVidrift;
      }

      const { mediaType, verificado } = await resolverTipoDirectoParaVidrift(tmdbIdDirecto);
      episodioOffsetTemporadaVidrift = 0;
      guardarCacheTmdbVidrift(tmdbIdDirecto, 1, mediaType, 1, 0, verificado);
      debugLog("[Vidrift] Usando el ID numérico de la URL directamente.", {
        animeId,
        tmdbId: tmdbIdDirecto,
        mediaType,
        verificado,
        temporada: 1,
        episodio: episodioActualIndex
      });
      return cacheTmdbVidrift;
    }

    // Caché ya resuelta (memoria o localStorage): animeId y temporada
    // efectiva son fijos por página, así que no hace falta volver a
    // consultar Firestore/TMDB ni la cadena de relations de la API.
    // Esto evita que cambiar de capítulo dispare otra resolución lenta.
    if (cacheTmdbVidrift?.animeId === animeId && cacheTmdbVidrift?.tmdbId && cacheTmdbVidrift.confiable) {
      episodioOffsetTemporadaVidrift = cacheTmdbVidrift.offsetEpisodio || 0;
      return cacheTmdbVidrift;
    }

    const temporadaEfectiva = await resolverTemporadaEfectivaSlug();
    if (cacheTmdbEsValida(temporadaEfectiva)) {
      // El offset forma parte de la temporada unificada: restaurarlo para
      // que el episodio de Vidrift sea el correcto aunque venga de caché.
      episodioOffsetTemporadaVidrift = cacheTmdbVidrift.offsetEpisodio || 0;
      return cacheTmdbVidrift;
    }

    const animeDatosRef = doc(db, "datos-animes", animeId);

    if (!firestoreTmdbConsultado) {
      firestoreTmdbConsultado = true;
      let animeDatos = documentoAnimeCache;

      if (!animeDatos) {
        // Comparte la promesa en curso con la carga de servidores: una sola
        // lectura de Firestore para ambos consumidores.
        animeDatos = await obtenerDatosAnimeParaServidores();
        if (animeDatos) {
          debugLog("Documento de Firestore obtenido para TMDB.", animeId);
        } else {
          debugLog("El documento no existe en Firestore o no se pudo leer.");
        }
      }

      if (animeDatos?.tmdbId) {
        debugLog("ID de TMDB encontrado en Firestore.", animeDatos.tmdbId);
        const esPelicula = animeDatos.tmdbMediaType === "movie";
        const tmdbSeason = esPelicula ? 1 : await resolverTemporadaVidrift(animeDatos.tmdbId, animeDatos.tmdbSeason);
        if (!tmdbSeason) return null;
        guardarCacheTmdbVidrift(animeDatos.tmdbId, tmdbSeason, animeDatos.tmdbMediaType, temporadaEfectiva, episodioOffsetTemporadaVidrift);
        if (!esPelicula && Number(animeDatos.tmdbSeason) !== tmdbSeason) {
          ejecutarEnSegundoPlano(
            setDoc(animeDatosRef, { tmdbSeason }, { merge: true }),
            "No se pudo actualizar la temporada TMDB en Firestore"
          );
        }
        debugLog("[Vidrift] ID recuperado de Firestore", {
          animeId,
          tmdbId: animeDatos.tmdbId,
          temporada: tmdbSeason,
          episodio: episodioActualIndex
        });
        return cacheTmdbVidrift;
      }
      if (animeDatos) {
        debugLog("El documento de Firestore no tiene tmdbId.");
      }
    }

    debugLog("Buscando el anime en TMDB.", tituloAnime);
    const resultados = await buscarAnimeTMDBConRespaldo(tituloAnime);
    debugLog("Resultados obtenidos de TMDB.", resultados);
    debugLog("[Vidrift] Resultados de búsqueda TMDB", { animeId, resultados });

    if (!resultados?.length) {
      debugLog("No se encontraron resultados en TMDB.");
      return { error: "TMDB no encontró resultados para el anime" };
    }

    const seleccion = await seleccionarResultadoTMDBParaVidrift(resultados);
    if (!seleccion) {
      debugLog("[Vidrift] Ningún resultado de TMDB contiene la temporada solicitada.", {
        animeId,
        temporada: temporadaEfectiva
      });
      return { error: "TMDB no devolvió una coincidencia con la temporada solicitada" };
    }

    const { tmdbId, tmdbSeason, resultado } = seleccion;
    debugLog("[Vidrift] Primer resultado seleccionado", {
      animeId,
      seleccionado: resultado,
      tmdbId,
      temporada: tmdbSeason
    });

    guardarCacheTmdbVidrift(tmdbId, tmdbSeason, resultado?.mediaType, temporadaEfectiva, episodioOffsetTemporadaVidrift);
    ejecutarEnSegundoPlano(
      setDoc(animeDatosRef, { tmdbId, tmdbSeason, tmdbMediaType: resultado?.mediaType || "tv" }, { merge: true }),
      "No se pudo guardar la asociación TMDB en Firestore"
    );

    return cacheTmdbVidrift;
  })()
    .catch(error => {
      debugLog("No se pudo cargar Vidrift; se probará el siguiente servidor.", error);
      return { error: "Error al consultar Firestore o TMDB para Vidrift" };
    })
    .finally(() => {
      promesaTmdbVidrift = null;
    });

  return promesaTmdbVidrift;
}

// Con fs=parent el fullscreen vive en #video, que no se destruye al cambiar
// de reproductor: el navegador mantiene el estado y no hay nada que capturar
// ni restaurar entre capítulos.
function elementoEnPantallaCompleta() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function solicitarPantallaCompleta(elemento) {
  const metodo = elemento?.requestFullscreen || elemento?.webkitRequestFullscreen;
  if (!metodo) throw new Error("requestFullscreen no está disponible");
  return metodo.call(elemento);
}

function salirDePantallaCompleta() {
  if (document.exitFullscreen) return document.exitFullscreen();
  return document.webkitExitFullscreen?.();
}

function soportaPantallaCompletaContenedor() {
  const videoDiv = videoContenedorGlobal;
  return !!(videoDiv?.requestFullscreen || videoDiv?.webkitRequestFullscreen);
}

// Navegadores sin Fullscreen API en elementos (iPhone Safari) no pueden poner
// #video en fullscreen real: se simula con position:fixed vía la clase
// video-fs-simulado. Nunca se usa como fallback de un requestFullscreen
// rechazado: eso dejaba el contenedor sin borde sin estar en pantalla.
let pantallaCompletaSimulada = false;

function aplicarPantallaCompletaSimulada() {
  pantallaCompletaSimulada = true;
  document.documentElement.classList.add("video-fs-simulado", "video-pantalla-completa");
}

function quitarPantallaCompletaSimulada() {
  pantallaCompletaSimulada = false;
  document.documentElement.classList.remove("video-fs-simulado");
  manejarCambioPantallaCompleta();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pantallaCompletaSimulada) {
    quitarPantallaCompletaSimulada();
  }
});

const manejarCambioPantallaCompleta = () => {
  const elemento = elementoEnPantallaCompleta();
  const videoDiv = videoContenedorGlobal;
  // Marca <html> mientras #video (o su contenido) ocupa la pantalla para que
  // el CSS quite el gutter del scrollbar y el borde del reproductor.
  const enPantallaVideo = pantallaCompletaSimulada || (!!elemento && videoDiv && (elemento === videoDiv || videoDiv.contains(elemento)));
  document.documentElement.classList.toggle("video-pantalla-completa", enPantallaVideo);
  enviarEstadoFullscreenVidrift();
};

["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]
  .forEach(evento => document.addEventListener(evento, manejarCambioPantallaCompleta));

// Con fs=parent Vidrift delega el fullscreen a la página: el objetivo es
// #video, que no se destruye al cambiar de episodio, así el salto automático
// de capítulo conserva la pantalla completa sin necesitar un nuevo gesto.
function enviarEstadoFullscreenVidrift() {
  if (!ventanaVidriftActiva) return;
  const videoDiv = videoContenedorGlobal;
  const elemento = elementoEnPantallaCompleta();
  const on = pantallaCompletaSimulada || (!!elemento && videoDiv.contains(elemento));
  ventanaVidriftActiva.postMessage(
    { type: "vidrift:fullscreen-state", on },
    ORIGEN_VIDRIFT
  );
}

async function manejarFullscreenVidrift(solicitar) {
  const videoDiv = videoContenedorGlobal;
  if (solicitar) {
    if (elementoEnPantallaCompleta() || pantallaCompletaSimulada) return;
    if (soportaPantallaCompletaContenedor()) {
      try {
        await solicitarPantallaCompleta(videoDiv);
      } catch (error) {
        // Si el anuncio de Vidrift consumió el gesto, el navegador rechaza
        // requestFullscreen: se avisa al player del estado real y el
        // siguiente clic vuelve a intentarlo.
        debugLog("[Vidrift] requestFullscreen rechazado", error?.message || error);
      }
      enviarEstadoFullscreenVidrift();
      return;
    }
    // Sin Fullscreen API en elementos (iPhone): fullscreen simulado con
    // CSS fijo sobre #video.
    aplicarPantallaCompletaSimulada();
    enviarEstadoFullscreenVidrift();
    return;
  }
  if (pantallaCompletaSimulada) {
    quitarPantallaCompletaSimulada();
    enviarEstadoFullscreenVidrift();
    return;
  }
  const elemento = elementoEnPantallaCompleta();
  if (elemento && videoDiv.contains(elemento)) {
    try {
      await salirDePantallaCompleta();
    } catch {
      // El usuario ya pudo haber salido con Esc; no hay nada que hacer.
    }
  }
  enviarEstadoFullscreenVidrift();
}

function esFuenteVideoDirecta(url) {
  return /\.(?:mp4|m3u8)(?:\?|$)/i.test(url);
}

// Vidrift marca cada fuente interna como "failed" cuando no tiene nada que
// reproducir. Si todas quedan en ese estado el embed muestra "This one won't
// play right now" y ninguna guarda de carga lo detecta: el iframe ya cargó
// bien y el timeout de 12 s se canceló en su evento load.
function vidriftAgotoSusFuentes(data) {
  const servidores = data?.servers;
  return Array.isArray(servidores)
    && servidores.length > 0
    && servidores.every(servidor => servidor?.state === "failed");
}

function crearVideoDirecto(url, reproduccionId) {
  const video = document.createElement("video");
  video.src = url;
  video.controls = true;
  video.autoplay = true;
  video.width = "100%";
  video.height = "100%";
  video.style.maxHeight = "80vh";
  video.onerror = () => {
    if (reproduccionId === reproduccionActualId) {
      intentarSiguienteServidor(reproduccionId, "El archivo de vídeo no se pudo reproducir");
    }
  };

  return video;
}

function crearIframeServidor(url, reproduccionId) {
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.width = "100%";
  iframe.height = "100%";
  iframe.style.border = "none";
  iframe.allow = "fullscreen";
  iframe.scrolling = "no";
  if (bloquearAnuncios) iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-presentation";

  iframe.onerror = () => {
    if (reproduccionId === reproduccionActualId) {
      intentarSiguienteServidor(reproduccionId, "El iframe del servidor produjo un error");
    }
  };
  iframe.onload = () => {
    if (reproduccionId === reproduccionActualId) {
      cancelarFallbackDeCarga();
    }
  };
  programarFallbackDeCarga(reproduccionId, 10000, "El servidor externo tardó demasiado en cargar");
  return iframe;
}

function cargarIframeServidor(url, videoDiv, reproduccionId) {
  const iframe = crearIframeServidor(url, reproduccionId);
  const insertar = () => {
    if (reproduccionId === reproduccionActualId) videoDiv.appendChild(iframe);
  };
  const fileId = url.match(/mega\.nz\/embed\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!fileId) return insertar();

  esEnlaceValidoMega(fileId)
    .then(valido => valido ? insertar() : intentarSiguienteServidor(reproduccionId, "El enlace de Mega no está disponible"))
    .catch(insertar);
}

async function mostrarVideo(link, botonSeleccionado) {
  const url = typeof link === "string" ? link : link.url;
  const esVidrift = link.vidrift === true;
  const reproduccionId = ++reproduccionActualId;
  ventanaVidriftActiva = null;
  limpiarPreferenciaSubtitulos?.();
  limpiarPreferenciaSubtitulos = null;

  const botones = document.querySelectorAll("#controles button");
  botones.forEach(btn => btn.classList.remove("servidor-activo"));

  if (botonSeleccionado) {
    botonSeleccionado.classList.add("servidor-activo");
    servidorActualIndex = Number(botonSeleccionado.dataset.serverIndex);
  }

  const videoDiv = videoContenedorGlobal;
  videoDiv.innerHTML = "";

  cancelarFallbackDeCarga();

  // Caso especial para Vidrift
  if (esVidrift) {
    videoDiv.innerHTML = "<p class='span-carga'>Cargando servidor Vidrift...</p>";
    // Firestore o TMDB también pueden quedar esperando: no bloquees los demás
    // servidores si el ID no llega en un tiempo razonable.
    programarFallbackDeCarga(reproduccionId, 12000, "Tiempo de espera al obtener el ID de Vidrift");

    // Obtener brandColor dinámico desde la variable CSS --btn
    const computedStyle = getComputedStyle(document.body);
    const btnColor = computedStyle.getPropertyValue('--btn').trim();
    // Convertir el color hexadecimal a formato sin # para Vidrift
    const brandColor = btnColor.startsWith('#') ? btnColor.slice(1) : btnColor || "7c5cff";

    // Logo de marca según el tema activo (mismo criterio que tema.js)
    const temaActivo = localStorage.getItem('theme') || window.AniZenThemes?.DEFAULT_THEME || 'sakura';
    const brandLogo = `https://ani.zenlite.workers.dev/icons/temas/icon-${temaActivo}.png`;
    const posterTema = `https://ani.zenlite.workers.dev/icons/temas/poster-${temaActivo}.png`;

    // Función para cargar el iframe con el ID de TMDB
    const cargarIframeConTMDB = (tmdbId, tmdbSeason, mediaType) => {
      if (reproduccionId !== reproduccionActualId) return;
      // debugLog(tSalto(), "TMDB resuelto, creando iframe Vidrift ep", episodioActualIndex);
      cancelarFallbackDeCarga();
      debugLog("Cargando Vidrift con el ID de TMDB.", tmdbId);

      // Construir URL con todos los parámetros de branding.
      // Vidrift tiene formas distintas para serie y película:
      // /tv/{tmdbId}/{temporada}/{episodio} y /movie/{tmdbId}.
      const esPelicula = mediaType === "movie";
      // Cuando la temporada del slug no existe en TMDB se reproduce desde la
      // temporada 1 unificada: el capítulo local se desplaza por los caps de
      // las temporadas anteriores (episodioOffsetTemporadaVidrift).
      const offsetEpisodioTemporada = esPelicula ? 0 : Number(episodioOffsetTemporadaVidrift) || 0;
      const episodioVidrift = Number(episodioActualIndex) + offsetEpisodioTemporada;
      const baseUrl = esPelicula
        ? `https://embed.vidrift.net/embed/movie/${tmdbId}`
        : `https://embed.vidrift.net/embed/tv/${tmdbId}/${tmdbSeason}/${episodioVidrift}`;

      const params = new URLSearchParams({
        brand: "Anizen",
        brandColor: brandColor,
        brandLogo,
        poster: posterTema,
        watermark: "1",
        showTitle: "1",
        // hide: "episodes",
        // URLSearchParams codifica los espacios; no pasar el valor ya codificado.
        font: "IBM%20Plex%20Sans",
        // Intento ligero inicial; el listener posterior lo corrige si el
        // proveedor interno de Vidrift no respeta este parámetro.
        sub: "es",
        download: "1",
        autoskip: modoMaratonActivo ? "1" : "0",
        autonext: modoMaratonActivo ? "1" : "0"
      });
      // Con fs=parent el botón de fullscreen del player avisa por
      // postMessage y la página pone en fullscreen #video, que sobrevive
      // al reemplazo del iframe: el salto automático de capítulo no sale
      // de pantalla completa (requestFullscreen sin gesto sería rechazado).
      // fs=parent se envía siempre: donde hay Fullscreen API el fullscreen es
      // real sobre #video; en iPhone el padre lo simula con CSS fijo.
      params.set("fs", "parent");
      const vidriftUrl = `${baseUrl}?${params.toString()}`;

      const iframe = document.createElement("iframe");
      iframe.src = vidriftUrl;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; fullscreen";
      iframe.style.border = "0";
      iframe.sandbox = "allow-scripts allow-same-origin allow-forms allow-presentation";

      // `sub=es` intenta preseleccionarlo al cargar. Cuando algún proveedor
      // interno no lo respeta, se corrige al recibir las pistas reales.
      const preferirAudioEspanol = preferenciaDoblado;
      const preferirSubtitulosEspanol = true;
      const inicioCargaFuentesVidrift = Date.now();
      let firmaEstadoVidrift = null;
      let sondeosEstadoSinCambio = 0;
      let vidriftEstaReproduciendo = false;
      let estadoVidriftActual = null;
      let subtituloEspanolPendiente = null;
      let intentosSubtituloEspanol = 0;
      let timeoutSubtituloEspanol = null;
      let audioComprobado = !preferirAudioEspanol;
      let subtitulosComprobados = false;
      let recibirEstadoVidrift;
      let intervaloEstadoVidrift = null;
      let intentosInfoSiguiente = 0;
      let avisoSubEspanolAgotado = false;
      const servidoresVidriftProbados = new Set();
      let servidorVidriftOriginal = null;

      const enviarInformacionSiguienteAVidrift = () => {
        // Mismo criterio que los botones de navegación: el siguiente es el
        // vecino en la lista, no el primer número mayor (hay series con
        // especiales o huecos en la numeración).
        const posActual = obtenerPosicionEpisodio(episodioActualIndex);
        const siguiente = posActual === -1
          ? episodios.find(({ number }) => Number(number) > Number(episodioActualIndex))
          : episodios[posActual + 1];

        // La lista de capítulos y el iframe se cargan en paralelo. Esperar un
        // instante evita ocultar el botón "Siguiente episodio" por error.
        if (!siguiente && episodios.length === 0 && intentosInfoSiguiente++ < 8) {
          setTimeout(enviarInformacionSiguienteAVidrift, 500);
          return;
        }

        const next = !esPelicula && siguiente
          ? { season: tmdbSeason, episode: Number(siguiente.number) + offsetEpisodioTemporada }
          : null;
        iframe.contentWindow?.postMessage(
          { type: "vidrift:nextup-info", next },
          ORIGEN_VIDRIFT
        );
        debugLog("[Vidrift] Información de siguiente capítulo enviada.", {
          siguiente: next,
          modoMaratonActivo
        });
      };

      const limpiarListenerVidrift = () => {
        clearTimeout(timeoutSubtituloEspanol);
        clearInterval(intervaloEstadoVidrift);
        window.removeEventListener("message", recibirEstadoVidrift);
      };

      const solicitarEstadoVidrift = () => {
        iframe.contentWindow?.postMessage(
          { type: "vidrift:get-state" },
          "https://embed.vidrift.net"
        );
      };

      const normalizarIdioma = (texto) => String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const esEspanol = (pista = {}) => {
        const codigo = String(
          pista.value || pista.code || pista.lang || pista.language || pista.locale || ""
        ).toLowerCase();
        const descripcion = normalizarIdioma([
          pista.label, pista.name, pista.title, pista.language,
          pista.lang, pista.locale, pista.code
        ].filter(Boolean).join(" "));
        return /(?:^|[-_])(?:es|spa)(?:[-_]|$)/i.test(codigo)
          || /\b(?:espanol|spanish|castellano|castilian|latam|latino(?:americano)?)\b/.test(descripcion);
      };

      const seleccionarSubtituloEspanol = (subtitulo) => {
        if (!subtitulo?.value || estadoVidriftActual?.subtitle === subtitulo.value) {
          subtitulosComprobados = true;
          return;
        }
        subtituloEspanolPendiente = subtitulo.value;
        iframe.contentWindow.postMessage(
          { type: "vidrift:set", subtitle: subtitulo.value },
          ORIGEN_VIDRIFT
        );
        clearTimeout(timeoutSubtituloEspanol);
        timeoutSubtituloEspanol = setTimeout(() => {
          if (reproduccionId !== reproduccionActualId || subtituloEspanolPendiente !== subtitulo.value) return;
          if (intentosSubtituloEspanol++ < 2) seleccionarSubtituloEspanol(subtitulo);
          else subtituloEspanolPendiente = null;
        }, 1200);
      };

      recibirEstadoVidrift = (event) => {
        if (event.origin !== ORIGEN_VIDRIFT || event.source !== iframe.contentWindow) return;
        if (event.data?.type === "vidrift:command-error" && event.data.field === "subtitle") {
          subtituloEspanolPendiente = null;
          clearTimeout(timeoutSubtituloEspanol);
          return;
        }
        if (event.data?.type !== "vidrift:state") return;

        estadoVidriftActual = event.data;
        const audioEspanol = event.data.audios?.find(esEspanol);
        const subtituloEspanol = event.data.subtitles?.find(esEspanol);

        if (preferirSubtitulosEspanol && !subtituloEspanol) {
          const servidorActual = event.data.server;
          servidorVidriftOriginal ??= servidorActual;
          if (servidorActual) servidoresVidriftProbados.add(servidorActual);
          const siguienteServidor = event.data.servers?.find((servidor) =>
            servidor.value && servidor.value !== servidorActual
              && (!servidor.state || servidor.state === "ready")
              && !servidoresVidriftProbados.has(servidor.value)
          );
          if (siguienteServidor) {
            servidoresVidriftProbados.add(siguienteServidor.value);
            iframe.contentWindow.postMessage({ type: "vidrift:set", server: siguienteServidor.value }, ORIGEN_VIDRIFT);
          } else if (!avisoSubEspanolAgotado && Array.isArray(event.data.servers) && event.data.servers.length > 0) {
            avisoSubEspanolAgotado = true;
            mostrarPildora(
              "Server sin subtítulos en español. Prueba el siguiente.", "default",
              () => intentarSiguienteServidor(reproduccionId, "Vidrift sin subtítulos en español", false), 6000
            );
            if (servidorActual && servidorActual !== servidorVidriftOriginal) {
              iframe.contentWindow.postMessage({ type: "vidrift:set", server: servidorVidriftOriginal }, ORIGEN_VIDRIFT);
            }
          }
        }

        if (preferirAudioEspanol && audioEspanol && event.data.audio !== audioEspanol.value) {
          iframe.contentWindow.postMessage({ type: "vidrift:set", audio: audioEspanol.value }, ORIGEN_VIDRIFT);
        }
        if (preferirSubtitulosEspanol && subtituloEspanol) {
          if (event.data.subtitle === subtituloEspanol.value) {
            subtituloEspanolPendiente = null;
            clearTimeout(timeoutSubtituloEspanol);
            subtitulosComprobados = true;
          } else if (subtituloEspanolPendiente !== subtituloEspanol.value) {
            intentosSubtituloEspanol = 0;
            seleccionarSubtituloEspanol(subtituloEspanol);
          }
        }
        audioComprobado ||= !preferirAudioEspanol || Array.isArray(event.data.audios);
        subtitulosComprobados ||= event.data.subtitle === subtituloEspanol?.value;
        if (audioComprobado && subtitulosComprobados) {
          limpiarListenerVidrift();
          if (limpiarPreferenciaSubtitulos === limpiarListenerVidrift) limpiarPreferenciaSubtitulos = null;
        }
      };
      window.addEventListener("message", recibirEstadoVidrift);
      limpiarPreferenciaSubtitulos = limpiarListenerVidrift;

      // Vigilancia de fallos internos de Vidrift, independiente del listener
      // de idiomas: aunque este se limpie al resolver pistas o a los 30 s,
      // este sondeo sigue pidiendo vidrift:state para detectar que todas las
      // fuentes del embed fallaron y pasar al siguiente servidor de la página.
      // Se limpia solo cuando esta reproducción deja de ser la activa.
      const sondeoEstadoFallosVidrift = setInterval(() => {
        if (reproduccionId !== reproduccionActualId) {
          clearInterval(sondeoEstadoFallosVidrift);
          window.removeEventListener("message", vigilarFallosVidrift);
          return;
        }
        solicitarEstadoVidrift();
      }, 8000);
      const vigilarFallosVidrift = (event) => {
        if (
          event.origin !== "https://embed.vidrift.net" ||
          event.source !== iframe.contentWindow
        ) return;

        // vidrift:progress llega cada ~5 s solo cuando hay reproducción
        // real: una vez visto, el embed está vivo aunque el estado se
        // repita (pausa, buffering largo, etc.).
        if (event.data?.type === "vidrift:progress") {
          vidriftEstaReproduciendo = true;
          return;
        }
        if (event.data?.type !== "vidrift:state") return;

        // Vidrift marca todos como "failed" de forma transitoria entre
        // rondas de reintento y a veces aparca el último en "ready" aunque
        // nada reproduce (pantalla "won't play"). Por eso ambas señales
        // exigen las mismas guardas: nunca hubo vidrift:progress, ningún
        // servidor tiene duración, el estado se estabilizó varios sondeos
        // y ya pasó el tiempo mínimo de carga.
        const servidoresVidrift = event.data.servers;
        const todosDefinitivos = Array.isArray(servidoresVidrift)
          && servidoresVidrift.length > 0
          && servidoresVidrift.every(s => s.state === "failed" || s.state === "ready");
        const firma = JSON.stringify([
          event.data.server,
          servidoresVidrift?.map(s => s.state) ?? null,
          event.data.duration
        ]);
        if (firma === firmaEstadoVidrift) {
          sondeosEstadoSinCambio++;
        } else {
          firmaEstadoVidrift = firma;
          sondeosEstadoSinCambio = 0;
        }
        const senalFallos = vidriftAgotoSusFuentes(event.data) || (
          todosDefinitivos
          && servidoresVidrift.some(s => s.state === "failed")
        );
        const agotadas = senalFallos
          && !vidriftEstaReproduciendo
          && !(Number(event.data.duration) > 0)
          && sondeosEstadoSinCambio >= 2
          && Date.now() - inicioCargaFuentesVidrift >= 20000;
        debugLog("[Vidrift] Estado recibido por la vigilancia de fallos", {
          server: event.data.server,
          estados: servidoresVidrift?.map(s => `${s.value}=${s.state || "sin-probar"}`).join(" ") ?? "sin-lista",
          duracion: event.data.duration,
          agotadas
        });
        if (!agotadas) return;

        clearInterval(sondeoEstadoFallosVidrift);
        window.removeEventListener("message", vigilarFallosVidrift);

        // IDs compartidos entre serie y película en TMDB: si /tv/ no tiene
        // fuentes pero /movie/ existe, se reintenta como película antes de
        // saltar al siguiente servidor externo. La caché se corrige para
        // que la próxima visita vaya directo a /movie/.
        if (!esPelicula) {
          existePeliculaTmdb(tmdbId).then(esPeliculaAlternativa => {
            if (reproduccionId !== reproduccionActualId) return;
            if (!esPeliculaAlternativa) {
              intentarSiguienteServidor(reproduccionId, "Vidrift agotó todas sus fuentes para este título");
              return;
            }
            guardarCacheTmdbVidrift(
              tmdbId,
              tmdbSeason,
              "movie",
              cacheTmdbVidrift?.temporadaEfectiva ?? null,
              0,
              true
            );
            debugLog("[Vidrift] /tv/ agotó sus fuentes; se reintenta como película.", { animeId, tmdbId });
            cargarIframeConTMDB(tmdbId, 1, "movie");
          });
          return;
        }

        intentarSiguienteServidor(reproduccionId, "Vidrift agotó todas sus fuentes para este título");
      };
      window.addEventListener("message", vigilarFallosVidrift);

      setTimeout(() => {
        if (reproduccionId === reproduccionActualId) {
          limpiarListenerVidrift();
          if (limpiarPreferenciaSubtitulos === limpiarListenerVidrift) limpiarPreferenciaSubtitulos = null;
        }
      }, 30000);

      iframe.addEventListener("error", () => {
        if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "El iframe de Vidrift produjo un error");
      });
      programarFallbackDeCarga(reproduccionId, 12000, "Vidrift tardó demasiado en cargar");
      const tIframe = performance.now();
      iframe.addEventListener("load", () => {
        if (reproduccionId !== reproduccionActualId) return;

        cancelarFallbackDeCarga();
        enviarEstadoFullscreenVidrift();
        solicitarEstadoVidrift();
        enviarInformacionSiguienteAVidrift();
        // Las pistas pueden aparecer unos segundos después de cargar o de
        // cambiar de servidor interno.
        intervaloEstadoVidrift = setInterval(solicitarEstadoVidrift, 1500);
      });

      if (reproduccionId !== reproduccionActualId) return;
      videoDiv.innerHTML = "";
      videoDiv.appendChild(iframe);
      ventanaVidriftActiva = iframe.contentWindow;
    };

    const tTmdb = performance.now();
    const asociacion = await resolverDatosTmdbVidrift();
    // debugLog(tSalto(), "resolverDatosTmdbVidrift tardó", Math.round(performance.now() - tTmdb), "ms");
    if (reproduccionId !== reproduccionActualId) return;

    if (!asociacion?.tmdbId) {
      const motivo = asociacion?.error
        || (asociacion === null ? "La temporada guardada no existe en TMDB" : "Error al consultar Firestore o TMDB para Vidrift");
      intentarSiguienteServidor(reproduccionId, motivo);
      return;
    }

    cargarIframeConTMDB(asociacion.tmdbId, asociacion.tmdbSeason, asociacion.mediaType);
    return;
  }

  if (esFuenteVideoDirecta(url)) {
    videoDiv.appendChild(crearVideoDirecto(url, reproduccionId));
    return;
  }

  cargarIframeServidor(url, videoDiv, reproduccionId);
}

function intentarSiguienteServidor(reproduccionId = reproduccionActualId, motivo = "El servidor actual falló o no respondió", mostrarAviso = true) {
  if (reproduccionId !== reproduccionActualId) return;

  const siguienteIndice = embeds.findIndex((servidor, indice) =>
    indice > servidorActualIndex && !servidor.url?.includes("mediafire.com")
  );

  if (siguienteIndice === -1) {
    limpiarPreferenciaSubtitulos?.();
    limpiarPreferenciaSubtitulos = null;

    // El propio iframe de Vidrift ya muestra su estado cuando todas sus
    // fuentes internas fallan. Si no hay un servidor externo al cual saltar,
    // conservarlo evita taparlo con el mensaje genérico de la página.
    const esAgotamientoInternoDeVidrift = motivo === "Vidrift agotó todas sus fuentes para este título"
      && embeds[servidorActualIndex]?.vidrift === true;
    if (esAgotamientoInternoDeVidrift) {
      debugLog("[Reproducción] Vidrift agotó sus fuentes y no hay respaldo externo; se conserva el iframe.", {
        animeId,
        episodio: episodioActualIndex
      });
      return;
    }

    console.error("[Reproducción] No hay más servidores disponibles.", {
      animeId,
      episodio: episodioActualIndex,
      servidorActual: embeds[servidorActualIndex]?.nombre || embeds[servidorActualIndex]?.name || "desconocido",
      motivo
    });
    mostrarEstadoDeServidores("No hay más servidores disponibles para este episodio.");
    return;
  }

  const siguienteServidor = embeds[siguienteIndice];
  const siguienteBoton = document.querySelector(`#controles button[data-server-index="${siguienteIndice}"]`);
  if (!siguienteBoton) return;

  // Esto se conserva también en producción: un salto automático debe ser
  // trazable sin habilitar el registro detallado de Vidrift.
  registrarCambioAutomaticoServidor({
    animeId,
    episodio: episodioActualIndex,
    desde: nombreVisibleServidor(embeds[servidorActualIndex], servidorActualIndex),
    hacia: nombreVisibleServidor(siguienteServidor, siguienteIndice),
    motivo
  });

  // El motivo también se muestra en pantalla: Live Server y algunos iframes
  // pueden limpiar la consola mientras se reemplaza el reproductor. Cuando el
  // salto lo inicia el propio aviso (p. ej. la píldora de subtítulos), el
  // mensaje sería redundante y se omite.
  if (mostrarAviso) {
    mostrarPildora(
      `${motivo}. Cambiando a ${nombreVisibleServidor(siguienteServidor, siguienteIndice)}.`,
      "default"
    );
  }

  mostrarVideo(siguienteServidor, siguienteBoton);
}
function actualizarEstadoBotones() {
  // Si no hay episodios cargados, mantener botones desactivados
  if (!episodios || episodios.length === 0) {
    btnAnterior.disabled = true;
    btnAnterior.classList.add('desactivado');
    btnSiguiente.disabled = true;
    btnSiguiente.classList.add('desactivado');
    if (btnSelectorCapitulo) {
      btnSelectorCapitulo.disabled = true;
      btnSelectorCapitulo.classList.add('desactivado');
    }
    return;
  }

  const pos = obtenerPosicionEpisodio(episodioActualIndex);
  if (pos !== -1) {
    const esPrimerEpisodio = pos === 0;
    btnAnterior.disabled = esPrimerEpisodio;
    btnAnterior.classList.toggle('desactivado', esPrimerEpisodio);

    const esUltimoEpisodio = pos === episodios.length - 1;
    btnSiguiente.disabled = esUltimoEpisodio;
    btnSiguiente.classList.toggle('desactivado', esUltimoEpisodio);
  } else {
    // Episodio fuera de la lista (ej. 404 o carga a medio camino):
    // conservar la comparación numérica como antes.
    const primerNumero = getNumeroCapitulo(episodios[0], 0);
    const esPrimerEpisodio = episodioActualIndex <= primerNumero;
    btnAnterior.disabled = esPrimerEpisodio;
    btnAnterior.classList.toggle('desactivado', esPrimerEpisodio);

    const ultimoEpisodio = episodios[episodios.length - 1];
    const ultimoNumero = getNumeroCapitulo(ultimoEpisodio, episodios.length - 1);
    const esUltimoEpisodio = episodioActualIndex >= ultimoNumero;
    btnSiguiente.disabled = esUltimoEpisodio;
    btnSiguiente.classList.toggle('desactivado', esUltimoEpisodio);
  }
  
  // Activar el selector de capítulos cuando hay episodios
  if (btnSelectorCapitulo) {
    btnSelectorCapitulo.disabled = false;
    btnSelectorCapitulo.classList.remove('desactivado');
  }
}

// Diagnóstico temporal del salto de capítulo: midiendo cada etapa para
// localizar la demora entre el aviso de fin de episodio y el nuevo capítulo.
const tSalto = () => `[SALTO-CAP +${Math.round(performance.now())}ms]`;

async function irAlSiguienteCapitulo() {
  const pos = obtenerPosicionEpisodio(episodioActualIndex);
  const siguiente = pos === -1 ? undefined : episodios[pos + 1];
  if (siguiente) {
    const inicio = performance.now();
    debugLog(tSalto(), "inicio salto a cap", siguiente.number);
    // El guardado de "visto" (getDoc + setDoc en Firestore) va en paralelo con
    // la carga del siguiente capítulo: esperarlo en serie añadía segundos al
    // salto automático de fin de episodio.
    const guardadoVisto = marcarCapituloActualComoVisto()
      .then(() => debugLog(tSalto(), "visto guardado", Math.round(performance.now() - inicio), "ms"))
      .catch(e => console.warn("[Vidrift] error guardando visto", e));
    await cargarVideoDesdeEpisodio(siguiente.number);
    debugLog(tSalto(), "cargarVideoDesdeEpisodio listo", Math.round(performance.now() - inicio), "ms");
    await guardadoVisto;
    refrescarUIEstadoCapitulo();
    sincronizarUINavegacion();
    debugLog(tSalto(), "salto completo", Math.round(performance.now() - inicio), "ms");
    return true;
  }
  return false;
}

// Configurar navegación de botones
btnSiguiente.addEventListener("click", async (e) => {
  e.preventDefault();
  await irAlSiguienteCapitulo();
});

btnAnterior.addEventListener("click", async (e) => {
  e.preventDefault();
  const pos = obtenerPosicionEpisodio(episodioActualIndex);
  const anterior = pos > 0 ? episodios[pos - 1] : undefined;
  if (anterior) {
    // const marcarVistoBtn = document.getElementById("btn-estado-episodio");
    // if (marcarVistoBtn && marcarVistoBtn.classList.contains('visto') && !toggleInProgress) {
    //   await toggleYGuardarEstadoCapitulo();
    // }
    await cargarVideoDesdeEpisodio(anterior.number);
    refrescarUIEstadoCapitulo();
    sincronizarUINavegacion();
  }
});


// Vidrift solo necesita el número de episodio de la URL: se arranca de
// inmediato, en paralelo con la carga de episodios, sin esperar a Firestore.
// Si la lista tarda, cargarVideoDesdeEpisodio usa un episodio mínimo.
ejecutarEnSegundoPlano(
  cargarVideoDesdeEpisodio(episodioActualIndex),
  "No se pudo iniciar la carga temprana del episodio"
);

cargarEpisodios()
  .then(() => {
    episodiosCargaTerminada = true;
    actualizarEstadoBotones();
    // Generar dropdown después de cargar episodios inicialmente
    if (typeof generarDropdownCapitulos === 'function') {
      generarDropdownCapitulos();
    }
    actualizarTextoBotonesNavegacion();
  })
  .catch(error => {
    episodiosCargaTerminada = true;
    console.error("Error al cargar episodios inicialmente:", error);
    // Si la lista nunca llega, la navegación queda desactivada con
    // textos limpios en vez de mostrar capítulos equivocados.
    actualizarTextoBotonesNavegacion();
  });

function establecerModoCine(activo) {
  document.body.classList.toggle("cine", activo);
  localStorage.setItem("cineActivo", String(activo));
}

const ORIGEN_VIDRIFT = "https://embed.vidrift.net";

// Listener para detectar cambios de episodio en el iframe de Vidrift
window.addEventListener('message', async (event) => {
  // Verificar que el mensaje viene de Vidrift
  if (event.origin !== 'https://embed.vidrift.net' && event.origin !== 'https://vidrift.net') {
    return;
  }

  // Solo responder al iframe actualmente visible. Evita que un iframe que
  // acaba de reemplazarse altere la URL o el progreso.
  if (event.source !== ventanaVidriftActiva) return;

  // Con fs=parent el botón de fullscreen del player llega como mensaje.
  // Debe responderse dentro del handler para que el clic del usuario dentro
  // del iframe siga contando como gesto de requestFullscreen.
  if (event.data?.type === "vidrift:fullscreen") {
    manejarFullscreenVidrift(event.data.on === true);
    return;
  }

  // debugLog(tSalto(), "evento Vidrift recibido:", event.data?.type, event.data?.episode ?? "");

  // Vidrift emite este evento al comenzar créditos o el ending. En modo
  // maratón saltamos de inmediato, sin esperar los cinco segundos de la
  // tarjeta "Siguiente episodio".
  if (event.data?.type === "vidrift:nextup" && modoMaratonActivo) {
    if (saltoOutroVidriftEnCurso) return;
    saltoOutroVidriftEnCurso = true;
    try {
      const avanzo = await irAlSiguienteCapitulo();
      debugLog("[Vidrift] Outro omitido por modo maratón.", { avanzo });
    } finally {
      saltoOutroVidriftEnCurso = false;
    }
    return;
  }

  // Algunos embeds piden al padre continuar con el siguiente capítulo en
  // vez de navegar internamente. Usamos el mismo flujo que el botón externo
  // para guardar el visto, mantener la URL y crear el nuevo iframe.
  if (event.data?.type === "vidrift:nextup-play") {
    const avanzo = await irAlSiguienteCapitulo();
    debugLog("[Vidrift] Solicitud de siguiente capítulo atendida.", { avanzo });
    return;
  }

  // Un capítulo marcado como no emitido no podrá reproducirse en Vidrift.
  if (event.data?.type === "vidrift:unreleased") {
    console.warn("[Vidrift] El capítulo aún no está emitido; se probará el siguiente servidor.", {
      animeId,
      episodio: episodioActualIndex
    });
    intentarSiguienteServidor(reproduccionActualId, "Vidrift indicó que el capítulo no está emitido");
    return;
  }

  // "vidrift:episode" es el evento oficial. Se conserva episodeChange por
  // compatibilidad con embeds anteriores.
  const esCambioDeEpisodio = ["vidrift:episode", "episodeChange"].includes(event.data?.type);
  const nuevoEpisodio = esCambioDeEpisodio ? event.data.episode : null;

  const numeroEpisodio = Number(nuevoEpisodio);
  // Vidrift numera dentro de la temporada unificada de TMDB; si la web
  // reparte la serie en varias temporadas hay que restar el offset para
  // obtener el capítulo local de esta página.
  const episodioLocalVidrift = numeroEpisodio - episodioOffsetTemporadaVidrift;
  // Si Vidrift avanza más allá del final de la temporada local (el siguiente
  // capítulo global pertenece a otra temporada de la web), el número local
  // no existe en la lista y el evento se ignora.
  const episodioLocalExiste = !episodiosCargados || !episodios.length
    || episodios.some((ep, idx) => String(getNumeroCapitulo(ep, idx)) === String(episodioLocalVidrift));
  if (
    Number.isInteger(episodioLocalVidrift) &&
    episodioLocalVidrift > 0 &&
    episodioLocalVidrift !== episodioActualIndex &&
    episodioLocalExiste &&
    !cambioEpisodioVidriftEnCurso
  ) {
    cambioEpisodioVidriftEnCurso = true;
    debugLog("[Vidrift] Cambio interno de capítulo detectado.", numeroEpisodio, "-> local", episodioLocalVidrift);

    try {
      // Se hace antes de actualizar el índice, igual que al usar el botón
      // externo de capítulo siguiente.
      await marcarCapituloActualComoVisto();

      // Actualizar el episodio actual
      episodioActualIndex = episodioLocalVidrift;

      // Actualizar URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("episode", episodioLocalVidrift);
      newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
      window.history.pushState({}, "", newUrl);

      sincronizarUINavegacion();

      // Refrescar estado de visto.
      await refrescarUIEstadoCapitulo();
    } finally {
      cambioEpisodioVidriftEnCurso = false;
    }
  }
});


document.addEventListener('DOMContentLoaded', () => {
  const cineBtn = document.getElementById('cine');

  cineBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    establecerModoCine(!document.body.classList.contains('cine'));
  });

  // En fase de captura: el primer clic con el modo cine activo solo lo
  // cierra y no llega al elemento pulsado (botones, enlaces, etc.).
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('cine')) return;
    establecerModoCine(false);
    e.preventDefault();
    e.stopPropagation();
  }, true);
});
