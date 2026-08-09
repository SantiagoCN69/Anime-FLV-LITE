import { db, auth } from './firebase-login.js';
import {collection, doc, getDocs, getDoc, updateDoc, setDoc, query, orderBy, limit, where} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { observerAnimeCards, aplicarViewTransition } from './utils.js';

// Registro del Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registrado con éxito:', registration.scope);
        
        // Verificar actualizaciones del service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('Nueva versión del Service Worker disponible');
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
    console.log('Service Worker controlador cambiado');
    window.location.reload();
  });
}

let userID = localStorage.getItem('userID') || "null";

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

let favoritosCargados = false;
let viendoCargado = false;
let pendientesCargados = false;
let completadosCargados = false;
let ultimosCapsCargados = false;
let continuarViendoCargado = false;
let directorioAV1Cargado = false;
let directorioJkCargado = false;
let labCargado = false;
let popularesCargados = false;
let horariosCargados = false;

// Flags para prevenir cargas simultáneas
const cargando = new Set();

export function mostrarSeccionDesdesearch() {
  let search = window.location.search;
  
  let id = search.split(/[?&]/)[1] || 'Ultimos-Episodios';
  id = decodeURIComponent(id);
  
  const seccion = document.getElementById(id);
  if (!seccion) {
    id = 'Ultimos-Episodios';
    history.replaceState(null, '', '?Ultimos-Episodios');
  };

  if (!document.getElementById(id).classList.contains("hidden")) return;

  document.querySelectorAll(".content-section").forEach(sec => {
    sec.classList.toggle("hidden", sec.id !== id);
  });
  
  document.querySelectorAll('.menu-item').forEach(item => 
    item.classList.toggle('active-menu-item', item.getAttribute('data-target') === id)
  );

  actualizarIndicadorActivo();

if (id === 'Ultimos-Episodios') {
  cargarHeroSlider();
}

const sectionConfig = {
  'Mis-Favoritos': { flag: () => favoritosCargados, setFlag: () => { favoritosCargados = true; }, load: () => cargarDatos(document.getElementById('favoritos'), doc(db, "usuarios", userID, "favoritos", "lista")) },
  'Viendo': { flag: () => viendoCargado, setFlag: () => { viendoCargado = true; }, load: () => cargarDatos(document.getElementById('viendo'), doc(db, "usuarios", userID, "estados", "viendo")) },
  'Pendientes': { flag: () => pendientesCargados, setFlag: () => { pendientesCargados = true; }, load: () => cargarDatos(document.getElementById('pendientes'), doc(db, "usuarios", userID, "estados", "pendiente")) },
  'Completados': { flag: () => completadosCargados, setFlag: () => { completadosCargados = true; }, load: () => cargarDatos(document.getElementById('completados'), doc(db, "usuarios", userID, "estados", "visto")) },
  'Ultimos-Episodios': { flag: () => ultimosCapsCargados, setFlag: () => { ultimosCapsCargados = true; }, load: () => { cargarUltimosCapitulos(); cargarhistorial(); } },
  'Continuar-viendo': { flag: () => continuarViendoCargado, setFlag: () => { continuarViendoCargado = true; }, load: () => cargarContinuarViendo() },
  'DirectorioAV1': { flag: () => directorioAV1Cargado, setFlag: () => { directorioAV1Cargado = true; }, load: () => cargarFetch("DirectorioAV1") },
  'DirectorioJK': { flag: () => directorioJkCargado, setFlag: () => { directorioJkCargado = true; }, load: () => cargarFetch("DirectorioJK") },
  'Lab': { flag: () => labCargado, setFlag: () => { labCargado = true; }, load: () => cargarFetch("lab") },
  'Populares': { flag: () => popularesCargados, setFlag: () => { popularesCargados = true; }, load: () => cargarFetch("populares") },
  'Horarios': { flag: () => horariosCargados, setFlag: () => { horariosCargados = true; }, load: () => cargarFetch("horarios") }
};

const config = sectionConfig[id];
if (config && !config.flag()) {
  config.load();
  config.setFlag();
} else if (config) {

}

cerrarSidebar();
}

window.addEventListener("DOMContentLoaded", () => {
  mostrarSeccionDesdesearch();
});
window.addEventListener("searchchange", () => {
  mostrarSeccionDesdesearch();
});

function actualizarIndicadorActivo() {
  const indicator = document.querySelector('.active-indicator');
  const activeItem = document.querySelector('.sidebar .menu-item.active-menu-item');
  const sidebarUl = document.querySelector('.sidebar ul');
  
  if (!indicator || !activeItem || !sidebarUl) return;
  
  const ulRect = sidebarUl.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();
  
  const top = itemRect.top - ulRect.top;
  const height = itemRect.height;
  
  indicator.style.top = top + 'px';
  indicator.style.height = height + 'px';
  indicator.classList.add('visible');
}

window.handlesearchChange = function () {
  let search = window.location.search.substring(1);

  if (!search) {
    search = 'Ultimos-Episodios';
    history.replaceState(null, '', '?' + search);
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
    precargarCacheDirectorioJK(),
  ])
  const sidebarItems = document.querySelectorAll('.menu-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      history.replaceState(null, '', `?${targetId}`);
      mostrarSeccionDesdesearch();
    });
  });
});

function crearElementoSiguienteCapitulo(itemData) {
  const btn = document.createElement('a');
  btn.className = 'btn-siguiente-capitulo';
  btn.href = `ver.html?id=${itemData.id}&episode=${itemData.siguienteCapitulo}`;
  
  const portada = document.createElement('img');
  portada.src = itemData.portada;
  portada.alt = itemData.titulo;
  portada.className = 'portada-anime';
  portada.onerror = () => {
    portada.src = 'path/to/default/image.png'; 
  };
  
  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  const spanTitulo = document.createElement('span'); 
  spanTitulo.classList.add('texto-2-lineas');
  spanTitulo.textContent = itemData.titulo;

  const spanEpisodio = document.createElement('span');
  spanEpisodio.className = 'texto-episodio';
  spanEpisodio.textContent = `Ver episodio ${itemData.siguienteCapitulo}` + ' / ' + (itemData.totalCapitulos || 'X');

  contenedorTexto.appendChild(spanTitulo);
  contenedorTexto.appendChild(spanEpisodio);
  
  btn.appendChild(portada);
  btn.appendChild(contenedorTexto);
  
  btn.addEventListener('click', () => {
    btn.getElementsByClassName("texto-2-lineas")[0].style.setProperty('view-transition-name', 'title' + itemData.id);
    btn.getElementsByClassName("texto-episodio")[0].style.setProperty('view-transition-name', 'episodio' + itemData.id);
  });

  return btn;
}

async function cargarUltimosCapsVistos() {
  const ultimosCapsContainer = document.getElementById('ultimos-caps-viendo');
  if (!ultimosCapsContainer) return;

  // Variable centralizada para el texto de cuando no hay nada
  const textoVacio = '<p>No hay capítulos disponibles para continuar viendo.</p>';

  if (!userID || userID === "null") {
    ultimosCapsContainer.innerHTML = '<p>Inicia sesión para ver tu registro de animes!.</p>';
    inicializarContinuarViendo();
    return;
  }

  const renderizarBotones = (datos) => {
    ultimosCapsContainer.innerHTML = '';
    if (!datos || datos.length === 0) {
      ultimosCapsContainer.innerHTML = textoVacio;
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
    const q = query(ref, where('esFinalizadoPorVistos', '==', false), limit(10));
    const snap = await getDocs(q);

    // Si el usuario no tiene historial en Firebase
    if (snap.empty) {
      ultimosCapsContainer.innerHTML = textoVacio;
      localStorage.setItem(cacheKey, JSON.stringify([])); 
      localStorage.setItem(cacheStateKey, JSON.stringify([]));
      inicializarContinuarViendo();
      return;
    }

    const currentState = [];
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const vistos = (data.episodiosVistos || []).map(Number);
      if (vistos.length > 0) {
        let fechaMilisegundos = 0;
        if (data.fechaAgregado && typeof data.fechaAgregado.toMillis === 'function') {
           fechaMilisegundos = data.fechaAgregado.toMillis();
        } else if (data.fechaAgregado) {
           fechaMilisegundos = new Date(data.fechaAgregado).getTime();
        }

        currentState.push({
          id: docSnap.id,
          ultimoVisto: Math.max(...vistos),
          fechaAgregado: fechaMilisegundos 
        });
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
      // ¿Este anime y su último capítulo visto ya estaban en la caché?
      const estadoAnterior = cachedState.find(c => c.id === cap.id && c.ultimoVisto === cap.ultimoVisto);
      
      if (estadoAnterior && Array.isArray(cachedData)) {
        // Rescatamos los datos visuales (portada, título) de la caché
        const datosCacheados = cachedData.find(d => d.id === cap.id);
        if (datosCacheados) {
          freshData[index] = datosCacheados; // Reutilizamos sin gastar lecturas
          console.log('♻️ Reusando caché:', cap.id, 'Ep último visto:', cap.ultimoVisto);
          return; // Saltamos a la siguiente iteración
        }
      }
      
      // Si es un anime nuevo o vio un capítulo nuevo, preparamos la petición
      indicesFetch.push(index);
      promesasFetch.push(getDoc(doc(db, "datos-animes", cap.id)));
    });
    console.log('🔄 Fetching nuevos animes:', promesasFetch.length, 'de', currentState.length);
    
    // 3. Ejecutamos las llamadas a Firebase SOLAMENTE para los que faltan
    if (promesasFetch.length > 0) {
      const animeDocsSnap = await Promise.all(promesasFetch);
      
      animeDocsSnap.forEach((docSnap, i) => {
        if (docSnap.exists()) {
          const animeDetails = docSnap.data();
          const originalIndex = indicesFetch[i]; // Recuperamos su posición original
          const cap = currentState[originalIndex];
          
          const siguienteCapitulo = cap.ultimoVisto + 1;
          const episodios = Array.isArray(animeDetails.episodios) ? animeDetails.episodios : Object.values(animeDetails.episodios || {});
          const siguienteEpisodio = episodios.find(ep => Number(ep.number) === siguienteCapitulo);
          
          console.log('🔍 Anime:', cap.id, '| Último visto:', cap.ultimoVisto, '| Buscando Ep:', siguienteCapitulo, '| Encontrado:', !!siguienteEpisodio);
          
          if (siguienteEpisodio) {
            freshData[originalIndex] = {
              id: cap.id,
              portada: animeDetails.portada,
              titulo: animeDetails.titulo,
              siguienteCapitulo: siguienteCapitulo,
              siguienteCapituloUrl: siguienteEpisodio.url,
              totalCapitulos: episodios.length
            };
          } else {
            console.warn('⚠️ No se encontró siguiente capítulo para:', cap.id, 'Título:', animeDetails.titulo, '| Ep buscado:', siguienteCapitulo, '| Total eps:', episodios.length);
          }
        } else {
          console.error('❌ Documento no existe en Firebase:', currentState[indicesFetch[i]].id);
        }
      });
    }
    
    // 4. Limpiamos cualquier anime nulo (por si ya no hay más capítulos para ver de ese anime)
    const datosFinales = freshData.filter(Boolean);
    console.log('✅ Animes a renderizar:', datosFinales.map(d => ({ id: d.id, titulo: d.titulo, siguienteEp: d.siguienteCapitulo })));
    
    // 5. Render final y actualización de cachés
    renderizarBotones(datosFinales);
    localStorage.setItem(cacheKey, JSON.stringify(datosFinales));
    localStorage.setItem(cacheStateKey, JSON.stringify(currentState));
    
    inicializarContinuarViendo();
    cargarContinuarViendo();
  } catch (error) {
    console.error('Error crítico en cargarUltimosCapsVistos:', error);
    // Feedback opcional para el usuario en caso de que se caiga el internet o la BD
    ultimosCapsContainer.innerHTML = '<p>Error al sincronizar tu historial de continuar viendo.</p>';
  }
}

