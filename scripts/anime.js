import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Agregamos arrayUnion y arrayRemove al final de esta línea
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteDoc, query } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

import { firebaseConfig } from "./firebaseconfig.js";
import { observerAnimeCards, aplicarViewTransition } from "./utils.js";
import { IA_SECTION_HTML, attachIaGridWheelScroll, loadIaRecommendationsIntoGrid } from "./ai-recommendations.js";
// Inicializar Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let id = new URLSearchParams(location.search).get("id");
let animeActual = null; // Guardar referencia al anime actual para invertir orden
let ordenInvertido = false; // Estado del orden de capítulos
let overlayCompletadosActivo = false; // Evitar overlay duplicado al invertir
let filtroActual = 'todos'; // Estado del filtro: 'todos', 'vistos', 'no-vistos'
let paginaActual = 0; // Página actual (0-indexed)
let episodiosFiltrados = []; // Episodios después de aplicar filtro y orden
let vistosCache = []; // Cache de episodios vistos para evitar llamadas repetidas
let primeraCarga = true; // Bandera para mostrar overlay solo en la primera carga
let skipScrollAlPrimerNoVisto = false; // Para evitar scroll cuando viene de búsqueda/paginación manual

const titulo = id.replaceAll("-", " ").toLowerCase();
const tituloFormateado = titulo.charAt(0).toUpperCase() + titulo.slice(1);
document.title = "AniZen - " + tituloFormateado;

const userID = localStorage.getItem("userID");

const getCacheKey = id => `anime_${id}`;

const cargarDatosDesdeCache = id => {
  try {
    const data = localStorage.getItem(getCacheKey(id));
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const actualizarCache = (id, anime) => {
  const existingData = localStorage.getItem(getCacheKey(id));
  const existingAnime = existingData ? JSON.parse(existingData) : null;
  
  const fechaActualizacion = existingAnime?._cachedAt || Date.now();
  const toCache = { ...anime, _cachedAt: fechaActualizacion };
  localStorage.setItem(getCacheKey(id), JSON.stringify(toCache));
  
  const animes = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('anime_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data._cachedAt) {
          animes.push({ id: key, fecha: data._cachedAt });
        }
      } catch (e) {
        console.error(`Error al procesar anime ${key}:`, e);
        localStorage.removeItem(key);
      }
    }
  }

  if (animes.length > 20) {
    try {
      const animesOrdenados = animes.sort((a, b) => b.fecha - a.fecha);
      const animesAEliminar = animesOrdenados.slice(20);
      
      animesAEliminar.forEach(anime => {
        localStorage.removeItem(anime.id);
      });
    } catch (e) {
      console.error('Error al eliminar animes viejos:', e);
    }
  }
};

// DOM references
const tituloEl = document.getElementById("titulo");
const statusEl = document.getElementById("status");
const portadaEl = document.getElementById("portada");
const descripcionEl = document.getElementById("descripcion");
const generoContainer = document.querySelector(".genero");
const capContenedor = document.getElementById("capitulos");
const filtroCapitulo = document.getElementById("filtro-capitulo");
const ratingEl = document.getElementById("rating");
const initLoadingCap = document.getElementById("init-loading-cap");
const info1El = document.getElementById("info1");

function quitarTildesYEspacios(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ /g, '-')
    .toLowerCase();
}

const renderGeneros = (container, generos) => {
  container.innerHTML = '';
  if (generos && generos.length) {
    const generosUnicos = [
      ...new Map(
        generos.map(g => [
          quitarTildesYEspacios(g).toLowerCase(),
          g
        ])
      ).values()
    ];

    generosUnicos.slice(0, 5).forEach(g => {
      const a = document.createElement('a');
      a.textContent = g;
      a.className = 'genre-link';
      const generoUrl = g.toLowerCase() === 'aventuras' ? 'aventura' : g;
      a.href = `/?DirectorioAV1&genre=${quitarTildesYEspacios(generoUrl)}`;


      container.appendChild(a);
      a.classList.add('cargado');
    });
  } else {
    container.textContent = 'Géneros no disponibles.';
  }
};

// Renderizar relacionados
let isRendering = false;
let capituloToggleInProgress = false;
let estadoToggleInProgress = false;

