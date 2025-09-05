import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";
import { observerAnimeCards, aplicarViewTransition } from "./utils.js";

// Inicializar Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let id = new URLSearchParams(location.search).get("id");

document.title = "AniZen - " + id;

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
  // Primero verificar si el anime ya existe en caché
  const existingData = localStorage.getItem(getCacheKey(id));
  const existingAnime = existingData ? JSON.parse(existingData) : null;
  
  // Si existe y tiene fecha de caché, usar esa fecha
  const fechaActualizacion = existingAnime?._cachedAt || Date.now();
  const toCache = { ...anime, _cachedAt: fechaActualizacion };
  localStorage.setItem(getCacheKey(id), JSON.stringify(toCache));
  
  // Verificar y mantener solo los 10 animes más recientes
  const animes = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('anime_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data._cachedAt) { // Verificar que el objeto existe y tiene fecha
          animes.push({ id: key, fecha: data._cachedAt });
        }
      } catch (e) {
        console.error(`Error al procesar anime ${key}:`, e);
        localStorage.removeItem(key); // Eliminar datos corruptos
      }
    }
  }

  // Si hay más de 5 animes, eliminar los más viejos
  if (animes.length > 20) {
    try {
      // Ordenar animes por fecha (de más nuevo a más viejo)
      const animesOrdenados = animes.sort((a, b) => b.fecha - a.fecha);
      // Eliminar todos los animes más allá del límite
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

function quitarTildesYEspacios(texto) {
  return texto
    .normalize('NFD')                   // Descompone los caracteres con tilde
    .replace(/[\u0300-\u036f]/g, '')   // Elimina las tildes
    .replace(/ /g, '-')                // Reemplaza espacios por guiones
    .toLowerCase(); //todo minuscula
}

const renderGeneros = (container, generos) => {
  container.innerHTML = '';
  if (generos && generos.length) {
    generos.slice(0, 5).forEach(g => {
      const a = document.createElement('a');
      a.textContent = g;
      a.className = 'genre-link';
      // Convertir 'aventuras' a 'aventura' para la URL
      const generoUrl = g.toLowerCase() === 'aventuras' ? 'aventura' : g;
      a.href = `index.html?Directorio&genre[]=${quitarTildesYEspacios(generoUrl)}`;


      container.appendChild(a);
    });
  } else {
    container.textContent = 'Géneros no disponibles.';
  }
};

// Renderizar relacionados
let isRendering = false;

async function renderRelacionados(anime) {
  const relacionadosContainer = document.getElementById('animes-relacionados');
  const relacionadosSection = document.getElementById('relacionados');
  const initLoading = document.getElementById('init-loading-relacionados');
  
  // Validaciones iniciales
  if (!relacionadosContainer || !anime?.relacionados?.length) {
    if (relacionadosSection) relacionadosSection.style.display = 'none';
    return;
  }

  // Prevenir múltiples renderizados simultáneos
  if (isRendering) return;
  isRendering = true;

  // Mostrar sección y loading
  if (relacionadosSection) relacionadosSection.style.display = 'flex';
  if (initLoading) initLoading.style.display = 'block';
  relacionadosContainer.innerHTML = '';

  try {
    // Crear un Set para evitar duplicados
    const titulosUnicos = new Set();
    const relacionesUnicas = anime.relacionados.filter(rel => {
      const esUnico = !titulosUnicos.has(rel.title);
      if (esUnico) titulosUnicos.add(rel.title);
      return esUnico;
    });
    // Hacer todas las peticiones en paralelo
    const resultados = await Promise.allSettled(
      relacionesUnicas.map(relacionado => 
        fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(relacionado.title)}`)
          .then(res => res.ok ? res.json() : Promise.reject(`HTTP Error: ${res.status}`))
          .then(data => ({
            data: data.data?.[0],
            relation: relacionado.relation
          }))
      )
    );

    // Crear fragmento para mejor rendimiento
    const fragment = document.createDocumentFragment();
    const idsAgregados = new Set();

    resultados.forEach(({ status, value }, index) => {
      if (status === 'fulfilled' && value?.data && !idsAgregados.has(value.data.id)) {
        idsAgregados.add(value.data.id);
        const card = crearAnimeCard(value.data);
        const relationSpan = document.createElement('span');
        relationSpan.className = 'relation-tag';
        relationSpan.textContent = value.relation;
        card.appendChild(relationSpan);
        if (card) {
        fragment.appendChild(card);
        }
      }
    });
    
    if (fragment.children.length > 0) {
    relacionadosContainer.appendChild(fragment);
    observerAnimeCards();
    }
    else {
      if (relacionadosSection) relacionadosSection.style.display = 'none';
    }
  } catch (error) {
    
    if (relacionadosSection) relacionadosSection.style.display = 'none';
    console.error('Error al cargar animes relacionados:', error);
  } finally {
    if (initLoading) initLoading.style.display = 'none';
    isRendering = false;
  }
}

function crearAnimeCard(anime) {
  const div = document.createElement('div');
  let ratingHtml = '';
  if (anime.rating) {
    ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
  }
  div.className = 'anime-card';
  div.style.setProperty('--cover', `url(${anime.cover})`);
  div.innerHTML = `
  <a href="anime.html?id=${anime.id}" id="anime-${anime.id}">
  <div class="container-img">
    <img src="${anime.cover}" class="cover" alt="${anime.title || anime.name}">
    <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
    ${ratingHtml}
    <span class="estado">${anime.type}</span>
  </div>
  <strong>${anime.title || anime.name}</strong>
</a>`;
  div.addEventListener('click', () => {
    aplicarViewTransition(anime.id, ratingHtml);
  });
  return div;
}
const renderAnime = anime => {
  anime.estado === "En emision"
  ? (statusEl.innerHTML = `<img src="../icons/circle-solid-blue.svg">${anime.estado}`, statusEl.classList.add("en-emision"))
  : (statusEl.innerHTML = `<img src="../icons/circle-solid.svg">${anime.estado}`, statusEl.classList.remove("en-emision"));

  tituloEl.textContent = anime.titulo;
  document.getElementById("portadacarga").classList.add("cargado");
  portadaEl.src = anime.portada;
  document.body.style.backgroundImage = `url(${anime.portada})`;
  descripcionEl.textContent = anime.descripcion;
  renderGeneros(generoContainer, anime.generos);
  ratingEl.textContent = anime.rating + "/5";
  crearBotonesEpisodios(anime);
  renderRelacionados(anime);
};

actualizarEstadoFavorito()
const getAnchoColumna = () => {
  const li = capContenedor.querySelector('li');
  return li ? li.getBoundingClientRect().width : 0;
};

const debounce = (fn, delay = 200) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const createEpisodeButton = (ep, vistos = []) => {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  const visto = vistos.includes(ep.number.toString());
  btn.className = `episode-btn ${visto ? 'ep-visto' : 'ep-no-visto'}`;
  btn.textContent = `Episodio ${ep.number || ep.title || 'desconocido'}`;

  const icon = document.createElement('img');
  icon.className = 'icon-eye';
  icon.src = visto ? '/icons/eye-solid.svg' : '/icons/eye-slash-solid.svg';
  icon.alt = 'visto';

  btn.appendChild(icon);
  li.appendChild(btn);

  btn.addEventListener('click', async () => {
    if (btn.classList.contains("ep-no-visto")) {
      await manejarEstadoEpisodio(btn, icon, ep);
    }
    window.location.href = `ver.html?id=${id}&url=${ep.number}`;
  });

  icon.addEventListener('click', e => {
    e.stopPropagation();
    manejarEstadoEpisodio(btn, icon, ep);
  });

  return li;
};

async function crearBotonesEpisodios(anime) {
  capContenedor.innerHTML = '';
  const episodios = Array.isArray(anime.episodios) ? anime.episodios : [];
  const vistos = await obtenerCapitulosVistos(id) || [];
  const fragment = document.createDocumentFragment();
  episodios.forEach(ep => fragment.appendChild(createEpisodeButton(ep, vistos)));
  capContenedor.appendChild(fragment);

  if (initLoadingCap) initLoadingCap.style.display = 'none';
  if (episodios.length > 0) {
    actualizarProgresoCapitulos(episodios.length, vistos);
  }

  capContenedor.classList.add("cargado");
  capContenedor.style.setProperty("--caps", episodios.length);
  
  setTimeout(() => {
    capContenedor.style.overflowX = "auto";
    // Desplazar al primer episodio no visto
    const primerNoVisto = capContenedor.querySelector('.episode-btn.ep-no-visto');
    if (primerNoVisto) {
      const targetElement = primerNoVisto.parentElement;
      if (targetElement) { 
      const anchoColumna = typeof getAnchoColumna === 'function' ? getAnchoColumna() : 0; 

      if (anchoColumna && anchoColumna > 0) {
        const columnaDelTarget = Math.floor(targetElement.offsetLeft / anchoColumna);
        let scrollToX = columnaDelTarget * anchoColumna;
        
        const maxScroll = capContenedor.scrollWidth - capContenedor.clientWidth;
        scrollToX = Math.max(0, Math.min(scrollToX, maxScroll));

        capContenedor.scrollTo({
          left: scrollToX,
          behavior: 'smooth'
        });
      } else {
        let scrollToX = targetElement.offsetLeft;
        const maxScroll = capContenedor.scrollWidth - capContenedor.clientWidth;
        scrollToX = Math.max(0, Math.min(scrollToX, maxScroll));

        capContenedor.scrollTo({
          left: scrollToX,
          behavior: 'smooth'
        });
      }
    }
  }
}, 500);
}

capContenedor.addEventListener('wheel', e => {
  e.preventDefault();
  const ancho = getAnchoColumna();
  if (!ancho) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  const curr = capContenedor.scrollLeft;
  const col = Math.round(curr / ancho);
  const target = (col + dir) * ancho;
  capContenedor.scrollTo({ left: Math.max(0, Math.min(target, capContenedor.scrollWidth - ancho)), behavior: 'smooth' });
}, { passive: false });

let scrollTimeout;
capContenedor.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const ancho = getAnchoColumna();
    if (!ancho) return;
    const col = Math.round(capContenedor.scrollLeft / ancho);
    capContenedor.scrollTo({ left: col * ancho, behavior: 'smooth' });
  }, 100);
});

filtroCapitulo.addEventListener('input', debounce(() => {
  const filtro = filtroCapitulo.value.toLowerCase();
  const botones = capContenedor.querySelectorAll('.episode-btn');
  const idx = Array.from(botones).findIndex(btn => btn.textContent.toLowerCase().includes(filtro));
  if (idx >= 0) botones[idx].parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));

async function manejarEstadoEpisodio(btn, icon, ep) {
  const user = localStorage.getItem("userID");
  if (!user) {
    console.warn('manejarEstadoEpisodio: No hay usuario autenticado.');
    window.alert('Inicia sesión para guardar tu progreso de capítulos, animes y mucho más!.');
    return;
  }
  const nuevo = !btn.classList.contains('ep-visto');
  btn.classList.toggle('ep-visto', nuevo);
  btn.classList.toggle('ep-no-visto', !nuevo);
  icon.src = nuevo ? '/icons/eye-solid.svg' : '/icons/eye-slash-solid.svg';
  try {
    const titulo = tituloEl.textContent;
    await toggleCapituloVisto(id, titulo, ep.number, nuevo);
  } catch (e) {
    console.error(e);
  }
}

async function toggleCapituloVisto(animeId, titulo, episodio, esVisto) {
  const user = localStorage.getItem("userID");
  const ref = doc(db, 'usuarios', user, 'caps-vistos', animeId);
  const snap = await getDoc(ref);
  let arr = snap.exists() ? snap.data().episodiosVistos || [] : [];
  arr = esVisto ? Array.from(new Set([...arr, episodio.toString()])) : arr.filter(x => x !== episodio.toString());
  await setDoc(ref, { titulo, fechaAgregado: serverTimestamp(), episodiosVistos: arr });
  actualizarProgresoCapitulos(document.querySelectorAll('.episode-btn').length, arr);
}

async function obtenerCapitulosVistos(animeId) {
  return new Promise((resolve, reject) => { 
    const fetchChaptersLogic = async (userInstance) => {
      if (!userInstance) {
        console.warn("obtenerCapitulosVistos: No hay instancia de usuario. Retornando [].");
        resolve([]); 
        return;
      }
      try {
        const ref = doc(db, 'usuarios', userInstance.uid, 'caps-vistos', animeId);
        const snap = await getDoc(ref);
        resolve(snap.exists() ? snap.data().episodiosVistos || [] : []); 
      } catch (error) {
        console.error("Error al obtener capítulos vistos:", error);
        reject(error); 
      }
    };

    let resolved = false; 
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); 
      if (!resolved) {
        resolved = true;
        await fetchChaptersLogic(user); 
      }
    }, (error) => {
      if (!resolved) {
         resolved = true;
         console.error("Error en onAuthStateChanged:", error);
         reject(error); 
         unsubscribe(); 
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe(); 
        console.warn("obtenerCapitulosVistos timed out esperando estado de auth. Retornando [].");
        resolve([]); 
      }
    }, 10000); 
  });
}

//comparar datos antes de jecutar renderAnime
function compararDatos(a, b) {
  // Validación rápida de nulos/undefined
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  // Función de comparación rápida de strings
  const strEqual = (str1, str2) => 
    String(str1 || '').trim() === String(str2 || '').trim();

  // Comparación de campos básicos (validación temprana)
  const camposBasicos = [
    ['titulo', strEqual],
    ['portada', strEqual],
    ['descripcion', strEqual],
    ['rating', strEqual],
    ['estado', strEqual]
  ];

  if (camposBasicos.some(([campo, comparar]) => 
    !comparar(a[campo], b[campo]))
  ) {
    return false;
  }

  // Comparación de arrays de géneros
  if (a.generos?.length !== b.generos?.length || 
      !a.generos.every((g, i) => strEqual(g, b.generos[i]))) {
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
    compararArrays(a.episodios || [], b.episodios || [], ['number', 'url']) &&
    compararArrays(a.relacionados || [], b.relacionados || [], ['title', 'relation'])
  );
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
  // 2. Cargar desde Firestore siempre
  try {
    const docSnap = await getDoc(doc(db, 'datos-animes', id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (!compararDatos(cached, data)) {
        actualizarCache(id, data);
        cached = data;
        renderAnime(data);
      }
    }
  } catch (err) {
    console.error('Error al cargar desde Firestore:', err);
  }

  // 3. Cargar desde API externa y actualizar todo
  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${id}`);
    const data = await res.json();
    const anime = {
      titulo: data.title || '',
      portada: data.cover || '',
      descripcion: data.synopsis || '',
      generos: data.genres || [],
      rating: data.rating || null,
      estado: data.status || null,
      episodios: data.episodes.map(ep => ({ number: ep.number, url: ep.url })),
      relacionados: data.related.map(ep => ({ title: ep.title, relation: ep.relation })) || [],

    };

    if (!compararDatos(cached, anime)) {
      await setDoc(doc(db, 'datos-animes', id), { ...anime, fechaGuardado: serverTimestamp() }, { merge: true });
      actualizarCache(id, anime);
      renderAnime(anime);
    }
  } catch (err) {
    console.error('Error carga anime:', err)
    const container = document.querySelector('.anime-details');
    container.classList.add('sin-resultados');
    
    container.innerHTML = `
    <img src="/img/cat.png" id="img-sin-resultados" alt="sin resultados">
    <div id="text-sin-resultados">
      <span id="span-sin-resultados">No se encontraron resultados</span>
      <span id="span-sin-resultados2">Prueba buscando de otra manera.</span>
    </div>
    <div id="sugerencias-sin-resultados">
      <h2>Sugerencias</h2>
      <div id="anime-grid-sin-resultados">
      <span class="span-carga">cargando...</span></div>
    </div>
  `;
  const scrollHorizontal = document.querySelector('#anime-grid-sin-resultados');

scrollHorizontal.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    scrollHorizontal.scrollLeft += e.deltaY;
  }
});

  
    const search = document.getElementById("busqueda"); 
    search.classList.add("active");
    document.querySelector('header').classList.add('search-active');
    search.focus();

    const porcentajeARecortar = Math.ceil(id.length * 0.4); 
    const recortado = id.slice(0, -porcentajeARecortar);
    cargarSugerenciasSinResultados(recortado);
  }
};
cargarAnime();


