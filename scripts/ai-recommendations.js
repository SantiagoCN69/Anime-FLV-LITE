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
  return `Actúa como un normalizador de títulos de anime.

1. Identifica "${searchTerm}":

* Busca el título oficial en japonés (romaji).
* Corrige errores ortográficos y nombres incompletos.
* Interpreta traducciones o nombres alternativos y encuentra el anime correcto.

2. Genera:

* Convierte el título oficial a kebab-case (minúsculas y guiones).
* Usa solo el nombre oficial en romaji.
* Recomienda 4 animes similares en género, tono y público objetivo.

Reglas:

* El primer elemento debe ser el anime corregido de "${searchTerm}".
* Devuelve exactamente 5 nombres.
* Formato: kebab-case.
* Sin espacios después de las comas.
* Sin explicaciones, texto adicional ni saltos de línea.
* Nunca busques animes en español, siempre en japonés.

Ejemplo:
kaoru-hana-wa-rin-to-saku,horimiya,kimi-ni-todoke,blue-box,skip-to-loafer
`;
}

export function parseAnimeNamesFromResponse(text) {
  return text
    .replace(/\n/g, ',')
    .split(',')
    .map(title =>
      title
        .trim()
        .replace(/-/g, ' ')
        .replace(/:/g, '')
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean)
    .slice(0, 5);
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
    const response = await fetch(
      `${SEARCH_URL}?q=${encodeURIComponent(nombre)}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const animes = Array.isArray(data) ? data : (data.data || []);

    if (!animes.length) return null;

    const nombreLower = nombre.toLowerCase();

    return (
      animes.find(a => a.title.toLowerCase() === nombreLower) ||
      animes
        .filter(a => a.title.toLowerCase().includes(nombreLower))
        .sort((a, b) => a.title.length - b.title.length)[0] ||
      animes[0]
    );
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