// Función auxiliar para convertir el slug en un título legible
// Ej: "kabushikigaisha-magi-lumiere" -> "Kabushikigaisha Magi Lumiere"
const formatTitleFromSlug = (slug) => {
  if (!slug) return 'Sin título';
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

function renderRelacionados(anime) {
  const relacionadosContainer = document.getElementById('animes-relacionados');
  const relacionadosSection = document.getElementById('relacionados');
  const initLoading = document.getElementById('init-loading-relacionados');

  // Soporte por si tu objeto usa la propiedad 'relacionados' o 'relations'
  const listaRelaciones = anime?.relacionados || anime?.relations;

  if (!relacionadosContainer || !listaRelaciones?.length) {
    if (relacionadosSection) relacionadosSection.style.display = 'none';
    return;
  }

  if (typeof isRendering !== 'undefined' && isRendering) return;
  isRendering = true;

  if (relacionadosSection) relacionadosSection.style.display = 'flex';
  if (initLoading) initLoading.style.display = 'block';
  relacionadosContainer.innerHTML = '';

  const getRelationText = (type) => {
    const types = {
      1: 'Precuela', 2: 'Secuela', 3: 'Ambientación Alternativa', 4: 'Versión alternativa',
      5: 'Historia paralela', 6: 'Resumen', 7: 'Historia completa', 8: 'Historia principal', 10: 'Otro'
    };
    return types[type] || `Tipo ${type}`; 
  };

  try {
    const animesProcesados = [];
    const idsAgregados = new Set();

    listaRelaciones.forEach(relacionado => {
      // Evitamos procesar duplicados
      if (!relacionado.id || idsAgregados.has(relacionado.id)) return;
      idsAgregados.add(relacionado.id);

      // Extraemos el año
      let yearStr = 'Desconocido';
      let rawYear = 9999;
      if (relacionado.startDate) {
        const dateMatch = String(relacionado.startDate).match(/(\d{4})/);
        if (dateMatch) {
          yearStr = dateMatch[1];
          rawYear = parseInt(yearStr);
        }
      }

      animesProcesados.push({
        id: relacionado.id,
        slug: relacionado.slug,
        title: formatTitleFromSlug(relacionado.slug),
        relation: getRelationText(relacionado.type),
        coverImage: `https://cdn.animeav1.com/covers/${relacionado.id}.jpg`,
        yearStr,
        rawYear
      });
    });

    // Ordenamos cronológicamente
    animesProcesados.sort((a, b) => a.rawYear - b.rawYear);

    if (animesProcesados.length > 0) {
      const fragment = document.createDocumentFragment();
      const timelineContainer = document.createElement('div');
      timelineContainer.className = 'timeline-container';
      
      // Validamos si hay más de 1 anime para decidir si mostramos la línea
      const mostrarLinea = animesProcesados.length > 1;
      
      animesProcesados.forEach((item, index) => {
        const node = document.createElement('div');
        node.className = 'timeline-node';
        

        const lineaHtml = (index < animesProcesados.length - 1) ? '<div class="timeline-line"></div>' : '';
        
        node.innerHTML = `
          <div class="timeline-head">
            <span class="timeline-year">${item.yearStr}</span>
            ${lineaHtml}
          </div>
          <a href="/anime?id=${item.slug}" class="timeline-card-link" id="anime-${item.id}">
            <div class="timeline-card-horizontal">
              <img src="${item.coverImage}" alt="${item.title}" class="timeline-cover" onerror="this.src='img/loading.png'" style="view-transition-name: cover-${item.slug}">
              <div class="timeline-info">
                <h4 class="timeline-title" style="view-transition-name: title-${item.slug}">${item.title}</h4>
                <span class="timeline-relation">${item.relation}</span>
              </div>
            </div>
          </a>
        `;
        
        node.querySelector('.timeline-card-link').addEventListener('click', () => {
          if (typeof aplicarViewTransition === 'function') {
            aplicarViewTransition(item.id, ''); 
          }
        });

        timelineContainer.appendChild(node);
      });
      
      fragment.appendChild(timelineContainer);
      relacionadosContainer.appendChild(fragment);
      
// CÓDIGO CORREGIDO
      timelineContainer.addEventListener('wheel', (evento) => {
        if (evento.deltaY !== 0) {
          evento.preventDefault();
          timelineContainer.scrollLeft += evento.deltaY;
        }
      });
      
      if (typeof observerAnimeCards === 'function') {
        observerAnimeCards();
      }
    } else {
      if (relacionadosSection) relacionadosSection.style.display = 'none';
    }

  } catch (error) {
    if (relacionadosSection) relacionadosSection.style.display = 'none';
    console.error('Error al renderizar animes relacionados:', error);
  } finally {
    if (initLoading) initLoading.style.display = 'none';
    isRendering = false;
  }
}

const BANNER_PESO_MIN_BYTES = 7 * 1024;
const BANNER_PESO_PROXIES = [
  'https://anizenlite.netlify.app/.netlify/functions/banner-peso',
];

async function obtenerPesoBanner(url) {
  if (!url) return null;
  const q = `?url=${encodeURIComponent(url)}`;

  for (const base of BANNER_PESO_PROXIES) {
    try {
      const res = await fetch(`${base}${q}`);
      if (!res.ok) continue;
      const { bytes } = await res.json();
      if (typeof bytes === 'number' && bytes > 0) return bytes;
    } catch {
      /* Pasa al siguiente proxy si este falla */
    }
  }
  return null;
}

async function esBannerValido(url) {
  const peso = await obtenerPesoBanner(url);
  return typeof peso === 'number' && peso >= BANNER_PESO_MIN_BYTES;
}

async function aplicarFondoAnime(anime) {
  const portada = anime.portada || anime.cover;
  const banner = anime.banner;
  const usarBanner = banner && await esBannerValido(banner);
  const imagenUrl = usarBanner ? banner : portada;

  document.body.style.setProperty('--background-image', imagenUrl ? `url(${imagenUrl})` : 'none');
  document.body.classList.add('fondo-animado');
}
function setAnimeDescripcion(descripcionEl, texto) {
  const descripcionCargando = document.getElementById('descripcion-cargando');
  if (descripcionCargando) descripcionCargando.style.display = 'none';
  if (!descripcionEl) return;

  const contenedor = descripcionEl.parentElement;
  if (!contenedor) return;

  // 1. Asignar texto e inicializar
  descripcionEl.textContent = texto;

  // Limpiar botón y eventos previos si se reutiliza el nodo
  const btnPrevio = contenedor.querySelector('.btn-toggle-desc');
  if (btnPrevio) btnPrevio.remove();

  contenedor.classList.add('collapsed');
  contenedor.classList.remove('expanded');

  // 2. Medir desbordamiento tras el renderizado del DOM
  requestAnimationFrame(() => {
    const tieneDesbordamiento = descripcionEl.scrollHeight > descripcionEl.clientHeight;

    if (tieneDesbordamiento) {
      // Crear el botón
      const btn = document.createElement('button');
      btn.className = 'btn-toggle-desc';
      btn.textContent = 'Ver más';
      contenedor.appendChild(btn);

      // Indicar visualmente que todo el bloque es interactivo
      contenedor.classList.add('is-clickable');

      // 3. Manejador de evento ÚNICO en el contenedor padre
      contenedor.onclick = (e) => {
        e.stopPropagation(); // Evita accionar tarjetas o enlaces externos

        const estaColapsado = contenedor.classList.toggle('collapsed');
        contenedor.classList.toggle('expanded');

        // Actualizar el texto del botón independientemente de dónde se hizo clic
        btn.textContent = estaColapsado ? 'Ver más' : 'Ver menos';
      };
    } else {
      // Si no desborda, remover listeners o estilos interactivos
      contenedor.onclick = null;
      contenedor.classList.remove('is-clickable');
    }
  });
}

// Función helper para obtener la URL de la portada
function getPortadaUrl(anime) {
  // Extrae el ID si viene de anime.url o usa anime.id / slugFromTitle directamente
  let id = anime.id;
  
  if (!id && anime.url) {
    id = anime.url.replace(/\/+$/, '').split('/').pop();
  } else if (!id && anime.title) {
    id = slugFromTitle(anime.title);
  }

  const cdnUrl = id ? `https://cdn.jkdesa.com/assets/images/animes/image/${id}.jpg` : null;
  const fallbackUrl = anime.portada || anime.image || anime.cover || '';

  return { cdnUrl, fallbackUrl };
}

// Aplicar al elemento <img>
function setAnimePortada(portadaEl, anime) {
  const { cdnUrl, fallbackUrl } = getPortadaUrl(anime);

  // Manejador de error para activar el fallback si el CDN devuelve 404
  portadaEl.onerror = function() {
    if (this.src !== fallbackUrl && fallbackUrl) {
      this.src = fallbackUrl;
    }
  };

  portadaEl.src = cdnUrl || fallbackUrl;
}

const renderAnime = anime => {
  
  // Build info1 content dynamically
  const infoParts = [];
  // Transformar categoría según condiciones
  let categoriaTransformada = anime.category;
  if (anime.category) {
    const categoriaLower = anime.category.toLowerCase();
    if (categoriaLower === 'ova') {
      categoriaTransformada = 'ova';
    } else if (categoriaLower === 'ona') {
      categoriaTransformada = 'onas';
    } else if (categoriaLower === 'tv anime') {
      categoriaTransformada = 'tv-anime';
    } else if (categoriaLower === 'película') {
      categoriaTransformada = 'pelicula';
    }
    else if (categoriaLower === 'especial') {
      categoriaTransformada = 'especial';
    }
  }
//tranformas estado 
let estadoTransformado = anime.estado;
if (anime.estado) {
  const estadoLower = anime.estado.toLowerCase();
  if (estadoLower === 'en emisión' || "en emision") {
    estadoTransformado = 'emision';
  } else if (estadoLower === 'finalizado') {
    estadoTransformado = 'finalizado';
  } else if (estadoLower === "por estrenar") {
    estadoTransformado = "proximamente";
  }
}
  //Add rating
  if (anime.score && anime.score !== 0) {
    infoParts.push(`<a href="/?Populares" class="span-text-anime1" id="scorecargado">${anime.score}</a>`);
  }
  // Add category
  if (categoriaTransformada && !categoriaTransformada.includes('Desconocido')) {
    infoParts.push(`<a href="/?DirectorioAV1&category=${categoriaTransformada}" class="span-text-anime1" id="categoriacargado">${anime.category}</a>`);
  }
  
  // Add year
  if (anime.startDate) {
    const yearMatch = String(anime.startDate).match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : anime.startDate;
    infoParts.push(`<a href="/?DirectorioAV1&minYear=${year}&maxYear=${year}" class="span-text-anime1" id="anocargado">${year}</a>`);
  }
  
  // Add status with icon
  if (anime.estado) {
    infoParts.push(`<a href="/?DirectorioAV1&status=${estadoTransformado}" class="span-text-anime1 ${anime.estado.toLowerCase()}" id="statuscargado">${anime.estado}</a>`);
  }
  
  // Join with spaces
  info1El.innerHTML = infoParts.join(' ');

  tituloEl.textContent = formatTitleFromSlug(anime.titulo);
  tituloEl.onclick = () => (navigator.clipboard.writeText(anime.titulo), mostrarPildora("alerta texto"));
  
  const r = document.createRange();
  r.selectNodeContents(tituloEl);
  if (r.getClientRects().length >= 2) {
    tituloEl.style.setProperty("align-items", "start", "important");
  }
  
  document.getElementById("covercarga").classList.add("cargado");
  
  setAnimePortada(portadaEl, anime);
  portadaEl.classList.add("cargo")
  document.querySelector('.anime-container1').style.setProperty('--anime-portada', `url(${anime.portada})`);
  aplicarFondoAnime(anime);
  setAnimeDescripcion(descripcionEl, anime.descripcion);
  renderGeneros(generoContainer, anime.generos);

  const container = document.querySelector(".anime-container3");

  if (anime.estado === "Por estrenar") {
    if (container) {
      container.style.minHeight = "unset";
      container.innerHTML = "<span id='anime-proximo-estrenar'>Próximamente en estreno. Los capítulos aún no están disponibles.</span>";
    }
    // Si no hay episodios, retornar. Si hay episodios (caso de actualización), continuar
    if (!anime.episodios || anime.episodios.length === 0) {
      return;
    }
  }

  // Si el anime ya no está en "Por estrenar" o tiene episodios, limpiar el mensaje
  const mensajeProximoEstrenar = document.getElementById('anime-proximo-estrenar');
  if (mensajeProximoEstrenar) {
    mensajeProximoEstrenar.remove();
  }

  animeActual = anime; // Guardar referencia al anime actual
  crearBotonesEpisodios(anime);
  renderRelacionados(anime);
};

const getAnchoColumna = () => {
  const li = capContenedor.querySelector('li');
  if (!li) return 0;
  const anchoLi = li.getBoundingClientRect().width;
  const gap = 16;
  return anchoLi + gap;
};

const debounce = (fn, delay = 200) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const createEpisodeButton = (ep, vistos = [], internalId) => {
  const li = document.createElement('li');
  const btn = document.createElement('a');
  btn.href = `ver?id=${id}&episode=${ep.number}`;
  const visto = vistos.includes(ep.number.toString());
  btn.className = `episode-btn ${visto ? 'ep-visto' : 'ep-no-visto'}`;
  
  const img = document.createElement('img');
  if (internalId) {
    img.className = 'episode-thumb';
    img.src = `https://cdn.animeav1.com/screenshots/${internalId}/${ep.number}.jpg`;
    img.loading = 'lazy';
    img.alt = `Episodio ${ep.number}`;

    img.onerror = () => {
      btn.classList.add('no-thumb');
    };
  }
  else {
    btn.classList.add('no-thumb');
  }
  
  const textSpan = document.createElement('span');
  textSpan.className = 'episode-text';
  textSpan.textContent = `Episodio ${
  ep.number !== undefined && ep.number !== null ? 
  ep.number : 
  (ep.title || 'desconocido')
}`;
  const playIcon = document.createElement('div');
  playIcon.className = "play-icon play-icon-anime";
  playIcon.alt = "ver";
  const icon = document.createElement('button');
  icon.className = 'icon-eye';
  icon.alt = 'visto';

  btn.appendChild(img);
  btn.appendChild(textSpan);
  btn.appendChild(playIcon);
  btn.appendChild(icon);
  li.appendChild(btn);

  btn.addEventListener('click', async () => {
    if (btn.classList.contains("ep-no-visto")) {
      await manejarEstadoEpisodio(btn, icon, ep);
    }
    img.style.setProperty('view-transition-name', `${id}-${ep.number}`);
  });

  icon.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    manejarEstadoEpisodio(btn, icon, ep);
  });

  return li;
};

