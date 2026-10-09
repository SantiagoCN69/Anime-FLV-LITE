import { observerAnimeCards, crearAnimeCard } from "./utils.js";

// --- CONSTANTES GLOBALES ---
const CACHE_KEY = 'animes_cache_populares';

// Apunta directamente a Netlify aunque estés navegando desde Cloudflare Workers u otro dominio
const MAL_PROXY_URL = 'https://anizenlite.netlify.app/.netlify/functions/mal-proxy-v3';

// Mapeo de estados de MAL a formato interno
const MAL_STATUS_MAP = {
  'airing': '1',
  'complete': '2',
  'upcoming': '3'
};

let currentPage = 1;
let rankingType = 'bypopularity'; // Valor por defecto

// Caché en memoria (5 minutos TTL)
const malCache = new Map();
const MAL_CACHE_TTL = 5 * 60 * 1000;
function centrarPaginacion() {
  const paginationContainer = document.getElementById('pagination-populares');
  const botones = paginationContainer.querySelectorAll('button');
  const botonActual = botones[currentPage - 1];

  if (botonActual) {
    const offsetLeft = botonActual.offsetLeft;
    const botonWidth = botonActual.offsetWidth;
    const containerWidth = paginationContainer.offsetWidth;

    const scrollLeft = offsetLeft - (containerWidth / 2) + (botonWidth / 2);
    paginationContainer.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
  }
}

function updatePagination(paging) {
  const paginationContainer = document.getElementById('pagination-populares');
  paginationContainer.innerHTML = '';

  const nextPageUrl = paging?.next;

  // Cambia el rango visual (ejemplo: 20 páginas hacia adelante y atrás)
  const range = 99; 
  let minPage = Math.max(1, currentPage - 5); // Muestra 5 páginas hacia atrás
  let maxPage = currentPage + range;          // Y 100 hacia adelante

  if (!nextPageUrl) {
    maxPage = currentPage; // Si MAL indica que no hay más datos, frena ahí
  }

  minPage = Math.max(1, minPage);

  for (let i = minPage; i <= maxPage; i++) {
    const button = document.createElement('button');
    button.className = 'page-button';
    button.textContent = i;
    button.addEventListener('click', () => cambiarPagina(i));
    button.classList.toggle('active', i === currentPage);
    paginationContainer.appendChild(button);
  }
}
function cambiarPagina(page) {
  currentPage = page;
  cargarPopulares();
}

// --- UTILIDADES DE FETCH ---

// Verificar caché en memoria
function getMalCache(cacheKey) {
  const cached = malCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MAL_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

// Guardar en caché en memoria
function setMalCache(cacheKey, data) {
  malCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// Fetch a API de MAL v2 a través del proxy de Netlify
async function fetchMALRanking(params = {}) {
  const cacheKey = `mal_ranking_${JSON.stringify(params)}`;
  const cached = getMalCache(cacheKey);
  if (cached) {
    console.log('✅ Usando caché de memoria');
    return cached;
  }

  try {
    const queryParams = new URLSearchParams({
      ranking_type: params.ranking_type || 'bypopularity',
      limit: params.limit || 20,
      fields: 'id,title,main_picture,mean,num_episodes,status,genres,synopsis,media_type',
      offset: params.offset || 0
    });

    const url = `${MAL_PROXY_URL}?${queryParams.toString()}`;
    console.log('🔗 Fetching:', params.ranking_type || 'bypopularity', 'page', (params.offset / 20) + 1);

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Error de autenticación con MyAnimeList');
      } else if (response.status === 429) {
        throw new Error('Rate limit excedido de MyAnimeList. Espere un momento.');
      } else if (response.status >= 400) {
        throw new Error(`Error en API de MyAnimeList: ${response.status}`);
      }
    }

    const data = await response.json();

    // Verificar si hay error en la respuesta del proxy
    if (data.error) {
      throw new Error(data.error);
    }

    // Transformar datos de MAL al formato interno
    const transformedData = {
      animes: data.data?.map(item => transformMALAnime(item.node)) || [],
      paging: data.paging || {}
    };

    console.log('� Recibidos:', transformedData.animes.length, 'animes');
    setMalCache(cacheKey, transformedData);
    return transformedData;

  } catch (error) {
    console.error('❌ Error en MAL:', error.message);
    throw error;
  }
}

const estadoTransformado = (status) => {
  const statusMap = {
    'finished_airing': 'Finalizado',
    'currently_airing': 'emisión',
    'not_yet_aired': 'estrenar'
  };
  return statusMap[status] || status;
};
// Transformar datos de MAL al formato intererno
function transformMALAnime(malAnime) {
  const transformed = {
    id: malAnime.title.toLowerCase().trim().replace(/[\s\W-]+/g, '-'), // Generar ID a partir del título
    title: malAnime.title,
    cover: malAnime.main_picture?.medium || malAnime.main_picture?.large || '',
    score: malAnime.mean || 0,
    type: malAnime.num_episodes ? `${malAnime.num_episodes} EPS` : '? EPS', // Número de episodios como type
    estado: estadoTransformado(malAnime.status),
    genres: malAnime.genres?.map(g => g.name) || [],
    synopsis: malAnime.synopsis || ''
  };
  return transformed;
}

