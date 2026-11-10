const IA_CHAT_URL = 'https://backend-ia-anime.onrender.com/api/chat';
const SEARCH_URL = 'https://backend-animeflv-lite.onrender.com/api/search';

export const IA_SECTION_HTML = `
<div id="recomendaciones-ia-busqueda" class="recomendaciones-ia-busqueda">
  <h2>Recomendaciones de la IA</h2>
  <div id="anime-grid-ia-busqueda">
    <span class="span-carga">Generando recomendaciones...</span>
  </div>
</div>`;

export function buildSimilarAnimePrompt(searchTerm) {
  return `Actúa como un recomendador de anime.

1. Analiza "${searchTerm}":

* Si es un título de anime (o una búsqueda de título), identifica el título oficial en japonés (romaji), corrige errores ortográficos y nombres incompletos, e interpreta traducciones o nombres alternativos.
* Si NO es un título sino un género, tema, tono o tipo de historia (por ejemplo "yaoi", "isekai", "romance escolar"), úsalo directamente como criterio de búsqueda. No intentes convertirlo en un título.

2. Genera:

* Exactamente 5 nombres de animes en romaji oficial.
* Si "${searchTerm}" era un título, el primer elemento debe ser ese anime corregido y los otros 4 deben ser similares en género, tono y público objetivo.
* Si "${searchTerm}" no era un título, devuelve solo 5 recomendaciones afines al criterio.

Reglas:

* Devuelve únicamente los 5 nombres separados por comas.
* Formato: kebab-case (minúsculas y guiones en lugar de espacios).
* Sin espacios después de las comas.
* Sin explicaciones, texto adicional, saludos ni saltos de línea.
* Nunca uses títulos en español ni en inglés.

Ejemplo:
kaoru-hana-wa-rin-to-saku,horimiya,kimi-ni-todoke,blue-box,skip-to-loafer
`;
}

// Un título válido no contiene puntuación de frase. Se admiten palabras
// separadas por espacios o guiones (la IA a veces ignora el formato kebab).
const PATRON_PUNTUACION_PROSA = /[.!?;:"'¿¡()]/;
const PATRON_TITULO = /^[a-z0-9]+(?:[- ][a-z0-9]+)*$/;
const MINIMO_TITULOS_VALIDOS = 3;

export function parseAnimeNamesFromResponse(text) {
  const crudos = String(text || '')
    .split(/[\n,]+/)
    .map(t => t
      .trim()
      .toLowerCase()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
      .trim()
    )
    .filter(Boolean);

  const validos = crudos.filter(t =>
    PATRON_TITULO.test(t) && !PATRON_PUNTUACION_PROSA.test(t)
  );

  if (validos.length < MINIMO_TITULOS_VALIDOS) {
    console.warn('[AI] La IA no devolvió una lista válida de títulos.');
    return [];
  }

  // Se conserva el formato con espacios que espera el buscador del backend.
  return validos.slice(0, 5).map(t => t.replace(/-/g, ' '));
}

export async function fetchIAResponse(prompt, signal) {
  const response = await fetch(IA_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: prompt }),
    signal
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.response || '';
}

