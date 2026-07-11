import { db, auth } from './firebase-login.js';
import {collection, doc, getDocs, getDoc, updateDoc, setDoc, query, orderBy, limit} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { observerAnimeCards, aplicarViewTransition } from './utils.js';

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
let directorioflvCargado = false;
let directorioJkCargado = false;
let labCargado = false;
let popularesCargados = false;
let horariosCargados = false;

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

const sectionConfig = {
  'Mis-Favoritos': { flag: () => favoritosCargados, setFlag: () => { favoritosCargados = true; }, load: () => cargarDatos(document.getElementById('favoritos'), doc(db, "usuarios", userID, "favoritos", "lista")) },
  'Viendo': { flag: () => viendoCargado, setFlag: () => { viendoCargado = true; }, load: () => cargarDatos(document.getElementById('viendo'), doc(db, "usuarios", userID, "estados", "viendo")) },
  'Pendientes': { flag: () => pendientesCargados, setFlag: () => { pendientesCargados = true; }, load: () => cargarDatos(document.getElementById('pendientes'), doc(db, "usuarios", userID, "estados", "pendiente")) },
  'Completados': { flag: () => completadosCargados, setFlag: () => { completadosCargados = true; }, load: () => cargarDatos(document.getElementById('completados'), doc(db, "usuarios", userID, "estados", "visto")) },
  'Ultimos-Episodios': { flag: () => ultimosCapsCargados, setFlag: () => { ultimosCapsCargados = true; }, load: () => { cargarUltimosCapitulos(); cargarhistorial(); } },
  'Continuar-viendo': { flag: () => continuarViendoCargado, setFlag: () => { continuarViendoCargado = true; }, load: () => cargarContinuarViendo() },
  'DirectorioFLV': { flag: () => directorioflvCargado, setFlag: () => { directorioflvCargado = true; }, load: () => cargarFetch("DirectorioFLV") },
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
  ])
  if(localStorage.getItem("ultimosCapsVistosCache_" + userID) === null) {
    document.getElementById("Continuar-viendo").innerHTML = '<span class="span-carga">Inicia sesión para ver los animes que estás viendo actualmente</span>'
  }
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
  btn.href = `ver.html?id=${itemData.id}&url=${itemData.siguienteCapitulo}`;
  
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
  spanEpisodio.textContent = `Ep. ${itemData.siguienteCapitulo}`;

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

  const renderizarBotones = (datos) => {
    ultimosCapsContainer.innerHTML = '';
    if (!datos || datos.length === 0) {
      ultimosCapsContainer.innerHTML = '<p>No tienes capítulos siguientes disponibles.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(itemData => {
      const btn = crearElementoSiguienteCapitulo(itemData);
      if (btn) fragment.appendChild(btn);
    });
    ultimosCapsContainer.appendChild(fragment);
  };

  if (!userID || userID === "null") {
    ultimosCapsContainer.innerHTML = '<p>Inicia sesión para ver tus últimos capítulos</p>';
    return;
  }

  const cacheKey = `ultimosCapsVistosCache_` + userID;
  const cacheStateKey = `estadoHistorialCache_` + userID; 
  
  let cachedData = null;
  let cachedState = null;

  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    const cachedStateString = localStorage.getItem(cacheStateKey);
    if (cachedDataString) cachedData = JSON.parse(cachedDataString);
    if (cachedStateString) cachedState = JSON.parse(cachedStateString);
  } catch (e) { 
    localStorage.removeItem(cacheKey); 
    localStorage.removeItem(cacheStateKey);
  }

  // 1. Render instantáneo desde caché
  if (cachedData && cachedData.length > 0) {
    console.log("DEBUG: Mostrando botones desde el caché temporalmente.");
    renderizarBotones(cachedData);
  }

  try {
    console.log("DEBUG: Buscando historial en Firebase...");
    const ref = collection(db, "usuarios", userID, "caps-vistos");
    const q = query(ref, orderBy('fechaAgregado', 'desc'), limit(8));
    const snap = await getDocs(q);

    if (snap.empty) {
      console.log("DEBUG: Historial vacío.");
      ultimosCapsContainer.innerHTML = '<p>No tienes capítulos vistos recientemente.</p>';
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheStateKey);
      return;
    }

    // 2. Extraemos el mapa EXACTO filtrando los que no tienen capítulos vistos (lo que pediste)
    const currentState = [];
    snap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const vistos = (data.episodiosVistos || []).map(Number);
      
      // Si NO está vacío, lo agregamos al estado actual. 
      // Si está vacío (no hay capítulos vistos), se ignora por completo.
      if (vistos.length > 0) {
        currentState.push({
          id: docSnap.id,
          ultimoVisto: Math.max(...vistos)
        });
      }
    });

    // 3. Comprobación estricta de estado
    if (cachedState && JSON.stringify(currentState) === JSON.stringify(cachedState)) {
      console.log("DEBUG: El historial no ha cambiado. Se detienen las descargas.");
      return; 
    }

    // 4. Si hay cambios, procedemos a buscar las portadas (solo de los que pasaron el filtro)
    console.log("DEBUG: Hay capítulos nuevos o cambios. Descargando datos de animes...");
    
    // Ahora mapeamos sobre currentState, ahorrando peticiones a animes sin caps vistos
    const animeRefs = currentState.map(cap => doc(db, "datos-animes", cap.id));
    const animeDocsSnap = await Promise.all(animeRefs.map(ref => getDoc(ref)));

    const freshData = currentState.map((cap, i) => {
      const animeDetails = animeDocsSnap[i].exists() ? animeDocsSnap[i].data() : null;
      if (!animeDetails) return null;

      // cap.ultimoVisto ya viene filtrado y seguro desde currentState
      const siguienteCapitulo = cap.ultimoVisto + 1;
      const episodios = Array.isArray(animeDetails.episodios) ? animeDetails.episodios : Object.values(animeDetails.episodios || {});
      const siguienteEpisodio = episodios.find(ep => Number(ep.number) === siguienteCapitulo);

      if (siguienteEpisodio) {
        return {
          id: cap.id,
          portada: animeDetails.portada,
          titulo: animeDetails.titulo,
          siguienteCapitulo: siguienteCapitulo,
          siguienteCapituloUrl: siguienteEpisodio.url
        };
      }
      return null;
    }).filter(Boolean);

    // 5. Render final y renovación de cachés
    renderizarBotones(freshData);
    localStorage.setItem(cacheKey, JSON.stringify(freshData));
    localStorage.setItem(cacheStateKey, JSON.stringify(currentState));

  } catch (error) {
    console.error('Error crítico en cargarUltimosCapsVistos:', error);
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
    
    if (anime.siguienteCapitulo) {chapterHtml = `<span id="chapter">Episodio ${anime.siguienteCapitulo}</span>`;}
    if (anime.estado) {if (anime.estado === 'En emision') {estadoHtml = `<span class="estado"><img src="../icons/circle-solid-blue.svg" alt="${anime.estado}">${anime.estado}</span>`;}
      else {estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="${anime.estado}">${anime.estado}</span>`;}
    }
    if (anime.rating) {ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;}
    
    if (siguienteEpisodioUrl) {linkbase = `<a href="ver.html?id=${anime.id}&url=${siguienteEpisodioUrl}">`;
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
            id: getIdFromUrl(anime.url),
            portada: anime.cover || '',
            titulo: anime.title || 'Sin título',
            siguienteCapitulo: anime.chapter?.toString() || ''
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
  
  const btnAnterior = container.querySelector('.ver-mas-btn');
  if (btnAnterior) {
    btnAnterior.textContent = "cargando...";
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
          animes.push({
            id: docSnap.id,
            titulo: data.titulo,
            portada: data.portada || data.banner,
            estado: data.estado || 'No disponible',
            rating: data.rating || null
          });
        } else {
          console.log(`No se encontró el anime con ID: ${id} en datos-animes, se eliminará de la lista`);
          idsNoEncontrados.push(id);
        }
      }
      
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
  }
}

async function cargarContinuarViendo() {
  const container = document.getElementById('continuar-viendo');
  const h2 = document.getElementById('continuarviendoh2');
  const cachekey = "ultimosCapsVistosCache_" + userID;
  if (!container) return;
  
  if(localStorage.getItem(cachekey) === null) {
    return;
  }
   let datos = JSON.parse(localStorage.getItem(cachekey));
   
   if (verificarYLimpiarCacheBackground(cachekey, datos, 'portada', null, true)) {
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
   
   h2.dataset.text = "Disponibles: " + datos.length;
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
  let touchStartX = 0;
  let touchEndX = 0;
  
  const handleSwipe = () => {
    if (sidebar.classList.contains("active")) {
      const dist = touchStartX - touchEndX;
      if (dist > 50) {
        sidebar.classList.remove("active")
        menuBtn.classList.remove("active")
      }
    }
  };
  
  document.addEventListener("touchstart", e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  document.addEventListener("touchend", e => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, { passive: true });

  const navigationMap = {
    'Ultimos-Episodios': { left: 'Populares', right: null },
    'Populares': { left: 'Continuar-viendo', right: 'Ultimos-Episodios' },
    'Continuar-viendo': { left: 'DirectorioJK', right: 'Populares' },
    'DirectorioJK': { left: 'Lab', right: 'Continuar-viendo' },
    'Lab': { left: null, right: 'DirectorioJK' }
  };
  
 const excepciones = [
  '.pagination',
  '#recomendaciones-favoritos',
  '#recomendaciones-personalizadas',
  '#sugerencias-sin-resultados',
  '#anime-grid-ia-busqueda'
 ]

function handleSectionNavigation(sectionId, direction) {
  const targetSection = navigationMap[sectionId]?.[direction];
  if (!targetSection) return false;

  history.replaceState(null, '', `?${targetSection}`);
  mostrarSeccionDesdesearch();
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
    if (this._touchData?.isPagination || this._touchData?.isException) return;
    
    const endX = e.changedTouches[0].screenX;
    const endY = e.changedTouches[0].screenY;
    const dx = endX - this._touchData.startX;
    const dy = Math.abs(endY - this._touchData.startY);
    
    const direction = Math.abs(dx) > 50 && dy < 35 
      ? dx < 0 ? 'left' : 'right' 
      : null;
    
    if (!direction) return;
    
    const sectionId = this.id;
    
    if (sidebar.classList.contains('active') && 
        sectionId === 'Ultimos-Episodios' && 
        direction === 'left') return;
    
    if (navigationMap[sectionId] && handleSectionNavigation(sectionId, direction)) {
      return;
    }
    
    if (direction === 'right' && !sidebar.classList.contains('active') && isMobile()) {
      sidebar.classList.add('active');
      menuBtn.classList.add('active');
      document.body.style.overflow = "hidden";
    }
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

const indexpagination = document.getElementById('indexpagination');



const NAV_POSITIONS = {
  TOP: 'top',
  BOTTOM: 'bottom',
  FLOATING: 'floating'
};

// toma primero localStorage, si no, usa la clase del HTML
let currentPosition =
  localStorage.getItem('indexpaginationPosition') ||
  [...indexpagination.classList].find(cls =>
    Object.values(NAV_POSITIONS).includes(cls)
  ) ||
  NAV_POSITIONS.TOP;

function applyNavigationPosition() {
  indexpagination.classList.remove('top', 'bottom', 'floating', 'fixed'); // 👈 importante

  indexpagination.classList.add(currentPosition);
}

// aplicar al iniciar
applyNavigationPosition();

// cambiar modo al hacer click en config
document.addEventListener('click', (e) => {
  if (e.target.closest('#config')) {

    if (currentPosition === NAV_POSITIONS.TOP) {
      currentPosition = NAV_POSITIONS.BOTTOM;
    } else if (currentPosition === NAV_POSITIONS.BOTTOM) {
      currentPosition = NAV_POSITIONS.FLOATING;
    } else {
      currentPosition = NAV_POSITIONS.TOP;
    }

    localStorage.setItem('indexpaginationPosition', currentPosition);
    applyNavigationPosition();
  }
});