// Fetch normal para el backend existente
async function fetchData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error en la red');
  return response.json();
}

async function cargarPopulares() {
  try {
    const container = document.getElementById('populares');

    if (!container) return;

    container.innerHTML = '<span class="span-carga">Cargando animes populares...</span>';

    console.log('📄 Cargando página:', currentPage, '- Ranking:', rankingType);

    // Verificar cache SOLO en página 1
    const cacheKey = `${CACHE_KEY}_${rankingType}_${currentPage}`;
    const cachedData = currentPage === 1 ? localStorage.getItem(cacheKey) : null;

    console.log('🔍 Cache key:', cacheKey);
    console.log('💾 Cache existe:', !!cachedData);
    console.log('📌 Caché habilitado solo para página 1:', currentPage === 1);

    // CARGA INSTANTÁNEA: Si hay caché y es página 1, mostrarlo primero
    if (cachedData && currentPage === 1) {
      try {
        const parsedCache = JSON.parse(cachedData);
        console.log('⚡ Carga instantánea desde localStorage:', parsedCache.data?.length, 'animes');
        renderizarResultados(parsedCache.data || []);
        updatePagination(parsedCache.paging || {});
        centrarPaginacion();
      } catch (e) {
        console.error('❌ Error al parsear caché:', e);
      }
    }

    // Usar API de MAL v2 a través del proxy para obtener ranking
    const offset = (currentPage - 1) * 20;
    const malData = await fetchMALRanking({
      ranking_type: rankingType,
      limit: 20,
      offset
    });

    let animes = malData.animes || [];
    console.log('📊 Animes recibidos de API:', animes.length);

    // COMPARACIÓN: Verificar si los datos cambiaron (solo en página 1)
    let datosCambiaron = true;
    if (cachedData && currentPage === 1) {
      try {
        const parsedCache = JSON.parse(cachedData);
        const cachedAnimes = parsedCache.data || [];
        const nuevosAnimes = animes;

        // Comparar IDs para detectar cambios
        const cachedIds = cachedAnimes.map(a => a.title).join(',');
        const nuevosIds = nuevosAnimes.map(a => a.title).join(',');

        datosCambiaron = cachedIds !== nuevosIds;
        console.log('🔄 Datos cambiaron:', datosCambiaron ? 'SÍ - Actualizando' : 'NO - Mismo contenido');
      } catch (e) {
        console.error('❌ Error al comparar caché:', e);
      }
    }

    // Solo actualizar render si los datos cambiaron o no es página 1
    if (datosCambiaron || currentPage !== 1) {
      console.log('🎨 Renderizando con datos actualizados');
      renderizarResultados(animes);
      updatePagination(malData.paging);
      centrarPaginacion();
    } else {
      console.log('✅ Manteniendo visualización del caché (sin cambios)');
    }

    // Guardar en localStorage SOLO si es página 1
    if (currentPage === 1) {
      localStorage.setItem(cacheKey, JSON.stringify({ data: animes, paging: malData.paging }));
      console.log('💾 Guardado en localStorage:', cacheKey);
    } else {
      console.log('📌 No guardando en localStorage (página', currentPage, '- solo página 1 usa caché)');
    }

  } catch (error) {
    console.error('❌ Error al cargar populares desde API:', error);
    console.log('📌 Manteniendo datos del caché local (sin reemplazar)');

    // NO reemplazar el contenido del contenedor
    // Si hay datos del caché ya renderizados, mantenerlos visibles
    // Solo marcar el error en consola
  }
}

function renderizarResultados(animes) {
  const container = document.getElementById('populares');
  if (!container) return;

  container.innerHTML = '';

  animes.forEach(anime => {
    const card = crearAnimeCard(anime);
    if (card) container.appendChild(card);
  });

  observerAnimeCards();
}

cargarPopulares();


const btns = document.querySelectorAll('#nav-populares .filtro-section > button');
btns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        });
    });

// Función para manejar los botones de filtro de ranking
function setupRankingFilterButtons(buttonsSelector, targetButtonId) {
    const buttons = document.querySelectorAll(buttonsSelector);
    const targetButton = document.getElementById(targetButtonId);

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (targetButton) {
                targetButton.classList.remove('active');
                const span = targetButton.querySelector('span');
                if (span) {
                    span.textContent = btn.textContent.trim();
                }
            }

            rankingType = btn.dataset.ranking || 'bypopularity';
            currentPage = 1;
            cargarPopulares();
        });
    });
}

setupRankingFilterButtons('#nav-populares-ranking-section > button', 'btn-populares-filtro-ranking');

const btnAlert = document.getElementById('btn-populares-alert');
const modal = document.getElementById('modal-populares');
btnAlert.addEventListener('click', () => {
    modal.classList.add('active');
});
modal.addEventListener('click', () => {
    modal.classList.remove('active');
});
window.addEventListener('scroll', () => {
    modal.classList.remove('active');
    document.querySelectorAll('.btn-filtro').forEach(opcion => {
        opcion.classList.remove('active');
    });
});


const scrollContainer = document.querySelector('#pagination-populares');

scrollContainer.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    scrollContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });