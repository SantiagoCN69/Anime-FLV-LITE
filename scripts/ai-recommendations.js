const IA_CHAT_URL = 'https://backend-ia-anime.onrender.com/api/chat';
//const IA_CHAT_URL = '.com/chat';

const SEARCH_URL = 'https://backend-animeflv-lite.onrender.com/api/search';
//const SEARCH_URL = 'http://localhost:3001/api/search';

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
    .map(t => t.trim()
      .replace(/-/g, ' ')
      .replace(/:/g, '')
      .replace(/\s+/g, ' '))
    .filter(Boolean);
}

export async function fetchIAResponse(prompt, signal) {
  console.log('[AI] Fetching IA response with prompt:', prompt);
  const response = await fetch(IA_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt }),
    signal
  });

  if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

  const data = await response.json();
  console.log('[AI] IA response received:', data.response);
  return data.response || '';
}

export async function resolveAnimeByName(nombre) {
  console.log('[AI] Resolving anime by name:', nombre);
  try {
    const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(nombre)}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const data = await res.json();
    const animes = Array.isArray(data) ? data : (data.data || []);
    console.log('[AI] Search results for', nombre, ':', animes.length, 'results');
    if (!animes.length) return null;

    let animeSeleccionado = animes.find(a =>
      a.title.toLowerCase() === nombre.toLowerCase()
    );

    if (!animeSeleccionado) {
      const animesCandidatos = animes.filter(a =>
        a.title.toLowerCase().includes(nombre.toLowerCase())
      );

      if (animesCandidatos.length) {
        animesCandidatos.sort((a, b) => a.title.length - b.title.length);
        animeSeleccionado = animesCandidatos[0];
      } else {
        animeSeleccionado = animes[0];
      }
    }

    console.log('[AI] Selected anime:', animeSeleccionado?.title);
    return animeSeleccionado;
  } catch (err) {
    console.error('[AI] Error al buscar anime:', nombre, err);
    return null;
  }
}

export async function fetchRecommendationsFromIA(searchTerm, signal) {
  console.log('[AI] Fetching recommendations for search term:', searchTerm);
  const prompt = buildSimilarAnimePrompt(searchTerm);
  const respuesta = await fetchIAResponse(prompt, signal);
  const nombres = parseAnimeNamesFromResponse(respuesta);
  console.log('[AI] Parsed anime names from response:', nombres);

  const animes = [];
  const idsVistos = new Set();

  for (const nombre of nombres) {
    const anime = await resolveAnimeByName(nombre);
    if (!anime || idsVistos.has(anime.id)) continue;
    idsVistos.add(anime.id);
    animes.push(anime);
  }

  console.log('[AI] Final recommendations count:', animes.length);
  return animes;
}

export function attachIaGridWheelScroll(grid) {
  if (!grid) return;
  grid.onwheel = (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      grid.scrollLeft += e.deltaY;
    }
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
  console.log('[AI] Loading IA recommendations into grid for:', searchTerm);
  if (!grid) return;

  try {
    const animes = await fetchRecommendationsFromIA(searchTerm, signal);
    if (isStale?.()) {
      console.log('[AI] Request is stale, aborting');
      return;
    }

    grid.innerHTML = '';

    if (!animes.length) {
      console.log('[AI] No recommendations found');
      grid.innerHTML = '<span class="span-carga">No se pudieron generar recomendaciones</span>';
      return;
    }

    console.log('[AI] Rendering', animes.length, 'anime cards');
    const fragment = document.createDocumentFragment();
    animes.forEach(anime => fragment.appendChild(crearAnimeCard(anime)));
    grid.appendChild(fragment);
    if (typeof observerAnimeCards === 'function') observerAnimeCards();
    console.log('[AI] Successfully loaded recommendations');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[AI] Request aborted');
      return;
    }
    console.error('[AI] Error al cargar recomendaciones IA:', error);
    if (isStale?.()) return;
    grid.innerHTML = '<span class="span-carga">No se pudieron generar recomendaciones</span>';
  }
}