async function cargarSugerenciasSinResultados(id) {

  document.title = "AniZen - " + "Sin Resultados";
      console.log(id);
      try {
        const response = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${id}`);
        if (!response.ok) throw new Error('Error al cargar el anime');
        
        const animeData = await response.json();
        if (animeData.data.length === 0) {
          const porcentajeARecortar = Math.ceil(id.length * 0.4); 
          const recortado = id.slice(0, -porcentajeARecortar);
          if (recortado.length >= 1) { 
            cargarSugerenciasSinResultados(recortado);
          }
          return;
        }
        const animeGrid = document.getElementById('anime-grid-sin-resultados');
        animeGrid.innerHTML = '';
        animeData.data.forEach(anime => {
          const animeCard = crearAnimeCard(anime);
          animeGrid.appendChild(animeCard);
          observerAnimeCards()
        });
      } catch (error) {
            console.error('Error al cargar sugerencias:', error);
        }
    }

  
// Toggle búsqueda de capítulos
document.getElementById('btn-search-capitulo').addEventListener('click', function () {
  document.querySelector('.header-caps').classList.add('search-active');
  document.getElementById('filtro-capitulo').focus();
});

document.getElementById('btn-close-search-capitulo').addEventListener('click', function () {
  document.querySelector('.header-caps').classList.remove('search-active');
  document.getElementById('filtro-capitulo').value = "";
});

// Altura del container 1
document.addEventListener('DOMContentLoaded', () => {
  function setContainerHeight() {
    const container1 = document.querySelector('.anime-container1');
    if (container1) {
      const height = container1.offsetHeight;
      document.documentElement.style.setProperty('--altura-container-1', `${height}px`);
    }
  }

  setContainerHeight();
  window.addEventListener('resize', setContainerHeight);
});

const btnFav = document.getElementById('btn-fav');

function actualizarEstadoFavorito() {
  obtenerFavoritosAnime()
    .then(favoritos => {
      const esFavorito = favoritos.includes(id);
      btnFav.classList.toggle("favorito", esFavorito);
      btnFav.textContent = esFavorito ? "FAVORITO" : "FAV";
    })
    .catch(error => {
      console.error("Error al obtener favoritos:", error);
    });
}

btnFav.addEventListener("click", async () => {
  if (!auth.currentUser) {
    alert("Debes iniciar sesión para agregar a favoritos.");
    return;
  }

  const titulo = document.getElementById("titulo").textContent;

  // Deshabilitamos para evitar spam de clics
  btnFav.disabled = true;
console.log("hola")
  try {
    // --- RESPUESTA VISUAL INSTANTÁNEA ---
    if (btnFav.classList.contains("activo")) {
      btnFav.classList.remove("activo");
      btnFav.classList.add("desaparecer");
      setTimeout(() => btnFav.classList.remove("desaparecer"), 500);
    } else {
      btnFav.classList.add("activo");
      btnFav.classList.add("aparecer");
      setTimeout(() => btnFav.classList.remove("aparecer"), 500);
    }

    // --- PROCESO INTERNO EN BASE DE DATOS ---
    const res = await toggleFavoritoAnime(titulo);

    // --- ESTADO FINAL ---
    actualizarEstadoFavorito();
    console.log("✅ Favoritos actualizado con éxito:", res.mensaje);

  } catch (err) {
    console.error("❌ Error al cambiar favorito:", err);
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
    return { esFavorito: false, mensaje: "Anime eliminado de favoritos" };
  } else {
    // agregar
    favoritos.push(id);
    await setDoc(favoritosRef, { animes: favoritos }, { merge: true });
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
  const progreso = (episodiosVistos.length / totalEpisodios) * 100;

  const progresoBtn = document.getElementById('btn-progreso');
  if (progresoBtn) {
    progresoBtn.style.setProperty('--progreso', progreso.toFixed(0));
    progresoBtn.style.setProperty('--progreso-text', `"${progreso.toFixed(0)}%"`);
  }

  const progresoElement = document.getElementById('progreso');
  if (progresoElement) {
    progresoElement.style.width = `${progreso}%`;
  }

}

const btnViendo = document.getElementById('btn-viendo');
const btnPendiente = document.getElementById('btn-pendiente');
const btnVisto = document.getElementById('btn-visto');
const seccionEstados = document.getElementById('Estados');
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

async function actualizarEstadoFirebase(estado) {
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
  const btnEstado = document.getElementById('btn-estado');
  const estadoId = btnSeleccionado.id.replace('btn-', '');
  const estado = ESTADOS[estadoId];
  const user = localStorage.getItem("userID");
  
  if (!user) {
    console.warn('manejarEstadoSeleccionado: No hay usuario autenticado.');
    window.alert('Inicia sesión para guardar tu progreso de capítulos, animes y mucho más!.');
    return;
  }

  if (btnSeleccionado.classList.contains('active')) {
    btnSeleccionado.classList.remove('active');
    seccionEstados.classList.remove('active');
    
    if (estado) {
      btnEstado.style.backgroundColor = '#6c757d';
      estadoText.innerHTML = 'ESTADO';
      
      try {
        const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estadoId);
        const estadoDoc = await getDoc(estadoRef);
        
        if (estadoDoc.exists() && Array.isArray(estadoDoc.data().animes)) {
          const animesActualizados = estadoDoc.data().animes.filter(animeId => animeId !== id);
          if (animesActualizados.length !== estadoDoc.data().animes.length) {
            await setDoc(estadoRef, { animes: animesActualizados }, { merge: true });
          }
        }
      } catch (error) {
        console.error('Error al eliminar el estado:', error);
      }
    }
    return;
  }

  [btnViendo, btnPendiente, btnVisto].forEach(btn => btn.classList.remove('active'));
  btnSeleccionado.classList.add('active');
  seccionEstados.classList.remove('active');

  if (estado) {
    btnEstado.style.backgroundColor = estado.color;
    estadoText.innerHTML = `${estado.texto}`;
  }

  await actualizarEstadoFirebase(estadoId.toUpperCase());
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
    if (btnSeleccionado) manejarEstadoSeleccionado(btnSeleccionado);
  }
});

btnViendo.addEventListener('click', () => manejarEstadoSeleccionado(btnViendo));
btnPendiente.addEventListener('click', () => manejarEstadoSeleccionado(btnPendiente));
btnVisto.addEventListener('click', () => manejarEstadoSeleccionado(btnVisto));

document.getElementById("btn-estado").addEventListener("click", () => {
  seccionEstados.classList.toggle("active");
});
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
modal.innerHTML = `<img src="" alt="Vista Ampliada">`;
document.body.appendChild(modal);

const modalImg = modal.querySelector('img');

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