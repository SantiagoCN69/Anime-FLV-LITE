import { db, auth } from './firebase-login.js';
import {collection, doc, getDocs, getDoc, updateDoc, setDoc, query, orderBy, limit, where, startAfter} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { observerAnimeCards, aplicarViewTransition, crearAnimeCard, scrollFilaUnaTarjeta } from './utils.js';
import { buildFavoritesAnimePrompt, fetchIAResponse, parseAnimeNamesFromResponse, resolveAnimeByName } from './ai-recommendations.js';
import { fetchMALRanking, MAL_RANKING_TYPES, MAL_RANKING_LABELS } from './mal-api.js';

// Registro del Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        
        // Verificar actualizaciones del service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Aquí podrías mostrar una notificación al usuario
            }
          });
        });
      })
      .catch((error) => {
        console.error('Error al registrar el Service Worker:', error);
      });
  });
  
  // Escuchar cambios en el control del service worker
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

let userID = localStorage.getItem('userID') || "null";

// El login no recarga la página: al resolverse el estado de auth se actualiza
// el userID para que las listas y secciones lean las listas del usuario correcto.
document.addEventListener('authStateReady', () => {
  userID = localStorage.getItem('userID') || "null";
});

// Todas las siluetas viven en el mismo path para que MorphSVG pueda interpolarlas.
const iconosDeSeccion = {
  'Ultimos-Episodios': '',
 'Busqueda-Resultados': 'M62.001 32.5715C62.001 27.1214 60.3848 21.7936 57.357 17.2621C54.3291 12.7305 50.0257 9.19856 44.9904 7.11292C39.9551 5.02727 34.4144 4.48163 29.0691 5.54491C23.7237 6.60815 18.8138 9.2327 14.96 13.0865C11.1062 16.9402 8.48172 21.8501 7.41844 27.1955C6.35519 32.5409 6.90099 38.0816 8.98662 43.1166C11.0723 48.1519 14.6042 52.4556 19.1358 55.4835C23.6674 58.5113 28.995 60.1275 34.445 60.1275 M6.88898 32.5714H62.001 M34.445 60.1275C29.1266 60.1275 24.8004 47.7824 24.8004 32.5715C24.8004 17.3605 29.1266 5.01538 34.445 5.01538C39.7633 5.01538 44.0896 17.3605 44.0896 32.5715 M51.9957 59.7693C57.3223 59.7693 61.6403 55.4513 61.6403 50.1247C61.6403 44.7981 57.3223 40.4801 51.9957 40.4801C46.6691 40.4801 42.3511 44.7981 42.3511 50.1247C42.3511 55.4513 46.6691 59.7693 51.9957 59.7693Z M64.7561 62.8834L58.804 56.9589',
 'Contacto': 'M36.1768 17.1832L63.4709 5.94446L39.5886 63.9445L29.3533 40.0621M63.4709 5.94446L29.3533 40.0621M29.3533 40.0621L5.47095 29.8268L19.118 24.2074',
  'Lista': 'M13.93 2.32H51.07C54.17 2.32 55.71 3.87 55.71 6.96V62.68L32.5 46.43L9.29 62.68V6.96C9.29 3.87 10.83 2.32 13.93 2.32Z',
  'DirectorioJK': 'M11.196 14.616c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.848 21.432-10.781M11.196 32.477c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.847 21.432-10.78M11.196 13.566c0-4.644 8.931-9.792 21.432-9.667 12.501.125 21.432 5.547 21.432 10.191v36.773c0 4.644-8.931 10.192-21.432 10.192-12.501 0-21.432-6.073-21.432-10.717V13.566Z',
  'DirectorioAV1': 'M11.196 14.616c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.848 21.432-10.781M11.196 32.477c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.847 21.432-10.78M11.196 13.566c0-4.644 8.931-9.792 21.432-9.667 12.501.125 21.432 5.547 21.432 10.191v36.773c0 4.644-8.931 10.192-21.432 10.192-12.501 0-21.432-6.073-21.432-10.717V13.566Z',
  'Populares': 'M41.018 61.686c35.917-8.817 15.805-44.083-8.62-58.777-2.874 10.286-7.187 13.225-15.806 23.511C5.177 40.038 10.848 55.808 26.65 61.686c-2.395-2.939-8.573-9.111-4.313-17.633 1.47-2.939 4.408-5.878 2.941-11.755 2.874 1.469 8.816 2.939 10.284 10.285 2.394-2.939 4.881-9.11 2.581-16.163 17.993 13.224 10.644 26.449 2.875 35.266Z',
  'Recomendaciones': 'M28.523 44.492a10.247 10.247 0 0 0-4.125-4.125L6.789 35.826a1.644 1.644 0 0 1 0-2.761l17.61-4.544a10.25 10.25 0 0 0 4.125-4.122l4.541-17.61a1.645 1.645 0 0 1 2.764 0l4.537 17.61a10.25 10.25 0 0 0 4.125 4.125l17.61 4.538a1.644 1.644 0 0 1 0 2.767l-17.61 4.538a10.247 10.247 0 0 0-4.125 4.125l-4.541 17.61a1.645 1.645 0 0 1-2.764 0l-4.538-17.61ZM57.408 8.611v11.482M63.149 14.352H51.668M11.482 48.797v5.741M14.352 51.668H8.611',
  'Horarios': 'M60.288 37.363v-5.581c0-10.526 0-15.789-3.27-19.058-3.269-3.27-8.532-3.27-19.056-3.27M37.962 59.691H26.797c-10.525 0-15.787 0-19.057-3.27-3.27-3.269-3.27-8.532-3.27-19.057v-5.582c0-10.526 0-15.789 3.27-19.058 3.27-3.27 8.532-3.27 19.057-3.27M18.424 9.454V5.268M46.335 9.454V5.268M56.102 55.504l4.186 4.187M58.894 23.409H28.89M4.471 23.409h10.813M57.496 48.527a8.373 8.373 0 1 1-16.746 0 8.373 8.373 0 0 1 16.746 0Z',
  'Preferencias': 'M5.77 27.79C7.25 28.72 8.2 30.3 8.2 32s-.95 3.28-2.43 4.21c-1 .63-1.65 1.13-2.11 1.73-1.01 1.32-1.46 3-1.24 4.65.17 1.23.9 2.5 2.36 5.02l.01.01c1.46 2.52 2.19 3.79 3.17 4.54 1.32 1.01 3 1.46 4.65 1.24.75-.1 1.51-.41 2.56-.96 1.54-.82 3.39-.85 4.9-.02 1.51.83 2.4 2.44 2.47 4.18.04 1.18.15 1.99.44 2.68.64 1.53 1.85 2.74 3.38 3.38 1.15.48 2.61.48 5.52.48s4.37 0 5.52-.48c1.53-.64 2.74-1.85 3.38-3.38.29-.69.4-1.5.44-2.68.07-1.74.96-3.35 2.47-4.18 1.51-.83 3.36-.8 4.9.02 1.05.55 1.81.86 2.56.96 1.65.22 3.33-.23 4.65-1.24.98-.75 1.71-2.02 3.17-4.54l.01-.01c1.46-2.52 2.19-3.79 2.36-5.02.22-1.65-.23-3.33-1.24-4.65-.46-.6-1.11-1.1-2.11-1.73-1.48-.93-2.43-2.51-2.43-4.21s.95-3.28 2.43-4.21c1-.63 1.65-1.13 2.11-1.73 1.01-1.32 1.46-3 1.24-4.65-.17-1.23-.9-2.5-2.36-5.02l-.01-.02-.1-.02c-.64-1.12-1.14-1.99-1.51-2.71M57.9 35.8c-1.48-.93-2.43-2.51-2.43-4.21s.95-3.28 2.43-4.21c1-.63 1.65-1.13 2.11-1.73 1.01-1.32 1.46-3 1.24-4.65-.17-1.23-.9-2.5-2.36-5.02-1.46-2.52-2.19-3.79-3.17-4.54-1.32-1.01-3-1.46-4.65-1.24-.75.1-1.51.41-2.56.96-1.54.82-3.39.85-4.9.02-1.51-.83-2.4-2.44-2.47-4.18-.04-1.18-.15-1.99-.44-2.68-.64-1.53-1.85-2.74-3.38-3.38-1.15-.48-2.61-.48-5.52-.48s-4.37 0-5.52.48c-1.53.64-2.74 1.85-3.38 3.38-.29.69-.4 1.5-.44 2.68-.07 1.74-.96 3.35-2.47 4.18-1.51.83-3.36.8-4.9-.02-1.05-.55-1.81-.86-2.56-.96-1.65-.22-3.33.23-4.65 1.24-.98.75-1.71 2.02-3.17 4.54l-.02.04c-.66 1.15-1.17 2.02-1.55 2.76M41.2 32c0 5.09-4.13 9.22-9.22 9.22-5.09 0-9.22-4.13-9.22-9.22 0-5.09 4.13-9.22 9.22-9.22 5.09 0 9.22 4.13 9.22 9.22Z'
};

let ultimoIconoAplicado = null;

function animarSVGCambio(nuevaSeccionId) {
  if (document.body.classList.contains('animaciones-off')) return;
  // La búsqueda dispara el evento en cada tecla; si el icono ya es el de
  // esta sección no hay que reiniciar el morph (se vería como parpadeo).
  if (nuevaSeccionId === ultimoIconoAplicado) return;
  ultimoIconoAplicado = nuevaSeccionId;
  if (nuevaSeccionId === 'Ultimos-Episodios') {
    document.querySelector('.dynamic-header-icon').classList.add('hidden');
    return;
  } else {
    document.querySelector('.dynamic-header-icon').classList.remove('hidden');
  }
  const icono = document.querySelector('.dynamic-header-icon');
  const path = document.getElementById('dynamic-icon-path');
  const destino = iconosDeSeccion[nuevaSeccionId];
  if (!icono || !path) return;

  // El icono de Lista (bookmark) necesita 2px menos que el resto
  icono.classList.toggle('icono-lista', nuevaSeccionId === 'Lista');
  icono.hidden = !destino;
  if (!destino) return;

  if (window.gsap && window.MorphSVGPlugin) {
    gsap.registerPlugin(MorphSVGPlugin);
    gsap.to(path, {
      duration: 0.55,
      morphSVG: { shape: destino, map: 'size' },
      ease: 'power2.inOut',
      overwrite: true
    });
  } else {
    path.setAttribute('d', destino);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const contadores = document.querySelectorAll('span.contador');
  contadores.forEach(contadorSpan => {
    let tiempoRestante = 100;
    contadorSpan.textContent = tiempoRestante + 's';
    const intervalo = setInterval(() => {
      tiempoRestante--;
      if (tiempoRestante >= 0) {
        contadorSpan.textContent = tiempoRestante + 's';
      } else {
        clearInterval(intervalo);
        contadorSpan.textContent = '';
      }
    }, 230);
  });
});