export async function resolveAnimeByName(nombre, signal) {
  try {
    const query = encodeURIComponent(nombre);
    const response = await fetch(
      `${SEARCH_URL}?q=${query}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const animes = Array.isArray(data) ? data : (data.data || []);

    if (!animes.length) return null;

    const nombreLower = nombre.toLowerCase();

    const elegido =
      animes.find(a => String(a.title || a.titulo || a.name || '').toLowerCase() === nombreLower) ||
      animes
        .filter(a => String(a.title || a.titulo || a.name || '').toLowerCase().includes(nombreLower))
        .sort((a, b) => String(a.title || '').length - String(b.title || '').length)[0] ||
      animes[0];

    return elegido;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    console.warn(`[AI] Error resolving "${nombre}"`, error);
    return null;
  }
}

export async function fetchRecommendationsFromIA(searchTerm, signal) {
  const prompt = buildSimilarAnimePrompt(searchTerm);
  const respuesta = await fetchIAResponse(prompt, signal);
  const nombres = parseAnimeNamesFromResponse(respuesta);

  if (!nombres.length) return [];

  const resultados = await Promise.all(
    nombres.map(async nombre => {
      try {
        return await resolveAnimeByName(nombre, signal);
      } catch (error) {
        if (error.name === 'AbortError') throw error;

        console.warn(`[AI] Failed to resolve "${nombre}"`, error);
        return null;
      }
    })
  );

  const idsVistos = new Set();
  const animes = [];

  for (const anime of resultados) {
    if (!anime || idsVistos.has(anime.id)) continue;

    idsVistos.add(anime.id);
    animes.push(anime);
  }

  return animes;
}

export function attachIaGridWheelScroll(grid) {
  if (!grid) return;

  grid.onwheel = e => {
    if (e.deltaY === 0) return;

    e.preventDefault();
    grid.scrollLeft += e.deltaY;
  };
}

export async function loadIaRecommendationsIntoGrid({
  searchTerm,
  grid,
  isStale,
  signal,
  crearAnimeCard,
  observerAnimeCards
}) {
  if (!grid) return;

  try {
    const animes = await fetchRecommendationsFromIA(searchTerm, signal);

    if (isStale?.()) return;

    grid.innerHTML = '';

    if (!animes.length) {
      grid.innerHTML =
        '<span class="span-carga">No se pudieron generar recomendaciones</span>';
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const anime of animes) {
      fragment.appendChild(crearAnimeCard(anime));
    }

    grid.appendChild(fragment);

    observerAnimeCards?.();
  } catch (error) {
    if (error.name === 'AbortError' || isStale?.()) return;

    console.error('[AI] Error al cargar recomendaciones:', error);

    grid.innerHTML =
      '<span class="span-carga">No se pudieron generar recomendaciones</span>';
  }
}

export function buildFavoritesAnimePrompt(favoritos, excluidos = [], filtroExtra = '') {
  const listaFavoritos = favoritos.join(', ');
  const listaExcluidos = excluidos.length ? excluidos.join(', ') : 'Ninguno';
  const instruccionExtra = filtroExtra ? `\n* Considera esta especificación clave: ${filtroExtra}.` : '';

  return `Actúa como un recomendador experto de anime.

1. Analiza los siguientes animes favoritos: ${listaFavoritos}.
2. Genera 5 recomendaciones de animes similares en género, tono o temática.

Reglas:
* NUNCA recomiendes animes de esta lista de excluidos: ${listaExcluidos}.${instruccionExtra}
* Usa exclusivamente el título oficial en japonés (romaji). Nunca en español ni inglés.
* Formato obligatorio: kebab-case (minúsculas y guiones en lugar de espacios).
* Devuelve exactamente 5 nombres separados por comas.
* Sin explicaciones, introducciones ni saltos de línea.

Ejemplo:
shingeki-no-kyojin,fullmetal-alchemist-brotherhood,jujutsu-kaisen,kimetsu-no-yaiba,hunter-x-hunter`;
}

export function buildCustomSearchAnimePrompt(descripcion, excluidos = []) {
  const listaExcluidos = excluidos.length ? excluidos.join(', ') : 'Ninguno';

  return `Actúa como un buscador y recomendador de anime.

1. Encuentra 5 animes que coincidan con esta descripción: "${descripcion}".

Reglas:
* NUNCA incluyas animes de esta lista: ${listaExcluidos}.
* Usa exclusivamente el título oficial en japonés (romaji). Nunca en español ni inglés.
* Formato obligatorio: kebab-case (minúsculas y guiones en lugar de espacios).
* Devuelve exactamente 5 nombres separados por comas.
* Sin explicaciones, introducciones ni saltos de línea.

Ejemplo:
solo-leveling,sword-art-online,tower-of-god,the-daily-life-of-the-immortal-king,overlord`;
}