function mostrarOverlayCapitulosCompletados() {
  // Evita duplicados usando el flag global
  if (overlayCompletadosActivo) return;
  if (capContenedor.querySelector(".caps-completados-card")) return;

  overlayCompletadosActivo = true;

  const overlay = document.createElement("div");
  overlay.className = "caps-completados-card";
  overlay.innerHTML = `
      <div class="caps-completados-icono">🏆</div>
      <div>
        <h3>¡Felicidades!</h3>
        <p>Has visto todos los episodios disponibles.</p>
      </div>
  `;

  capContenedor.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("show"));

  setTimeout(() => {
    overlay.classList.remove("show");
    overlay.addEventListener("transitionend", () => {
      overlay.remove();
      overlayCompletadosActivo = false;
    }, {
      once: true,
    });
  }, 3000);
}

// ==========================================
// 1. FUNCIONES AUXILIARES GLOBALES
// ==========================================

// ==========================================
// 2. FUNCIÓN PRINCIPAL OPTIMIZADA
// ==========================================
async function crearBotonesEpisodios(anime, resetPagina = true) {
    overlayCompletadosActivo = false; // Reset flag al limpiar contenedor

    // Limpiar paginación al inicio para evitar saltos visuales
    const paginationContainer = document.getElementById('pagination-container');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }

    let episodios = Array.isArray(anime.episodios) ? anime.episodios : [];

    if (episodios.length === 0) {
        capContenedor.innerHTML = '<span class="span-carga">No hay capitulos disponibles</span>';
        if (initLoadingCap) initLoadingCap.style.display = 'none';
        capContenedor.classList.add("cargado");
        return;
    }

    // Obtener episodios vistos (usar cache si está disponible)
    let vistos = vistosCache.length > 0 ? vistosCache : await obtenerCapitulosVistos(id) || [];

    // Validar y limpiar episodios si es necesario
    const numerosValidos = new Set(episodios.map(ep => ep.number));
    const vistosFiltrados = vistos.filter(num => numerosValidos.has(num));

    if (vistos.length !== vistosFiltrados.length) {
        await actualizarCapitulosVistos(id, vistosFiltrados);
        vistos = vistosFiltrados;
        vistosCache = vistos; // Actualizar cache
    } else if (vistosCache.length === 0) {
        // Si es la primera carga, guardar en cache
        vistosCache = vistos;
    }

    // Aplicar filtro
    let episodiosFiltradosTemp = [...episodios];
    if (filtroActual === 'vistos') {
        episodiosFiltradosTemp = episodiosFiltradosTemp.filter(ep => vistos.includes(ep.number.toString()));
    } else if (filtroActual === 'no-vistos') {
        episodiosFiltradosTemp = episodiosFiltradosTemp.filter(ep => !vistos.includes(ep.number.toString()));
    }

    // Aplicar orden (crear copia invertida para no modificar el array original)
    if (ordenInvertido) {
        episodiosFiltradosTemp = [...episodiosFiltradosTemp].reverse();
    }

    // Guardar episodios filtrados globalmente
    episodiosFiltrados = episodiosFiltradosTemp;

    // Mostrar mensaje si no hay resultados después del filtro
    if (episodiosFiltrados.length === 0 && episodios.length > 0) {
        capContenedor.innerHTML = ''; // Limpiar primero para parar cualquier animación

        let mensaje = '';
        if (filtroActual === 'vistos') {
            mensaje = 'No hay episodios vistos aún';
        } else if (filtroActual === 'no-vistos') {
            mensaje = '¡Ya has visto todos los episodios!';
        } else {
            mensaje = 'No hay episodios disponibles';
        }

        // Usar requestAnimationFrame para asegurar que el renderizado sea inmediato
        requestAnimationFrame(() => {
            capContenedor.innerHTML = `<span class="span-carga">${mensaje}</span>`;
            if (initLoadingCap) initLoadingCap.style.display = 'none';
            capContenedor.classList.add("cargado");

            // Ocultar paginación
            const paginationContainer = document.getElementById('pagination-container');
            if (paginationContainer) {
                paginationContainer.style.display = 'none';
            }
        });
        return;
    }

    // Resetear página si se solicita
    if (resetPagina) {
        paginaActual = 0;
    }
    capContenedor.innerHTML = '';
    // Paginación: 10 episodios por página
    const itemsPerPage = 10;
    const totalPaginas = Math.ceil(episodiosFiltrados.length / itemsPerPage);

    // Obtener episodios de la página actual
    const startIndex = paginaActual * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, episodiosFiltrados.length);
    const episodiosAMostrar = episodiosFiltrados.slice(startIndex, endIndex);

    // Renderizado en bloque con DocumentFragment
    const fragment = document.createDocumentFragment();
    episodiosAMostrar.forEach(ep => fragment.appendChild(createEpisodeButton(ep, vistos, anime.internalId)));
    capContenedor.appendChild(fragment);

    if (initLoadingCap) initLoadingCap.style.display = 'none';
    if (episodios.length > 0) {
        actualizarProgresoCapitulos(episodios.length, vistos);
    }

    capContenedor.classList.add("cargado");
    capContenedor.style.setProperty("--caps", episodios.length);

    // Activar botón de invertir después de renderizar los capítulos
    const btnInvertirCaps = document.getElementById('btn-invertir-caps');
    if (btnInvertirCaps) {
        btnInvertirCaps.disabled = false;
    }

    // El contenedor usa CSS para limitar la altura (max-height en CSS)

    // Crear paginación si hay más de una página
    if (totalPaginas > 1) {
        crearPaginacion(episodiosFiltrados.length, itemsPerPage);
    } else {
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
    }

    // Scroll automático al primer no visto
    scrollAlPrimerNoVisto(vistos);

    // Verificar si TODOS los episodios del anime están vistos para mostrar el overlay
    // Solo en la primera carga y si no hay filtro aplicado
    const totalVistos = vistos.length;
    const totalEpisodiosAnime = episodios.length;
    const todosCompletados = totalVistos === totalEpisodiosAnime && totalEpisodiosAnime > 0;
    const sinFiltro = filtroActual === 'todos';

    if (todosCompletados && sinFiltro && primeraCarga && typeof mostrarOverlayCapitulosCompletados === 'function') {
        mostrarOverlayCapitulosCompletados();
        primeraCarga = false;
    }
}

// Función para cambiar a la página del primer episodio no visto
function scrollAlPrimerNoVisto(vistosParam) {
    // Si se debe saltar el scroll, no hacer nada
    if (skipScrollAlPrimerNoVisto) {
        skipScrollAlPrimerNoVisto = false; // Resetear bandera
        return;
    }

    // Usar el parámetro o el cache si no se proporciona
    const vistos = vistosParam || vistosCache;

    // Buscar el primer episodio no visto en la lista global filtrada
    const primerNoVistoGlobal = episodiosFiltrados.find(ep => !vistos.includes(ep.number.toString()));

    if (!primerNoVistoGlobal) {
        // Mostrar overlay solo si: no hay filtro + todos los episodios FILTRADOS están vistos + primera carga
        const todosVistos = episodiosFiltrados.every(ep => vistos.includes(ep.number.toString()));
        const sinFiltro = filtroActual === 'todos';
        if (episodiosFiltrados.length >= 1 && todosVistos && sinFiltro && primeraCarga && typeof mostrarOverlayCapitulosCompletados === 'function') {
            mostrarOverlayCapitulosCompletados();
            primeraCarga = false;
        }
        return;
    }

    // Calcular en qué página está el primer no visto
    const itemsPerPage = 10;
    const indicePrimerNoVisto = episodiosFiltrados.indexOf(primerNoVistoGlobal);
    const paginaPrimerNoVisto = Math.floor(indicePrimerNoVisto / itemsPerPage);

    // Si el primer no visto no está en la página actual, cambiar a esa página
    if (paginaPrimerNoVisto !== paginaActual) {
        paginaActual = paginaPrimerNoVisto;
        crearBotonesEpisodios(animeActual, false);
    }
}