let ultimosCapsCargados = false;
let directorioAV1Cargado = false;
let directorioJkCargado = false;
let labCargado = false;
let listaCargada = false;
let popularesCargados = false;
let horariosCargados = false;
let preferenciasCargadas = false;
let contactoCargado = false;
let heroSliderCargado = false;

// Flags para prevenir cargas simultáneas
const cargando = new Set();
// Constantes globales
const CDN_PORTADAS_ANIME = 'https://cdn.jkdesa.com/assets/images/animes/image';
const TIEMPO_MAXIMO_LECTURA_LISTA_MS = 12000;
const IMAGEN_PREDETERMINADA = 'img/loading.png';
const idsDeListasCargados = new Map();

// Cache de promesas para desduplicar peticiones a Firestore y evitar lecturas repetidas
const cacheAnimesFirestore = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de TTL para datos de animes

function obtenerDatosAnimeFirestore(animeId) {
  const cachedEntry = cacheAnimesFirestore.get(animeId);
  
  // OPTIMIZACIÓN: Verificar si el cache aún es válido (TTL)
  if (cachedEntry) {
    const edad = Date.now() - cachedEntry.timestamp;
    if (edad < CACHE_TTL_MS) {
      return cachedEntry.promise;
    } else {
      // Cache expirado, eliminar
      cacheAnimesFirestore.delete(animeId);
    }
  }

  const promesaLectura = getDoc(doc(db, 'datos-animes', animeId))
    .then(snap => snap.exists() ? snap.data() : null)
    .catch(error => {
      // Un error de red no debe bloquear futuros intentos de esta portada.
      cacheAnimesFirestore.delete(animeId);
      console.warn(`[Firestore] Error al consultar datos de ${animeId}:`, error);
      return null;
    });

  // Guardar con timestamp para TTL
  cacheAnimesFirestore.set(animeId, {
    promise: promesaLectura,
    timestamp: Date.now()
  });
  
  return promesaLectura;
}

// OPTIMIZACIÓN: Limpieza periódica del cache para evitar crecimiento indefinido
setInterval(() => {
  const ahora = Date.now();
  for (const [animeId, entry] of cacheAnimesFirestore.entries()) {
    if (ahora - entry.timestamp > CACHE_TTL_MS) {
      cacheAnimesFirestore.delete(animeId);
    }
  }
}, CACHE_TTL_MS);

function conTiempoMaximo(promesa, milisegundos, mensaje) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(mensaje)), milisegundos);
  });

  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

function generarTituloDesdeId(animeId) {
  if (!animeId) return 'Título desconocido';

  let slug = String(animeId);
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // Si falla la decodificación, se mantiene la cadena original
  }

  // Capitalización directa mediante Regex sin instanciar arrays intermedios
  const titulo = slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, caracter => caracter.toUpperCase());

  return titulo || 'Título desconocido';
}

function crearResumenAnimeDesdeId(animeId) {
  const idSeguro = encodeURIComponent(String(animeId));
  return {
    id: animeId,
    titulo: generarTituloDesdeId(animeId),
    portada: `${CDN_PORTADAS_ANIME}/${idSeguro}.jpg`,
    portadaGenerada: true
  };
}

function crearTarjetaDeLista(anime) {
  const card = crearAnimeCard(anime);
  const usaPortadaGenerada = anime?.portadaGenerada || anime?.portada?.startsWith(CDN_PORTADAS_ANIME);
  if (!card || !usaPortadaGenerada) return card;

  const imagen = card.querySelector('img.cover');
  if (!imagen) return card;

  imagen.onerror = async function () {
    // 1. Desvincular el evento actual para prevenir bucles de ejecución
    this.onerror = null;

    try {
      // 2. Consulta desduplicada mediante cache
      const datos = await obtenerDatosAnimeFirestore(anime.id);
      const portadaReal = datos?.portada || datos?.banner || datos?.cover;

      if (portadaReal) {
        // Asignar fallback seguro por si la URL recuperada de Firestore también falla al cargar
        this.onerror = () => {
          this.onerror = null;
          this.src = IMAGEN_PREDETERMINADA;
        };

        this.src = portadaReal;

        // if (datos?.titulo) {
        //   this.alt = datos.titulo;
        //   const tituloEl = card.querySelector('strong');
        //   if (tituloEl) tituloEl.textContent = datos.titulo;
        // }
        return;
      }
    } catch (error) {
      console.warn(`[Portada] Fallo al recuperar fallback de Firestore para ${anime.id}:`, error);
    }

    // 3. Fallback final si Firestore no tiene datos o la consulta falla
    this.src = IMAGEN_PREDETERMINADA;
  };

  return card;
}

export function mostrarSeccionDesdesearch() {
  let search = window.location.search;
  
  let id = search.split(/[?&]/)[1] || 'Ultimos-Episodios';
  id = decodeURIComponent(id);

  // Las antiguas secciones de listas ahora viven dentro de ?Lista&tab=...
  const listasLegacy = { 'Mis-Favoritos': 'favoritos', 'Viendo': 'viendo', 'Pendientes': 'pendiente', 'Completados': 'visto' };
  if (listasLegacy[id]) {
    history.replaceState(null, '', `?Lista&tab=${listasLegacy[id]}`);
    id = 'Lista';
  }

  const seccion = document.getElementById(id);
  if (!seccion) {
    id = 'Ultimos-Episodios';
    history.replaceState(null, '', '?Ultimos-Episodios');
  };

  // La sección inicial puede venir visible desde el HTML. Aun así debemos
  // completar su inicialización (cargas, menú e icono) al arrancar.
  // Animar SVGs antes de cambiar de sección.
  animarSVGCambio(id);

  document.querySelectorAll(".content-section").forEach(sec => {
    sec.classList.toggle("hidden", sec.id !== id);
  });

  window.scrollTo(0, 0);

  document.querySelectorAll('.menu-item').forEach(item =>
    item.classList.toggle('active-menu-item', item.getAttribute('data-target') === id)
  );

  actualizarIndicadorActivo();
  actualizarIndicadorNav();

if (id === 'Ultimos-Episodios') {
  if (!heroSliderCargado) {
    cargarHeroSlider();
    heroSliderCargado = true;
  }
  // Se re-genera en cada visita a Inicio: se pide un ranking al azar
  // directamente a la API y se baraja de nuevo.
  cargarPopularesPreview();
}

const sectionConfig = {
  'Lista': { flag: () => listaCargada, setFlag: () => { listaCargada = true; }, load: () => cargarFetch("Lista") },
  'Ultimos-Episodios': { flag: () => ultimosCapsCargados, setFlag: () => { ultimosCapsCargados = true; }, load: () => { cargarUltimosCapitulos(); cargarhistorial(); } },
  'DirectorioAV1': { flag: () => directorioAV1Cargado, setFlag: () => { directorioAV1Cargado = true; }, load: () => cargarFetch("DirectorioAV1") },
  'DirectorioJK': { flag: () => directorioJkCargado, setFlag: () => { directorioJkCargado = true; }, load: () => cargarFetch("DirectorioJK") },
  'Recomendaciones': { flag: () => labCargado, setFlag: () => { labCargado = true; }, load: () => cargarFetch("Recomendaciones") },
  'Preferencias': { flag: () => preferenciasCargadas, setFlag: () => { preferenciasCargadas = true; }, load: () => cargarFetch("Preferencias") },
  'Contacto': { flag: () => contactoCargado, setFlag: () => { contactoCargado = true; }, load: () => cargarFetch("Contacto") },
  'Populares': { flag: () => popularesCargados, setFlag: () => { popularesCargados = true; }, load: () => cargarFetch("Populares") },
  'Horarios': { flag: () => horariosCargados, setFlag: () => { horariosCargados = true; }, load: () => cargarFetch("Horarios") }
};

const config = sectionConfig[id];
if (config && !config.flag()) {
  config.load();
  config.setFlag();
}
  const currentSection = decodeURIComponent(window.location.search.split(/[?&]/)[1] || 'Ultimos-Episodios');
  if (typeof centrarElementoEnVista === 'function') {
    centrarElementoEnVista(currentSection);
  }
  cerrarSidebar();
  window.dispatchEvent(new Event('seccionchange'));
}

// header.js no puede importar este módulo (se carga también en anime/ver),
// así que pide el cambio de icono con un evento en window.
window.addEventListener('iconoseccion', (e) => {
  if (e.detail) animarSVGCambio(e.detail);
});

window.addEventListener("DOMContentLoaded", () => {
  mostrarSeccionDesdesearch();
});
window.addEventListener("searchchange", () => {
  mostrarSeccionDesdesearch();
});

function actualizarIndicadorActivo(targetItem = null) {
  const indicator = document.querySelector('.active-indicator');
  const activeItem = document.querySelector('.sidebar .menu-item.active-menu-item');
  const sidebarUl = document.querySelector('.sidebar ul');

  if (!indicator || !sidebarUl) return;

  // Si se proporciona un targetItem (hover), usar ese; si no, usar el activo
  const itemToUse = targetItem || activeItem;

  // Evalúa si no hay ítem activo o si no pertenece directamente a la lista principal
  const esDeListaPrincipal = itemToUse && itemToUse.parentElement === sidebarUl;

  // Solo aplicar el fallback si NO estamos en modo hover (targetItem es null)
  if (!itemToUse || !esDeListaPrincipal) {
    if (targetItem === null) {
      // Solo en modo no-hover: ocultar el indicador
      indicator.classList.remove('visible');
    }
    // En modo hover con elemento inválido: no hacer nada (dejar el indicador donde está)
    return;
  }

  // Si el ítem es válido
  const ulRect = sidebarUl.getBoundingClientRect();
  const itemRect = itemToUse.getBoundingClientRect();

  indicator.style.top = (itemRect.top - ulRect.top + 4) + 'px';
  indicator.style.height = (itemRect.height - 8) + 'px';
  indicator.style.left = '10px';
  indicator.classList.add('visible');
}