// ----------------------------------------------------
// UTILS DE FLIP OPTIMIZADO
// ----------------------------------------------------
function renderFlipOptimizado(container, renderCallback) {
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
    if (!el.dataset.id) return;
    
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
function createAnimeCard(anime, siguienteEpisodioUrl) {
    const div = document.createElement('div');
    let chapterHtml = ''; 
    let estadoHtml = '';
    let ratingHtml = '';
    let linkbase =  `<a href="anime.html?id=${anime.id}" id="anime-${anime.id}">`;
  
    div.className = 'anime-card';
    div.dataset.id = anime.id; // ¡CLAVE PARA EL FLIP!
    
    if (anime.Capitulo) {chapterHtml = `<span class="chapter">Episodio ${anime.Capitulo}</span>`;}
    if (anime.estado) {if (anime.estado === 'En emisión' || anime.estado === 'En emision') {estadoHtml = `<span class="estado"><img src="../icons/circle-solid-blue.svg" alt="${anime.estado}">${anime.estado}</span>`;}
      else {estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="${anime.estado}">${anime.estado}</span>`;}
    }
    if (!anime.estado && siguienteEpisodioUrl) {
      estadoHtml = `<span class="estado">Capitulo ${siguienteEpisodioUrl}</span>`;
    }
    if (anime.rating) {ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;}
    
    if (siguienteEpisodioUrl) {linkbase = `<a href="ver.html?id=${anime.id}&episode=${siguienteEpisodioUrl}">`;
    }
    div.innerHTML = `
    ${linkbase}
      <div class="container-img">
        <img src="${anime.portada}" class="cover" alt="${anime.titulo}">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        ${chapterHtml}
        ${estadoHtml}
        ${ratingHtml}
      </div>
      <strong>${anime.titulo}</strong>
    </a>`;
    div.addEventListener('click', () => {
      const strong = div.querySelector('strong');
      const containerImg = div.querySelector('.container-img');
      const rating = div.querySelector('.rating');
      
      if (strong) strong.style.setProperty('view-transition-name', 'title' + anime.id);
      if (containerImg) containerImg.style.setProperty('view-transition-name', anime.id);
      if (rating && ratingHtml) rating.style.setProperty('view-transition-name', 'rating' + anime.id);
    });
    
    return div;
}

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
  if (!datos || !Array.isArray(datos)) return false;
  
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
const DIRECTORIO_JK_CACHE_KEY = 'cache-directoriojk';

let animesCacheMemoria = null;
let precargaDirectorioJKPromise = null;

const slugFromTitle = (str = '') => 
  str.toLowerCase()
     .trim()
     .replace(/[:'".,!?/()]/g, '')
     .replace(/[\s-]+/g, '-');

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

function leerCacheDirectorioJK() {
  if (animesCacheMemoria) return animesCacheMemoria;
  
  try {
    const raw = localStorage.getItem(DIRECTORIO_JK_CACHE_KEY);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    if (Array.isArray(data?.animes) && data.animes.length > 0) {
      animesCacheMemoria = shuffleArray(data.animes.slice(0, 10));
      return animesCacheMemoria;
    }
  } catch (e) {
    console.error('Error leyendo cache del directorio JK:', e);
  }
  return null;
}

async function precargarCacheDirectorioJK() {
  if (animesCacheMemoria || localStorage.getItem(DIRECTORIO_JK_CACHE_KEY)) return;
  if (precargaDirectorioJKPromise) return precargaDirectorioJKPromise;
  
  console.log('No hay cache cargado del api..');
  precargaDirectorioJKPromise = (async () => {
    try {
      const res = await fetch('https://backend-animeflv-lite.onrender.com/api/browse?source=jkanime&p=1');
      if (!res.ok) throw new Error('Respuesta inválida');
      
      const data = await res.json();
      if (!Array.isArray(data?.animes) || data.animes.length === 0) return;

      localStorage.setItem(DIRECTORIO_JK_CACHE_KEY, JSON.stringify(data));
      animesCacheMemoria = shuffleArray(data.animes.slice(0, 10));

      const section = document.getElementById('Ultimos-Episodios');
      if (section && !section.classList.contains('hidden')) {
        cargarHeroSlider();
      }
    } catch (e) {
      console.error('Error precargando cache del directorio JK:', e);
    } finally {
      precargaDirectorioJKPromise = null;
    }
  })();

  return precargaDirectorioJKPromise;
}

const getEstadoBadge = (estado) => {
  const badges = {
    'En emision': '<span class="hero-badge hero-badge--ongoing">En emisión</span>',
    'Por estrenar': '<span class="hero-badge hero-badge--new">Por estrenar</span>',
    'Concluido': '<span class="hero-badge hero-badge--status">Concluido</span>',
    'Finalizado': '<span class="hero-badge hero-badge--status">Finalizado</span>'
  };
  return estado ? (badges[estado] || `<span class="hero-badge hero-badge--status">${estado}</span>`) : '';
};

function buildHeroSlide(anime, index) {
  const id = slugFromTitle(anime.title);
  const url1 = `anime.html?id=${id}`;
  const url2 = `ver.html?id=${id}&episode=1`;
  const synopsisCompleta = (anime.synopsis || '').replace(/<[^>]*>/g, '').trim();

  const badges = [
    getEstadoBadge(anime.estado),
    (index === 0 && anime.estado !== 'Por estrenar') ? '<span class="hero-badge hero-badge--new">Reciente</span>' : ''
  ].filter(Boolean).join('');

  const slide = document.createElement('article');
  slide.className = `hero-slide ${index === 0 ? 'active' : ''}`;
  slide.dataset.index = index;
  slide.dataset.id = id;
  slide.style.setProperty('--bg-image', `url('${anime.image || ''}')`);
  
  slide.innerHTML = `
  <div class="hero-background">
    <div class="hero-slide__bg" style="background-image:url('${anime.image || ''}')"></div>
  </div>
    <div class="hero-slide__content">
      ${badges ? `<div class="hero-slide__badges">${badges}</div>` : ''}
      <h2 class="hero-slide__title">${anime.title || 'Sin título'}</h2>
      ${synopsisCompleta ? `<p class="hero-slide__synopsis">${synopsisCompleta}</p>` : ''}
      <div class="hero-slide__actions">
        <a href="${url2}" class="hero-btn hero-btn--primary">
          <span class="hero-btn__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </span>
          <span class="hero-btn__label">Ver ahora</span>
        </a>
        <a href="${url1}" class="hero-btn hero-btn--secondary">
          <span class="hero-btn__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>
          </span>
          <span class="hero-btn__label">Más información</span>
        </a>
      </div>
    </div>
  `;
  return slide;
}

function initHeroSliderControls(container, slidesLength) {
  const track = container.querySelector('.hero-slider__track');
  const dotsWrap = container.querySelector('.hero-slider__dots');
  let current = 0;
  let autoplayId = null;

  const goTo = (index) => {
    if (current === index) return;

    const currentSlide = track.querySelector('.hero-slide.active');
    current = (index + slidesLength) % slidesLength;
    
    if (currentSlide) {
      currentSlide.classList.remove('active');
      currentSlide.classList.add('leaving');
      setTimeout(() => currentSlide.classList.remove('leaving'), 500);
    }
    
    track.children[current]?.classList.add('active');
    
    dotsWrap.querySelector('.hero-slider__dot.active')?.classList.remove('active');
    dotsWrap.children[current]?.classList.add('active');
  };

  const startAutoplay = () => {
    stopAutoplay();
    autoplayId = setInterval(() => goTo(current + 1), 5500);
  };

  const stopAutoplay = () => {
    if (autoplayId) {
      clearInterval(autoplayId);
      autoplayId = null;
    }
  };

  const resetAutoplay = () => {
    stopAutoplay();
    startAutoplay();
  };

  dotsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    goTo(Number(btn.dataset.idx));
    resetAutoplay();
  });

  container.querySelector('.hero-slider__prev').addEventListener('click', () => {
    goTo(current - 1);
    resetAutoplay();
  });
  
  container.querySelector('.hero-slider__next').addEventListener('click', () => {
    goTo(current + 1);
    resetAutoplay();
  });

  container.addEventListener('mouseenter', stopAutoplay);
  container.addEventListener('mouseleave', startAutoplay);

  let touchStartX = 0;
  track.addEventListener('touchstart', e => { 
    touchStartX = e.changedTouches[0].screenX; 
    stopAutoplay();
  }, { passive: true });
  
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 50) {
      goTo(current + (dx < 0 ? 1 : -1));
    }
    resetAutoplay();
  }, { passive: true });

  track.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const slide = link.closest('.hero-slide');
    if (slide) {
      const id = slide.dataset.id;
      slide.querySelector('.hero-slide__title')?.style.setProperty('view-transition-name', 'title' + id);
      slide.querySelector('.hero-slide__bg')?.style.setProperty('view-transition-name', id);
    }
  });

  startAutoplay();
}

function cargarHeroSlider() {
  const container = document.getElementById('hero-slider');
  if (!container) return;

  const animes = leerCacheDirectorioJK();
  if (!animes) {
    container.classList.add('hidden');
    container.replaceChildren();
    precargarCacheDirectorioJK();
    return;
  }

  container.classList.remove('hidden');
  
  container.innerHTML = `
    <div class="hero-slider__track"></div>
    <button type="button" class="hero-slider__prev" aria-label="Anterior">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <button type="button" class="hero-slider__next" aria-label="Siguiente">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <div class="hero-slider__dots">
      ${animes.map((_, i) => `<button type="button" class="hero-slider__dot ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="Ir al slide ${i + 1}"></button>`).join('')}
    </div>
  `;

  const track = container.querySelector('.hero-slider__track');
  const fragment = document.createDocumentFragment();
  animes.forEach((anime, i) => fragment.appendChild(buildHeroSlide(anime, i)));
  track.appendChild(fragment);

  initHeroSliderControls(container, animes.length);
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
      
        const getIdFromUrl = (url) => {
          if (!url) return '';
          const clean = url.replace(/\/+$/, '');
          const parts = clean.split('/');
          let last = parts[parts.length - 1];
          if (/^\d+$/.test(last)) {
            last = parts[parts.length - 2] || '';
          } else {
            last = last.replace(/-\d+$/, '');
          }
          return last;
        };
        
        const fragment = document.createDocumentFragment();
        datos.forEach(anime => {
          const card = createAnimeCard({
            id: anime.id || getIdFromUrl(anime.url),
            portada: anime.image || anime.cover || '',
            titulo: anime.title || 'Sin título',
            Capitulo: anime.chapter?.toString() || anime.episode?.toString() || ''
          });
          if (card) fragment.appendChild(card);
        });
        container.appendChild(fragment);
      });
      
      observerAnimeCards();
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
    
    try {
      const docRef = doc(db, 'ultimos-capitulos', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const firestoreData = docSnap.data().items || [];
  
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
  
      if (JSON.stringify(normalizar(apiData)) !== JSON.stringify(normalizar(cached))) {
        if(apiData.length > 0) {
          render(apiData);
          guardarCache(cacheKey, apiData);
          cached = apiData;
        }
        try {
          if (apiData && apiData.length > 0) {
            const docRef = doc(db, 'ultimos-capitulos', docId);
            await setDoc(docRef, { 
              items: apiData,
              lastUpdated: new Date().toISOString()
            }, { merge: true });
          }
        } catch (firestoreError) {
          console.error('Error al actualizar Firestore:', firestoreError);
        }
      }
    } catch (err) {
      console.error('Error al obtener datos de la API:', err);
    }
}

async function cargarhistorial() {
  const historialContainer = document.getElementById('historial');
  const historialh2 = document.getElementById('historialh2');
  if (!historialContainer) return;

  const claves = Object.keys(localStorage);
  const animesRecientes = [];
  
  const clavesAnime = claves.filter(clave => clave.startsWith('anime_'));
  
  for (const clave of clavesAnime) {
    try {
      const datos = JSON.parse(localStorage.getItem(clave));
      if (datos && datos._cachedAt) { 
        animesRecientes.push({
          id: clave.replace('anime_', ''), 
          titulo: datos.titulo || 'Sin título',
          estado: datos.estado || 'Sin estado',
          rating: datos.rating || 'Sin rating',
          portada: datos.portada || '',
          _cachedAt: datos._cachedAt
        });
      }
    } catch (e) {
      console.error('Error al procesar datos del localStorage:', e);
    }
  }
  
  animesRecientes.sort((a, b) => b._cachedAt - a._cachedAt);
  const animesAMostrar = animesRecientes.slice(0, 20);
  
  if (animesAMostrar.length > 0) {
    if (verificarYLimpiarCacheBackground(null, animesAMostrar, 'portada', (items) => {
      items.forEach(anime => localStorage.removeItem('anime_' + anime.id));
    }, true)) {
      return;
    }
    
    historialh2.classList.remove('hidden');
    historialContainer.classList.remove('hidden');
    
    // ----------------------------------------------------
    // Modificación: Integrado renderFlipOptimizado
    // ----------------------------------------------------
    renderFlipOptimizado(historialContainer, () => {
      historialContainer.innerHTML = '';
      const fragment = document.createDocumentFragment();
      animesAMostrar.forEach(anime => {
        const card = createAnimeCard(anime);
        if (card) fragment.appendChild(card);
      });
      historialContainer.appendChild(fragment);
    });
    
    observerAnimeCards();
  } else {
    historialh2.classList.add('hidden');
    historialContainer.classList.add('hidden');
  }
}

function guardarCache2(key, data) {
  try {
    if (!data || !data.length) {
      localStorage.removeItem(key);
      console.log('No hay datos para guardar en caché');
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
    animes.forEach(anime => {
        const card = createAnimeCard(anime);
        if (card) fragment.appendChild(card);
    });
    contenedor.appendChild(fragment);
  });
  observerAnimeCards();
}

function manejarBotonVerMas(container, DocRef, hayMas, limite, offset, numAnimes) {
  const btnAnterior = container.querySelector('.ver-mas-btn');
  if (btnAnterior) {
    container.removeChild(btnAnterior);
  }

  if (hayMas) {
    const verMasBtn = document.createElement('button');
    verMasBtn.className = 'ver-mas-btn';
    verMasBtn.textContent = 'Ver más';
    verMasBtn.onclick = () => cargarDatos(container, DocRef, limite, offset + numAnimes);
    container.appendChild(verMasBtn);
  }
}

async function cargarDatos(container, DocRef, limite = 10, offset = 0) {
  if (!userID || userID === "null") {
    container.innerHTML = '<p>Inicia sesión para ver tus animes en ' + container.id + '</p>';
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
      agregarAnimesAlContenedor(cachedData, container);
      h2.dataset.text = "Disponibles: " + cachedData.length;
    }
  }

  try {
      const Doc = await getDoc(DocRef);
      let titulos = Doc.exists() ? [...(Doc.data().animes || [])].filter(titulo => titulo != null).reverse() : [];
      h2.dataset.text = "Disponibles: " + titulos.length;

      if (titulos.length === 0) {
          container.innerHTML = '<p>No tienes animes en ' + container.id + '</p>';
          localStorage.removeItem(cacheKey);
          return;
      }

      if (offset === 0 && cachedData) {
          const ultimosTitulos = titulos.slice(0, limite).toString();
          const titulosCache = cachedData.map(a => a.id).slice(0, limite).toString();
          if (ultimosTitulos === titulosCache) {
              const hayMas = offset + limite < titulos.length;
              manejarBotonVerMas(container, DocRef, hayMas, limite, offset, cachedData.length);
              return;
          } 
        }
        
      const idsABuscar = titulos.slice(offset, offset + limite);
      let animes = [];
      const idsNoEncontrados = [];
      
      for (const id of idsABuscar) {
        const docSnap = await getDoc(doc(db, "datos-animes", id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!data.titulo || data.titulo.trim() === '') {
            console.log(`El anime con ID: ${id} no tiene título, se eliminará de la lista`);
            idsNoEncontrados.push(id);
          } else {
            animes.push({
              id: docSnap.id,
              titulo: data.titulo,
              portada: data.portada || data.banner,
              estado: data.estado || 'No disponible',
              rating: data.rating || null
            });
          }
        } else {
          console.log(`No se encontró el anime con ID: ${id} en datos-animes, se eliminará de la lista`);
          idsNoEncontrados.push(id);
        }
      }
      
      console.log('Animes cargados:', animes);
      
      if (idsNoEncontrados.length > 0) {
        const nuevosTitulos = titulos.filter(id => !idsNoEncontrados.includes(id));
        if (nuevosTitulos.length !== titulos.length) {
          try {
            await updateDoc(DocRef, { animes: nuevosTitulos });
            console.log(`Se eliminaron ${idsNoEncontrados.length} animes no encontrados de ${container.id}`);
          } catch (error) {
            console.error('Error al actualizar la lista de animes:', error);
          }
        }
      }
      
// Actualizar caché si es primera página
      if (offset === 0) {
        const cacheAnimes = animes.slice(0, limite);
        const animesOrdenados = titulos
            .slice(0, limite)
            .map(id => cacheAnimes.find(a => a.id === id))
            .filter(Boolean);
        guardarCache2(cacheKey, animesOrdenados);
        
        // ✅ CORRECCIÓN: Borrar lo viejo e insertar lo nuevo en el mismo ciclo FLIP
        renderFlipOptimizado(container, () => {
          container.innerHTML = '';
          const fragment = document.createDocumentFragment();
          animesOrdenados.forEach(anime => {
              const card = createAnimeCard(anime);
              if (card) fragment.appendChild(card);
          });
          container.appendChild(fragment);
        });
        
        manejarBotonVerMas(container, DocRef, offset + limite < titulos.length, limite, offset, animesOrdenados.length);
        observerAnimeCards(); 
        return;
      }
      
      agregarAnimesAlContenedor(animes, container);
      manejarBotonVerMas(container, DocRef, offset + limite < titulos.length, limite, offset, animes.length);

  } catch (error) {
      console.error('Error al cargar favoritos:', error);
      container.innerHTML = '<p>Error al cargar los favoritos</p>';
  } finally {
    cargando.delete(cargaKey);
  }
}

async function cargarContinuarViendo() {
  const container = document.getElementById('continuar-viendo');
  const h2 = document.getElementById('continuarviendoh2');
  const cachekey = "ultimosCapsVistosCache_" + userID;
  if (!container) return;
  
  if(localStorage.getItem(cachekey) === null) {
    container.innerHTML = '<span class="span-carga">Inicia sesión para ver tu registro de animes!</span>';
    return;
  }
   let datos = JSON.parse(localStorage.getItem(cachekey));
   
   if (verificarYLimpiarCacheBackground(cachekey, datos, 'portada', null, true)) {
     return;
    }
  h2.dataset.text = "Disponibles: " + datos.length;
  if (datos.length === 0) {
   container.innerHTML = '<span class="span-carga">No hay capítulos disponibles para continuar viendo.</span>';
   return;
  }
    
    // ----------------------------------------------------
    // Modificación: Integrado renderFlipOptimizado
   // ----------------------------------------------------
   renderFlipOptimizado(container, () => {
     container.innerHTML = '';
     datos.forEach(data => {
       container.appendChild(createAnimeCard(data, data.siguienteCapitulo));
     });
    });
    observerAnimeCards();
   
  }

function cargarFetch(direccion) {
  direccion = direccion.charAt(0).toUpperCase() + direccion.slice(1);
  const main = document.getElementById(direccion);
  if (!main) return;
  fetch(direccion + '.html')
    .then(res => res.text())
    .then(html => {
      const temp = document.createElement('div');
      temp.innerHTML = html;

      const nuevoMain = temp.querySelector('main');
      if (nuevoMain) {
        main.innerHTML = nuevoMain.innerHTML;
      }

      const script = document.createElement('script');
      script.src = '/scripts/' + direccion + '.js';
      script.type = 'module';
      document.body.appendChild(script);
    });
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

function cerrarSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const menuBtn = document.getElementById("menu-toggle");

  sidebar.classList.remove("active");
  menuBtn.classList.remove("active");

  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const sections = document.querySelectorAll(".content-section");

  const isMobile = () => window.innerWidth <= 600;

  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    menuBtn.classList.toggle("active");
  });

  sections.forEach(section => {
    section.addEventListener("click", () => {
      sidebar.classList.remove("active");
      menuBtn.classList.remove("active");
      document.body.style.overflow = "";
    });
  });

  // --- NUEVA LÓGICA DE DESLIZAMIENTO DEL SIDEBAR EN TIEMPO REAL ---
  let isDraggingSidebar = false;
  let isIntentionalSwipe = false; 
  let startX = 0;
  let startY = 0; 
  let sidebarWidth = 0;

  document.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY; 
    const isActive = sidebar.classList.contains("active");
    const zonaDeAgarre = 100 * window.innerWidth / 100; 

    // Obtener la sección actual desde la URL (por defecto 'Ultimos-Episodios')
    const currentSection = decodeURIComponent(window.location.search.split(/[?&]/)[1] || 'Ultimos-Episodios');

    // Verificar si el touch comenzó en un elemento de excepción
    const excepciones = [
      '.pagination', '.hero-slider', '#recomendaciones-favoritos',
      '#recomendaciones-personalizadas', '#sugerencias-sin-resultados',
      '#anime-grid-ia-busqueda', '#filtro-letras-av1', '#section-ultimos-caps-viendo'
    ];
    const touchTarget = e.target;
    const isInException = excepciones.some(selector => {
      const element = document.querySelector(selector);
      return element && element.contains(touchTarget);
    });

    // Si está en una excepción, no permitir el arrastre
    if (isInException) return;

    // Condición estricta: Solo permitir abrir si está cerrado, dentro de la zona de agarre, en móvil, 
    // Y estamos exactamente en la sección 'Ultimos-Episodios'
    const canOpenSidebar = !isActive && startX < zonaDeAgarre && isMobile() && currentSection === 'Ultimos-Episodios';

    // Iniciar arrastre si cumplimos las reglas para abrir, o si ya está abierto (para poder cerrarlo)
    // Solo permitir cerrar si estamos en la sección 'Ultimos-Episodios'
    if (canOpenSidebar || (isActive && currentSection === 'Ultimos-Episodios')) {
      isDraggingSidebar = true;
      isIntentionalSwipe = false; 
      sidebarWidth = sidebar.offsetWidth || 250; 
    }
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!isDraggingSidebar) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    // FASE DE DETECCIÓN DE INTENCIÓN (Los primeros 5-10 píxeles de movimiento)
    if (!isIntentionalSwipe) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
        // Movimiento VERTICAL (Scroll). Cancelamos el arrastre del menú.
        isDraggingSidebar = false;
        return;
      } else if (Math.abs(deltaX) > 5) {
        // Movimiento HORIZONTAL (Swipe). Confirmamos la intención.
        isIntentionalSwipe = true;
        sidebar.style.transition = "none"; 
      } else {
        return;
      }
    }

    const isActive = sidebar.classList.contains("active");
    let percentage = 0;

    if (!isActive) {
      const move = Math.max(0, deltaX); 
      percentage = -100 + (move / sidebarWidth) * 100;
      percentage = Math.min(0, percentage); 
    } else {
      const move = Math.min(0, deltaX); 
      percentage = (move / sidebarWidth) * 100;
      percentage = Math.max(-100, percentage); 
    }

    sidebar.style.transform = `translateX(${percentage}%)`;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!isDraggingSidebar) return;
    isDraggingSidebar = false;
    
    if (!isIntentionalSwipe) return;
    
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - startX;
    const isActive = sidebar.classList.contains("active");
    
    // Restaurar estilos
    sidebar.style.transition = ""; 
    sidebar.style.transform = ""; 

    const umbral = 50; 

    if (!isActive && deltaX > umbral) {
      sidebar.classList.add("active");
      menuBtn.classList.add("active");
      document.body.style.overflow = "hidden";
    } else if (isActive && deltaX < -umbral) {
      sidebar.classList.remove("active");
      menuBtn.classList.remove("active");
      document.body.style.overflow = "";
    }
  }, { passive: true });
  // --- FIN LÓGICA DEL SIDEBAR ---

  // --- LÓGICA DE NAVEGACIÓN ENTRE SECCIONES ---
  const navigationMap = {
    'Ultimos-Episodios': { left: 'DirectorioJK', right: null },
    'DirectorioJK': { left: 'Lab', right: 'Ultimos-Episodios' },
    'Lab': { left: 'Populares', right: 'DirectorioJK' },
    'Populares': { left: 'Horarios', right: 'Lab' },
    'Horarios': { left: null, right: 'Populares' }
  };
  
  const excepciones = [
    '.pagination', '.hero-slider', '#recomendaciones-favoritos',
    '#recomendaciones-personalizadas', '#sugerencias-sin-resultados',
    '#anime-grid-ia-busqueda', '#filtro-letras-av1', '#section-ultimos-caps-viendo'
  ];

  function handleSectionNavigation(sectionId, direction) {
    const targetSection = navigationMap[sectionId]?.[direction];
    if (!targetSection) return false;

    history.replaceState(null, '', `?${targetSection}`);
    mostrarSeccionDesdesearch(); // Asume que esta función sigue disponible globalmente
    return true;
  }

  const originalMostrarSeccion = mostrarSeccionDesdesearch;
  mostrarSeccionDesdesearch = function() {
    originalMostrarSeccion.apply(this, arguments);
    const id = decodeURIComponent(window.location.search.split(/[?&]/)[1] || 'Ultimos-Episodios');
    centrarElementoEnVista(id);
  };

  function isElementInExceptions(element) {
    if (!element) return false;
    return excepciones.some(selector => 
      element.closest && element.closest(selector) !== null
    );
  }

  function handleTouchStart(e) {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const targetElement = document.elementFromPoint(touchX, touchY);

    this._touchData = {
      startX: e.changedTouches[0].screenX,
      startY: e.changedTouches[0].screenY,
      isPagination: targetElement?.closest('#indexpagination') !== null,
      isException: isElementInExceptions(targetElement)
    };
  }

  function handleTouchEnd(e) {
    if (this._touchData?.isPagination || this._touchData?.isException || document.body.style.overflow === "hidden") return;
    
    const endX = e.changedTouches[0].screenX;
    const endY = e.changedTouches[0].screenY;
    const dx = endX - this._touchData.startX;
    const dy = Math.abs(endY - this._touchData.startY);
    
    const direction = Math.abs(dx) > 50 && dy < 35 
      ? dx < 0 ? 'left' : 'right' 
      : null;
    
    if (!direction) return;
    const sectionId = this.id;
    
    handleSectionNavigation(sectionId, direction);
  }

  sections.forEach(section => {
    section._touchData = {};
    section.addEventListener('touchstart', handleTouchStart, { passive: true });
    section.addEventListener('touchend', handleTouchEnd, { passive: true });
  });

  sidebar.addEventListener("touchstart", function(e) {
    this._startY = e.touches[0].pageY;
    this._startScroll = this.scrollTop;
  }, { passive: false });

  sidebar.addEventListener("touchmove", function(e) {
    const y = e.touches[0].pageY;
    const dy = this._startY - y;
    const atTop = this.scrollTop === 0;
    const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight;
    if ((atTop && dy < 0) || (atBottom && dy > 0)) {
      e.preventDefault();
    }
  }, { passive: false });
});

// =========================================
// SCRIPT DE SCROLL AUTOMÁTICO ENTRE SECCIONES
// =========================================

const sectionsOrder = [
  'Ultimos-Episodios', 'Mis-Favoritos', 'Viendo', 'Pendientes',
  'Completados',  'DirectorioJK','Lab', 'Populares', 'Horarios', 'Continuar-viendo'
];

const state = {
  isScrolling: false,
  scrollTimeout: null,
  insistCount: 0,
  atBottom: false,
  atTop: false,
  lastEdgeTime: 0 // Freno de tiempo para evitar cambios bruscos
};

const indicators = { bottom: null, top: null };

// Diccionario de iconos para cada sección
const sectionIcons = {
  'Ultimos-Episodios': `<svg width="65" height="65" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_12_59)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M60.8794 33.0105C60.8099 32.8285 60.7751 32.6365 60.7751 32.4444C60.7751 32.2517 60.8099 32.0589 60.8798 31.8751L63.0177 26.2639L63.2187 25.7352C63.4393 25.1567 63.546 24.5535 63.546 23.9601C63.5467 22.3143 62.7275 20.7263 61.2856 19.7838L60.576 19.3204L55.7803 16.189C55.4548 15.9756 55.2167 15.6471 55.115 15.2706L53.398 8.9278C52.8055 6.74414 50.8277 5.24295 48.5848 5.24295C48.5 5.24295 48.4156 5.2446 48.3308 5.24954L41.7932 5.57639V5.57563L41.6951 5.57817C41.3281 5.57817 40.9744 5.45397 40.6897 5.22483L35.9034 1.36952L35.5742 1.10476C34.6632 0.369061 33.5502 -0.000754949 32.4447 5.46768e-06C31.3395 -0.0016421 30.2263 0.369061 29.3147 1.10476L29.3159 1.10388L24.7275 4.7995L24.2004 5.22407C23.9144 5.45409 23.5595 5.57829 23.1941 5.57829L23.1088 5.57639L16.5749 5.25043L16.5707 5.24954C16.4693 5.24371 16.3804 5.24295 16.3043 5.24295C14.061 5.24295 12.0836 6.74401 11.4911 8.9278L9.77399 15.2706C9.67184 15.6486 9.43269 15.978 9.10508 16.1923L8.6321 16.501L3.60143 19.7854C2.16032 20.7288 1.34198 22.3158 1.34274 23.9609C1.34274 24.5534 1.44908 25.1541 1.66884 25.7317L4.00902 31.875L4.0094 31.8758C4.07885 32.0579 4.11408 32.2516 4.11408 32.4443C4.11408 32.6372 4.07936 32.83 4.0094 33.0121L1.66972 39.1537L1.6701 39.153C1.44958 39.7314 1.34274 40.3339 1.34274 40.9271C1.34198 42.5731 2.16032 44.1618 3.60346 45.1051L7.68665 47.7714L9.10622 48.6982C9.43358 48.9116 9.67184 49.2394 9.77399 49.6183L11.4911 55.9603C12.0831 58.144 14.0613 59.6452 16.3043 59.6459C16.3804 59.6452 16.4632 59.6443 16.5517 59.6394L16.3639 59.6492L23.1365 59.3109H23.1332L23.1966 59.31C23.5598 59.31 23.9137 59.4342 24.1991 59.6642L29.3156 63.7859H29.3159C30.2265 64.52 31.3392 64.8898 32.4447 64.889C33.5498 64.8899 34.6628 64.52 35.5739 63.7851L41.1301 59.3091L40.6908 59.6633C40.9763 59.4333 41.3293 59.31 41.6929 59.31L41.7689 59.3116L48.3831 59.6418L48.3499 59.6402C48.4219 59.6435 48.5002 59.6452 48.585 59.6459C50.8271 59.6452 52.8061 58.1449 53.3982 55.9603L55.1152 49.6183C55.2174 49.2394 55.4554 48.9125 55.7821 48.699L61.2888 45.1035C62.729 44.1601 63.547 42.5731 63.5462 40.9279C63.5462 40.3345 63.4395 39.7313 63.2185 39.1521L60.8794 33.0105ZM57.7131 30.6686C57.4951 31.2405 57.3858 31.8428 57.3858 32.4444C57.3858 33.047 57.4951 33.6493 57.7131 34.2212L60.0512 40.3603L60.0516 40.3611C60.1232 40.549 60.1567 40.7393 60.1567 40.928C60.1558 41.456 59.8952 41.9658 59.4322 42.2678L53.9306 45.86H53.931C52.9062 46.5285 52.163 47.5514 51.8432 48.7331L50.1261 55.075C49.9379 55.775 49.3007 56.2566 48.585 56.2558L48.4898 56.2532L48.4659 56.2525L41.9423 55.9273H41.9468C41.8665 55.9223 41.7817 55.9207 41.6929 55.9198C40.5563 55.9198 39.4515 56.3087 38.5632 57.0245L38.1235 57.3795L33.4473 61.1462C33.1527 61.3837 32.8027 61.4996 32.4448 61.4996C32.0874 61.4996 31.7368 61.3837 31.4419 61.1462L26.3259 57.0245C25.4379 56.3096 24.3337 55.9207 23.1967 55.9207C23.1206 55.9207 23.0316 55.9215 22.9298 55.9273V55.9281L16.3852 56.255L16.3872 56.2542L16.3046 56.2559C15.5895 56.2566 14.9515 55.775 14.7633 55.0751L13.0463 48.7332C12.7264 47.5515 11.9834 46.5288 10.9585 45.8601L6.87604 43.1947L5.45736 42.2679C4.99477 41.9666 4.73331 41.4561 4.73243 40.9273C4.73281 40.7377 4.76601 40.5474 4.83711 40.3613L7.17679 34.2204L7.17641 34.2213C7.39439 33.6487 7.50364 33.0471 7.50364 32.4446C7.50364 31.8422 7.3949 31.2398 7.17641 30.668L4.92342 24.7554L4.83736 24.5303C4.76576 24.3416 4.73268 24.1505 4.73217 23.961C4.73306 23.4322 4.99414 22.9233 5.4566 22.6221L10.9587 19.0301L10.9596 19.0292C11.9839 18.359 12.7263 17.337 13.0462 16.1561L14.7632 9.81331C14.951 9.11411 15.5899 8.63162 16.3044 8.63251L16.3682 8.63327L22.9471 8.96177L22.9542 8.96266C23.034 8.96595 23.1144 8.96773 23.1942 8.96849C24.3308 8.96849 25.4359 8.58029 26.3247 7.86537L31.4431 3.74278C31.7372 3.50527 32.0869 3.3902 32.4448 3.38944C32.8023 3.38944 33.1524 3.50527 33.4469 3.74278L33.1171 3.47714L38.5641 7.86449C39.4541 8.58105 40.5605 8.9676 41.6954 8.9676C41.7798 8.9676 41.8555 8.96506 41.9225 8.96342H41.9048L48.5045 8.63403H48.509L48.5851 8.63238C49.3001 8.63149 49.9384 9.11398 50.1263 9.81318L51.8433 16.1559C52.1632 17.3367 52.9053 18.3587 53.9299 19.0291L60.1422 23.0854L59.4322 22.622C59.8952 22.9233 60.1559 23.4321 60.1567 23.9601C60.1567 24.1497 60.1232 24.3401 60.0512 24.5294L57.4111 31.4597L57.7131 30.6686Z" fill="white" style="fill:white;fill-opacity:1;"/>
<path d="M24.8594 28.6801L23.1125 29.0235C23.0206 29.0425 22.9701 29.1153 22.9884 29.2089L24.288 35.8213L24.2123 35.837L19.2027 29.9536C19.1199 29.8576 19.0189 29.8286 18.9105 29.8502L17.0556 30.2152C16.9637 30.2334 16.9133 30.3062 16.9332 30.3996L18.9378 40.5952C18.9555 40.6888 19.0297 40.7392 19.1216 40.7209L20.8684 40.3775C20.9602 40.3585 21.0107 40.2849 20.9929 40.1913L19.6949 33.5946L19.7722 33.5796L24.7926 39.445C24.8754 39.5409 24.9622 39.5716 25.0864 39.5484L26.9252 39.1859C27.017 39.1677 27.0674 39.094 27.0476 39.0005L25.0434 28.8041C25.0253 28.7108 24.9513 28.662 24.8594 28.6801Z" fill="white" style="fill:white;fill-opacity:1;"/>
<path d="M35.5961 35.4415L31.0677 36.332C31.0065 36.3453 30.9689 36.3204 30.9581 36.2583L30.5291 34.0795C30.5161 34.0183 30.5415 33.9819 30.6027 33.9687L34.374 33.2273C34.4659 33.209 34.5163 33.1362 34.4986 33.0437L34.1759 31.406C34.1577 31.3142 34.0836 31.2636 33.9918 31.281L30.2209 32.0233C30.1595 32.0348 30.1215 32.0092 30.1092 31.948L29.6996 29.8627C29.6872 29.8006 29.7124 29.7633 29.7736 29.7518L34.302 28.8614C34.3939 28.8431 34.4443 28.7695 34.4244 28.6768L34.1 27.0245C34.0817 26.9309 34.0081 26.8812 33.9158 26.8995L27.1796 28.2244C27.0857 28.2426 27.0369 28.3163 27.0551 28.4097L29.0597 38.6061C29.0795 38.6989 29.1515 38.7484 29.2454 38.7303L35.9816 37.4054C36.0739 37.3872 36.1244 37.3135 36.1046 37.2209L35.7798 35.5675C35.7621 35.4746 35.688 35.4234 35.5961 35.4415Z" fill="white" style="fill:white;fill-opacity:1;"/>
<path d="M47.8075 24.1679L45.8298 24.5567C45.7218 24.5775 45.6694 24.6371 45.6747 24.7487L45.5199 31.6293L45.4872 31.6352L42.3382 25.4048C42.2878 25.3162 42.2136 25.2674 42.1218 25.2857L40.7771 25.5497C40.6708 25.5712 40.6203 25.644 40.6075 25.745L40.1118 32.6927L40.0812 32.6992L37.2689 26.4003C37.2366 26.3093 37.1626 26.2614 37.0546 26.2829L35.0608 26.6735C34.9528 26.695 34.9346 26.7629 34.9689 26.853L39.6918 36.5141C39.7423 36.6009 39.816 36.6515 39.9083 36.6333L41.4532 36.3287C41.5612 36.3081 41.6116 36.2335 41.6241 36.1351L42.1776 29.2387L42.2083 29.233L45.316 35.4086C45.3648 35.4954 45.4389 35.546 45.5469 35.5245L47.0918 35.2199C47.1998 35.2 47.2648 35.1223 47.2632 35.0254L47.9607 24.2978C47.9569 24.201 47.9155 24.1463 47.8075 24.1679Z" fill="white" style="fill:white;fill-opacity:1;"/>
</g>
<defs>
<clipPath id="clip0_12_59">
<rect width="64.8889" height="64.8889" fill="white" style="fill:white;fill-opacity:1;"/>
</clipPath>
</defs>
</svg>
`,
  'Mis-Favoritos': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: text-bottom;">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>`,
  'Viendo': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: text-bottom;">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>`,
  'Pendientes': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: text-bottom;">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>`,
  'Completados': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: text-bottom;">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>`,
  'DirectorioJK': `<svg width="65" height="65" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11.1961 14.6158C11.1961 19.5454 18.3377 25.3324 32.6282 25.3324C46.9188 25.3324 54.0603 19.4847 54.0603 14.5515M11.1961 32.4768C11.1961 37.4063 18.3377 43.1934 32.6282 43.1934C46.9188 43.1934 54.0603 37.3456 54.0603 32.4125M11.1961 13.5656C11.1961 8.92172 20.1268 3.77419 32.6282 3.89921C45.1296 4.02426 54.0603 9.44683 54.0603 14.0907V50.8627C54.0603 55.5066 45.1296 61.0544 32.6282 61.0544C20.1268 61.0544 11.1961 54.9815 11.1961 50.3376V13.5656Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="3.93834" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
  'Lab': `<svg width="65" height="65" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M58.4408 54.7077L57.1541 55.5646V55.565L58.4408 54.7077ZM8.70621 59.5125V57.9674H8.7025L8.70621 59.5125ZM6.12921 54.7077L7.41585 55.565V55.5646L6.12921 54.7077ZM43.101 5.43842C42.2482 5.43842 41.5585 6.13013 41.5585 6.98337C41.5585 7.83664 42.2482 8.52835 43.101 8.52835V6.98337V5.43842ZM30.7425 8.52835C31.5953 8.52835 32.2887 7.83664 32.2887 6.98337C32.2887 6.13013 31.5953 5.43842 30.7425 5.43842V6.98337V8.52835ZM49.2822 53.3325V54.8776C49.8421 54.8776 50.3612 54.5728 50.6319 54.0815C50.9063 53.5902 50.8914 52.9899 50.591 52.5138L49.2822 53.3325ZM41.5585 40.9728L42.8674 40.1541C42.5856 39.7021 42.0888 39.4277 41.5585 39.4277V40.9728ZM23.0188 40.9728V39.4277C22.4849 39.4277 21.9881 39.7021 21.7063 40.1541L23.0188 40.9728ZM15.2915 53.3325L13.9826 52.5138C13.686 52.9899 13.6674 53.5902 13.9418 54.0815C14.2125 54.5728 14.7316 54.8776 15.2915 54.8776V53.3325ZM40.0123 13.1633H38.4661V26.1318H40.0123L41.5585 26.1321V13.1633H40.0123ZM40.0123 26.1318H38.4661C38.4661 27.0473 38.7368 27.9421 39.2448 28.7038L40.5315 27.8467L41.8181 26.9897C41.6475 26.7357 41.5585 26.4373 41.5585 26.1321L40.0123 26.1318ZM40.5315 27.8467L39.2448 28.7038L57.1541 55.5646L58.4408 54.7077L59.7274 53.8505L41.8181 26.9897L40.5315 27.8467ZM58.4408 54.7077L57.1541 55.565C57.3099 55.7979 57.3988 56.0682 57.4137 56.3478L58.9562 56.2725L60.4987 56.1976C60.4579 55.3596 60.1909 54.5487 59.7274 53.8505L58.4408 54.7077ZM58.9562 56.2725L57.4137 56.3478C57.4285 56.627 57.3655 56.9047 57.232 57.1513L58.5928 57.8803L59.9573 58.6092C60.354 57.8691 60.5395 57.036 60.4987 56.1976L58.9562 56.2725ZM58.5928 57.8803L57.232 57.1513C57.0985 57.3978 56.9057 57.6044 56.6646 57.7479L57.4582 59.0735L58.2517 60.3987C58.971 59.9674 59.5605 59.349 59.9573 58.6092L58.5928 57.8803ZM57.4582 59.0735L56.6646 57.7479C56.4236 57.8917 56.1493 57.9674 55.8712 57.9674V59.5125V61.0576C56.7092 61.0576 57.5323 60.8299 58.2517 60.3987L57.4582 59.0735ZM55.8712 59.5125V57.9674H8.70621V59.5125V61.0576H55.8712V59.5125ZM8.70621 59.5125L8.7025 57.9674C8.4244 57.9678 8.15001 57.8921 7.90899 57.7486L7.11549 59.0746L6.32203 60.4005C7.04137 60.8314 7.86821 61.0583 8.70621 61.0576V59.5125ZM7.11549 59.0746L7.90899 57.7486C7.66798 57.6047 7.47149 57.3986 7.338 57.152L5.97717 57.8817L4.61634 58.6111C5.01309 59.3512 5.60269 59.9697 6.32203 60.4005L7.11549 59.0746ZM5.97717 57.8817L7.338 57.152C7.20822 56.9054 7.14519 56.6273 7.15632 56.3481L5.6138 56.2732L4.07129 56.1987C4.0305 57.0374 4.21959 57.871 4.61634 58.6111L5.97717 57.8817ZM5.6138 56.2732L7.15632 56.3481C7.17115 56.0686 7.26012 55.7979 7.41585 55.565L6.12921 54.7077L4.84623 53.8501C4.37903 54.5487 4.11208 55.3603 4.07129 56.1987L5.6138 56.2732ZM6.12921 54.7077L7.41585 55.5646L25.3252 28.7038L24.0385 27.8467L22.7556 26.9896L4.84623 53.8501L6.12921 54.7077ZM24.0385 27.8467L25.3252 28.7038C25.8332 27.942 26.1039 27.047 26.1039 26.1314L24.5576 26.1318H23.0151C23.0151 26.437 22.9224 26.7357 22.7556 26.9896L24.0385 27.8467ZM24.5576 26.1318L26.1039 26.1314V13.1633H24.5576H23.0151V26.1318H24.5576ZM43.101 6.98337V8.52835H46.1934V6.98337V5.43842H43.101V6.98337ZM46.1934 6.98337V8.52835C46.6013 8.52835 46.9944 8.69113 47.2836 8.98087L48.3774 7.8884L49.4676 6.79593C48.5999 5.92672 47.4208 5.43842 46.1934 5.43842V6.98337ZM48.3774 7.8884L47.2836 8.98087C47.5728 9.27061 47.736 9.66358 47.736 10.0733H49.2822H50.8284C50.8284 8.84408 50.3389 7.66518 49.4676 6.79593L48.3774 7.8884ZM49.2822 10.0733H47.736C47.736 10.4831 47.5728 10.8761 47.2836 11.1658L48.3774 12.2582L49.4676 13.3507C50.3389 12.4815 50.8284 11.3026 50.8284 10.0733H49.2822ZM48.3774 12.2582L47.2836 11.1658C46.9944 11.4555 46.6013 11.6183 46.1934 11.6183V13.1633V14.7083C47.4208 14.7083 48.5999 14.2199 49.4676 13.3507L48.3774 12.2582ZM46.1934 13.1633V11.6183H18.3839V13.1633V14.7083H46.1934V13.1633ZM18.3839 13.1633V11.6183C17.9723 11.6183 17.5793 11.4555 17.2901 11.1658L16.1963 12.2582L15.1061 13.3507C15.9738 14.2199 17.1529 14.7083 18.3839 14.7083V13.1633ZM16.1963 12.2582L17.2901 11.1658C17.0009 10.8761 16.8377 10.4831 16.8377 10.0733H15.2915H13.749C13.749 11.3026 14.2347 12.4815 15.1061 13.3507L16.1963 12.2582ZM15.2915 10.0733H16.8377C16.8377 9.66358 17.0009 9.27061 17.2901 8.98087L16.1963 7.8884L15.1061 6.79593C14.2347 7.66515 13.749 8.84408 13.749 10.0733H15.2915ZM16.1963 7.8884L17.2901 8.98087C17.5793 8.69113 17.9723 8.52835 18.3839 8.52835V6.98337V5.43842C17.1529 5.43842 15.9738 5.92672 15.1061 6.79593L16.1963 7.8884ZM18.3839 6.98337V8.52835H30.7425V6.98337V5.43842H18.3839V6.98337ZM38.4661 6.98337H36.9236V8.52835V10.0733C38.6292 10.0733 40.0123 8.68991 40.0123 6.98337H38.4661ZM36.9236 8.52835V6.98337H35.3774H33.8312C33.8312 8.68991 35.2142 10.0733 36.9236 10.0733V8.52835ZM35.3774 6.98337H36.9236V5.43842V3.89343C35.2142 3.89343 33.8312 5.27686 33.8312 6.98337H35.3774ZM36.9236 5.43842V6.98337H38.4661H40.0123C40.0123 5.27686 38.6292 3.89343 36.9236 3.89343V5.43842ZM49.2822 53.3325L50.591 52.5138L42.8674 40.1541L41.5585 40.9728L40.2459 41.7915L47.9733 54.1516L49.2822 53.3325ZM41.5585 40.9728V39.4277H23.0188V40.9728V42.5179H41.5585V40.9728ZM23.0188 40.9728L21.7063 40.1541L13.9826 52.5138L15.2915 53.3325L16.6041 54.1516L24.3277 41.7915L23.0188 40.9728ZM15.2915 53.3325V54.8776H49.2822V53.3325V51.7877H15.2915V53.3325Z" fill="white" style="fill:white;fill-opacity:1;"/>
</svg>
`,
  'Populares': `<svg width="65" height="65" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M41.0176 61.6857C76.9357 52.8693 56.8236 17.6035 32.3986 2.90942C29.5244 13.1953 25.2115 16.1341 16.5925 26.4199C5.17703 40.0382 10.8477 55.808 26.6503 61.6857C24.2557 58.7467 18.0772 52.5752 22.3373 44.0529C23.8079 41.1138 26.7455 38.1751 25.2785 32.2975C28.1526 33.7669 34.0949 35.2363 35.5619 42.5833C37.9565 39.6446 40.4427 33.473 38.1434 26.4199C56.136 39.6446 48.7866 52.8693 41.0176 61.6857Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="3.87923" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
  'Horarios': `<svg width="65" height="65" viewBox="0 0 65 65" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M60.2881 37.3634V31.7816C60.2881 21.2564 60.2881 15.9937 57.0185 12.724C53.749 9.4542 48.4867 9.4542 37.9622 9.4542M37.9622 59.6906H26.7971C16.2725 59.6906 11.0102 59.6906 7.74065 56.4211C4.47109 53.1515 4.47112 47.8884 4.47112 37.3634V31.7816C4.47112 21.2564 4.47109 15.9937 7.74065 12.724C11.0102 9.4542 16.2725 9.4542 26.7971 9.4542M18.4243 9.4542V5.26782M46.3349 9.4542V5.26782M56.1017 55.5042L60.2881 59.6906M58.8941 23.4088H28.8903M4.47112 23.4088H15.2845M57.4958 48.5272C57.4958 53.1511 53.749 56.9 49.123 56.9C44.5012 56.9 40.7502 53.1511 40.7502 48.5272C40.7502 43.903 44.5012 40.1545 49.123 40.1545C53.749 40.1545 57.4958 43.903 57.4958 48.5272Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="3.97706" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
  'default': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: text-bottom;">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>`,
  "Continuar-viendo": `<svg width="69" height="69" viewBox="0 0 69 69" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_20_26)">
<path d="M34.5018 64.6408C51.1788 64.6408 64.6981 51.1214 64.6981 34.4445C64.6981 17.7675 51.1788 4.24817 34.5018 4.24817C17.8249 4.24817 4.30551 17.7675 4.30551 34.4445C4.30551 51.1214 17.8249 64.6408 34.5018 64.6408Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="4.30556" stroke-miterlimit="10"/>
<path d="M34.5018 23.4509C37.5297 23.4509 39.9842 20.9963 39.9842 17.9685C39.9842 14.9406 37.5297 12.4861 34.5018 12.4861C31.474 12.4861 29.0194 14.9406 29.0194 17.9685C29.0194 20.9963 31.474 23.4509 34.5018 23.4509Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="4.30556" stroke-miterlimit="10"/>
<path d="M34.5018 56.4027C37.5297 56.4027 39.9842 53.9481 39.9842 50.9203C39.9842 47.8924 37.5297 45.4379 34.5018 45.4379C31.474 45.4379 29.0194 47.8924 29.0194 50.9203C29.0194 53.9481 31.474 56.4027 34.5018 56.4027Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="4.30556" stroke-miterlimit="10"/>
<path d="M18.0259 39.9268C21.0537 39.9268 23.5083 37.4723 23.5083 34.4444C23.5083 31.4166 21.0537 28.962 18.0259 28.962C14.998 28.962 12.5435 31.4166 12.5435 34.4444C12.5435 37.4723 14.998 39.9268 18.0259 39.9268Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="4.30556" stroke-miterlimit="10"/>
<path d="M50.9777 39.9268C54.0056 39.9268 56.4601 37.4723 56.4601 34.4444C56.4601 31.4166 54.0056 28.962 50.9777 28.962C47.9499 28.962 45.4953 31.4166 45.4953 34.4444C45.4953 37.4723 47.9499 39.9268 50.9777 39.9268Z" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="4.30556" stroke-miterlimit="10"/>
<path d="M66.1666 64.9445L34.5018 64.6407" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="4.30556" stroke-miterlimit="10" stroke-linecap="round"/>
<path d="M35.1666 33.9445H34.1666" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="4.30556" stroke-miterlimit="10" stroke-linecap="round"/>
</g>
<defs>
<clipPath id="clip0_20_26">
<rect width="68.8889" height="68.8889" fill="white" style="fill:white;fill-opacity:1;"/>
</clipPath>
</defs>
</svg>`

};

// 1. CREACIÓN DE INTERFAZ (Estilo Píldora Horizontal)
function createIndicators() {
  if (indicators.bottom && indicators.top) return;

  const createHTML = (label, sectionName, icon) => `
    <div class="indicator-text">
      ${label}:
      <span class="indicator-highlight">
        ${icon}
        ${sectionName}
      </span>
    </div>
    <div class="indicator-action">
      <span class="action-text">Ir ahora &rarr;</span>
      <div class="progress-bar"></div>
    </div>

  `;

  // Indicador Inferior
  indicators.bottom = document.createElement('div');
  indicators.bottom.className = 'section-change-indicator bottom';
  indicators.bottom.innerHTML = createHTML('Siguiente sección', 'Sección', sectionIcons.default);

  // Indicador Superior
  indicators.top = document.createElement('div');
  indicators.top.className = 'section-change-indicator top';
  indicators.top.innerHTML = createHTML('Sección anterior', 'Sección', sectionIcons.default);

  document.body.append(indicators.bottom, indicators.top);

  // Hacer funcionales los botones "Ir ahora"
  indicators.bottom.querySelector('.indicator-action').addEventListener('click', () => {
    changeSection('next');
  });
  indicators.top.querySelector('.indicator-action').addEventListener('click', () => {
    changeSection('prev');
  });
}

function updateIndicator(show, progress = 0, position = 'bottom', sectionName = '') {
  if (!indicators[position]) createIndicators();
  const indicator = indicators[position];
  const transformHide = position === 'bottom' ? 'translateY(100px)' : 'translateY(-100px)';

  if (sectionName) {
    const highlightSpan = indicator.querySelector('.indicator-highlight');
    if (highlightSpan) {
      const cleanName = sectionName.replace(/-/g, ' ');
      const icon = sectionIcons[sectionName] || sectionIcons.default;
      highlightSpan.innerHTML = `
        ${icon}
        ${cleanName}
      `;
    }
  }

  indicator.style.transform = show ? 'translateX(-50%) translateY(0)' : `translateX(-50%) ${transformHide}`;
  indicator.style.opacity = show ? '1' : '0';

  const progressBar = indicator.querySelector('.progress-bar');
  if (progressBar) progressBar.style.width = show ? `${Math.min(progress, 100)}%` : '0%';
}

// 2. LÓGICA DE TRANSICIÓN (Conectada a tu función global)
function changeSection(direction) {
  if (state.isScrolling) return;

  const activeSection = document.querySelector('.content-section:not(.hidden)');
  if (!activeSection) return;

  const currentIndex = sectionsOrder.indexOf(activeSection.id);
  const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  
  if (newIndex < 0 || newIndex >= sectionsOrder.length) return;

  const targetSectionId = sectionsOrder[newIndex];
  const targetSection = document.getElementById(targetSectionId);
  
  if (!targetSection) return;

  console.log(`🚀 Scroll activado: Navegando hacia ${targetSectionId}`);
  
  state.isScrolling = true;
  state.insistCount = 0;
  state.atBottom = false;
  state.atTop = false;
  
  updateIndicator(false, 0, 'bottom');
  updateIndicator(false, 0, 'top');

  // Cambiar URL silenciosamente
  history.pushState(null, '', `?${targetSectionId}`);
  
  // Llamar a tu función nativa para cargar datos y vistas
  try {
    if (typeof mostrarSeccionDesdesearch === 'function') {
      mostrarSeccionDesdesearch();
    } else {
      console.warn("mostrarSeccionDesdesearch no está definida globalmente.");
    }
  } catch (e) {
    console.error("Error al ejecutar mostrarSeccionDesdesearch:", e);
  }

  // Animación de entrada
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  const startY = direction === 'next' ? '20px' : '-20px';
  targetSection.style.opacity = '0';
  targetSection.style.transform = `translateY(${startY})`;
  targetSection.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

  requestAnimationFrame(() => {
    targetSection.style.opacity = '1';
    targetSection.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    state.isScrolling = false;
    targetSection.style.transition = '';
  }, 400);
}

// 3. DETECCIÓN DE LÍMITES Y FRENO
function handleIntent(direction) {
  if (state.isScrolling) return;

  const activeSection = document.querySelector('.content-section:not(.hidden)');
  if (!activeSection) return;

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;

  const isEdgeBottom = Math.ceil(scrollTop + clientHeight) >= (scrollHeight - 20);
  const isEdgeTop = scrollTop <= 20;

  if (direction === 'down' && isEdgeBottom) {
    handleEdge('bottom', true);
  } else if (direction === 'up' && isEdgeTop) {
    handleEdge('top', true);
  } else {
    if (state.atBottom || state.atTop) {
      state.atBottom = false; state.atTop = false; state.insistCount = 0;
      updateIndicator(false, 0, 'bottom'); updateIndicator(false, 0, 'top');
    }
  }
}

function handleEdge(edgeType, isAtEdge) {
  const isBottom = edgeType === 'bottom';
  const currentStateFlag = isBottom ? state.atBottom : state.atTop;
  const direction = isBottom ? 'next' : 'prev';
  const now = Date.now();

  const activeSection = document.querySelector('.content-section:not(.hidden)');
  if (!activeSection) return;
  const currentIndex = sectionsOrder.indexOf(activeSection.id);
  const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  
  if (targetIndex < 0 || targetIndex >= sectionsOrder.length) return;
  const targetSectionId = sectionsOrder[targetIndex];

  clearTimeout(state.scrollTimeout);

  if (!currentStateFlag) {
    if (isBottom) state.atBottom = true; else state.atTop = true;
    state.insistCount = 1;
    state.lastEdgeTime = now;
    
    updateIndicator(true, 30, edgeType, targetSectionId);
    
    state.scrollTimeout = setTimeout(() => {
      state.atBottom = false; state.atTop = false;
      updateIndicator(false, 0, edgeType);
    }, 1500);
  } else {
    // Freno de tiempo (150ms) para que no avance de golpe con scroll rápido
    if (now - state.lastEdgeTime < 150) {
      state.scrollTimeout = setTimeout(() => {
        state.atBottom = false; state.atTop = false;
        updateIndicator(false, 0, edgeType);
      }, 1500);
      return; 
    }

    state.lastEdgeTime = now;
    state.insistCount++;
    
    const progress = Math.min(45 + (state.insistCount * 15), 100);
    updateIndicator(true, progress, edgeType, targetSectionId);
    
    if (progress >= 100) {
      changeSection(direction);
    } else {
      state.scrollTimeout = setTimeout(() => {
        state.atBottom = false; state.atTop = false;
        updateIndicator(false, 0, edgeType);
      }, 1500);
    }
  }
}

// 4. LISTENERS (Ignorando sidebar y swipes horizontales)
window.addEventListener('wheel', (e) => {
  if (e.target.closest('.sidebar')) return;
  handleIntent(e.deltaY > 0 ? 'down' : 'up');
}, { passive: true });

let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => { 
  if (e.target.closest('.sidebar')) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY; 
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (e.target.closest('.sidebar')) return;
  
  const touchEndX = e.touches[0].clientX;
  const touchEndY = e.touches[0].clientY;

  const deltaX = Math.abs(touchEndX - touchStartX);
  const deltaY = Math.abs(touchEndY - touchStartY);

  // Si es movimiento horizontal, ignorar
  if (deltaX >= deltaY) return;

  handleIntent(touchStartY > touchEndY ? 'down' : 'up');
  
  touchStartX = touchEndX;
  touchStartY = touchEndY; 
}, { passive: true });

// 5. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  createIndicators();
});