// ==========================================
// 3. FUNCIÓN DE PAGINACIÓN
// ==========================================
function crearPaginacion(totalEpisodios, itemsPerPage) {
    const paginationContainer = document.getElementById('pagination-container');
    const paginationInfo = document.getElementById('pagination-info');
    const paginationText = document.getElementById('pagination-text');
    const paginationOptions = document.getElementById('pagination-options');
    const btnPagination = document.getElementById('btn-pagination');

    if (!paginationContainer) return;

    // Mostrar el contenedor de paginación
    paginationContainer.style.display = 'flex';

    // Calcular el rango actual basado en la página
    const startIndex = paginaActual * itemsPerPage;
    const endIndex = Math.min((paginaActual + 1) * itemsPerPage, totalEpisodios);

    // Obtener los episodios de la página actual para mostrar sus números reales
    const episodiosEnPagina = episodiosFiltrados.slice(startIndex, endIndex);
    const capInicio = episodiosEnPagina.length > 0 ? episodiosEnPagina[0].number : 0;
    const capFin = episodiosEnPagina.length > 0 ? episodiosEnPagina[episodiosEnPagina.length - 1].number : 0;

    // Actualizar el texto de información con números de capítulo reales
    paginationInfo.textContent = `Mostrando episodios ${capInicio}-${capFin} de ${totalEpisodios}`;

    // Actualizar el texto del botón con números de capítulo reales
    paginationText.textContent = `caps ${capInicio}-${capFin}`;

    // Generar opciones de paginación
    paginationOptions.innerHTML = '';
    const totalPaginas = Math.ceil(totalEpisodios / itemsPerPage);

    for (let i = 0; i < totalPaginas; i++) {
        const pagStartIndex = i * itemsPerPage;
        const pagEndIndex = Math.min((i + 1) * itemsPerPage, totalEpisodios);
        const episodiosPagina = episodiosFiltrados.slice(pagStartIndex, pagEndIndex);

        const pagCapInicio = episodiosPagina.length > 0 ? episodiosPagina[0].number : 0;
        const pagCapFin = episodiosPagina.length > 0 ? episodiosPagina[episodiosPagina.length - 1].number : 0;

        const option = document.createElement('button');
        option.className = 'pagination-option';
        option.textContent = `caps ${pagCapInicio}-${pagCapFin}`;
        option.dataset.pagina = i;

        if (i === paginaActual) {
            option.classList.add('active');
        }

        option.addEventListener('click', () => {
            // Actualizar la página actual
            paginaActual = i;

            // Evitar scroll al primer no visto cuando se cambia de página manualmente
            skipScrollAlPrimerNoVisto = true;

            // Cerrar el dropdown
            btnPagination.classList.remove('open');
            paginationOptions.classList.remove('open');

            // Regenerar los episodios con la nueva página (sin resetear)
            if (animeActual) {
                crearBotonesEpisodios(animeActual, false);
            }
        });

        paginationOptions.appendChild(option);
    }

    // Manejar el toggle del dropdown
    btnPagination.onclick = (e) => {
        e.stopPropagation();
        btnPagination.classList.toggle('open');
        paginationOptions.classList.toggle('open');
    };

    // Cerrar el dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!btnPagination.contains(e.target) && !paginationOptions.contains(e.target)) {
            btnPagination.classList.remove('open');
            paginationOptions.classList.remove('open');
        }
    });
}

// ==========================================
// 4. CONFIGURACIÓN DE BOTONES FUERA DE LA FUNCIÓN
// ==========================================
let invertirDebounceTimer = null;

function setupInvertirButton() {
    const btnInvertirCaps = document.getElementById('btn-invertir-caps');
    if (btnInvertirCaps) {
        // Clonar para limpiar listeners viejos
        const newBtn = btnInvertirCaps.cloneNode(true);
        btnInvertirCaps.parentNode.replaceChild(newBtn, btnInvertirCaps);

        newBtn.addEventListener('click', () => {
            if (invertirDebounceTimer) return; // Ignorar clicks durante debounce

            if (animeActual) {
                ordenInvertido = !ordenInvertido;
                crearBotonesEpisodios(animeActual, true); // true = resetear página

                // Debounce de 300ms para evitar spam
                invertirDebounceTimer = setTimeout(() => {
                    invertirDebounceTimer = null;
                }, 400);
            }
        });
    }
}

// Inicializar cuando el DOM cargue
document.addEventListener('DOMContentLoaded', () => {
    setupInvertirButton();
    setupFiltroBotones();
});

function setupFiltroBotones() {
    const botonesFiltro = document.querySelectorAll('.btn-filtro-cap');
    botonesFiltro.forEach(boton => {
        boton.addEventListener('click', () => {
            // Remover clase active de todos
            botonesFiltro.forEach(b => b.classList.remove('active'));
            // Agregar clase active al clickeado
            boton.classList.add('active');

            // Actualizar filtro
            filtroActual = boton.dataset.filtro;

            // Regenerar episodios con el nuevo filtro
            if (animeActual) {
                crearBotonesEpisodios(animeActual, true);
            }
        });
    });
}
// 1. Limpieza de capítulos (Corregido con setDoc + merge para evitar caídas si no existe el doc)
async function actualizarCapitulosVistos(animeId, episodiosLimpios) {
  try {
    const userId = auth.currentUser?.uid || localStorage.getItem("userID");
    if (!userId) {
      console.warn("No hay usuario autenticado.");
      return;
    }

    const ref = doc(db, 'usuarios', userId, 'caps-vistos', animeId);
    
    // setDoc con merge es más seguro que updateDoc aquí
    await setDoc(ref, {
      episodiosVistos: episodiosLimpios
    }, { merge: true });
    
    console.log("Base de datos limpia: episodios inválidos eliminados con éxito.");
  } catch (error) {
    console.error("Error al limpiar los capítulos en Firestore:", error);
  }
}

// 2. Filtro de búsqueda con paginación (debounce de 500ms para evitar spam mientras escribe)
filtroCapitulo.addEventListener('input', debounce(() => {
  const filtro = filtroCapitulo.value.toLowerCase();

  if (!filtro || !animeActual) return;

  // Buscar el capítulo en la lista global de episodios filtrados
  const epIndex = episodiosFiltrados.findIndex(ep =>
    ep.number.toString().includes(filtro) ||
    (ep.title && ep.title.toLowerCase().includes(filtro))
  );

  if (epIndex >= 0) {
    // Calcular en qué página está el episodio
    const itemsPerPage = 10;
    const paginaObjetivo = Math.floor(epIndex / itemsPerPage);

    // Si estamos en una página diferente, cambiar a la página objetivo
    if (paginaObjetivo !== paginaActual) {
      paginaActual = paginaObjetivo;
      skipScrollAlPrimerNoVisto = true; // Evitar scroll al primer no visto después de búsqueda
      crearBotonesEpisodios(animeActual, false);
    }
  }
}, 500));

// 3. Manejador de clicks (Optimistic UI - Impecable)
async function manejarEstadoEpisodio(btn, icon, ep) {
  const userId = auth.currentUser?.uid || localStorage.getItem("userID");
  // Evitar doble clic rápido en ESTE mismo botón
  if (!userId) {
    mostrarPildora('no-user');
    return
  }
  if (btn.dataset.loading === "true") return; 

  const animeId = id; 
  const tituloAnime = tituloEl.textContent;
  const marcandoComoVisto = !btn.classList.contains('ep-visto');
  
  // Marcar este botón como ocupado
  btn.dataset.loading = "true";

  // UI Optimista
  btn.classList.toggle('ep-visto', marcandoComoVisto);
  btn.classList.toggle('ep-no-visto', !marcandoComoVisto);
  icon.src = marcandoComoVisto ? '/icons/eye-solid.svg' : '/icons/eye-slash-solid.svg';

  try {
    await toggleCapituloVisto(animeId, tituloAnime, ep.number, marcandoComoVisto);
  } catch (e) {
    console.error('Error al cambiar estado, revirtiendo UI:', e);
    // Reversión local si falla
    btn.classList.toggle('ep-visto', !marcandoComoVisto);
    btn.classList.toggle('ep-no-visto', marcandoComoVisto);
    icon.src = !marcandoComoVisto ? '/icons/eye-solid.svg' : '/icons/eye-slash-solid.svg';
  } finally {
    // Liberar el botón pase lo que pase (éxito o error)
    delete btn.dataset.loading;
  }
}