window.handlesearchChange = function () {
  let search = decodeURIComponent(window.location.search.split(/[?&]/)[1] || '');

  if (!search) {
    search = 'Ultimos-Episodios';
    history.replaceState(null, '', '?Ultimos-Episodios');
  }

  document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));

  const targetSection = document.getElementById(search);
  if (targetSection) {
    targetSection.classList.remove('hidden');

    const activeMenuItem = document.querySelector(`.menu-item[data-target="${search}"]`);
    if (activeMenuItem) {
      document.querySelectorAll('.menu-item').forEach(li => li.classList.remove('active'));
      activeMenuItem.classList.add('active');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    cargarUltimosCapsVistos(),
  ])
  const sidebarItems = document.querySelectorAll('.menu-item');
  let hoverTimeout = null;

  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      if (!targetId) return;
      history.replaceState(null, '', `?${targetId}`);
      mostrarSeccionDesdesearch();
      // Centrar el elemento en la navegación con un pequeño delay
      if (typeof centrarElementoEnVista === 'function') {
        centrarElementoEnVista(targetId);
      }
    });

    // Evento hover - actualizar indicador al elemento en hover
    item.addEventListener('mouseenter', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      actualizarIndicadorActivo(item);
    });

    // Evento leave - volver al elemento activo con pequeño retraso
    item.addEventListener('mouseleave', () => {
      hoverTimeout = setTimeout(() => {
        actualizarIndicadorActivo(null);
        hoverTimeout = null;
      }, 100);
    });
  });
});

function crearElementoSiguienteCapitulo(itemData) {
  const btn = document.createElement('a');
 // ✅ CORRECTO
  btn.dataset.title = `ver ${itemData.titulo} EP ${itemData.siguienteCapitulo}`;
  btn.className = 'btn-siguiente-episodio';
  btn.href = `/ver?id=${itemData.id}&episode=${itemData.siguienteCapitulo}`;
  
  const portada = document.createElement('img');
  portada.src = itemData.portada;
  portada.alt = itemData.titulo;
  portada.className = 'portada-anime';
  portada.onerror = () => {
    portada.src = '/icons/poster.png';
  };
  
  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-episodio';

  const spanTitulo = document.createElement('span'); 
  spanTitulo.classList.add('texto-2-lineas');
  spanTitulo.textContent = itemData.titulo;

  const spanEpisodio = document.createElement('span');
  spanEpisodio.className = 'texto-episodio';
  spanEpisodio.textContent = `Ver Ep ${itemData.siguienteCapitulo}` + ' / ' + (itemData.totalCapitulos || 'X');

  contenedorTexto.appendChild(spanTitulo);
  contenedorTexto.appendChild(spanEpisodio);
  
  btn.appendChild(portada);
  btn.appendChild(contenedorTexto);
  
  btn.addEventListener('click', () => {
    btn.getElementsByClassName("texto-2-lineas")[0].style.setProperty('view-transition-name', 'title-' + itemData.id);
    btn.getElementsByClassName("portada-anime")[0].style.setProperty('view-transition-name', itemData.id + '-' + itemData.siguienteCapitulo);
    btn.getElementsByClassName("texto-episodio")[0].style.setProperty('view-transition-name', 'episodio-' + itemData.id);
  });

  return btn;
}

// Tarjeta de "Continuar viendo": creación y actualización en sitio
function crearTarjetaContinuarViendo(data) {
  const total = data.totalCapitulos || 12;
  const capsVistos = Math.max((data.siguienteCapitulo || 1) - 1, 1);

  const card = document.createElement('a');
  card.className = 'continue-card anime-card';
  card.href = `/ver?id=${data.id}&episode=${data.siguienteCapitulo}`;
  card.dataset.id = data.id;
  card.dataset.episode = data.siguienteCapitulo;

  card.innerHTML = `
    <div class="card-thumbnail container-img">
      <img src="${data.portada}" alt="${data.titulo}" onerror="this.src='/icons/poster.png'">
      <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
      <span class="chapter ep-badge">EP ${data.siguienteCapitulo}</span>
    </div>
    <div class="card-info">
      <div class="progress-track"><div class="progress-fill" style="width: ${Math.min((capsVistos/total)*100, 100)}%">
      <div class="progress-fill-background"></div>
      </div>
      </div>
      <strong>${data.titulo}</strong>
      <span class="card-meta">${capsVistos}/${total} eps</span>
    </div>`;

  return card;
}

// Actualiza una tarjeta existente sin recrearla (evita parpadeos)
function actualizarTarjetaContinuarViendo(card, data) {
  const total = data.totalCapitulos || 12;
  const capsVistos = Math.max((data.siguienteCapitulo || 1) - 1, 1);

  card.href = `/ver?id=${data.id}&episode=${data.siguienteCapitulo}`;
  card.dataset.episode = data.siguienteCapitulo;

  const img = card.querySelector('.container-img img');
  if (img && img.getAttribute('src') !== data.portada) {
    img.src = data.portada;
    img.alt = data.titulo;
  }

  const badge = card.querySelector('.ep-badge');
  if (badge) badge.textContent = `EP ${data.siguienteCapitulo}`;

  const fill = card.querySelector('.progress-fill');
  if (fill) fill.style.width = `${Math.min((capsVistos / total) * 100, 100)}%`;

  const titulo = card.querySelector('.card-info strong');
  if (titulo) titulo.textContent = data.titulo;

  const meta = card.querySelector('.card-meta');
  if (meta) meta.textContent = `${capsVistos}/${total} eps`;
}

async function cargarUltimosCapsVistos() {
  const sectionsidebar  = document.getElementById('continuar-viendo-sidebar')
  const ultimosCapsContainer = document.getElementById('ultimos-caps-viendo');
  if (!ultimosCapsContainer) return;

  if (!userID || userID === "null") {
    sectionsidebar.style.display = 'none';
    inicializarContinuarViendo();
    return;
  }

  const MAX_VALIDOS = 10;
  const BATCH_SIZE = 20;

  const renderizarBotones = (datos) => {
    ultimosCapsContainer.innerHTML = '';
    if (!datos || datos.length === 0) {
      sectionsidebar.style.display = 'none';
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(itemData => {
      const btn = crearElementoSiguienteCapitulo(itemData);
      if (btn) fragment.appendChild(btn);
    });
    ultimosCapsContainer.appendChild(fragment);
  };

  const cacheKey = `ultimosCapsVistosCache_` + userID;
  const cacheStateKey = `estadoHistorialCache_` + userID; 
  
  let cachedData = [];
  let cachedState = [];

  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    const cachedStateString = localStorage.getItem(cacheStateKey);
    if (cachedDataString) cachedData = JSON.parse(cachedDataString);
    if (cachedStateString) cachedState = JSON.parse(cachedStateString);
  } catch (e) { 
    localStorage.removeItem(cacheKey); 
    localStorage.removeItem(cacheStateKey);
  }

  // 1. Render instantáneo
  if (Array.isArray(cachedData)) {
    renderizarBotones(cachedData);
    inicializarContinuarViendo();
  }

  try {
    const ref = collection(db, "usuarios", userID, "caps-vistos");
    let allDocs = [];
    let lastDoc = null;
    let hasMore = true;

    // Fetch iterativo hasta tener suficientes candidatos
    while (hasMore && allDocs.length < BATCH_SIZE * 2) {
      let q = query(ref, where('esFinalizadoPorVistos', '==', false), limit(BATCH_SIZE));
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);

      if (snap.empty) {
        hasMore = false;
        break;
      }

      allDocs = [...allDocs, ...snap.docs];
      lastDoc = snap.docs[snap.docs.length - 1];

      if (allDocs.length >= BATCH_SIZE * 2) {
        hasMore = false;
      }
    }

    // Si el usuario no tiene historial en Firebase
    if (allDocs.length === 0) {
      sectionsidebar.style.display = 'none';
      localStorage.setItem(cacheKey, JSON.stringify([]));
      localStorage.setItem(cacheStateKey, JSON.stringify([]));
      inicializarContinuarViendo();
      return;
    }

    const currentState = [];
    allDocs.forEach(docSnap => {
      const data = docSnap.data();
      const vistos = (data.episodiosVistos || []).map(Number);
      if (vistos.length > 0) {
        let fechaMilisegundos = 0;
        if (data.fechaAgregado && typeof data.fechaAgregado.toMillis === 'function') {
           fechaMilisegundos = data.fechaAgregado.toMillis();
        } else if (data.fechaAgregado) {
           fechaMilisegundos = new Date(data.fechaAgregado).getTime();
        }

        const item = {
          id: docSnap.id,
          ultimoVisto: Math.max(...vistos),
          fechaAgregado: fechaMilisegundos
        };
        currentState.push(item);
      }
    });
    
    // Ordenar por fechaAgregado descendente en el cliente
    currentState.sort((a, b) => {
      const fechaA = a.fechaAgregado ? a.fechaAgregado.toDate?.() || a.fechaAgregado : 0;
      const fechaB = b.fechaAgregado ? b.fechaAgregado.toDate?.() || b.fechaAgregado : 0;
      return fechaB - fechaA;
    });

    // Validamos si TODO está exactamente igual (ahorra ejecución)
    if (cachedState && cachedData.length > 0 && JSON.stringify(currentState) === JSON.stringify(cachedState)) {
      return;
    }

    // --- 2. OPTIMIZACIÓN: Solo pedir a Firebase los animes que cambiaron ---
    const promesasFetch = [];
    const indicesFetch = [];
    const freshData = new Array(currentState.length).fill(null);

    currentState.forEach((cap, index) => {
      const estadoAnterior = cachedState.find(c => c.id === cap.id && c.ultimoVisto === cap.ultimoVisto);

      if (estadoAnterior && Array.isArray(cachedData)) {
        const datosCacheados = cachedData.find(d => d.id === cap.id);
        if (datosCacheados) {
          freshData[index] = datosCacheados;
          return;
        }
      }

      indicesFetch.push(index);
      // OPTIMIZACIÓN: Usar obtenerDatosAnimeFirestore con TTL en lugar de getDoc directo
      promesasFetch.push(obtenerDatosAnimeFirestore(cap.id));
    });
    
    // 3. Ejecutamos las llamadas a Firebase SOLAMENTE para los que faltan
    if (promesasFetch.length > 0) {
      const animeDocsData = await Promise.all(promesasFetch);

      animeDocsData.forEach((animeDetails, i) => {
        if (animeDetails) {
          const originalIndex = indicesFetch[i];
          const cap = currentState[originalIndex];

          const episodios = Array.isArray(animeDetails.episodios) ? animeDetails.episodios : Object.values(animeDetails.episodios || {});
          // El siguiente capítulo es el vecino en la lista, no ultimoVisto + 1:
          // hay series con especiales o huecos en la numeración.
          const posUltimoVisto = episodios.findIndex(ep => Number(ep.number) === cap.ultimoVisto);
          const siguienteEpisodio = posUltimoVisto === -1
            ? episodios.find(ep => Number(ep.number) > cap.ultimoVisto)
            : episodios[posUltimoVisto + 1];
          const siguienteCapitulo = siguienteEpisodio ? Number(siguienteEpisodio.number) : cap.ultimoVisto + 1;

          if (siguienteEpisodio) {
            freshData[originalIndex] = {
              id: cap.id,
              portada: animeDetails.portada,
              titulo: animeDetails.titulo,
              siguienteCapitulo: siguienteCapitulo,
              totalCapitulos: episodios.length
            };
          }
        }
      });
    }

    // 4. Limpiamos cualquier anime nulo (por si ya no hay más capítulos para ver de ese anime)
    const datosFinales = freshData.filter(Boolean);

    // 5. Limitar a MAX_VALIDOS y mantener solo el estado correspondiente
    const datosFinalesLimitados = datosFinales.slice(0, MAX_VALIDOS);
    const idsFinales = new Set(datosFinalesLimitados.map(d => d.id));
    const currentStateLimitado = currentState.filter(c => idsFinales.has(c.id));

    // 6. Render final y actualización de cachés
    renderizarBotones(datosFinalesLimitados);
    localStorage.setItem(cacheKey, JSON.stringify(datosFinalesLimitados));
    localStorage.setItem(cacheStateKey, JSON.stringify(currentStateLimitado));

    inicializarContinuarViendo();
  } catch (error) {
    console.error('❌ [cargarUltimosCapsVistos] Error crítico:', error);
    console.error('❌ [cargarUltimosCapsVistos] Stack trace:', error.stack);
    // Feedback opcional para el usuario en caso de que se caiga el internet o la BD
    ultimosCapsContainer.innerHTML = '<p>Error al sincronizar tu historial de continuar viendo.</p>';
  }
}

