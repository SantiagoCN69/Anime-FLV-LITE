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

const renderAnime = anime => {
  tituloEl.textContent = anime.titulo;
  portadaEl.src = anime.portada;
  document.body.style.backgroundImage = `url(${anime.portada})`;
  descripcionEl.textContent = anime.descripcion;
  renderGeneros(generoContainer, anime.generos);
  crearBotonesEpisodios(anime);
  ratingEl.textContent = anime.rating + "/5";
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
    window.location.href = `ver.html?animeId=${id}&url=${encodeURIComponent(ep.url)}`;
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
  console.log(vistos)
  const fragment = document.createDocumentFragment();
  episodios.forEach(ep => fragment.appendChild(createEpisodeButton(ep, vistos)));
  capContenedor.appendChild(fragment);
  if (episodios.length > 0) {
    actualizarProgresoCapitulos(episodios.length, vistos);
  }
  // Desplazar al primer episodio no visto
  const primerNoVisto = capContenedor.querySelector('.episode-btn.ep-no-visto');
  if (primerNoVisto) {
    const targetElement = primerNoVisto.parentElement;
    if (targetElement) { // Check if parentElement is not null
      const anchoColumna = typeof getAnchoColumna === 'function' ? getAnchoColumna() : 0; // Ensure getAnchoColumna is callable and provide a default

      if (anchoColumna && anchoColumna > 0) {
        // Calculate scroll position based on columns
        const columnaDelTarget = Math.floor(targetElement.offsetLeft / anchoColumna);
        let scrollToX = columnaDelTarget * anchoColumna;
        
        // Ensure the scroll position is within valid bounds
        const maxScroll = capContenedor.scrollWidth - capContenedor.clientWidth;
        scrollToX = Math.max(0, Math.min(scrollToX, maxScroll));

        capContenedor.scrollTo({
          left: scrollToX,
          behavior: 'smooth'
        });
      } else {
        // Fallback: scroll to bring the element's start into view if no valid column width
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
  return new Promise(async (resolve, reject) => {
    const fetchChaptersLogic = async (userInstance) => {
      if (!userInstance) {
        console.warn("obtenerCapitulosVistos: fetchChaptersLogic llamado sin instancia de usuario válida. Retornando [].");
        resolve([]);
        return;
      }
      try {
        // Asumiendo que 'db', 'doc', 'getDoc' están disponibles en este alcance
        const ref = doc(db, 'usuarios', userInstance.uid, 'caps-vistos', animeId);
        const snap = await getDoc(ref);
        resolve(snap.exists() ? snap.data().episodiosVistos || [] : []);
      } catch (error) {
        console.error("Error al obtener capítulos vistos:", error);
        reject(error); // O podrías resolver con [] si prefieres manejar errores así
      }
    };

    // Asumiendo que 'auth' está disponible en este alcance
    const currentUser = auth.currentUser;
    console.log("obtenerCapitulosVistos: Verificando usuario actual:", currentUser);

    if (currentUser) {
      console.log("obtenerCapitulosVistos: Usuario ya autenticado, procediendo.");
      await fetchChaptersLogic(currentUser);
    } else {
      console.log("obtenerCapitulosVistos: Usuario no autenticado inicialmente, esperando authStateReady.");
      const authReadyListener = async (event) => {
        document.removeEventListener("authStateReady", authReadyListener); // Limpiar listener
        if (event.detail && event.detail.user) {
          console.log("obtenerCapitulosVistos: authStateReady recibido con usuario:", event.detail.user);
          await fetchChaptersLogic(event.detail.user);
        } else {
          console.warn("obtenerCapitulosVistos: authStateReady recibido sin usuario autenticado. Retornando [].");
          resolve([]);
        }
      };
      document.addEventListener("authStateReady", authReadyListener);
    }
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

  const episodiosA = JSON.stringify(normalizarEpisodios(a.episodios));
  const episodiosB = JSON.stringify(normalizarEpisodios(b.episodios));

  // Retornamos el resultado final
  return tituloIgual && portadaIgual && descripcionIgual && ratingIgual && estadoIgual && generosIgual && episodiosA === episodiosB;
}

(async () => {
  if (!id) return console.error('ID inválido');

  // 1. Cargar desde caché (si existe)
  const cached = cargarDatosDesdeCache(id);
  if (cached) {
    renderAnime({
      titulo: cached.titulo,
      portada: cached.portada,
      descripcion: cached.descripcion,
      generos: cached.generos,
      rating: cached.rating,
      estado: cached.estado,
      episodios: cached.episodios,
    });
  }

  // 2. Cargar desde Firestore siempre
  try {
    const docSnap = await getDoc(doc(db, 'datos-animes', id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (!compararDatos(cached, data)) {
        console.log("Datos diferentes de cache a firestore, actualizando...")
        renderAnime({
          titulo: data.titulo,
          portada: data.portada,
          descripcion: data.descripcion,
          generos: data.generos,
          rating: data.rating,
          estado: data.estado,
          episodios: data.episodios,
        });
      actualizarCache(id, data);
    }}
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


