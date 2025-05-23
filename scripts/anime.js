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

function quitarTildesYEspacios(texto) {
  return texto
    .normalize('NFD')                   // Descompone los caracteres con tilde
    .replace(/[\u0300-\u036f]/g, '')   // Elimina las tildes
    .replace(/ /g, '-');                // Reemplaza espacios por guiones
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
      a.href = `directorio.html?genre%5B%5D=${quitarTildesYEspacios(generoUrl)}`;


      container.appendChild(a);
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

}

// Manejo de estados con botones individuales
const btnViendo = document.getElementById('btn-viendo');
const btnPendiente = document.getElementById('btn-pendiente');
const btnVisto = document.getElementById('btn-visto');
const seccionEstados = document.getElementById('Estados');
const estadoText = document.getElementById('estado-text');

// Asegúrate de definir esta variable correctamente

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
  const user = auth.currentUser;
  if (!user) return;

  await limpiarEstadosPrevios(); 

  // Guarda el anime en la colección correspondiente
  await setDoc(doc(collection(doc(db, "usuarios", user.uid), estado.toLowerCase()), id), {
    id: id, 
    timestamp: Date.now()
  });
}

// Eliminar el anime de todas las colecciones de estado
async function limpiarEstadosPrevios() {
  const user = auth.currentUser;
  if (!user) return;

  const estados = ['viendo', 'pendiente', 'visto'];
  for (const estado of estados) {
    const ref = doc(collection(doc(db, "usuarios", user.uid), estado), id);
    const snap = await getDoc(ref);
    if (snap.exists()) await deleteDoc(ref);
  }
}

// Manejar selección de estado
function manejarEstadoSeleccionado(btnSeleccionado) {
  const btnEstado = document.getElementById('btn-estado');
  const estadoId = btnSeleccionado.id.replace('btn-', '');
  const estado = ESTADOS[estadoId];

  // Si el botón ya está activo, eliminar el estado
  if (btnSeleccionado.classList.contains('active')) {
    btnSeleccionado.classList.remove('active');
    seccionEstados.classList.remove('active');
    if (estado) {
      btnEstado.style.backgroundColor = '#6c757d';
      estadoText.innerHTML = 'ESTADO';
      // Eliminar el estado de Firebase
      const user = auth.currentUser;
      if (user) {
        const ref = doc(collection(doc(db, "usuarios", user.uid), estadoId), id);
        deleteDoc(ref);
      }
    }
    return;
  }

  // Si el botón no estaba activo, proceder normalmente
  [btnViendo, btnPendiente, btnVisto].forEach(btn => btn.classList.remove('active'));
  btnSeleccionado.classList.add('active');
  seccionEstados.classList.remove('active');

  if (estado) {
    btnEstado.style.backgroundColor = estado.color;
    estadoText.innerHTML = `${estado.texto}`;
  }

  actualizarEstadoFirebase(estadoId.toUpperCase());
}

// Obtener el estado actual
async function obtenerEstadoActual() {
  const user = auth.currentUser;
  if (!user) return null;

  const estados = ['visto', 'viendo', 'pendiente'];
  for (const estado of estados) {
    const ref = doc(collection(doc(db, "usuarios", user.uid), estado), id);
    const snap = await getDoc(ref);
    if (snap.exists()) return estado.toUpperCase();
  }
  return null;
}

// Cargar el estado actual en la UI
async function actualizarEstadoActual() {
  const user = auth.currentUser;
  if (!user) return;

  const estadoActual = await obtenerEstadoActual();
  if (estadoActual) {
    const btnSeleccionado = document.getElementById(`btn-${estadoActual.toLowerCase()}`);
    if (btnSeleccionado) manejarEstadoSeleccionado(btnSeleccionado);
    
  }
}

// Escuchar cambios en la autenticación
onAuthStateChanged(auth, async (user) => {
  if (user) await actualizarEstadoActual();
});

// Eventos para los botones
btnViendo.addEventListener('click', () => manejarEstadoSeleccionado(btnViendo));
btnPendiente.addEventListener('click', () => manejarEstadoSeleccionado(btnPendiente));
btnVisto.addEventListener('click', () => manejarEstadoSeleccionado(btnVisto));

// Mostrar/ocultar sección
document.getElementById("btn-estado").addEventListener("click", () => {
  seccionEstados.classList.toggle("active");
});

// Cerrar la sección cuando se haga clic fuera
document.addEventListener("click", (e) => {
  const seccion = document.getElementById("Estados");
  const btnEstado = document.getElementById("btn-estado");
  if (seccion.classList.contains("active") && 
      !seccion.contains(e.target) && 
      !btnEstado.contains(e.target)) {
    seccion.classList.remove("active");
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