// ----------------------------------------------------
// UTILS DE FLIP OPTIMIZADO
// ----------------------------------------------------
function renderFlipOptimizado(container, renderCallback) {
  if (document.body.classList.contains('animaciones-off')) {
    renderCallback();
    return;
  }

  // 1. FIRST: Capturamos posiciones actuales
  const posicionesAnteriores = new Map();
  Array.from(container.children).forEach(el => {
    if (el.dataset.id) {
      posicionesAnteriores.set(el.dataset.id, el.getBoundingClientRect());
    }
  });

  // 2. DOM UPDATE: Ejecutamos los cambios en el DOM
  renderCallback();

  // 3. INVERT & PLAY: Animamos el estado final desde el inicial
  Array.from(container.children).forEach(el => {
    if (!el.dataset.id) {
      return;
    }

    const posAnterior = posicionesAnteriores.get(el.dataset.id);

    if (posAnterior) {
      // Elemento existente, calculamos desplazamiento
      const posActual = el.getBoundingClientRect();
      const deltaX = posAnterior.left - posActual.left;
      const deltaY = posAnterior.top - posActual.top;

      if (deltaX !== 0 || deltaY !== 0) {
        el.animate([
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' }
        ], { duration: 300, easing: 'ease-out' });
      }
    } else {
      // Elemento nuevo (Fade In + Slide Up)
      el.animate([
        { opacity: 0, transform: 'translateY(15px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 300, easing: 'ease-out' });
    }
  });
}

// ----------------------------------------------------
// Modificación: Agregamos div.dataset.id
// ----------------------------------------------------

function leerCache(key) {
    try {
      const raw = localStorage.getItem(key);
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Error leyendo cache (${key}):`, e);
      localStorage.removeItem(key);
    }
    return null;
}

function verificarYLimpiarCacheBackground(cacheKey, datos, campoPortada = 'portada', onLimpiar = null, recargarPagina = false) {
  if (!datos || !Array.isArray(datos)) {
    return false;
  }

  const itemsConBackground = datos.filter(item =>
    item[campoPortada] === 'img/background.webp' ||
    item[campoPortada] === 'background.webp' ||
    item.estado === 'No disponible' ||
    item.estado === 'no disponible'
  );

  if (itemsConBackground.length > 0) {
    if (onLimpiar) {
      onLimpiar(itemsConBackground);
    } else {
      localStorage.removeItem(cacheKey);
    }

    if (recargarPagina) {
      location.reload();
    }
    
    return true;
  }
  return false;
}

function guardarCache(key, data) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error guardando cache (${key}):`, e);
    localStorage.removeItem(key);
  }
}

async function obtenerHistorialParaIA() {
  const claves = Object.keys(localStorage);
  const clavesAnime = claves.filter(clave => clave.startsWith('anime_'));
  const animesRecientes = [];

  for (const clave of clavesAnime) {
    try {
      const datos = JSON.parse(localStorage.getItem(clave));
      if (datos && datos._cachedAt && datos.titulo) {
        animesRecientes.push(datos.titulo);
      }
    } catch (e) {
      console.error('Error al procesar datos del localStorage:', e);
    }
  }

  return animesRecientes.slice(0, 5);
}

function tituloToKebabCase(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function generarSlideHTML(a, i, usarBannerDinamico = false) {
  const isPE = a.type === 'Por estrenar';
  const syn = (a.synopsis || '').replace(/<[^>]*>/g, '').trim();
  const statusBadge = a.type ? (a.type === 'TV Anime' ? `<span class="hero-badge hero-badge--ongoing">TV Anime</span>` : a.type === 'Personalizado' ? `<span class="hero-badge hero-badge--personalizado">Personalizado</span>` : `<span class="hero-badge hero-badge--status">${a.type}</span>`) : '';
  
  const customBadgesList = a.badges || a.bages || [];
  const customBadgesHtml = customBadgesList.length 
    ? `<div class="hero-slide__extra-badges">${customBadgesList.map(b => `<span class="hero-badge hero-badge--custom">${b}</span>`).join('')}</div>` 
    : '';

  const bannerUrl = usarBannerDinamico 
    ? `https://cdn.jkdesa.com/assets/images/animes/image/${tituloToKebabCase(a.title)}.jpg`
    : (a.banner || '');

  return `
    <article class="hero-slide ${i === 0 ? 'active' : ''}" data-id="${a.id}" style="--bg-image: url('${bannerUrl}')">
      <div class="hero-background"><div class="hero-slide__bg" style="background-image: url('${bannerUrl}')"></div></div>
      <div class="hero-slide__content">
        ${statusBadge ? `<div class="hero-slide__badges">${statusBadge}</div>` : ''}
        <h2 class="hero-slide__title">${a.title || 'Sin título'}</h2>
        ${syn ? `<p class="hero-slide__synopsis">${syn}</p>` : ''}
        ${customBadgesHtml}
        <div class="hero-slide__actions ${isPE ? 'left-align' : ''}">
          <a href="/ver?id=${a.id}&episode=1" class="hero-btn hero-btn--primary ${isPE ? 'hidden' : ''}">
            <span class="hero-btn__icon" aria-hidden="true"><svg viewBox="-3 0 28 28" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --> <title>play</title> <desc>Created with Sketch Beta.</desc> <defs> </defs> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage"> <g id="Icon-Set-Filled" sketch:type="MSLayerGroup" transform="translate(-419.000000, -571.000000)" fill="#000000"> <path d="M440.415,583.554 L421.418,571.311 C420.291,570.704 419,570.767 419,572.946 L419,597.054 C419,599.046 420.385,599.36 421.418,598.689 L440.415,586.446 C441.197,585.647 441.197,584.353 440.415,583.554" id="play" sketch:type="MSShapeGroup"> </path> </g> </g> </g></svg></span> Ver Ahora
          </a>
          <a href="/anime?id=${a.id}" class="hero-btn hero-btn--secondary">
            <span class="hero-btn__label">Más información</span>
            <span class="hero-btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M6 12H18M18 12L13 7M18 12L13 17" stroke="Currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg></span>
          </a>
        </div>
      </div>
    </article>`;
}

const SLIDES_PERSONALIZADOS_CACHE_KEY = 'slidesPersonalizadosCache';
const SLIDES_PERSONALIZADOS_TTL = 60 * 60 * 1000; // 1 hora

// Ping ligero al backend de IA para "despertar" el servicio (cold start en Render)
// sin consumir una llamada real a la API.
function wakeUpIAApi() {
  fetch('https://backend-ia-anime.onrender.com/', { method: 'GET', mode: 'no-cors', keepalive: true })
    .catch(() => {});
}

async function generarSlidesPersonalizados() {
  try {
    const cached = JSON.parse(localStorage.getItem(SLIDES_PERSONALIZADOS_CACHE_KEY));
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < SLIDES_PERSONALIZADOS_TTL && Array.isArray(cached.slides)) {
      return cached.slides;
    }
  } catch (e) {
    localStorage.removeItem(SLIDES_PERSONALIZADOS_CACHE_KEY);
  }

  const historial = await obtenerHistorialParaIA();
  
  if (historial.length === 0) return [];

  try {
    const prompt = buildFavoritesAnimePrompt(historial, [], 'Recomienda 2 animes similares según tu historial');
    const respuesta = await fetchIAResponse(prompt);
    const nombres = parseAnimeNamesFromResponse(respuesta).slice(0, 2);

    if (!nombres.length) return [];

    const resultados = await Promise.all(
      nombres.map(nombre => resolveAnimeByName(nombre))
    );

    const slidesPersonalizados = [];
    for (const anime of resultados) {
      if (!anime) continue;

      const syn = (anime.synopsis || '').replace(/<[^>]*>/g, '').trim();

      slidesPersonalizados.push({
        id: anime.id,
        title: anime.title,
        synopsis: syn,
        type: 'Personalizado',
        badges: ['Recomendado para ti', 'Según tu historial']
      });
    }

    if (slidesPersonalizados.length) {
      localStorage.setItem(SLIDES_PERSONALIZADOS_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        slides: slidesPersonalizados
      }));
    }

    return slidesPersonalizados;
  } catch (error) {
    console.error('[Hero Slider] Error al generar slides personalizados:', error);
    return [];
  }
}