// 1. Función para obtener los datos de caché de forma segura
function obtenerDatosContinuarViendo() {
  const userID = localStorage.getItem('userID') || "null";
  const cacheKey = `ultimosCapsVistosCache_${userID}`;
  
  try {
    const cachedData = localStorage.getItem(cacheKey);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (e) {
    console.error('Error al leer caché de capítulos:', e);
    return null;
  }
}

// 2. Controlador principal
function inicializarContinuarViendo() {
  console.log('Inicializando continuar viendo');
  const datos = obtenerDatosContinuarViendo();
  const container = document.getElementById('section-continuar-viendo');
  const gridPrincipal = document.getElementById('section-ultimos-caps-viendo');

  // Si no hay datos, ocultamos la sección o mostramos un mensaje vacío
  if (!datos || datos.length === 0) {
    if (container) container.classList.add('hidden');
    if (gridPrincipal) gridPrincipal.innerHTML = '<p class="empty-state">No tienes capítulos pendientes.</p>';
    return;
  }

  // Renderizar la vista principal estilo "Netflix/Crunchyroll" (Basado en tu imagen)
  if (container && gridPrincipal) {
    container.classList.remove('hidden');
    renderizarGridPrincipal(gridPrincipal, datos);
  }
}

// 3. Renderizado del Grid Principal (Diseño de la imagen)
function renderizarGridPrincipal(container, datos) {
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  
  datos.forEach(item => {
    // Calculamos el progreso falso o real si tienes el total de capítulos
    const total = item.totalCapitulos || 12; // Valor por defecto si no existe
    const capsVistos = (item.siguienteCapitulo || 1) - 1;
    const progresoPorcentaje = Math.min((capsVistos / total) * 100, 100);

    const card = document.createElement('a');
    card.className = 'continue-card anime-card';
    card.href = `ver.html?id=${item.id}&episode=${item.siguienteCapitulo}`;
    
    // Usamos Template Literals para estructurar el componente de forma limpia
    card.innerHTML = `
      <div class="card-thumbnail container-img">
        <img src="${item.portada}" alt="${item.titulo}" onerror="this.src='path/to/default/image.png'">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        <span class="chapter ep-badge">EP ${item.siguienteCapitulo}</span>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${progresoPorcentaje}%"></div>
        </div>
      </div>
      <div class="card-info">
        <h3 class="card-title">${item.titulo}</h3>
        <span class="card-meta">${capsVistos}/${total} eps</span>
      </div>
    `;
    
    fragment.appendChild(card);
  });
  
  container.appendChild(fragment);

  // Inicializar botones de scroll
  inicializarBotonesScroll(container);
}

function inicializarBotonesScroll(container) {
  // Buscar botones en el header (section-continuar-viendo)
  const headerSection = document.getElementById('section-continuar-viendo');
  const prevBtn = headerSection.querySelector('.scroll-btn-prev');
  const nextBtn = headerSection.querySelector('.scroll-btn-next');
  
  if (!prevBtn || !nextBtn) return;
  
  const scrollAmount = 660;
  
  prevBtn.addEventListener('click', () => {
    container.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
  });
  
  nextBtn.addEventListener('click', () => {
    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  });
  
  // Botones siempre visibles
  prevBtn.style.opacity = '1';
  prevBtn.style.pointerEvents = 'auto';
  
  nextBtn.style.opacity = '1';
  nextBtn.style.pointerEvents = 'auto';
}

// Boton de colapsar sidebar
const collapseBtn = document.getElementById('Collapse-aside');
if (collapseBtn) {
  // Recuperar estado guardado al cargar

  collapseBtn.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    // Guardar estado en localStorage
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  });
}
// Tooltip ultra-optimizado para producción v2
(() => {
    let tooltip = null;
    let activeElement = null;
    let rafId = null;
    let scrollTimeout = null;
    let observer = null;
    let isLargeScreen = false;
    let isSidebarCollapsed = false;

    const mediaQuery = window.matchMedia('(min-width: 601px)');
    isLargeScreen = mediaQuery.matches;

    const handleMediaChange = (e) => {
        isLargeScreen = e.matches;
        if (!isLargeScreen || !isSidebarCollapsed) hideTooltip();
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    const shouldShowTooltip = () => isLargeScreen && isSidebarCollapsed;

    const getTooltip = () => {
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            // Optimizacion CSS inline para asegurar que use transforms
            tooltip.style.top = '0';
            tooltip.style.left = '0';
            tooltip.style.willChange = 'transform, opacity'; // Le avisa a la GPU
            document.body.appendChild(tooltip);
        }
        return tooltip;
    };

    // Mostrar y posicionar tooltip en un solo RAF (Evita Layout Thrashing)
    const showTooltip = (element) => {
        if (!shouldShowTooltip()) return;
        
        const text = element.getAttribute('data-target');
        if (!text) return;

        const tooltipEl = getTooltip();
        tooltipEl.textContent = text.replace(/-/g, ' ');
        activeElement = element;

        if (rafId) cancelAnimationFrame(rafId);
        
        rafId = requestAnimationFrame(() => {
            // FASE DE LECTURA (Read)
            const rect = element.getBoundingClientRect();
            const tooltipHeight = tooltipEl.offsetHeight;
            
            const tooltipTop = rect.top + (rect.height / 2) - (tooltipHeight / 2);
            const tooltipLeft = rect.right + 15;
            
            // FASE DE ESCRITURA (Write) - Usamos translate3d para aceleración GPU
            tooltipEl.style.transform = `translate3d(${tooltipLeft}px, ${tooltipTop}px, 0)`;
            tooltipEl.classList.add('show');
        });
    };

    const hideTooltip = () => {
        if (tooltip) tooltip.classList.remove('show');
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        activeElement = null;
    };

    let lastScrollTime = 0;
    const SCROLL_THROTTLE = 100;

    const handleScroll = () => {
        const now = performance.now();
        if (now - lastScrollTime < SCROLL_THROTTLE) return;
        lastScrollTime = now;

        hideTooltip();
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (activeElement && shouldShowTooltip()) {
                showTooltip(activeElement);
            }
        }, 150);
    };

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('.menu-item');
        if (target && target !== activeElement) {
            showTooltip(target);
        }
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
        if (!activeElement) return;
        
        // Evita el bug de parpadeo si el cursor se mueve a un hijo del mismo botón
        const related = e.relatedTarget;
        if (related && activeElement.contains(related)) return;

        const target = e.target.closest('.menu-item');
        if (target === activeElement) {
            hideTooltip();
        }
    }, { passive: true });

    document.addEventListener('click', hideTooltip, { passive: true });

    // capture: true permite detectar scroll en contenedores internos (como el sidebar)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    let observerTimeout = null;
    observer = new MutationObserver(() => {
        clearTimeout(observerTimeout);
        observerTimeout = setTimeout(() => {
            isSidebarCollapsed = document.body.classList.contains('sidebar-collapsed');
            if (!shouldShowTooltip()) hideTooltip();
        }, 50);
    });
    
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    isSidebarCollapsed = document.body.classList.contains('sidebar-collapsed');

    const cleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (scrollTimeout) clearTimeout(scrollTimeout);
        if (observerTimeout) clearTimeout(observerTimeout);
        if (observer) observer.disconnect();
        mediaQuery.removeEventListener('change', handleMediaChange);
    };

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
})();