// 4. Guardado en Firestore (Operación atómica ultra-eficiente)
async function toggleCapituloVisto(animeId, titulo, episodio, esVisto) {
  capituloToggleInProgress = true;

  try {
    const userId = auth.currentUser?.uid || localStorage.getItem("userID");
    if (!userId) throw new Error("Usuario no autenticado");

    const ref = doc(db, 'usuarios', userId, 'caps-vistos', animeId);

    // Obtener estado del anime desde el DOM (elemento #statuscargado)
    const statusElement = document.getElementById('statuscargado');
    const estadoTexto = statusElement ? statusElement.textContent : '';
    const esFinalizadoPorEstado = estadoTexto === 'Finalizado' || estadoTexto === 'Concluido';

    // LEER UNA SOLA VEZ al inicio (optimización - antes eran 2 lecturas)
    const snap = await getDoc(ref);
    let nuevosVistos = [];

    if (snap.exists()) {
      const data = snap.data();
      nuevosVistos = data.episodiosVistos || [];
    }

    if (esVisto) {
      // Marcar como visto
      nuevosVistos = [...new Set([...nuevosVistos, episodio.toString()])];

      // Verificar si se vieron todos los capítulos FILTRADOS
      const totalFiltrados = episodiosFiltrados.length;
      const vistosFiltrados = nuevosVistos.filter(ep => episodiosFiltrados.some(ef => ef.number.toString() === ep)).length;
      const vistosTodosLosCapsFiltrados = vistosFiltrados >= totalFiltrados && totalFiltrados > 0;
      const esFinalizadoPorVistos = esFinalizadoPorEstado && vistosTodosLosCapsFiltrados;

      await setDoc(ref, {
        titulo,
        fechaAgregado: serverTimestamp(),
        episodiosVistos: arrayUnion(episodio.toString()),
        esFinalizadoPorVistos: esFinalizadoPorVistos
      }, { merge: true });

      // Actualizar cache local
      vistosCache = nuevosVistos;
    } else {
      // Desmarcar como visto
      if (snap.exists()) {
        nuevosVistos = nuevosVistos.filter(ep => ep !== episodio.toString());

        if (nuevosVistos.length === 0) {
          await deleteDoc(ref);
          console.log('🗑️ Documento eliminado:', animeId, '(no quedan episodios vistos)');
        } else {
          // Verificar si aún se vieron todos los capítulos FILTRADOS
          const totalFiltrados = episodiosFiltrados.length;
          const vistosFiltrados = nuevosVistos.filter(ep => episodiosFiltrados.some(ef => ef.number.toString() === ep)).length;
          const vistosTodosLosCapsFiltrados = vistosFiltrados >= totalFiltrados && totalFiltrados > 0;
          const esFinalizadoPorVistos = esFinalizadoPorEstado && vistosTodosLosCapsFiltrados;

          await setDoc(ref, {
            titulo,
            fechaAgregado: serverTimestamp(),
            episodiosVistos: nuevosVistos,
            esFinalizadoPorVistos: esFinalizadoPorVistos
          }, { merge: true });
        }

        // Actualizar cache local
        vistosCache = nuevosVistos;
      }
    }

    // Lógicas de UI post-confirmación
    const total = document.querySelectorAll(".episode-btn").length;
    const vistosEnUI = document.querySelectorAll(".episode-btn.ep-visto").length;

    actualizarProgresoCapitulos(total, vistosEnUI);

    // Mostrar overlay SOLO si se marcó el último capítulo como visto
    // (verificar que el capítulo marcado es el último de los episodios FILTRADOS)
    if (esVisto && vistosEnUI === total && total > 0) {
        const ultimoEpisodioFiltrado = episodiosFiltrados[episodiosFiltrados.length - 1];
        if (ultimoEpisodioFiltrado && parseInt(episodio) === parseInt(ultimoEpisodioFiltrado.number)) {
            mostrarOverlayCapitulosCompletados();
        }
    }
    mostrarPildora("capvisto", esVisto, null, episodio);

  } catch (error) {
    console.error("Error guardando en Firestore:", error);
    throw error;
  } finally {
    capituloToggleInProgress = false;
  }
}

// 5. Carga inicial (Optimizado con authStateReady de Firebase v11)
async function obtenerCapitulosVistos(animeId) {
  try {
    await auth.authStateReady(); 

    if (!auth.currentUser) {
      console.warn("obtenerCapitulosVistos: No hay instancia de usuario. Retornando [].");
      return [];
    }

    const ref = doc(db, 'usuarios', auth.currentUser.uid, 'caps-vistos', animeId);
    const snap = await getDoc(ref);
    
    return snap.exists() ? snap.data().episodiosVistos || [] : [];
    
  } catch (error) {
    console.error("Error al obtener capítulos vistos:", error);
    return []; 
  }
}
// Función optimizada para comparar datos según la nueva estructura del backend
function compararDatos(a, b) {
  // Validación rápida de nulos/undefined
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  // Función de comparación rápida de strings
  const strEqual = (str1, str2) => 
    String(str1 || '').trim() === String(str2 || '').trim();

  // Comparación de campos básicos (actualizados según nuevo backend)
  const camposBasicos = [
    ['titulo', strEqual],
    ['portada', strEqual],
    ['banner', strEqual],
    ['descripcion', strEqual],
    ['estado', strEqual],
    ['category', strEqual],
    ['startDate', strEqual],
    ['internalId', strEqual],
    ['id', strEqual], // Nuevo campo obligatorio
    ['score', strEqual]
  ];

  if (camposBasicos.some(([campo, comparar]) => 
    !comparar(a[campo], b[campo]))
  ) {
    return false;
  }

  // Comparación de arrays de géneros
  if (a.generos?.length !== b.generos?.length || !(a.generos || []).every((g, i) => strEqual(g, b.generos[i]))) {
    return false;
  }

  // Función para comparar arrays de objetos con claves específicas
  const compararArrays = (arrA, arrB, keys) => {
    if (arrA?.length !== arrB?.length) return false;
    
    const normalizar = (obj) => 
      keys.map(k => String(obj?.[k] || '').trim().toLowerCase());
    
    const aSorted = [...arrA].sort((x, y) => 
      normalizar(x).join('|').localeCompare(normalizar(y).join('|'))
    );
    
    const bSorted = [...arrB].sort((x, y) => 
      normalizar(x).join('|').localeCompare(normalizar(y).join('|'))
    );
    
    return aSorted.every((item, i) => 
      normalizar(item).join('|') === normalizar(bSorted[i]).join('|')
    );
  };

  // Comparar episodios y relacionados
  return (
    compararArrays(a.episodios || [], b.episodios || [], ['number']) &&
    compararArrays(a.relacionados || [], b.relacionados || [], ['slug', 'type', 'startDate', 'id'])
  );
}

// Función simplificada para normalizar datos de la API (sin sources[0].data)
function normalizarDatosAPI(data) {
  if (!data) {
    return null;
  }

  // Ya no tenemos el formato con sources[0].data - formato directo simplificado
  return {
    id: data.id || '', // Nuevo campo obligatorio
    titulo: data.title || '',
    internalId: data.internalId || '',
    portada: data.cover || '',
    banner: data.banner || '',
    descripcion: data.synopsis || '',
    generos: data.genres || [],
    estado: data.status || null,
    category: data.category || null,
    startDate: data.startDate || null,
    episodios: (data.episodes || []).map(ep => ({ number: ep.number })),
    relacionados: (data.relations || [])
      .filter(ep => ep && ep.slug)
      .map(ep => ({ slug: ep.slug, type: ep.type, startDate: ep.startDate, id: ep.id })) || [],
    // Campos adicionales según función
    type: data.type || null, // Para search
    chapter: data.chapter || null, // Para getLatestEpisodes
    url: data.url || null, // Para search
    score: data.score || null
  };
}