async function cargarHeroSlider() {
  const container = document.getElementById('hero-slider');
  if (!container) return;

  // Despierta el backend de IA mientras cargan los banners,
  // para que esté listo si hay que generar slides personalizados.
  wakeUpIAApi();

  try {
    const res = await fetch('/banners-slides.json');
    const animes = res.ok ? await res.json() : null;
    if (!animes || !animes.length) throw new Error("JSON vacío o no encontrado");

    // Mezcla aleatoria (Algoritmo Fisher-Yates)
    for (let i = animes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [animes[i], animes[j]] = [animes[j], animes[i]];
    }

    // 1. Generación de slides en lote
    const slidesHTML = animes.map((a, i) => generarSlideHTML(a, i)).join('');

    // 2. Inyección única en el DOM
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="hero-slider__track">${slidesHTML}</div>
      <button class="hero-slider__prev" aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>
      <button class="hero-slider__next" aria-label="Siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>
    `;

    const sliderControls = initHeroSliderControls(container, animes.length);

    // 3. Cargar slides personalizados en segundo plano
    generarSlidesPersonalizados().then(slidesPersonalizados => {
      if (!slidesPersonalizados.length) return;

      const track = container.querySelector('.hero-slider__track');
      if (!track) return;

      // Los recomendados se añaden inactivos. Si se crean con índice 0, cada
      // uno recibe la clase `active` y quedan varias capas animándose a la vez.
      const slidesPersonalizadosHTML = slidesPersonalizados
        .map(a => generarSlideHTML(a, -1, true))
        .join('');

      // Insertar después del slide activo actual
      const activeSlide = track.querySelector('.hero-slide.active');
      if (activeSlide) {
        activeSlide.insertAdjacentHTML('afterend', slidesPersonalizadosHTML);
      } else {
        track.insertAdjacentHTML('afterbegin', slidesPersonalizadosHTML);
      }

      if (sliderControls && sliderControls.updateLength) {
        sliderControls.updateLength();
      }
    }).catch(error => {
      console.error('[Hero Slider] Error al cargar slides personalizados:', error);
    });
  } catch (error) {
    console.error("[Hero Slider] Error detectado:", error);
    container.innerHTML = '<p class="span-carga">Error al cargar banners. Revisa la consola (F12).</p>';
  }
}

function initHeroSliderControls(container, len) {
  const track = container.querySelector('.hero-slider__track');
  if (!track) return;

  let curr = 0, autoId, startX = 0;
  const leavingTimers = new WeakMap();

  const getSlides = () => Array.from(track.querySelectorAll('.hero-slide'));
  const getCurrentIndex = (slides) => {
    const activeIndex = slides.findIndex(slide => slide.classList.contains('active'));
    return activeIndex === -1 ? Math.min(curr, Math.max(slides.length - 1, 0)) : activeIndex;
  };

  const clearLeavingState = (slide) => {
    const timer = leavingTimers.get(slide);
    if (timer) clearTimeout(timer);
    slide.classList.remove('leaving');
  };

  const markAsLeaving = (slide) => {
    clearLeavingState(slide);
    slide.classList.remove('active');
    slide.classList.add('leaving');
    leavingTimers.set(slide, setTimeout(() => slide.classList.remove('leaving'), 500));
  };

  const goTo = (i) => {
    const slides = getSlides();
    if (slides.length < 2) return;

    curr = getCurrentIndex(slides);
    const next = ((i % slides.length) + slides.length) % slides.length;
    if (curr === next) return;

    markAsLeaving(slides[curr]);
    curr = next;
    clearLeavingState(slides[curr]);
    slides[curr].classList.add('active');
  };

  const play = () => autoId = autoId || setInterval(() => goTo(curr + 1), 5500);
  const stop = () => autoId = clearInterval(autoId);
  const reset = () => { stop(); play(); };

  // Delegación de eventos centralizada
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) {
      goTo(curr + (btn.classList.contains('hero-slider__next') ? 1 : -1));
      return reset();
    }
    
    const link = e.target.closest('a');
    if (link) {
      const slide = link.closest('.hero-slide');
      if (slide) {
        const id = slide.dataset.id;
        slide.querySelector('.hero-slide__title')?.style.setProperty('view-transition-name', `title-${id}`);
        slide.querySelector('.hero-slide__bg')?.style.setProperty('view-transition-name', link.classList.contains('hero-btn--primary') ? `${id}-1` : `cover-${id}`);
      }
    }
  });

  // Control de hover y touch
  container.addEventListener('mouseenter', stop);
  container.addEventListener('mouseleave', play);

  track.addEventListener('touchstart', e => { 
    startX = e.touches[0].clientX; 
    stop(); 
  }, { passive: true });
  
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) goTo(curr + (dx < 0 ? 1 : -1));
    reset();
  }, { passive: true });

  play();

  return {
    updateLength: () => {
      const slides = getSlides();
      curr = getCurrentIndex(slides);
    },
    goTo: (i) => goTo(i)
  };
}

async function cargarUltimosCapitulos() {
    const container = document.getElementById('ultimos-episodios');
    const cacheKey = 'ultimosEpisodiosGeneralesCache';
    const docId = 'ultimosCapitulos'; 
  
    // ----------------------------------------------------
    // Modificación: Integrado renderFlipOptimizado
    // ----------------------------------------------------
    const render = (datos) => {
      document.querySelectorAll('.init-loading-servidores').forEach(el => el.style.display = 'none');
      
      renderFlipOptimizado(container, () => {
        container.innerHTML = '';

        if (!datos?.length) {
          container.innerHTML = '<p>No se encontraron últimos episodios.</p>';
          return;
        }

        const fragment = document.createDocumentFragment();
        const cards = [];
        datos.forEach(anime => {
          const card = crearAnimeCard({
            id: anime.id,
            portada: anime.image || anime.cover || anime['cover-lasted'] || '',
            titulo: anime.title || 'Sin título',
            episodio: anime.chapter?.toString() || anime.episode?.toString() || ''
          });
          if (card) {
            fragment.appendChild(card);
            cards.push(card);
          }
        });
        container.appendChild(fragment);

        observerAnimeCards(cards);
      });
    };
  
    let cached = leerCache(cacheKey);
    if (cached) {
      if (verificarYLimpiarCacheBackground(cacheKey, cached, 'cover', null, true)) {
        cached = null;
      } else {
        render(cached);
      }
    }
  
    const normalizar = obj => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(normalizar);
        
        return Object.keys(obj).sort().reduce((res, key) => ({
          ...res,
          [key]: normalizar(obj[key])
        }), {});
      };
    
    // undefined = todavía no se leyó; null = el documento no existe.
    let datosFirestorePrevios = undefined;
    try {
      const docRef = doc(db, 'ultimos-capitulos', docId);
      const docSnap = await getDoc(docRef);
      datosFirestorePrevios = docSnap.exists() ? docSnap.data() : null;
      if (datosFirestorePrevios) {
        const firestoreData = datosFirestorePrevios.items || [];
  
        if (JSON.stringify(normalizar(cached)) !== JSON.stringify(normalizar(firestoreData))) {
          render(firestoreData);
          guardarCache(cacheKey, firestoreData);
          cached = firestoreData;
        }
      }
    } catch (err) {
      console.error('Error al obtener datos de Firestore:', err);
    }
  
    try {
      const res = await fetch('https://backend-animeflv-lite.onrender.com/api/latest');
      const apiData = await res.json();
  
      if (!Array.isArray(apiData)) {
        throw new Error('Formato de respuesta inválido');
      }
  
      // OPTIMIZACIÓN: Solo escribir en Firestore si los datos cambiaron
      const datosCambiaron = JSON.stringify(normalizar(apiData)) !== JSON.stringify(normalizar(cached));
      
      if (datosCambiaron) {
        if(apiData.length > 0) {
          render(apiData);
          guardarCache(cacheKey, apiData);
          cached = apiData;
          
          // Solo escribir si Firestore también tiene datos diferentes.
          // Se reutiliza la lectura anterior cuando existe para no pagar
          // una segunda lectura del mismo documento.
          try {
            const docRef = doc(db, 'ultimos-capitulos', docId);
            let firestoreData = null;
            let firestoreExiste = false;
            if (datosFirestorePrevios !== undefined) {
              firestoreExiste = datosFirestorePrevios !== null;
              firestoreData = datosFirestorePrevios?.items || [];
            } else {
              const docSnap = await getDoc(docRef);
              firestoreExiste = docSnap.exists();
              firestoreData = firestoreExiste ? docSnap.data().items || [] : [];
            }

            if (!firestoreExiste || JSON.stringify(normalizar(apiData)) !== JSON.stringify(normalizar(firestoreData))) {
              await setDoc(docRef, {
                items: apiData,
                lastUpdated: new Date().toISOString()
              }, { merge: true });
            }
          } catch (firestoreError) {
            console.error('Error al actualizar Firestore:', firestoreError);
          }
        }
      }
    } catch (err) {
      console.error('Error al obtener datos de la API:', err);
    }
}

async function cargarhistorial() {

  const historialContainer = document.getElementById('historial');
  const historialheader = document.getElementById('header-section-historial');
  const sectionHistorial = document.getElementById('section-historial');

  if (!historialContainer) return;

  const claves = Object.keys(localStorage);
  const animesRecientes = [];
  const clavesAnime = claves.filter(clave => clave.startsWith('anime_'));

  for (const clave of clavesAnime) {

    try {

      const datos = JSON.parse(localStorage.getItem(clave));

      if (datos && datos._cachedAt) {

        // Si el anime no tiene portada, eliminarlo del localStorage
        if (!datos.portada || datos.portada.trim() === '') {
          localStorage.removeItem(clave);
          continue;
        }

        animesRecientes.push({
          id: clave.replace('anime_', ''),
          titulo: datos.titulo || 'Sin título',
          estado: datos.estado || 'Sin estado',
          type: datos.category || '',
          score: datos.score || '',
          portada: datos.portada,
          _cachedAt: datos._cachedAt
        });
      }

    } catch (e) {

      console.error('Error al procesar datos del localStorage:', e);

      // Si el dato está corrupto, también se puede eliminar
      localStorage.removeItem(clave);
    }
  }

  animesRecientes.sort((a, b) => b._cachedAt - a._cachedAt);

  const animesAMostrar = animesRecientes.slice(0, 11);

  // Solo renderiza si hay MÁS de 3 elementos (> 3)
  if (animesAMostrar.length > 4) {

    if (historialheader) historialheader.classList.remove('hidden');
    historialContainer.classList.remove('hidden');

    renderFlipOptimizado(historialContainer, () => {

      historialContainer.innerHTML = '';

      const fragment = document.createDocumentFragment();
      const cards = [];

      animesAMostrar.forEach(anime => {

        const card = crearAnimeCard(anime);

        if (card) {
          fragment.appendChild(card);
          cards.push(card);
        }

      });

      historialContainer.appendChild(fragment);
    });

    if (sectionHistorial) sectionHistorial.classList.remove('hidden');
    observerAnimeCards(historialContainer.querySelectorAll('.anime-card:not(.show)'));

  } else {

    // Oculta las secciones si hay 3 o menos elementos
    if (historialheader) historialheader.classList.add('hidden');
    historialContainer.classList.add('hidden');
    if (sectionHistorial) sectionHistorial.classList.add('hidden');

  }

  actualizarLayout();
}

function guardarCache2(key, data) {
  try {
    if (!data || !data.length) {
      localStorage.removeItem(key);
      return;
    }
    const dataToCache = data.slice(0, 10);
    localStorage.setItem(key, JSON.stringify(dataToCache));
  } catch (e) {
    console.error('Error al guardar en caché:', e);
  }
}

function agregarAnimesAlContenedor(animes, contenedor) {
  // ----------------------------------------------------
  // Modificación: Integrado renderFlipOptimizado aquí también
  // ----------------------------------------------------
  renderFlipOptimizado(contenedor, () => {
    const fragment = document.createDocumentFragment();
    const cards = [];
    animes.forEach(anime => {
        const card = crearTarjetaDeLista(anime);
        if (card) {
          fragment.appendChild(card);
          cards.push(card);
        }
    });
    contenedor.appendChild(fragment);
    observerAnimeCards(cards);
  });
}

function manejarBotonVerMas(container, DocRef, hayMas, limite, offset, numAnimes, idsCargados = null, orden = 'recientes') {
  const btnAnterior = container.querySelector('.ver-mas-btn');
  if (btnAnterior) {
    container.removeChild(btnAnterior);
  }

  if (hayMas) {
    const verMasBtn = document.createElement('button');
    verMasBtn.className = 'ver-mas-btn';
    verMasBtn.textContent = 'Ver más';
    verMasBtn.onclick = () => cargarDatos(
      container,
      DocRef,
      // Los IDs ya están en memoria: mostrar todos los restantes en un solo clic.
      idsCargados ? idsCargados.length : limite,
      offset + numAnimes,
      idsCargados,
      orden
    );
    container.appendChild(verMasBtn);
  }
}

const ORDENES_LISTA_VALIDOS = new Set(['recientes', 'nombre-az', 'nombre-za']);

export async function cargarDatos(container, DocRef, limite = 10, offset = 0, idsCargados = null, orden = 'recientes') {
  if (!userID || userID === "null") {
    container.innerHTML = '<p class="span-carga">Inicia sesión para ver tu lista</p>';
    const h2 = document.querySelector('#' + container.id + 'h2');
    h2.dataset.text = 0;
    return;
  }
  
  // Prevenir cargas simultáneas del mismo contenedor
  const cargaKey = `${container.id}_${offset}`;
  if (cargando.has(cargaKey)) {
    return;
  }
  cargando.add(cargaKey);
  
  const btnAnterior = container.querySelector('.ver-mas-btn');
  if (btnAnterior) {
    btnAnterior.textContent = "cargando...";
    btnAnterior.disabled = true;
  }
  
  const h2 = document.querySelector('#' + container.id + 'h2');

  const cacheKey = `${container.id}Cache_${userID}`;
  const cachedData = leerCache(cacheKey);

  if (cachedData && offset === 0) {
    if (verificarYLimpiarCacheBackground(cacheKey, cachedData, 'portada', null, true)) {
    } else {
      // Reemplazamos el indicador inicial de carga; no lo dejamos mezclado
      // con las tarjetas de la caché.
      container.innerHTML = '';
      const fragment = document.createDocumentFragment();
      const cards = [];
      cachedData.forEach(anime => {
        const card = crearTarjetaDeLista(anime);
        if (card) {
          fragment.appendChild(card);
          cards.push(card);
        }
      });
      container.appendChild(fragment);
      observerAnimeCards(cards);
    }
  }

  try {
      let titulos = idsCargados || idsDeListasCargados.get(container.id);
      if (!titulos) {
        const Doc = await conTiempoMaximo(
          getDoc(DocRef),
          TIEMPO_MAXIMO_LECTURA_LISTA_MS,
          'La lista tardó demasiado en responder.'
        );
        titulos = Doc.exists()
          ? [...(Doc.data().animes || [])].filter(titulo => titulo != null).reverse()
          : [];
        idsDeListasCargados.set(container.id, titulos);
      }

      // El orden de la lista en Firestore es el de agregado (más reciente primero
      // tras el reverse). Los órdenes alternativos solo reordenan ese mismo array
      // en memoria: no generan lecturas adicionales.
      if (ORDENES_LISTA_VALIDOS.has(orden) && orden !== 'recientes') {
        const factor = orden === 'nombre-za' ? -1 : 1;
        titulos = [...titulos].sort((a, b) =>
          factor * generarTituloDesdeId(a).localeCompare(generarTituloDesdeId(b), 'es', { sensitivity: 'base', numeric: true })
        );
      }
      h2.dataset.text = titulos.length;
      h2.classList.add('cargado');

      if (titulos.length === 0) {
          container.innerHTML = '<p class="span-carga">No tienes animes en ' + container.id + '</p>';
          localStorage.removeItem(cacheKey);
          return;
      }

      // La lista se valida con una sola lectura, pero si sus primeras tarjetas
      // no cambiaron conservamos el DOM y la caché: no se vuelve a renderizar.
      if (offset === 0 && cachedData) {
        const idsActuales = titulos.slice(0, limite).toString();
        const idsEnCache = cachedData.map(anime => anime.id).slice(0, limite).toString();
        if (idsActuales === idsEnCache) {
          manejarBotonVerMas(
            container,
            DocRef,
            limite < titulos.length,
            limite,
            0,
            cachedData.length,
            titulos,
            orden
          );
          return;
        }
      }

      const animes = titulos
        .slice(offset, offset + limite)
        .map(crearResumenAnimeDesdeId);
      
// Actualizar caché si es primera página
      if (offset === 0) {
        const animesOrdenados = animes;
        guardarCache2(cacheKey, animesOrdenados);
        
        // 1. Creamos la función que reemplaza el contenido del contenedor
        const renderizarContenido = () => {
          container.innerHTML = '';
          const fragment = document.createDocumentFragment();
          const cards = [];
          animesOrdenados.forEach(anime => {
              const card = crearTarjetaDeLista(anime);
              if (card) {
                fragment.appendChild(card);
                cards.push(card);
              }
          });
          container.appendChild(fragment);
          observerAnimeCards(cards);
        };

        // 2. Verificamos si las animaciones están apagadas
        if (document.body.classList.contains('animaciones-off')) {
          renderizarContenido(); // Renderizado normal, sin animación (instantáneo)
        } else {
          // Renderizado con animación FLIP
          renderFlipOptimizado(container, renderizarContenido);
        }

        manejarBotonVerMas(container, DocRef, offset + limite < titulos.length, limite, offset, animesOrdenados.length, titulos, orden); 
        return;
      }
      
      agregarAnimesAlContenedor(animes, container);
      manejarBotonVerMas(container, DocRef, offset + limite < titulos.length, limite, offset, animes.length, titulos, orden);

  } catch (error) {
      console.error('Error al cargar favoritos:', error);
      // Si hay cache, no mostrar error offline
      if (!cachedData || cachedData.length === 0) {
      container.innerHTML = '<p class="span-carga">Error al cargar, no hay conexión</p>';
      }
  } finally {
    cargando.delete(cargaKey);
  }
}

function cargarFetch(direccion) {
  
  const main = document.getElementById(direccion);
  if (!main) return;

  const direccionMinus = direccion.toLowerCase();

  const cssHref = `/styles/style_${direccionMinus}.css`;

  // 1. Cargar el CSS primero y evitar duplicados en el <head>
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = cssHref;
    document.head.appendChild(css);
  }

  // 2. Realizar el fetch del HTML usando directamente la dirección
  fetch(direccionMinus + '.html')
    .then(res => res.text())
    .then(html => {
      const temp = document.createElement('div');
      temp.innerHTML = html;

      const nuevoMain = temp.querySelector('main');
      if (nuevoMain) {
        main.innerHTML = nuevoMain.innerHTML;
      }

      // 3. Cargar el script correspondiente evitando duplicados
      const scriptId = `script-${direccionMinus}`;
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `/scripts/${direccionMinus}.js`;
        script.type = 'module';
        document.body.appendChild(script);
      }
    })
    .catch(err => console.error('Error al cargar el recurso:', err));
}

// Preview de Populares en Inicio: pide directamente a la API de MAL un
// ranking al azar (tipo y página) y muestra una selección barajada.
// No usa caché: la API siempre está disponible. Si falla, la sección
// queda oculta.
const POPULARES_PREVIEW_CANTIDAD = 7;
const POPULARES_PREVIEW_MAX_PAGINA = 10;
let popularesPreviewCargando = false;

function barajarArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deduplicarAnimes(animes) {
  const vistos = new Set();
  return animes.filter(anime => {
    const id = anime?.id || anime?.title;
    if (!id || vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
}

export async function cargarPopularesPreview() {
  const section = document.getElementById('section-populares-preview');
  const container = document.getElementById('populares-preview');
  if (!section || !container || popularesPreviewCargando) return;

  popularesPreviewCargando = true;
  try {
    // Un ranking y una página al azar por visita: el subtítulo muestra cuál salió.
    const rankingType = MAL_RANKING_TYPES[Math.floor(Math.random() * MAL_RANKING_TYPES.length)];
    const pagina = 1 + Math.floor(Math.random() * POPULARES_PREVIEW_MAX_PAGINA);
    const malData = await fetchMALRanking({
      ranking_type: rankingType,
      limit: 20,
      offset: (pagina - 1) * 20
    });

    const seleccion = deduplicarAnimes(barajarArray(malData.animes || []))
      .slice(0, POPULARES_PREVIEW_CANTIDAD);
    if (!seleccion.length) {
      section.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    const subtitulo = document.getElementById('populares-preview-filtro');
    if (subtitulo) {
      subtitulo.textContent = `Selección de ${MAL_RANKING_LABELS[rankingType] || rankingType}`;
    }

    container.innerHTML = '';
    const cards = [];
    seleccion.forEach(anime => {
      const card = crearAnimeCard(anime);
      if (card) {
        container.appendChild(card);
        cards.push(card);
      }
    });
    observerAnimeCards(cards);

    // Mismo patrón que "Continuar Viendo": botones que desplazan la fila.
    ['prev', 'next'].forEach(dir => {
      const btn = section.querySelector(`.scroll-btn-${dir}`);
      if (btn) {
        btn.onclick = () => scrollFilaUnaTarjeta(container, dir);
      }
    });

    // El título y la tarjeta final navegan a la sección Populares completa.
    const irAPopulares = () => {
      history.replaceState(null, '', '?Populares');
      mostrarSeccionDesdesearch();
      centrarElementoEnVista('Populares');
    };
    const verTodo = document.createElement('button');
    verTodo.type = 'button';
    verTodo.className = 'ver-todo-card';
    verTodo.innerHTML = `
      <span class="ver-todo-card-label">Ver todo</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6"/>
      </svg>`;
    verTodo.onclick = irAPopulares;
    container.appendChild(verTodo);

    section.classList.remove('hidden');
  } catch (error) {
    console.warn('[Populares] No se pudo cargar la selección aleatoria:', error);
    section.classList.add('hidden');
    container.innerHTML = '';
  } finally {
    popularesPreviewCargando = false;
  }
}

function centrarElementoEnVista(seccionId, smooth = true) {
  const contenedor = document.getElementById("indexpagination");
  const elemento = contenedor?.querySelector(`[data-target="${seccionId}"]`);
  if (!contenedor || !elemento) return;

  const { left: contLeft, width: contWidth } = contenedor.getBoundingClientRect();
  const { left: elLeft, width: elWidth } = elemento.getBoundingClientRect();
  const distanciaCentro = (elLeft - contLeft) - (contWidth / 2 - elWidth / 2);

  contenedor.scrollTo({
    left: contenedor.scrollLeft + distanciaCentro,
    behavior: smooth ? 'smooth' : 'auto'
  })
}
let ultimoBotonActivoNav = null;

function actualizarIndicadorNav() {
  const nav = document.getElementById('indexpagination');
  const indicator = nav?.querySelector('.nav-indicator');
  if (!nav || !indicator) return;

  // Mientras se arrastra el dedo el indicador lo controla el gesto táctil.
  if (indicator.classList.contains('arrastrando')) return;

  const botonActivo = nav.querySelector('.menu-item.active-menu-item');
  if (!nav.classList.contains('floating') || !botonActivo || !nav.getClientRects().length) {
    indicator.style.opacity = '0';
    ultimoBotonActivoNav = null;
    return;
  }

  const extraAncho = 5;
  indicator.style.width = `${botonActivo.offsetWidth + extraAncho}px`;
  indicator.style.transform = `translateX(${botonActivo.offsetLeft - extraAncho / 2}px)`;
  indicator.style.opacity = '1';

  if (botonActivo !== ultimoBotonActivoNav) {
    ultimoBotonActivoNav = botonActivo;
    indicator.classList.remove('rebote');
    void indicator.offsetWidth;
    indicator.classList.add('rebote');
  }
}

function cerrarSidebar() {
  document.querySelector(".sidebar")?.classList.remove("active");
  document.getElementById("menu-toggle")?.classList.remove("active");
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const navPagination = document.getElementById("indexpagination");
  if (navPagination) {
    navPagination.addEventListener('scroll', actualizarIndicadorNav, { passive: true });
    window.addEventListener('resize', actualizarIndicadorNav);
    new MutationObserver(actualizarIndicadorNav)
      .observe(navPagination, { attributes: true, attributeFilter: ['class'], subtree: true });
    actualizarIndicadorNav();

    // --- GESTO TÁCTIL EN LA PAGINACIÓN ---
    // Al arrastrar el dedo sobre la barra, el indicador la sigue; al soltar
    // sobre un botón se activa esa sección (equivale a su click).
    let navDrag = null;
    const navBotones = () => navPagination.querySelectorAll('.menu-item');

    navPagination.addEventListener('touchstart', (e) => {
      // Solo la píldora flotante tiene indicador que seguir; en top/bottom
      // la barra hace scroll horizontal nativo.
      if (!navPagination.classList.contains('floating')) return;
      const touch = e.touches[0];
      navDrag = { x: touch.clientX, y: touch.clientY, activo: false };
    }, { passive: true });

    navPagination.addEventListener('touchmove', (e) => {
      if (!navDrag) return;
      const touch = e.touches[0];
      const dx = touch.clientX - navDrag.x;
      const dy = Math.abs(touch.clientY - navDrag.y);

      if (!navDrag.activo) {
        // Intención horizontal: si el dedo baja o apenas se mueve, es scroll/tap normal.
        if (dy > Math.abs(dx) || Math.abs(dx) < 8) return;
        navDrag.activo = true;
      }

      const indicator = navPagination.querySelector('.nav-indicator');
      const botonActivo = navPagination.querySelector('.menu-item.active-menu-item');
      if (!indicator || !botonActivo || getComputedStyle(indicator).display === 'none') return;
      e.preventDefault();

      const ancho = botonActivo.offsetWidth + 5;
      const navRect = navPagination.getBoundingClientRect();
      const x = touch.clientX - navRect.left - navPagination.clientLeft + navPagination.scrollLeft;
      const botones = [...navBotones()];
      if (!botones.length) return;
      const minX = botones[0].offsetLeft - 2.5;
      const ultimo = botones[botones.length - 1];
      const maxX = ultimo.offsetLeft + ultimo.offsetWidth - 2.5 - ancho;
      const tx = Math.min(Math.max(x - ancho / 2, minX), Math.max(minX, maxX));

      indicator.classList.add('arrastrando');
      indicator.style.width = `${ancho}px`;
      indicator.style.transform = `translateX(${tx}px)`;
      indicator.style.opacity = '1';
    }, { passive: false });

    const terminarNavDrag = (e) => {
      if (!navDrag) return;
      const eraArrastre = navDrag.activo;
      navDrag = null;
      if (!eraArrastre) return;

      navPagination.querySelector('.nav-indicator')?.classList.remove('arrastrando');
      const touch = e.changedTouches[0];

      // Si el dedo se soltó fuera de la barra (arriba/abajo), se cancela:
      // no se activa ninguna sección.
      const navRect = navPagination.getBoundingClientRect();
      const tolerancia = 12;
      const dentro = touch.clientY >= navRect.top - tolerancia
        && touch.clientY <= navRect.bottom + tolerancia
        && touch.clientX >= navRect.left - tolerancia
        && touch.clientX <= navRect.right + tolerancia;
      if (!dentro) {
        actualizarIndicadorNav();
        return;
      }

      const boton = [...navBotones()].find(b => {
        const r = b.getBoundingClientRect();
        return touch.clientX >= r.left && touch.clientX <= r.right;
      });
      if (boton) boton.click();
      actualizarIndicadorNav();
    };
    navPagination.addEventListener('touchend', terminarNavDrag, { passive: true });
    navPagination.addEventListener('touchcancel', terminarNavDrag, { passive: true });
  }

  const menuBtn = document.getElementById("menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const sections = document.querySelectorAll(".content-section");

  // --- UTILIDADES GLOBALES DRY ---
  const isMobile = () => window.innerWidth <= 600;
  const getCurrentSection = () => decodeURIComponent(window.location.search.split(/[?&]/)[1] || 'Ultimos-Episodios');
  
  // Lista unificada de excepciones (añadido '#indexpagination')
  const excepcionesSelector = [
    '.pagination', '#indexpagination', '.hero-slider', '#recomendaciones-favoritos',
    '#recomendaciones-personalizadas', '#sugerencias-sin-resultados',
    '#anime-grid-ia-busqueda', '#filtro-letras-av1', '#section-ultimos-caps-viendo',
    '#filtro-anos-av1', '#lista-nav', '#populares-preview'
  ].join(','); 
  
  const isException = (element) => element?.closest(excepcionesSelector) !== null;

  // --- EVENTOS BÁSICOS ---
  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    menuBtn.classList.toggle("active");
  });

  // Reutilizamos la función global en lugar de repetir código
  sections.forEach(section => section.addEventListener("click", cerrarSidebar));

  // --- LÓGICA DE DESLIZAMIENTO DEL SIDEBAR ---
  let drag = { active: false, intent: false, startX: 0, startY: 0, width: 0 };
  const seccionesPermitidas = ['Ultimos-Episodios', 'Lista', 'Preferencias', 'Contacto'];

  document.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const section = getCurrentSection();
    const isActive = sidebar.classList.contains("active");
    
    if (isException(e.target)) return;

    // zonaDeAgarre es 100% de innerWidth (osea < window.innerWidth)
    const canOpen = !isActive && touch.clientX < window.innerWidth && isMobile() && seccionesPermitidas.includes(section);
    
    if (canOpen || (isActive && seccionesPermitidas.includes(section))) {
      drag = { active: true, intent: false, startX: touch.clientX, startY: touch.clientY, width: sidebar.offsetWidth || 250 };
    }
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!drag.active) return;
    
    const deltaX = e.touches[0].clientX - drag.startX;
    const deltaY = e.touches[0].clientY - drag.startY;

    if (!drag.intent) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) return drag.active = false; // Scroll vertical
      if (Math.abs(deltaX) > 5) { // Swipe horizontal
        drag.intent = true;
        sidebar.style.transition = "none"; 
      } else return;
    }

    const isActive = sidebar.classList.contains("active");
    const move = isActive ? Math.min(0, deltaX) : Math.max(0, deltaX);
    const percentage = Math.max(-100, Math.min(0, isActive ? (move / drag.width) * 100 : -100 + (move / drag.width) * 100));

    sidebar.style.transform = `translateX(${percentage}%)`;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!drag.active) return;
    drag.active = false;
    
    if (!drag.intent) return;
    
    const deltaX = e.changedTouches[0].clientX - drag.startX;
    const isActive = sidebar.classList.contains("active");
    
    sidebar.style.transition = ""; 
    sidebar.style.transform = ""; 

    if (!isActive && deltaX > 50) {
      sidebar.classList.add("active");
      menuBtn.classList.add("active");
      document.body.style.overflow = "hidden";
    } else if (isActive && deltaX < -50) {
      cerrarSidebar();
    }
  }, { passive: true });

  // --- LÓGICA DE NAVEGACIÓN ENTRE SECCIONES ---
  const navigationMap = {
    'Ultimos-Episodios': { left: 'DirectorioAV1' },
    'DirectorioJK': { left: 'Recomendaciones', right: 'Ultimos-Episodios' },
    'DirectorioAV1': { left: 'Lista', right: 'Ultimos-Episodios' },
    'Lista': { left: 'Recomendaciones', right: 'DirectorioAV1' },
    'Recomendaciones': { left: 'Horarios', right: 'Lista' },
    'Populares': { left: 'Horarios', right: 'Recomendaciones' },
    'Horarios': { right: 'Recomendaciones', left: null }
  };

  sections.forEach(section => {
    section.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      section._touch = {
        startX: e.changedTouches[0].screenX,
        startY: e.changedTouches[0].screenY,
        ignore: isException(document.elementFromPoint(touch.clientX, touch.clientY))
      };
    }, { passive: true });

    section.addEventListener('touchend', (e) => {
      if (section._touch?.ignore || document.body.style.overflow === "hidden") return;
      
      const dx = e.changedTouches[0].screenX - section._touch.startX;
      const dy = Math.abs(e.changedTouches[0].screenY - section._touch.startY);
      
      if (Math.abs(dx) > 50 && dy < 35) {
        const target = navigationMap[section.id]?.[dx < 0 ? 'left' : 'right'];
        // Solo navegar si hay un target válido (no null)
        if (target) {
          history.replaceState(null, '', `?${target}`);
          
          // Llamar a la función directamente (está exportada como módulo ES6)
          if (typeof mostrarSeccionDesdesearch === 'function') {
            mostrarSeccionDesdesearch();
          } else if (window.mostrarSeccionDesdesearch) {
            window.mostrarSeccionDesdesearch();
          }
        }
        // Si target es null, no hacer nada (no navegar)
      }
    }, { passive: true });
  });

  // --- PREVENCIÓN DE OVERSCROLL EN EL SIDEBAR ---
  let sbStartY = 0;
  sidebar.addEventListener("touchstart", e => sbStartY = e.touches[0].pageY, { passive: false });
  sidebar.addEventListener("touchmove", function(e) {
    const dy = sbStartY - e.touches[0].pageY;
    const atTop = this.scrollTop === 0;
    const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight;
    
    if ((atTop && dy < 0) || (atBottom && dy > 0)) e.preventDefault();
  }, { passive: false });
});

// =========================================
// 2. CONTINUAR VIENDO & SIDEBAR
// =========================================
function inicializarContinuarViendo() {
  const userID = localStorage.getItem('userID');
  const cachekey = "ultimosCapsVistosCache_" + userID;
  const container = document.getElementById('section-continuar-viendo');
  const grid = document.getElementById('section-ultimos-caps-viendo');
  const h2 = document.getElementById('continuarviendoh2');

  if (!container) {
    return;
  }

  let datos = JSON.parse(localStorage.getItem(cachekey)) || [];
  if (!Array.isArray(datos)) datos = [];

  if (verificarYLimpiarCacheBackground(cachekey, datos, 'portada', null, true)) {
    return;
  }

  if (h2) h2.dataset.text = datos.length;

  if (datos.length === 0) {
    container.classList.add('hidden');
    if (grid) {
      grid.innerHTML = '';
      grid.dataset.firma = '';
    }
    return;
  }

  if (container && grid) {
    container.classList.remove('hidden');

    // ----------------------------------------------------
    // Firma de los datos: si nada cambió (mismos animes,
    // episodios, títulos, portadas y orden) no tocamos el DOM.
    // ----------------------------------------------------
    const firma = datos.map(d =>
      `${d.id}|${d.siguienteCapitulo}|${d.totalCapitulos}|${d.titulo}|${d.portada}`
    ).join(';');

    if (grid.dataset.firma === firma) {
      observerAnimeCards(grid.querySelectorAll('.anime-card:not(.show)'));
      return;
    }
    grid.dataset.firma = firma;

    const idsNuevos = new Set(datos.map(d => d.id));

    // ----------------------------------------------------
    // Render incremental dentro del FLIP: se reutilizan las
    // cards existentes (solo se actualizan sus datos), se
    // crean únicamente las nuevas y se eliminan las que ya
    // no están. Nada de innerHTML='' -> cero parpadeo.
    // ----------------------------------------------------
    renderFlipOptimizado(grid, () => {
      // 1. Indexar cards existentes y eliminar las que ya no están
      const existentes = new Map();
      Array.from(grid.children).forEach(card => {
        if (idsNuevos.has(card.dataset.id)) {
          existentes.set(card.dataset.id, card);
        } else {
          card.remove();
        }
      });

      // 2. Actualizar existentes / crear solo las nuevas
      const cardsNuevas = [];
      const cardsFinales = datos.map(data => {
        let card = existentes.get(data.id);
        if (card) {
          actualizarTarjetaContinuarViendo(card, data);
        } else {
          card = crearTarjetaContinuarViendo(data);
          cardsNuevas.push(card);
        }
        return card;
      });

      // 3. Reordenar moviendo nodos (no se destruyen ni recrean)
      cardsFinales.forEach((card, i) => {
        const ref = grid.children[i];
        if (ref !== card) grid.insertBefore(card, ref || null);
      });

      // 4. Observar solo las cards recién creadas
      if (cardsNuevas.length) observerAnimeCards(cardsNuevas);
    });

    // Inicializar botones scroll
    ['prev', 'next'].forEach(dir => {
      const btn = container.querySelector(`.scroll-btn-${dir}`);
      if (btn) {
        btn.style.cssText = 'opacity: 1; pointer-events: auto;';
        btn.onclick = () => scrollFilaUnaTarjeta(grid, dir);
      }
    });
  }
}

function actualizarLayout() {
  const ancho = window.innerWidth;
  const colapsada = document.body.classList.contains('sidebar-Colapsard');

  // Más susceptible cuando la sidebar está colapsada (1241px), menos cuando está visible (1391px)
  const activar = ((colapsada && ancho >= 1196) || (!colapsada && ancho >= 1346))
    && document.querySelectorAll('#historial .anime-card').length >= 4;
  document.body.classList.toggle('layout-horizontal', activar);
}

document.getElementById('Colapsar-aside')?.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-Colapsard');
  localStorage.setItem('sidebarColapsard', document.body.classList.contains('sidebar-Colapsard'));
  actualizarLayout();
});

window.addEventListener('resize', actualizarLayout);
actualizarLayout(); // Se ejecuta al iniciar para aplicar el estado guardado en localStorage

// =========================================
// 3. TOOLTIP ULTRA-OPTIMIZADO V2 (EXTENDIDO)
// =========================================
(() => {
  let tooltip, active, rafId, timer, obs;
  let isLarge = window.matchMedia('(min-width: 601px)').matches;
  let isColapsard = document.body.classList.contains('sidebar-Colapsard');

  // Selector unificado para elementos con tooltip en el sidebar
  const SELECTOR = '.menu-item, #ultimos-caps-viendo a';

  // Extrae el texto según el atributo presente
  const getTooltipText = (el) => {
    if (el.dataset.title) return el.dataset.title;
    if (el.dataset.target) return el.dataset.target.replace(/-/g, ' ');
    return null;
  };

  const hide = () => {
    tooltip?.classList.remove('show');
    active = null;
    if (rafId) cancelAnimationFrame(rafId);
  };

  const show = (el) => {
    if (!isLarge || !isColapsard || !el.closest('.sidebar')) return;

    const text = getTooltipText(el);
    if (!text) return;

    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip';
      tooltip.style.cssText = 'top:0; left:0; will-change: transform, opacity;';
      document.body.appendChild(tooltip);
    }

    tooltip.textContent = text;
    active = el;
    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      tooltip.style.transform = `translate3d(90px, ${rect.top + (rect.height - tooltip.offsetHeight) / 2}px, 0)`;
      tooltip.classList.add('show');
    });
  };

  window.matchMedia('(min-width: 601px)').addEventListener('change', e => {
    isLarge = e.matches;
    if (!isLarge) hide();
  });

  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    if (performance.now() - lastScroll < 100) return;
    lastScroll = performance.now();
    hide();
    clearTimeout(timer);
    timer = setTimeout(() => active && show(active), 150);
  }, { passive: true, capture: true });

  document.addEventListener('mouseover', e => {
    const t = e.target.closest(SELECTOR);
    if (t && t !== active) show(t);
  }, { passive: true });

  document.addEventListener('mouseout', e => {
    // Evaluación agnóstica del elemento activo para evitar acoplamiento a una sola clase CSS
    if (active && (!e.relatedTarget || !active.contains(e.relatedTarget)) && active.contains(e.target)) {
      hide();
    }
  }, { passive: true });

  document.addEventListener('click', hide, { passive: true });

  obs = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      isColapsard = document.body.classList.contains('sidebar-Colapsard');
      if (!isColapsard) hide();
    }, 50);
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const cleanup = () => { hide(); clearTimeout(timer); obs.disconnect(); };
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);
})();
