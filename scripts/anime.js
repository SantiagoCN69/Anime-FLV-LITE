import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

// Inicializar Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const id = new URLSearchParams(location.search).get("id");



// Cargar información del anime
document.getElementById("descripcion").innerHTML = '<div class="loading">Cargando información...</div>';

const getCacheKey = id => `anime_${id}`;

const cargarDatosDesdeCache = id => {
  try {
    const data = localStorage.getItem(getCacheKey(id));
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed._cachedAt && Date.now() - parsed._cachedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getCacheKey(id));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const actualizarCache = (id, anime) => {
  const toCache = { ...anime, _cachedAt: Date.now() };
  localStorage.setItem(getCacheKey(id), JSON.stringify(toCache));
};

// DOM references
const tituloEl = document.getElementById("titulo");
const portadaEl = document.getElementById("portada");
const descripcionEl = document.getElementById("descripcion");
const generoContainer = document.querySelector(".genero");
const capContenedor = document.getElementById("capitulos");
const filtroCapitulo = document.getElementById("filtro-capitulo");
const ratingEl = document.getElementById("rating");
const initLoadingCap = document.getElementById("init-loading-cap");

const renderGeneros = (container, generos) => {
  container.innerHTML = '';
  if (generos && generos.length) {
    generos.slice(0, 5).forEach(g => {
      const btn = document.createElement('button');
      btn.textContent = g;
      btn.className = 'genre-btn';
      container.appendChild(btn);
    });
  } else {
    container.textContent = 'Géneros no disponibles.';
  }
};

// Renderizar relacionados
async function renderRelacionados(anime) {
  const relacionadosContainer = document.getElementById('animes-relacionados');
  const relacionadosSection = document.getElementById('relacionados');
  const initLoading = document.getElementById('init-loading-relacionados');
  
  if (!relacionadosContainer || !anime.relacionados || !anime.relacionados.length) {
    if (relacionadosSection) relacionadosSection.style.display = 'none';
    return;
  }
  
  if (relacionadosSection) relacionadosSection.style.display = 'flex';

  relacionadosContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();

  for (const relacionado of anime.relacionados) {
    try {
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(relacionado.title)}`);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const data = await res.json();

      // Tomar solo el primer resultado
      const primerResultado = data.data?.[0];
      if (primerResultado) {
        const card = crearAnimeCard(primerResultado);
        
        // Agregar la relación debajo de la tarjeta
        const relationSpan = document.createElement('span');
        relationSpan.className = 'relation-tag';
        relationSpan.textContent = relacionado.relation;
        card.appendChild(relationSpan);
        
        fragment.appendChild(card);
      }
    } catch (err) {
      console.error('Error al buscar anime relacionado:', relacionado.title, err);
    }
  }
  
  relacionadosContainer.appendChild(fragment);
  if (initLoading) initLoading.style.display = 'none';
}


const renderAnime = anime => {
  tituloEl.textContent = anime.titulo;
  portadaEl.src = anime.portada;
  document.body.style.backgroundImage = `url(${anime.portada})`;
  descripcionEl.textContent = anime.descripcion;
  renderGeneros(generoContainer, anime.generos);
  crearBotonesEpisodios(anime);
  ratingEl.textContent = anime.rating + "/5";
  renderRelacionados(anime);
};

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
    window.location.href = `ver.html?animeId=${id}&url=${ep.number}`;
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
  const user = auth.currentUser;
  if (!user) throw 'No autenticado';
  const ref = doc(db, 'usuarios', user.uid, 'caps-vistos', animeId);
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
  if (!a || !b) return false;

  const normalizar = (v) => (typeof v === "string" ? v.trim() : v);

  // Comparación detallada de campos
  const tituloIgual = normalizar(a.titulo) === normalizar(b.titulo);
  const portadaIgual = normalizar(a.portada) === normalizar(b.portada);
  const descripcionIgual = normalizar(a.descripcion) === normalizar(b.descripcion);
  const ratingIgual = normalizar(a.rating) === normalizar(b.rating);
  const estadoIgual = normalizar(a.estado) === normalizar(b.estado);
  const generosIgual = JSON.stringify(a.generos) === JSON.stringify(b.generos);

  // Normalizar y ordenar episodios
  const normalizarEpisodios = (episodios) => {
    return episodios
      .map(ep => ({ url: ep.url, number: ep.number })) // Asegurarse de que la estructura sea la misma
      .sort((ep1, ep2) => ep1.number - ep2.number); // Ordenar por número
  };
// normalizar y ordenar relacionados
const normalizarRelacionados = (relacionados) => {
  return relacionados
    .map(rel => ({ title: rel.title, relation: rel.relation })) // Asegurarse de que la estructura sea la misma
    .sort((rel1, rel2) => rel1.title.localeCompare(rel2.title)); // Ordenar alfabéticamente por título
};

  const episodiosA = JSON.stringify(normalizarEpisodios(a.episodios));
  const episodiosB = JSON.stringify(normalizarEpisodios(b.episodios));

  const relacionadosA = JSON.stringify(normalizarRelacionados(a.relacionados));
  const relacionadosB = JSON.stringify(normalizarRelacionados(b.relacionados));

  // Retornamos el resultado final
  return tituloIgual && portadaIgual && descripcionIgual && ratingIgual && estadoIgual && generosIgual && episodiosA === episodiosB && relacionadosA === relacionadosB;
}

(async () => {
  if (!id) return console.error('ID inválido');

  // 1. Cargar desde caché (si existe)
  const cached = cargarDatosDesdeCache(id);
  if (cached) {
    renderAnime(cached);
  }

  // 2. Cargar desde Firestore siempre
  try {
    const docSnap = await getDoc(doc(db, 'datos-animes', id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (!compararDatos(cached, data)) {
       console.log("Datos diferentes de cache a firestore, actualizando...")
      actualizarCache(id, data);
      renderAnime(data);
    }
  }} catch (err) {
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
    await setDoc(doc(db, 'datos-animes', id), { ...anime, fechaGuardado: serverTimestamp() }, { merge: true });
    actualizarCache(id, anime);
    if (!compararDatos(cached, anime)) {
      console.log("Datos diferentes de firestore a api, actualizando...")
      renderAnime(anime);
    }
  } catch (err) {
    console.error('Error carga anime:', err)
  }
})();

  
// Toggle búsqueda de capítulos
document.getElementById('btn-search-capitulo').addEventListener('click', function () {
  document.querySelector('.header-caps').classList.add('search-active');
  document.getElementById('filtro-capitulo').focus();
});

// Cerrar búsqueda de capítulos
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

// Botón de favoritos
const btnFav = document.getElementById('btn-fav');

// Función para actualizar botón de favorito
function actualizarEstadoFavorito() {
  obtenerFavoritosAnime()
    .then(favoritos => {
      const esFavorito = favoritos.some(f => f.id === id);
      btnFav.classList.toggle("favorito", esFavorito);
      btnFav.textContent = esFavorito ? "FAVORITO" : "FAV";
    });
}

btnFav.addEventListener("click", () => {
  if (!auth.currentUser) {
    alert("Debes iniciar sesión para agregar a favoritos.");
    return;
  }
  const titulo = document.getElementById("titulo").textContent;

  btnFav.disabled = true;

  toggleFavoritoAnime(id, titulo)
    .then(res => {
      actualizarEstadoFavorito();
    })
    .catch(err => {
      console.error("Error al cambiar favorito:", err);
    })
    .finally(() => {
      btnFav.disabled = false;
    });
});
// Función para alternar favoritos
async function toggleFavoritoAnime(animeId, titulo) {
  const user = auth.currentUser;
  if (!user) {
    throw "Usuario no autenticado";
  }

  const ref = doc(collection(doc(db, "usuarios", user.uid), "favoritos"), animeId);
  const docSnap = await getDoc(ref);

  if (docSnap.exists()) {
    await deleteDoc(ref);
    return { esFavorito: false, mensaje: "Anime eliminado de favoritos" };
  } else {
    await setDoc(ref, { titulo, fechaAgregado: serverTimestamp() });
    return { esFavorito: true, mensaje: "Anime agregado a favoritos" };
  }
}

// Obtener lista de favoritos
async function obtenerFavoritosAnime() {
  const user = auth.currentUser;
  if (!user) return [];

  const ref = collection(doc(db, "usuarios", user.uid), "favoritos");
  const snap = await getDocs(ref);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Detectar cambios de sesión
onAuthStateChanged(auth, user => {
  if (user) {
    actualizarEstadoFavorito();
  }
});

// Estados de visualización del anime
const btnEstado = document.getElementById('btn-estado');
const ESTADOS_ANIME = ['ESTADO', 'VIENDO', 'PENDIENTE', 'VISTO'];
const CLASES_ESTADOS = {
  'ESTADO': 'estado-default',
  'VIENDO': 'estado-viendo',
  'PENDIENTE': 'estado-pendiente',
  'VISTO': 'estado-completado'
};

// Función para obtener en qué colección está este anime
async function obtenerEstadoActual() {
  const user = auth.currentUser;
  if (!user) return "ESTADO";

  for (const estado of ['viendo', 'pendiente', 'visto']) {
    const ref = doc(collection(doc(db, "usuarios", user.uid), estado), id);
    const snap = await getDoc(ref);
    if (snap.exists()) return estado.toUpperCase();
  }

  return "ESTADO";
}

// Función para eliminar el anime de todas las colecciones de estado
async function limpiarEstadosPrevios() {
  const user = auth.currentUser;
  if (!user) return;

  for (const estado of ['viendo', 'pendiente', 'visto']) {
    const ref = doc(collection(doc(db, "usuarios", user.uid), estado), id);
    const snap = await getDoc(ref);
    if (snap.exists()) await deleteDoc(ref);
  }
}

// Función para actualizar el botón visual inmediatamente
async function actualizarBotonEstado(estado) {
  btnEstado.textContent = estado;
  btnEstado.className = "";
  btnEstado.classList.add(CLASES_ESTADOS[estado] || "estado-default");
}

// Función para actualizar el progreso de capítulos vistos
async function actualizarProgresoCapitulos(totalEpisodios, episodiosVistos) {
  const progreso = (episodiosVistos.length / totalEpisodios) * 100;

  // Actualizar variables CSS
  const progresoBtn = document.getElementById('btn-progreso');
  if (progresoBtn) {
    progresoBtn.style.setProperty('--progreso', progreso.toFixed(0));
    progresoBtn.style.setProperty('--progreso-text', `"${progreso.toFixed(0)}%"`);
  }

  // Actualizar visual del progreso
  const progresoElement = document.getElementById('progreso');
  if (progresoElement) {
    progresoElement.style.width = `${progreso}%`;
  }

  const user = auth.currentUser;
  if (!user) return;

  const estadoActual = await obtenerEstadoActual();

  if (progreso === 100 && estadoActual !== "VISTO") {
    await limpiarEstadosPrevios();
    const ref = doc(collection(doc(db, "usuarios", user.uid), "visto"), id);
    await setDoc(ref, {
      titulo: document.getElementById("titulo").textContent,
      fechaAgregado: serverTimestamp()
    });
    actualizarBotonEstado("VISTO");

  } else if (progreso < 100 && progreso !== 0 && estadoActual !== "VIENDO") {
    await limpiarEstadosPrevios();
    const ref = doc(collection(doc(db, "usuarios", user.uid), "viendo"), id);
    await setDoc(ref, {
      titulo: document.getElementById("titulo").textContent,
      fechaAgregado: serverTimestamp(),
      progreso: progreso
    });
    actualizarBotonEstado("VIENDO");
  }
}

// Evento para cambiar de estado cíclicamente
btnEstado.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    alert("Debes iniciar sesión para cambiar el estado.");
    return;
  }

  const estadoActual = await obtenerEstadoActual();
  const indiceActual = ESTADOS_ANIME.indexOf(estadoActual);
  const siguienteEstado = ESTADOS_ANIME[(indiceActual + 1) % ESTADOS_ANIME.length];

  // Actualizar visualmente antes de guardar en Firestore
  actualizarBotonEstado(siguienteEstado);

  await limpiarEstadosPrevios();

  if (["VIENDO", "PENDIENTE", "VISTO"].includes(siguienteEstado)) {
    const ref = doc(collection(doc(db, "usuarios", user.uid), siguienteEstado.toLowerCase()), id);
    await setDoc(ref, {
      titulo: document.getElementById("titulo").textContent,
      fechaAgregado: serverTimestamp()
    });
  }
});

// Cargar estado al iniciar sesión 
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const estado = await obtenerEstadoActual();
    actualizarBotonEstado(estado);
  }
});
// dezplazamiento relacioandos
const scrollContainer = document.querySelector('#animes-relacionados');

scrollContainer.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault(); // evita el scroll vertical
    scrollContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });


//side bar
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');
const episodeList = document.getElementById('capitulos');
const relatedAnimes = document.getElementById('animes-relacionados');

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let touchStartedOnEpisodeList = false;
let touchStartedOnRelatedAnimes = false;
const swipeThreshold = 50;
const verticalThreshold = 50;

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

window.addEventListener('scroll', () => {
  if (window.innerWidth < 600) {
    if (sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
    }
  }
});

document.addEventListener('click', (event) => {
  const isClickInsideSidebar = sidebar.contains(event.target);
  const isClickOnMenuToggle = menuToggle.contains(event.target);

  if (!isClickInsideSidebar && !isClickOnMenuToggle && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
  }
});

document.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0].screenX;
  touchStartY = event.changedTouches[0].screenY;

  touchStartedOnEpisodeList = episodeList?.contains(event.target) || false;
  touchStartedOnRelatedAnimes = relatedAnimes?.contains(event.target) || false;
}, { passive: true });

document.addEventListener('touchend', (event) => {
  touchEndX = event.changedTouches[0].screenX;
  touchEndY = event.changedTouches[0].screenY;
  handleSwipeGesture();
  touchStartedOnEpisodeList = false;
  touchStartedOnRelatedAnimes = false;
}, { passive: true });

function handleSwipeGesture() {
  const swipeDistanceX = touchEndX - touchStartX;
  const swipeDistanceY = Math.abs(touchEndY - touchStartY);
  const isSwipeRight = swipeDistanceX > swipeThreshold;
  const isSwipeLeft = swipeDistanceX < -swipeThreshold;

  const swipeStartedInRestrictedArea = touchStartedOnEpisodeList || touchStartedOnRelatedAnimes;

  if (isSwipeRight && !sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold && !swipeStartedInRestrictedArea) {
    if (window.innerWidth <= 600) {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        function checkScrollAndOpen() {
          if (window.scrollY === 0) {
            sidebar.classList.add('active');
          } else {
            requestAnimationFrame(checkScrollAndOpen);
          }
        }
        requestAnimationFrame(checkScrollAndOpen);
      } else {
        sidebar.classList.add('active');
      }
    } else {
      sidebar.classList.add('active');
    }
  } else if (isSwipeLeft && sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold) {
    sidebar.classList.remove('active');
  }
}


function crearElementoSiguienteCapitulo({ portada, titulo, siguienteCapitulo, siguienteEpisodioUrl, animeId }) {
  const btn = document.createElement('div');
  btn.className = 'btn-siguiente-capitulo';

  const img = document.createElement('img');
  img.src = portada;
  img.alt = titulo;
  img.className = 'portada-anime';
  img.onerror = () => {
    img.src = 'path/to/default/image.png';
  };

  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  contenedorTexto.innerHTML = `
    <span class="texto-2-lineas">${titulo}</span>
    <span class="texto-episodio">Ep. ${siguienteCapitulo}</span>
  `;

  btn.append(img, contenedorTexto);
  btn.addEventListener('click', () => {
    window.location.href = `ver.html?animeId=${animeId}&url=${encodeURIComponent(siguienteCapitulo)}`;
  });

  return btn;
}

async function cargarUltimosCapsVistos() {
  const container = document.getElementById('ultimos-caps-viendo');
  if (!container) return;

  const renderizar = (datos) => {
    container.innerHTML = '';
    if (!datos?.length) {
      container.innerHTML = '<p>No tienes capítulos siguientes disponibles.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(data => fragment.appendChild(crearElementoSiguienteCapitulo(data)));
    container.appendChild(fragment);
  };

  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    container.innerHTML = '<p>Inicia sesión para ver tus últimos capítulos</p>';
    return;
  }

  const cacheKey = `ultimosCapsVistosCache_${user.uid}`;
  let cachedData = null;

  try {
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      cachedData = JSON.parse(cache);
      if (Array.isArray(cachedData)) renderizar(cachedData);
      else localStorage.removeItem(cacheKey);
    }
  } catch (e) {
    console.error("Error al leer caché:", e);
    localStorage.removeItem(cacheKey);
  }

  try {
    const ref = collection(doc(db, "usuarios", user.uid), "caps-vistos");
    const snap = await getDocs(ref);

    if (snap.empty) return;

    const capVistos = snap.docs.map(docSnap => ({
      animeId: docSnap.id,
      ...docSnap.data()
    })).sort((a, b) => new Date(b.fechaAgregado?.toDate?.() || 0) - new Date(a.fechaAgregado?.toDate?.() || 0))
      .slice(0, 10);

    const animeRefs = capVistos.map(cap => doc(db, "datos-animes", cap.animeId));
    const animeDocs = await Promise.all(animeRefs.map(getDoc));

    const animeMap = {};
    animeDocs.forEach((docSnap, i) => {
      if (docSnap.exists()) animeMap[capVistos[i].animeId] = docSnap.data();
    });

    const freshData = capVistos.map(cap => {
      const anime = animeMap[cap.animeId];
      if (!anime?.portada || !anime?.titulo || !anime?.episodios) return null;

      const sigCapNum = Math.max(...(cap.episodiosVistos || []).map(Number), 0) + 1;
      const sigCap = Object.values(anime.episodios).find(ep => ep.number === sigCapNum);
      if (!sigCap?.url) return null;

      return {
        animeId: cap.animeId,
        portada: anime.portada,
        titulo: anime.titulo,
        siguienteCapitulo: sigCapNum,
        siguienteEpisodioUrl: sigCap.url
      };
    }).filter(Boolean);

    const freshStr = JSON.stringify(freshData);
    const cacheStr = JSON.stringify(cachedData);

    if (freshStr !== cacheStr) {
      renderizar(freshData);
      localStorage.setItem(cacheKey, freshStr);
    }
  } catch (error) {
    console.error('Error al cargar datos desde Firestore:', error);
    if (cachedData === null) container.innerHTML = '<p>Error al cargar últimos capítulos</p>';
  }
}

window.addEventListener('DOMContentLoaded', cargarUltimosCapsVistos);