async function cargarAnime(idauxiliar) {
  if (idauxiliar) {
    console.log(idauxiliar);
    id = idauxiliar;
  }
  if (!id) {
    const letras = "abcdefghijklmnopqrstuvwxyz";
    const letraRandom = letras[Math.floor(Math.random() * letras.length)];
    return cargarAnime(letraRandom);
  }

  // 1. Cargar desde caché (si existe)
  let cached = cargarDatosDesdeCache(id);
  if (cached) {
    renderAnime(cached);
  }

  // 2. Cargar desde Firestore siempre (optimización: guardar resultado para reutilizar)
  let firestoreData = null;
  try {
    const docSnap = await getDoc(doc(db, 'datos-animes', id));
    if (docSnap.exists()) {
      firestoreData = docSnap.data();
      if (!compararDatos(cached, firestoreData)) {
        actualizarCache(id, firestoreData);
        cached = firestoreData;
        renderAnime(firestoreData);
      }
    }
  } catch (err) {
    console.error('Error al cargar desde Firestore:', err);
  }

  // 3. Cargar desde API externa y actualizar todo
  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${id}`);
    const data = await res.json();
    const anime = normalizarDatosAPI(data);
    if (anime) { console.log(anime) }

    if (!anime) {
      if (firestoreData && firestoreData.manual === true) {
        return
      }
      mostrarResultadosBusqueda(id);
      return
    }

    if (!anime.id || !anime.titulo) {
      if (firestoreData && firestoreData.manual === true) {
        return
      }
      mostrarResultadosBusqueda(id);
      return
    }

    if (!compararDatos(cached, anime)) {
      // Preservar servidores existentes en Firestore (reutilizar lectura anterior)
      if (firestoreData && firestoreData.episodios) {
        anime.episodios = anime.episodios.map(ep => {
          const epFirestore = firestoreData.episodios.find(e => String(e.number) === String(ep.number));
          if (epFirestore?.servidores) {
            return { ...ep, servidores: epFirestore.servidores };
          }
          return ep;
        });
      }
      await setDoc(doc(db, 'datos-animes', id), { ...anime, fechaGuardado: serverTimestamp() }, { merge: true });
      actualizarCache(id, anime);
      renderAnime(anime);
    }

    if (data.message === 'Anime no encontrado en ninguna fuente') {
      mostrarResultadosBusqueda(id);
    }
   }
    catch (err) {
    console.error('Error carga anime:', err)
  }
};

function mostrarResultadosBusqueda(termino) {
  const inputBusqueda = document.getElementById('busqueda');
  if (!inputBusqueda || !termino) return;

  document.querySelector('header')?.classList.add('search-active');
  inputBusqueda.value = termino;
  inputBusqueda.dispatchEvent(new Event('input'));
}

cargarAnime();


// Toggle búsqueda de capítulos
const btnSearchCapitulo = document.getElementById('btn-search-capitulo');
const btnCloseSearchCapitulo = document.getElementById('btn-close-search-capitulo');

if (btnSearchCapitulo) {
  btnSearchCapitulo.addEventListener('click', function () {
    document.querySelector('.header-caps').classList.add('search-active');
    document.getElementById('filtro-capitulo').focus();
  });
}

if (btnCloseSearchCapitulo) {
  btnCloseSearchCapitulo.addEventListener('click', function () {
    document.querySelector('.header-caps').classList.remove('search-active');
    document.getElementById('filtro-capitulo').value = "";
  });
}



const btnFav = document.getElementById('btn-fav');

actualizarEstadoFavorito()

function actualizarEstadoFavorito() {
  obtenerFavoritosAnime()
    .then(favoritos => {
      const esFavorito = favoritos.includes(id);
      btnFav.classList.toggle("favorito", esFavorito);
    })
    .catch(error => {
      console.error("Error al obtener favoritos:", error);
    });
}

btnFav.addEventListener("click", async () => {
  if (!auth.currentUser) {
    mostrarPildora('no-user');
    return;
  }

  const titulo = document.getElementById("titulo").textContent;

  // Deshabilitamos para evitar spam de clics
  btnFav.disabled = true;

  // Guardar estado anterior de la UI
  const eraActivo = btnFav.classList.contains("favorito");

  try {
    // --- RESPUESTA VISUAL INSTANTÁNEA ---
    if (eraActivo) {
      btnFav.classList.remove("favorito");
      btnFav.classList.add("desaparecer");
      setTimeout(() => btnFav.classList.remove("desaparecer"), 500);
    } else {
      btnFav.classList.add("favorito");
      btnFav.classList.add("aparecer");
      setTimeout(() => btnFav.classList.remove("aparecer"), 500);
    }

    // --- PROCESO INTERNO EN BASE DE DATOS ---
    const res = await toggleFavoritoAnime(titulo);

    // --- ESTADO FINAL ---
    actualizarEstadoFavorito();

  } catch (err) {
    console.error("❌ Error al cambiar favorito:", err);
    // Revertir UI en caso de error
    if (eraActivo) {
      btnFav.classList.add("favorito");
    } else {
      btnFav.classList.remove("favorito");
    }
    actualizarEstadoFavorito();
  } finally {
    btnFav.disabled = false;
  }
});

async function toggleFavoritoAnime(titulo) {
  const user = localStorage.getItem("userID");
  if (!user) {
    throw "Usuario no autenticado";
  }

  const favoritosRef = doc(collection(doc(db, "usuarios", user), "favoritos"), "lista");
  const favoritosDoc = await getDoc(favoritosRef);

  let favoritos = [];
  if (favoritosDoc.exists() && favoritosDoc.data().animes) {
    favoritos = [...favoritosDoc.data().animes];
  }

  const index = favoritos.indexOf(id);

  if (index !== -1) {
    // eliminar
    favoritos.splice(index, 1);
    await setDoc(favoritosRef, { animes: favoritos }, { merge: true });
    mostrarPildora("fav", false, titulo);  
    return { esFavorito: false, mensaje: "Anime eliminado de favoritos" };
  } else {
    // agregar
    favoritos.push(id);
    await setDoc(favoritosRef, { animes: favoritos }, { merge: true });
    mostrarPildora("fav", true, titulo);  
    return { esFavorito: true, mensaje: "Anime agregado a favoritos" };
  }
}

async function obtenerFavoritosAnime() {
  const user = localStorage.getItem("userID");
  if (!user) return [];

  const favoritosRef = doc(collection(doc(db, "usuarios", user), "favoritos"), "lista");
  const favoritosDoc = await getDoc(favoritosRef);
  
  return favoritosDoc.exists() && favoritosDoc.data().animes 
    ? favoritosDoc.data().animes 
    : [];
}

async function actualizarProgresoCapitulos(totalEpisodios, episodiosVistos) {
  // Evitamos dividir por cero si no hay episodios
  if (!totalEpisodios || totalEpisodios === 0) return;

  // Verificamos si recibimos un Array (para usar .length) o un Número directo
  const cantidadVistos = Array.isArray(episodiosVistos) 
    ? episodiosVistos.length 
    : Number(episodiosVistos);

  const progreso = (cantidadVistos / totalEpisodios) * 100;
  const progresoFixed = progreso.toFixed(0);

  const progresoBtn = document.getElementById('btn-progreso');
  if (progresoBtn) {
    progresoBtn.style.setProperty('--progreso', progresoFixed);
  }

  const progresoText = document.getElementById('progreso-text');
  if (progresoText) {
    progresoText.textContent = `${progresoFixed}%`;
  }

  const progresoElement = document.getElementById('progreso');
  if (progresoElement) {
    progresoElement.style.width = `${progreso}%`;
  }
}

const btnViendo = document.getElementById('btn-viendo');
const btnPendiente = document.getElementById('btn-pendiente');
const btnVisto = document.getElementById('btn-visto');
const estadoText = document.getElementById('estado-text');

const ESTADOS = {
  viendo: {
    color: '#22cee9',
    texto: 'VIENDO',
  },
  pendiente: {
    color: '#ffc107',
    texto: 'PENDIENTE',
  },
  visto: {
    color: '#00c853',
    texto: 'VISTO',
  }
};

let activeBtn, timeout;

const buttons = [btnViendo, btnPendiente, btnVisto, btnFav].filter(Boolean);

const setHover = btn => {
  clearTimeout(timeout);
  if (activeBtn && activeBtn !== btn) activeBtn.classList.remove("touch-hover");
  activeBtn = btn;
  btn?.classList.add("touch-hover");
};

const clearHover = () => {
  timeout = setTimeout(() => {
    activeBtn?.classList.remove("touch-hover");
    activeBtn = null;
  }, 2000);
};

buttons.forEach(btn => {
  btn.addEventListener("touchstart", () => setHover(btn), { passive: true });

  btn.addEventListener("touchmove", e => {
    setHover(document.elementFromPoint(
      e.touches[0].clientX,
      e.touches[0].clientY
    )?.closest("button"));
  }, { passive: true });

  btn.addEventListener("touchend", clearHover, { passive: true });
  btn.addEventListener("touchcancel", clearHover, { passive: true });
});
async function actualizarEstadoFirebase(estado) {
  if (estadoToggleInProgress) {
    console.warn('actualizarEstadoFirebase: Operación en progreso, ignorando.');
    return;
  }

  estadoToggleInProgress = true;

  try {
    const user = localStorage.getItem("userID");
    if (!user) return;

    const estadoActual = await obtenerEstadoActual();

    if (estadoActual === estado) return;

    await limpiarEstadosPrevios();

    if (!estado) return;

    const estadoLower = estado.toLowerCase();
    const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estadoLower);
    const estadoDoc = await getDoc(estadoRef);

    let animes = [];
    if (estadoDoc.exists()) {
      animes = [...(estadoDoc.data().animes || [])];
    }

    if (!animes.includes(id)) {
      animes.push(id);
      await setDoc(estadoRef, { animes }, { merge: true });
      console.log(estadoLower);
      mostrarPildora(estadoLower, true, document.getElementById('titulo')?.textContent || '');
    }
  } catch (error) {
    console.error("Error al actualizar estado en Firebase:", error);
    throw error;
  } finally {
    estadoToggleInProgress = false;
  }
}

async function limpiarEstadosPrevios() {
  const user = localStorage.getItem("userID");
  if (!user) return;

  const estados = ['viendo', 'pendiente', 'visto'];

  for (const estado of estados) {
    const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estado);
    const estadoDoc = await getDoc(estadoRef);
    
    if (estadoDoc.exists()) {
      let animes = [...(estadoDoc.data().animes || [])];
      const index = animes.indexOf(id);
       
      if (index !== -1) {
        animes.splice(index, 1);
        await setDoc(estadoRef, { animes }, { merge: true });
      }
    }
  }
}

async function manejarEstadoSeleccionado(btnSeleccionado) {
  if (estadoToggleInProgress) {
    console.warn('manejarEstadoSeleccionado: Operación en progreso, ignorando clic.');
    return;
  }

  const estadoId = btnSeleccionado.id.replace('btn-', '');
  const estado = ESTADOS[estadoId];
  const user = localStorage.getItem("userID");

  if (!user) {
    mostrarPildora('no-user');
    return;
  }

  if (btnSeleccionado.classList.contains('active')) {
    // Desactivar estado - UI INSTANTÁNEA
    const estadoAnterior = btnSeleccionado.classList.contains('active');
    btnSeleccionado.classList.remove('active');
    
    try {
      const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estadoId);
      const estadoDoc = await getDoc(estadoRef);

      if (estadoDoc.exists() && Array.isArray(estadoDoc.data().animes)) {
        const animesActualizados = estadoDoc.data().animes.filter(animeId => animeId !== id);
        if (animesActualizados.length !== estadoDoc.data().animes.length) {
          await setDoc(estadoRef, { animes: animesActualizados }, { merge: true });
          console.log(estadoId);
          mostrarPildora(estadoId, false, document.getElementById('titulo')?.textContent || '');
        }
      }
    } catch (error) {
      console.error('Error al eliminar el estado:', error);
      // Revertir UI en caso de error
      btnSeleccionado.classList.add('active');
      await refrescarEstadoBotones();
    }
    return;
  }

  // Activar nuevo estado - UI INSTANTÁNEA
  const estadoAnteriorBtn = document.querySelector('#btn-viendo.active, #btn-pendiente.active, #btn-visto.active');
  [btnViendo, btnPendiente, btnVisto].forEach(btn => btn.classList.remove('active'));
  btnSeleccionado.classList.add('active');
  mostrarPildora('actualizando', true, document.getElementById('titulo')?.textContent || '');
  
  try {
    await actualizarEstadoFirebase(estadoId.toUpperCase());
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    // Revertir UI en caso de error
    await refrescarEstadoBotones();
  }
}

async function refrescarEstadoBotones() {
  const user = localStorage.getItem("userID");
  if (!user) return;

  try {
    const estadoActual = await obtenerEstadoActual();
    [btnViendo, btnPendiente, btnVisto].forEach(btn => btn.classList.remove('active'));

    if (estadoActual) {
      const btn = document.getElementById(`btn-${estadoActual.toLowerCase()}`);
      if (btn) btn.classList.add('active');
    }
  } catch (error) {
    console.error('Error al refrescar estado de botones:', error);
  }
}

async function obtenerEstadoActual() {
  const user = localStorage.getItem("userID");
  if (!user) return null;

  const estados = ['viendo', 'pendiente', 'visto'];
  
  for (const estado of estados) {
    const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estado);
    const estadoDoc = await getDoc(estadoRef);
    
    if (estadoDoc.exists() && Array.isArray(estadoDoc.data().animes)) {
      if (estadoDoc.data().animes.includes(id)) {
        return estado.toUpperCase();
      }
    }
  }
  return null;
}
obtenerEstadoActual().then(estado => {
  if (estado) {
    const btnSeleccionado = document.getElementById(`btn-${estado.toLowerCase()}`);
    if (btnSeleccionado) btnSeleccionado.classList.add('active'); // Solo UI
  }
});

btnViendo.addEventListener('click', () => manejarEstadoSeleccionado(btnViendo));
btnPendiente.addEventListener('click', () => manejarEstadoSeleccionado(btnPendiente));
btnVisto.addEventListener('click', () => manejarEstadoSeleccionado(btnVisto));


document.addEventListener("click", (e) => {
  const seccion = document.getElementById("Estados");
  if (!seccion) return;
  const btnEstado = document.getElementById("btn-estado");
  if (seccion.classList.contains("active") && 
      !seccion.contains(e.target) && 
      !btnEstado.contains(e.target)) {
    seccion.classList.remove("active");
  }
});

const scrollContainer = document.querySelector('#animes-relacionados');

scrollContainer.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault(); 
    scrollContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });

//modal portada
const modal = document.createElement('div');
modal.id = 'modalImagen';
modal.innerHTML = `
  <img src="" alt="Vista Ampliada">
  <div class="modal-acciones">
    <!-- Botón Compartir -->
    <button id="btn-compartir-anime">
      Compartir anime
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M15.8358 16.1305L9.02549 12.1985L8.27549 13.4976L15.0858 17.4295L15.8358 16.1305Z" fill="#BFBFBF"></path> 
        <path fill-rule="evenodd" clip-rule="evenodd" d="M15.8358 7.8656L9.02549 11.7976L8.27549 10.4985L15.0858 6.56657L15.8358 7.8656Z" fill="#BFBFBF"></path> 
        <path fill-rule="evenodd" clip-rule="evenodd" d="M6.15 13.6438C7.06127 13.6438 7.8 12.905 7.8 11.9938C7.8 11.0825 7.06127 10.3438 6.15 10.3438C5.23873 10.3438 4.5 11.0825 4.5 11.9938C4.5 12.905 5.23873 13.6438 6.15 13.6438ZM6.15 15.1438C7.8897 15.1438 9.3 13.7334 9.3 11.9938C9.3 10.2541 7.8897 8.84375 6.15 8.84375C4.4103 8.84375 3 10.2541 3 11.9938C3 13.7334 4.4103 15.1438 6.15 15.1438Z" fill="currentColor"></path> 
        <path fill-rule="evenodd" clip-rule="evenodd" d="M17.85 16.3455C18.7612 16.3455 19.5 17.0842 19.5 17.9955C19.5 18.9068 18.7612 19.6455 17.85 19.6455C16.9387 19.6455 16.2 18.9068 16.2 17.9955C16.2 17.0842 16.9387 16.3455 17.85 16.3455ZM17.85 14.8455C19.5896 14.8455 21 16.2558 21 17.9955C21 19.7352 19.5896 21.1455 17.85 21.1455C16.1103 21.1455 14.7 19.7352 14.7 17.9955C14.7 16.2558 16.1103 14.8455 17.85 14.8455Z" fill="currentColor"></path> 
        <path fill-rule="evenodd" clip-rule="evenodd" d="M17.85 7.64961C18.7612 7.64961 19.5 6.91088 19.5 5.99961C19.5 5.08834 18.7612 4.34961 17.85 4.34961C16.9387 4.34961 16.2 5.08834 16.2 5.99961C16.2 6.91088 16.9387 7.64961 17.85 7.64961ZM17.85 9.14961C19.5896 9.14961 21 7.73931 21 5.99961C21 4.25991 19.5896 2.84961 17.85 2.84961C16.1103 2.84961 14.7 4.25991 14.7 5.99961C14.7 7.73931 16.1103 9.14961 17.85 9.14961Z" fill="currentColor"></path>
      </svg>
    </button>
    <!-- Botón Descargar -->
    <button id="btn-descargar-imagen">
      Descargar portada 
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path opacity="0.5" d="M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M12 3V16M12 16L16 11.625M12 16L8 11.625" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </button>
  </div>`;
document.body.appendChild(modal);

// ---- SELECCIÓN DE ELEMENTOS ----
const btnDescargarImagen = modal.querySelector('#btn-descargar-imagen');
const btnCompartirAnime = modal.querySelector('#btn-compartir-anime');
const modalImg = modal.querySelector('img');

// ---- FUNCIONES AUXILIARES ----
// Extraer la obtención del título crudo para que ambos botones lo usen
const obtenerTituloAnime = () => {
  const tituloEl = document.getElementById('titulo');
  return tituloEl ? tituloEl.textContent.trim() : 'Este increíble anime';
};

// Sanitización exclusiva para el nombre de archivo a descargar
const obtenerNombreSanitizado = (tituloCrudo) => {
  return tituloCrudo
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Elimina acentos
    .replace(/\s+/g, '_')                             // Espacios por guiones bajos
    .replace(/[^\w.-]+/g, '');                        // Solo caracteres válidos para archivos
};

// ---- EVENTO: COMPARTIR ----
btnCompartirAnime.addEventListener('click', async (e) => {
  e.stopPropagation();

  const tituloCrudo = obtenerTituloAnime();
  const urlActual = window.location.href; 
  
  // Mensaje optimizado y amigable invitando a la plataforma Anizen
  const datosACompartir = {
    title: `¡Mira ${tituloCrudo} en Anizen!`,
    text: `¡Te recomiendo ver ${tituloCrudo}! 🍿 Disfrútalo ahora mismo en Anizen:`,
    url: urlActual
  };

  try {
    if (navigator.share) {
      await navigator.share(datosACompartir);
    } else {
      // El salto de línea (\n) asegura que la URL quede debajo del mensaje al pegar en WhatsApp/Telegram
      await navigator.clipboard.writeText(`${datosACompartir.text}\n${datosACompartir.url}`);
      
      const textoOriginal = btnCompartirAnime.textContent;
      btnCompartirAnime.textContent = "¡Enlace copiado!";
      setTimeout(() => { 
        btnCompartirAnime.innerHTML = `Compartir anime ${btnCompartirAnime.querySelector('svg').outerHTML}`; 
      }, 2000);
    }
  } catch (error) {
    if (error.name !== 'AbortError') { 
      console.error('Error al compartir:', error);
    }
  }
});

// ---- EVENTO: DESCARGAR ----
btnDescargarImagen.addEventListener('click', async (e) => {
  e.stopPropagation();
  
  const src = modalImg.src;
  if (!src) return;

  const contenidoOriginalBtn = btnDescargarImagen.innerHTML;
  btnDescargarImagen.disabled = true;
  btnDescargarImagen.textContent = 'Descargando...';

  try {
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    
    const blob = await response.blob();
    const mimeType = blob.type;
    const extension = mimeType.split('/')[1] || 'jpg'; 

    const tituloCrudo = obtenerTituloAnime();
    const nombreAnime = obtenerNombreSanitizado(tituloCrudo);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `portada-${nombreAnime}.${extension}`;
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error en la descarga:', err);
    alert('No se pudo descargar la imagen.');
  } finally {
    btnDescargarImagen.disabled = false;
    btnDescargarImagen.innerHTML = contenidoOriginalBtn;
  }
});
portadaEl.addEventListener('click', () => {
  modalImg.src = portadaEl.src;
  modal.classList.add('active');
});

// Cerrar al hacer clic en la imagen del modal
modal.addEventListener('click', () => {
  modal.classList.remove('active');
});
window.addEventListener('scroll', () => {
  modal.classList.remove('active');
});

//pildora visual check 

function mostrarPildora(opcion, estado = true, anime = null, cap = null) {
  const pillAnterior = document.querySelector('.pildora');
  if (pillAnterior) pillAnterior.remove();

  const pill = document.createElement("div");
  pill.classList.add("pildora");

  const accion = estado ? "Agregado a" : "Eliminado de";

  const opciones = {
    fav: { clase: "pildora-fav", texto: `${anime} ${accion} favoritos` },
    pendiente: { clase: "pildora-pendiente", texto: `${anime} ${accion} pendientes` },
    visto: { clase: "pildora-visto", texto: `${anime} ${accion} vistos` },
    viendo: { clase: "pildora-viendo", texto: `${anime} ${accion} viendo` },
    capvisto: { clase: "pildora-visto", texto: `Capítulo ${cap} ${accion} vistos` },
    actualizando: { clase: "pildora-default", texto: `Actualizando ${anime}...` },
    "no-user": { clase: "pildora-no-user", texto: "Inicia sesión para guardar tu progreso" },
    "alerta texto": { clase: "pildora-default", texto: "Título copiado al portapapeles" }
  };

  const config = opciones[opcion];

  if (config) {
    pill.textContent = config.texto;
    pill.classList.add(estado ? config.clase : "pildora-eliminado");
    
    if (opcion === "no-user") {
      pill.onclick = () => {
        const confirmBtn = document.getElementById("confirm-login");
        if (confirmBtn) confirmBtn.click();
      };
      console.log("Pildora de no-user creada con evento de clic");
    }
  } else {
    pill.textContent = estado ? "Acción realizada" : "Acción revertida";
    pill.classList.add(estado ? "pildora-default" : "pildora-eliminado");
  }

  document.body.appendChild(pill);

  pill.addEventListener('animationend', () => {
    pill.remove();
  }, { once: true });
}


// Función para actualizar campo esFinalizadoPorVistos por lotes desde Firestore
async function actualizarFinalizadoPorLotes() {
  console.log('🔄 Iniciando actualizarFinalizadoPorLotes...');
  try {
    const userId = auth.currentUser?.uid || localStorage.getItem("userID");
    if (!userId) {
      console.warn("No hay usuario autenticado para actualizar finalizado.");
      return;
    }
    console.log('✅ Usuario autenticado:', userId);

    const ref = collection(db, "usuarios", userId, "caps-vistos");
    const snap = await getDocs(ref);
    
    if (snap.empty) {
      console.log("✅ No hay documentos para actualizar.");
      return;
    }
    console.log(`📦 Total documentos encontrados: ${snap.docs.length}`);

    let actualizados = 0;
    const batchSize = 10; // Procesar en lotes de 10
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const promesas = [];

      for (const docSnap of batch) {
        const data = docSnap.data();
        const animeId = docSnap.id;
        console.log(`🔍 Procesando ${animeId}...`);
        promesas.push(
          (async () => {
            try {
              const animeDoc = await getDoc(doc(db, 'datos-animes', animeId));
              if (animeDoc.exists()) {
                const animeData = animeDoc.data();
                const estado = (animeData.estado || animeData.status || '').toLowerCase();
                const esFinalizadoPorEstado = estado === 'finalizado' || estado === 'completed';
                
                // Verificar si se vieron todos los capítulos
                const episodiosVistos = (data.episodiosVistos || []).length;
                const totalEpisodios = Array.isArray(animeData.episodios) ? animeData.episodios.length : Object.keys(animeData.episodios || {}).length;
                const vistosTodosLosCaps = totalEpisodios > 0 && episodiosVistos >= totalEpisodios;
                const esFinalizadoPorVistos = esFinalizadoPorEstado && vistosTodosLosCaps;
                
                console.log(`  📊 ${animeId}: estado="${estado}" esFinalizadoPorEstado=${esFinalizadoPorEstado} vistos=${episodiosVistos}/${totalEpisodios} vistosTodos=${vistosTodosLosCaps} esFinalizadoPorVistos=${esFinalizadoPorVistos}`);
                
                await setDoc(docSnap.ref, {
                  esFinalizadoPorVistos: esFinalizadoPorVistos
                }, { merge: true });
                
                console.log(`✅ Actualizado: ${animeId} - esFinalizadoPorVistos: ${esFinalizadoPorVistos}`);
                actualizados++;
              } else {
                console.warn(`⚠️ Anime no existe en datos-animes: ${animeId}`);
              }
            } catch (e) {
              console.error(`❌ Error actualizando ${animeId}:`, e);
            }
          })()
        );
      }

      await Promise.all(promesas);
      console.log(`📊 Progreso: ${Math.min(i + batchSize, docs.length)}/${docs.length} documentos procesados`);
    }

    console.log(`✅ Actualización completada: ${actualizados} documentos actualizados.`);

  } catch (error) {
    console.error("❌ Error al actualizar finalizado por lotes:", error);
  }
}


// Función de limpieza: elimina documentos con episodiosVistos vacíos
async function limpiarDocumentosVacios() {
  try {
    const userId = auth.currentUser?.uid || localStorage.getItem("userID");
    if (!userId) {
      console.warn("No hay usuario autenticado para limpiar documentos.");
      return;
    }
    
    const ref = collection(db, "usuarios", userId, "caps-vistos");
    const snap = await getDocs(ref);
    
    if (snap.empty) {
      console.log("✅ No hay documentos para limpiar.");
      return;
    }
    
    let eliminados = 0;
    const promesasEliminacion = [];
    
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const episodiosVistos = data.episodiosVistos || [];
      
      if (!Array.isArray(episodiosVistos) || episodiosVistos.length === 0) {
        console.log('🗑️ Eliminando documento vacío:', docSnap.id);
        promesasEliminacion.push(deleteDoc(docSnap.ref));
        eliminados++;
      }
    });
    
    if (promesasEliminacion.length > 0) {
      await Promise.all(promesasEliminacion);
      console.log(`✅ Limpieza completada: ${eliminados} documentos eliminados.`);
    } else {
      console.log("✅ No se encontraron documentos vacíos.");
    }
    
  } catch (error) {
    console.error("❌ Error al limpiar documentos vacíos:", error);
  }
}
// ejecutar 1 vez
async function ejecutarMantenimientoUnaVez() {
  const cacheKey = "mantenimiento_bd_completado";
  const yaEjecutado = localStorage.getItem(cacheKey);

  if (yaEjecutado === "true") {
    // Si ya está en true, no hacemos nada
    // console.log("✅ El mantenimiento de la base de datos ya se realizó anteriormente.");
  } else {
    const userId = auth.currentUser?.uid || localStorage.getItem("userID");
    if (!userId) {
      console.warn("⏳ El mantenimiento se pospone hasta que haya un usuario autenticado.");
      return;
    }

    // Si no existe o es falso, ejecutamos el proceso
    try {
      console.log("⏳ Iniciando limpieza y actualización de documentos...");
      
      // Ejecutamos tus funciones esperando a que terminen
      await limpiarDocumentosVacios();
      await actualizarFinalizadoPorLotes();
      
      // Guardamos en el localStorage para no volver a hacerlo
      localStorage.setItem(cacheKey, "true");
      console.log("✅ Mantenimiento finalizado y guardado en local.");
      
    } catch (error) {
      console.error("❌ Ocurrió un error ejecutando el mantenimiento:", error);
    }
  }
}
ejecutarMantenimientoUnaVez();