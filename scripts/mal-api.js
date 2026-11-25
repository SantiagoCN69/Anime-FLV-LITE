// --- API DE MYANIMELIST v2 VÍA PROXY DE NETLIFY ---
// Apunta directamente a Netlify aunque estés navegando desde Cloudflare Workers u otro dominio
const MAL_PROXY_URL = 'https://anizenlite.netlify.app/.netlify/functions/mal-proxy-v3';

// Mismos nombres que los botones de filtro de populares.html
export const MAL_RANKING_TYPES = ['bypopularity', 'all', 'airing', 'upcoming', 'tv', 'movie', 'ova', 'special', 'favorite'];
export const MAL_RANKING_LABELS = {
  bypopularity: 'Populares',
  all: 'Top Rated',
  airing: 'En emisión',
  upcoming: 'Próximos',
  tv: 'TV',
  movie: 'Películas',
  ova: 'OVAs',
  special: 'Especiales',
  favorite: 'Favoritos'
};

// Caché en memoria (5 minutos TTL) para evitar peticiones repetidas
// al cambiar de página o filtro dentro de la misma sesión.
const malCache = new Map();
const MAL_CACHE_TTL = 5 * 60 * 1000;

function getMalCache(cacheKey) {
  const cached = malCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MAL_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setMalCache(cacheKey, data) {
  malCache.set(cacheKey, { data, timestamp: Date.now() });
}

const estadoTransformado = (status) => {
  const statusMap = {
    'finished_airing': 'Finalizado',
    'currently_airing': 'emisión',
    'not_yet_aired': 'estrenar'
  };
  return statusMap[status] || status;
};

// Transformar datos de MAL al formato interno
export function transformMALAnime(malAnime) {
  return {
    id: malAnime.title.toLowerCase().trim().replace(/[\s\W-]+/g, '-'),
    title: malAnime.title,
    cover: malAnime.main_picture?.medium || malAnime.main_picture?.large || '',
    score: malAnime.mean || 0,
    type: malAnime.num_episodes ? `${malAnime.num_episodes} EPS` : '? EPS',
    estado: estadoTransformado(malAnime.status),
    genres: malAnime.genres?.map(g => g.name) || [],
    synopsis: malAnime.synopsis || ''
  };
}

// Fetch a API de MAL v2 a través del proxy de Netlify
export async function fetchMALRanking(params = {}) {
  const cacheKey = `mal_ranking_${JSON.stringify(params)}`;
  const cached = getMalCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const queryParams = new URLSearchParams({
      ranking_type: params.ranking_type || 'bypopularity',
      limit: params.limit || 20,
      fields: 'id,title,main_picture,mean,num_episodes,status,genres,synopsis,media_type',
      offset: params.offset || 0
    });

    const response = await fetch(`${MAL_PROXY_URL}?${queryParams.toString()}`);

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

    if (data.error) {
      throw new Error(data.error);
    }

    const transformedData = {
      animes: data.data?.map(item => transformMALAnime(item.node)) || [],
      paging: data.paging || {}
    };

    setMalCache(cacheKey, transformedData);
    return transformedData;

  } catch (error) {
    console.error('Error en MAL:', error.message);
    throw error;
  }
}
