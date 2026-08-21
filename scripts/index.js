import { db, auth } from './firebase-login.js';
import {collection, doc, getDocs, getDoc, updateDoc, setDoc, query, orderBy, limit, where} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { observerAnimeCards, aplicarViewTransition, crearAnimeCard } from './utils.js';

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

// Todas las siluetas viven en el mismo path para que MorphSVG pueda interpolarlas.
const iconosDeSeccion = {
  'Ultimos-Episodios': '',
  'Mis-Favoritos': 'M31.939 16.483C33.846 6.946 48.506 6.347 54.828 12.668c6.115 6.115 5.721 16.533 0 22.889L31.939 58.445 9.05 35.557C6.016 32.521 4.311 28.405 4.311 24.113S6.016 15.704 9.05 12.668c5.913-5.913 20.981-5.722 22.889 3.815Z',
  'Viendo': 'M61.154 32.474C61.154 39.122 48.256 52.419 32.344 52.419S3.534 39.122 3.534 32.474 16.432 12.529 32.344 12.529s28.81 13.297 28.81 19.945ZM43.425 32.474a11.081 11.081 0 1 1-22.162 0 11.081 11.081 0 0 1 22.162 0Z',
  'Pendientes': 'M32.315 21.509v14.371H44.89M3.571 32.287C3.571 48.162 16.44 61.031 32.315 61.031c15.874 0 28.743-12.869 28.743-28.744S48.189 3.544 32.315 3.544 3.571 16.413 3.571 32.287Z',
  'Completados': 'M19.663 32.285l9.542 9.543 15.904-19.085M61.014 32.285c0 15.811-12.817 28.628-28.628 28.628S3.759 48.096 3.759 32.285 16.576 3.658 32.386 3.658s28.628 12.817 28.628 28.627Z',
  'DirectorioJK': 'M11.196 14.616c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.848 21.432-10.781M11.196 32.477c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.847 21.432-10.78M11.196 13.566c0-4.644 8.931-9.792 21.432-9.667 12.501.125 21.432 5.547 21.432 10.191v36.773c0 4.644-8.931 10.192-21.432 10.192-12.501 0-21.432-6.073-21.432-10.717V13.566Z',
  'DirectorioAV1': 'M11.196 14.616c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.848 21.432-10.781M11.196 32.477c0 4.93 7.142 10.716 21.432 10.716 14.291 0 21.432-5.847 21.432-10.78M11.196 13.566c0-4.644 8.931-9.792 21.432-9.667 12.501.125 21.432 5.547 21.432 10.191v36.773c0 4.644-8.931 10.192-21.432 10.192-12.501 0-21.432-6.073-21.432-10.717V13.566Z',
  'Populares': 'M41.018 61.686c35.917-8.817 15.805-44.083-8.62-58.777-2.874 10.286-7.187 13.225-15.806 23.511C5.177 40.038 10.848 55.808 26.65 61.686c-2.395-2.939-8.573-9.111-4.313-17.633 1.47-2.939 4.408-5.878 2.941-11.755 2.874 1.469 8.816 2.939 10.284 10.285 2.394-2.939 4.881-9.11 2.581-16.163 17.993 13.224 10.644 26.449 2.875 35.266Z',
  'Recomendaciones': 'M28.523 44.492a10.247 10.247 0 0 0-4.125-4.125L6.789 35.826a1.644 1.644 0 0 1 0-2.761l17.61-4.544a10.25 10.25 0 0 0 4.125-4.122l4.541-17.61a1.645 1.645 0 0 1 2.764 0l4.537 17.61a10.25 10.25 0 0 0 4.125 4.125l17.61 4.538a1.644 1.644 0 0 1 0 2.767l-17.61 4.538a10.247 10.247 0 0 0-4.125 4.125l-4.541 17.61a1.645 1.645 0 0 1-2.764 0l-4.538-17.61ZM57.408 8.611v11.482M63.149 14.352H51.668M11.482 48.797v5.741M14.352 51.668H8.611',
  'Horarios': 'M60.288 37.363v-5.581c0-10.526 0-15.789-3.27-19.058-3.269-3.27-8.532-3.27-19.056-3.27M37.962 59.691H26.797c-10.525 0-15.787 0-19.057-3.27-3.27-3.269-3.27-8.532-3.27-19.057v-5.582c0-10.526 0-15.789 3.27-19.058 3.27-3.27 8.532-3.27 19.057-3.27M18.424 9.454V5.268M46.335 9.454V5.268M56.102 55.504l4.186 4.187M58.894 23.409H28.89M4.471 23.409h10.813M57.496 48.527a8.373 8.373 0 1 1-16.746 0 8.373 8.373 0 0 1 16.746 0Z',
  'Continuar-viendo': 'M32.3491 62.5454C49.026 62.5454 62.5454 49.0261 62.5454 32.3491C62.5454 15.6722 49.026 2.15283 32.3491 2.15283C15.6721 2.15283 2.15278 15.6722 2.15278 32.3491C2.15278 49.0261 15.6721 62.5454 32.3491 62.5454ZM32.3491 62.5454L64.0139 62.8491M33.0139 31.8491H32.0139M37.8315 15.8732C37.8315 18.901 35.3769 21.3556 32.3491 21.3556C29.3212 21.3556 26.8667 18.901 26.8667 15.8732C26.8667 12.8453 29.3212 10.3908 32.3491 10.3908C35.3769 10.3908 37.8315 12.8453 37.8315 15.8732ZM37.8315 48.825C37.8315 51.8528 35.3769 54.3074 32.3491 54.3074C29.3212 54.3074 26.8667 51.8528 26.8667 48.825C26.8667 45.7971 29.3212 43.3426 32.3491 43.3426C35.3769 43.3426 37.8315 45.7971 37.8315 48.825ZM21.3556 32.3491C21.3556 35.3769 18.901 37.8315 15.8731 37.8315C12.8453 37.8315 10.3907 35.3769 10.3907 32.3491C10.3907 29.3212 12.8453 26.8667 15.8731 26.8667C18.901 26.8667 21.3556 29.3212 21.3556 32.3491ZM54.3074 32.3491C54.3074 35.3769 51.8529 37.8315 48.825 37.8315C45.7972 37.8315 43.3426 35.3769 43.3426 32.3491C43.3426 29.3212 45.7972 26.8667 48.825 26.8667C51.8529 26.8667 54.3074 29.3212 54.3074 32.3491Z'
};

function animarSVGCambio(nuevaSeccionId) {
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
let preferenciasCargadas = false;

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

  // Animar SVGs antes de cambiar de sección
  animarSVGCambio(id);

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
  'Recomendaciones': { flag: () => labCargado, setFlag: () => { labCargado = true; }, load: () => cargarFetch("Recomendaciones") },
  'Preferencias': { flag: () => preferenciasCargadas, setFlag: () => { preferenciasCargadas = true; }, load: () => cargarFetch("preferencias") },
  'Populares': { flag: () => popularesCargados, setFlag: () => { popularesCargados = true; }, load: () => cargarFetch("populares") },
  'Horarios': { flag: () => horariosCargados, setFlag: () => { horariosCargados = true; }, load: () => cargarFetch("horarios") }
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
      const targetId = e.currentTarget.getAttribute('data-target');
      if (!targetId) return;
      history.replaceState(null, '', `?${targetId}`);
      mostrarSeccionDesdesearch();
      // Centrar el elemento en la navegación con un pequeño delay
      if (typeof centrarElementoEnVista === 'function') {
        centrarElementoEnVista(targetId);
      }
    });
  });
});

function crearElementoSiguienteCapitulo(itemData) {
  const btn = document.createElement('a');
  btn.className = 'btn-siguiente-capitulo';
  btn.href = `/ver?id=${itemData.id}&episode=${itemData.siguienteCapitulo}`;
  
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
    btn.getElementsByClassName("texto-2-lineas")[0].style.setProperty('view-transition-name', 'title-' + itemData.id);
    btn.getElementsByClassName("portada-anime")[0].style.setProperty('view-transition-name', itemData.id + '-' + itemData.siguienteCapitulo);
    btn.getElementsByClassName("texto-episodio")[0].style.setProperty('view-transition-name', 'episodio-' + itemData.id);
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
  const url1 = `/anime?id=${id}`;
  const url2 = `/ver?id=${id}&episode=1`;
  const synopsisCompleta = (anime.synopsis || '').replace(/<[^>]*>/g, '').trim();

  const badges = [
    getEstadoBadge(anime.estado),
    (index === 0 && anime.estado !== 'Por estrenar') ? '<span class="hero-badge hero-badge--new">Reciente</span>' : ''
  ].filter(Boolean).join('');

  const slide = document.createElement('article');
  slide.className = `hero-slide ${index === 0 ? 'active' : ''}`;
  slide.dataset.index = index;
  slide.dataset.id = id;
  slide.style.setProperty('--bg-image', `url('${anime.cover || ''}')`);
  
  slide.innerHTML = `
  <div class="hero-background">
    <div class="hero-slide__bg" style="background-image:url('${anime.cover || ''}')"></div>
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
      const isVerAhora = link.classList.contains('hero-btn--primary');
      
      slide.querySelector('.hero-slide__title')?.style.setProperty('view-transition-name', 'title-' + id);
      
      if (isVerAhora) {
        // Botón "Ver ahora": usa id + "-1" para el bg
        slide.querySelector('.hero-slide__bg')?.style.setProperty('view-transition-name', id + '-1');
      } else {
        // Botón "Más información": usa cover- + id para el bg
        slide.querySelector('.hero-slide__bg')?.style.setProperty('view-transition-name', 'cover-' + id);
      }
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
      
        const fragment = document.createDocumentFragment();
        datos.forEach(anime => {
          const card = crearAnimeCard({
            id: anime.id,
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
  const historialheader = document.getElementById('header-section-historial');
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
          rating: datos.rating || '',
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
    
    historialheader.classList.remove('hidden');
    historialContainer.classList.remove('hidden');
    
    // ----------------------------------------------------
    // Modificación: Integrado renderFlipOptimizado
    // ----------------------------------------------------
    renderFlipOptimizado(historialContainer, () => {
      historialContainer.innerHTML = '';
      const fragment = document.createDocumentFragment();
      animesAMostrar.forEach(anime => {
        const card = crearAnimeCard(anime);
        if (card) fragment.appendChild(card);
      });
      historialContainer.appendChild(fragment);
    });
    
    observerAnimeCards();
  } else {
    historialheader.classList.add('hidden');
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
        const card = crearAnimeCard(anime);
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
      agregarAnimesAlContenedor(cachedData, container);
      h2.dataset.text = cachedData.length;
    }
  }

  try {
      const Doc = await getDoc(DocRef);
      let titulos = Doc.exists() ? [...(Doc.data().animes || [])].filter(titulo => titulo != null).reverse() : [];
      h2.dataset.text = titulos.length;

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
              const card = crearAnimeCard(anime);
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
      // Si hay cache, no mostrar error offline
      if (!cachedData || cachedData.length === 0) {
      container.innerHTML = '<p>Error al cargar los favoritos</p>';
      }
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
  h2.dataset.text = datos.length;
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
       container.appendChild(crearAnimeCard(data, data.siguienteCapitulo));
     });
    });
    observerAnimeCards();
   
  }

function cargarFetch(direccion) {
  const sectionId = direccion.charAt(0).toUpperCase() + direccion.slice(1);
  const main = document.getElementById(sectionId);
  if (!main) return;
  const recursos = {
    DirectorioAV1: 'directorioav1',
    DirectorioJK: 'directoriojk',
    Recomendaciones: 'Recomendaciones',
    populares: 'populares',
    horarios: 'horarios',
    preferencias: 'preferencias'
  };
  const recurso = recursos[direccion] || direccion;

  fetch(recurso + '.html')
    .then(res => res.text())
    .then(html => {
      const temp = document.createElement('div');
      temp.innerHTML = html;

      const nuevoMain = temp.querySelector('main');
      if (nuevoMain) {
        // // El icono principal ya está fuera de las secciones; quitamos solo el del header principal cargado.
        // const headerCargado = nuevoMain.querySelector(':scope > .headder-section');
        // if (headerCargado) {
        //   headerCargado.querySelector(':scope > svg, :scope > div > svg')?.remove();
        //   headerCargado.classList.add('header-icon-extracted');
        // }
        main.innerHTML = nuevoMain.innerHTML;
      }

      const script = document.createElement('script');
      script.src = '/scripts/' + recurso + '.js';
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
  document.querySelector(".sidebar")?.classList.remove("active");
  document.getElementById("menu-toggle")?.classList.remove("active");
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
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
    '#anime-grid-ia-busqueda', '#filtro-letras-av1', '#section-ultimos-caps-viendo'
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
  const seccionesPermitidas = ['Ultimos-Episodios', 'Mis-Favoritos', 'Viendo', 'Pendientes', 'Completados'];

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
    'Ultimos-Episodios': { left: 'DirectorioJK' },
    'Mis-Favoritos': { left: null, right: null },
    'Viendo': { left: null, right: null },
    'Pendientes': { left: null, right: null },
    'Completados': { left: null, right: null },
    'DirectorioJK': { left: 'Recomendaciones', right: 'Ultimos-Episodios' },
    'DirectorioAV1': { left: 'Recomendaciones', right: 'Ultimos-Episodios' },
    'Recomendaciones': { left: 'Populares', right: 'DirectorioJK' },
    'Preferencias': { left: 'Ultimos-Episodios', right: 'Horarios' },
    'Populares': { left: 'Horarios', right: 'Recomendaciones' },
    'Horarios': { right: 'Populares', left: 'Continuar-viendo' },
    'Continuar-viendo': { right: 'Horarios' }
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
// 1. SCRIPT DE SCROLL AUTOMÁTICO ENTRE SECCIONES
// =========================================
const sectionsOrder = [
  'Ultimos-Episodios', 'Mis-Favoritos', 'Viendo', 'Pendientes',
  'Completados', 'DirectorioJK', 'DirectorioAV1', 'Recomendaciones', 'Populares', 'Horarios', 'Preferencias', 'Continuar-viendo'
];

const state = { scrolling: false, timer: null, insist: 0, edge: null, lastTime: 0 };
const inds = { bottom: null, top: null };

const getIcon = (name) => {
  const svg = document.querySelector(`.sidebar .menu-item[data-target="${name}"] svg`);
  if (svg) {
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', '16');
    clone.setAttribute('height', '16');
    clone.style.cssText = 'margin-right: 4px; vertical-align: text-bottom;';
    return clone.outerHTML;
  }
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: text-bottom;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
};

const updateIndicator = (show, progress = 0, pos = 'bottom', name = '') => {
  if (!inds[pos]) {
    inds[pos] = document.createElement('div');
    inds[pos].className = `section-change-indicator ${pos}`;
    inds[pos].innerHTML = `
      <div class="indicator-text">${pos === 'bottom' ? 'Siguiente' : 'Anterior'}: <span class="indicator-highlight"></span></div>
      <div class="indicator-action"><span class="action-text">Ir ahora &rarr;</span><div class="progress-bar"></div></div>`;
    inds[pos].querySelector('.indicator-action').onclick = () => changeSection(pos === 'bottom' ? 'next' : 'prev');
    document.body.appendChild(inds[pos]);
  }
  
  const el = inds[pos];
  if (name) el.querySelector('.indicator-highlight').innerHTML = `${getIcon(name)} ${name.replace(/-/g, ' ')}`;
  
  el.style.transform = `translateX(-50%) translateY(${show ? '0' : (pos === 'bottom' ? '100px' : '-100px')})`;
  el.style.opacity = show ? '1' : '0';
  el.querySelector('.progress-bar').style.width = show ? `${Math.min(progress, 100)}%` : '0%';
};

const changeSection = (dir) => {
  if (state.scrolling) return;
  const active = document.querySelector('.content-section:not(.hidden)');
  if (!active) return;

  const nextIdx = sectionsOrder.indexOf(active.id) + (dir === 'next' ? 1 : -1);
  const target = document.getElementById(sectionsOrder[nextIdx]);
  if (!target) return;

  state.scrolling = true; state.insist = 0; state.edge = null;
  updateIndicator(false, 0, 'bottom'); updateIndicator(false, 0, 'top');
  
  history.pushState(null, '', `?${target.id}`);
  
  // Llamar a la función directamente (está exportada como módulo ES6)
  if (typeof mostrarSeccionDesdesearch === 'function') {
    mostrarSeccionDesdesearch();
  } else if (window.mostrarSeccionDesdesearch) {
    window.mostrarSeccionDesdesearch();
  }
  
  window.scrollTo({ top: 0, behavior: 'instant' });

  target.style.cssText = `opacity:0; transform:translateY(${dir === 'next' ? '20px' : '-20px'}); transition:opacity 0.4s ease, transform 0.4s ease`;
  
  requestAnimationFrame(() => {
    target.style.opacity = '1'; 
    target.style.transform = 'translateY(0)';
  });

  setTimeout(() => { state.scrolling = false; target.style.transition = ''; }, 400);
};

const handleEdge = (type, targetId) => {
  const now = Date.now();
  clearTimeout(state.timer);

  if (state.edge !== type) {
    state.edge = type; state.insist = 1; state.lastTime = now;
    updateIndicator(true, 30, type, targetId);
  } else {
    if (now - state.lastTime < 150) {
      state.timer = setTimeout(() => {
        state.edge = null;
        updateIndicator(false, 0, type);
      }, 1500);
      return;
    }
    
    state.lastTime = now;
    const progress = Math.min(45 + (++state.insist * 15), 100);
    updateIndicator(true, progress, type, targetId);
    
    if (progress >= 100) {
      changeSection(type === 'bottom' ? 'next' : 'prev');
      return;
    }
  }
  state.timer = setTimeout(() => {
    state.edge = null;
    updateIndicator(false, 0, type);
  }, 1500);
};

const handleIntent = (dir) => {
  if (state.scrolling) return;
  const top = window.pageYOffset || document.documentElement.scrollTop;
  const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const active = document.querySelector('.content-section:not(.hidden)');
  
  if (!active) return;
  const idx = sectionsOrder.indexOf(active.id);
  
  // Calcular el índice de la sección objetivo
  const targetIdx = dir === 'down' ? idx + 1 : idx - 1;
  const targetId = sectionsOrder[targetIdx];

  if (dir === 'down' && top >= max - 20 && targetId) {
    handleEdge('bottom', targetId);
  } else if (dir === 'up' && top <= 20 && targetId) {
    handleEdge('top', targetId);
  } else if (state.edge) {
    state.edge = null; state.insist = 0;
    updateIndicator(false, 0, 'bottom'); updateIndicator(false, 0, 'top');
  }
};

let startX = 0, startY = 0;
const isSidebar = e => e.target.closest('.sidebar');
const isSection = e => e.target.closest('.content-section');

// Lógica para scroll automático con wheel
window.addEventListener('wheel', e => {
  if (!isSidebar(e)) {
    handleIntent(e.deltaY > 0 ? 'down' : 'up');
  }
}, { passive: true });

// Lógica táctil separada para scroll vertical (NO interferir con navegación horizontal)
window.addEventListener('touchstart', e => {
  // Solo iniciar seguimiento si NO estamos en una sección con navegación horizontal
  if (!isSidebar(e) && !isSection(e)) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }
}, { passive: true });

window.addEventListener('touchmove', e => {
  if (isSidebar(e) || isSection(e)) return; // Ignorar si estamos en sidebar o sección
  
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  const dx = Math.abs(currentX - startX);
  const dy = Math.abs(currentY - startY);
  
  // Solo procesar si es movimiento vertical significativo (scroll)
  if (dy > 10 && dy > dx) {
    handleIntent(startY > currentY ? 'down' : 'up');
  }
}, { passive: true });

// Resetear coordenadas al terminar el touch
window.addEventListener('touchend', () => {
  startX = 0;
  startY = 0;
}, { passive: true });


// =========================================
// 2. CONTINUAR VIENDO & SIDEBAR
// =========================================
function inicializarContinuarViendo() {
  const data = JSON.parse(localStorage.getItem(`ultimosCapsVistosCache_${localStorage.getItem('userID') || 'null'}`) || 'null');
  const container = document.getElementById('section-continuar-viendo');
  const grid = document.getElementById('section-ultimos-caps-viendo');

  if (!data?.length) {
    container?.classList.add('hidden');
    if (grid) grid.innerHTML = '<p class="empty-state">No tienes capítulos pendientes.</p>';
    return;
  }

  if (container && grid) {
    container.classList.remove('hidden');
    grid.innerHTML = data.map(item => {
      const total = item.totalCapitulos || 12;
      const capsVistos = Math.max((item.siguienteCapitulo || 1) - 1, 1);
      
      return `
        <a class="continue-card anime-card" href="/ver?id=${item.id}&episode=${item.siguienteCapitulo}" data-id="${item.id}" data-episode="${item.siguienteCapitulo}">
          <div class="card-thumbnail container-img">
            <img src="${item.portada}" alt="${item.titulo}" onerror="this.src='path/to/default/image.png'">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
            <span class="chapter ep-badge">EP ${item.siguienteCapitulo}</span>
          </div>
          <div class="card-info">
          <div class="progress-track"><div class="progress-fill" style="width: ${Math.min((capsVistos/total)*100, 100)}%"></div></div>
            <strong>${item.titulo}</strong>
            <span class="card-meta">${capsVistos}/${total} eps</span>
          </div>  
        </a>`;
    }).join('');
    
    // Agregar view transitions a las tarjetas de continuar viendo
    grid.querySelectorAll('.continue-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const episode = card.dataset.episode;
        const title = card.querySelector('strong');
        const img = card.querySelector('.card-thumbnail img');
        
        if (title) title.style.setProperty('view-transition-name', 'title-' + id);
        if (img) img.style.setProperty('view-transition-name', id + '-' + episode);
      });
    });

    // Inicializar botones scroll
    ['prev', 'next'].forEach(dir => {
      const btn = container.querySelector(`.scroll-btn-${dir}`);
      if (btn) {
        btn.style.cssText = 'opacity: 1; pointer-events: auto;';
        btn.onclick = () => grid.scrollBy({ left: dir === 'next' ? 660 : -660, behavior: 'smooth' });
      }
    });
  }
}

document.getElementById('Collapse-aside')?.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('sidebarCollapsed', document.body.classList.contains('sidebar-collapsed'));
});


// =========================================
// 3. TOOLTIP ULTRA-OPTIMIZADO V2
// =========================================
(() => {
  let tooltip, active, rafId, timer, obs;
  let isLarge = window.matchMedia('(min-width: 601px)').matches;
  let isCollapsed = document.body.classList.contains('sidebar-collapsed');

  const hide = () => {
    tooltip?.classList.remove('show');
    active = null;
    if (rafId) cancelAnimationFrame(rafId);
  };

  const show = (el) => {
    if (!isLarge || !isCollapsed || !el.closest('.sidebar') || !el.dataset.target) return;
    
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip';
      tooltip.style.cssText = 'top:0; left:0; will-change: transform, opacity;';
      document.body.appendChild(tooltip);
    }

    tooltip.textContent = el.dataset.target.replace(/-/g, ' ');
    active = el;
    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      tooltip.style.transform = `translate3d(${rect.right + 15}px, ${rect.top + (rect.height - tooltip.offsetHeight)/2}px, 0)`;
      tooltip.classList.add('show');
    });
  };

  window.matchMedia('(min-width: 601px)').addEventListener('change', e => { isLarge = e.matches; if(!isLarge) hide(); });
  
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    if (performance.now() - lastScroll < 100) return;
    lastScroll = performance.now();
    hide();
    clearTimeout(timer);
    timer = setTimeout(() => active && show(active), 150);
  }, { passive: true, capture: true });

  document.addEventListener('mouseover', e => { const t = e.target.closest('.menu-item'); if (t && t !== active) show(t); }, { passive: true });
  document.addEventListener('mouseout', e => {
    if (active && (!e.relatedTarget || !active.contains(e.relatedTarget)) && e.target.closest('.menu-item') === active) hide();
  }, { passive: true });
  document.addEventListener('click', hide, { passive: true });

  obs = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { isCollapsed = document.body.classList.contains('sidebar-collapsed'); if(!isCollapsed) hide(); }, 50);
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const cleanup = () => { hide(); clearTimeout(timer); obs.disconnect(); };
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);
})();
