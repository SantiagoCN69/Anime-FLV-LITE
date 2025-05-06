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

const cargarDatosDesdeCache = (id) => {
  const cacheKey = `anime_${id}`;
  const cachedData = localStorage.getItem(cacheKey);
  return cachedData ? JSON.parse(cachedData) : null;
};

const actualizarCache = (id, anime) => {
  const cacheKey = `anime_${id}`;
  localStorage.setItem(cacheKey, JSON.stringify(anime));
};

fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${id}`)
  .then(res => res.json())
  .then(async anime => {
    // Intentar cargar desde cache primero
    const cachedAnime = cargarDatosDesdeCache(id);
    if (cachedAnime) {
      document.getElementById("titulo").textContent = cachedAnime.titulo;
      document.getElementById("portada").src = cachedAnime.portada;
      document.body.style.backgroundImage = `url(${cachedAnime.portada})`;
      document.getElementById("descripcion").textContent = cachedAnime.descripcion;
      crearBotonesEpisodios(cachedAnime, document.getElementById("capitulos"));


      // Actualizar géneros desde cache
      const generoContainerCache = document.querySelector(".genero");
      generoContainerCache.innerHTML = ''; // Limpiar géneros anteriores
      if (cachedAnime.generos && cachedAnime.generos.length > 0) {
        cachedAnime.generos.slice(0, 5).forEach(genre => { // Limitar a 5 géneros
          const btn = document.createElement("button");
          btn.textContent = genre;
          btn.className = 'genre-btn';
          generoContainerCache.appendChild(btn);
        });
      } else {
        generoContainerCache.textContent = 'Géneros no disponibles.';
      }
    }

    // Luego, actualizar con los datos más recientes de Firestore
    try {
      if (!id) {
        console.error('ID de anime no válido');
        return;
      }

      const datosAnime = {
        titulo: anime.title || '',
        portada: anime.cover || '',
        descripcion: anime.synopsis || '',
        episodios: (anime.episodes || []).map(ep => ({
          numero: ep.number || '',
          url: ep.url || ''
        })),
        generos: anime.genres || [],
        estado: anime.status || '',
        calificacion: anime.score || null,
        fechaGuardado: serverTimestamp(),
        rating: anime.rating || null,
      };

      const animeDatosRef = doc(db, 'datos-animes', id);
      await setDoc(animeDatosRef, datosAnime, { merge: true });

      // Actualizar cache con los datos frescos
      actualizarCache(id, {
        titulo: anime.title,
        portada: anime.cover,
        descripcion: anime.synopsis,
        episodios: anime.episodes || [],
        generos: anime.genres,
        estado: anime.status,
        calificacion: anime.score,
        rating: anime.rating
      });

      // Actualizar UI con los datos más recientes
      document.getElementById("titulo").textContent = anime.title;
      document.getElementById("portada").src = anime.cover;
      document.body.style.backgroundImage = `url(${anime.cover})`;
      document.getElementById("descripcion").textContent = anime.synopsis;

      // Crear botones de género
      const generoContainer = document.querySelector(".genero");
      generoContainer.innerHTML = ''; // Limpiar géneros anteriores por si acaso
      if (anime.genres && anime.genres.length > 0) {
        anime.genres.slice(0, 5).forEach(genre => { // Limitar a 5 géneros
          const btn = document.createElement("button");
          btn.textContent = genre;
          btn.className = 'genre-btn';
          generoContainer.appendChild(btn);
        });
      } else {
        generoContainer.textContent = 'Géneros no disponibles.';
      }
      crearBotonesEpisodios(anime, document.getElementById("capitulos"));
    } catch (error) {
      console.error('Error al guardar datos del anime en Firestore:', error);
    }

    const capContenedor = document.getElementById("capitulos");
    const filtroCapitulo = document.getElementById("filtro-capitulo");

    // Scroll horizontal con la rueda del mouse
    capContenedor.addEventListener("wheel", function (e) {
      e.preventDefault();
      const columnas = this.querySelectorAll("li");
      if (columnas.length === 0) return;
      const anchoColumna = columnas[0].getBoundingClientRect().width;  // Usar getBoundingClientRect() para precisión
      const direccion = e.deltaY > 0 ? 1 : -1;
      const scrollActual = this.scrollLeft;
      const columnaActual = Math.floor(scrollActual / anchoColumna);
      const nuevoScroll = (columnaActual + direccion) * anchoColumna;
      const scrollMaximo = (columnas.length - 1) * anchoColumna;
      this.scrollLeft = Math.max(0, Math.min(nuevoScroll, scrollMaximo));
    }, { passive: false });

    // Ajustar scroll a columna completa al terminar
    capContenedor.addEventListener('scrollend', function() {
      const columnas = this.querySelectorAll("li");
      if (columnas.length === 0) return;
      const anchoColumna = columnas[0].getBoundingClientRect().width;  // Usar getBoundingClientRect() para precisión
      const scrollActual = this.scrollLeft;
      const columnaActual = Math.round(scrollActual / anchoColumna);
      const nuevoScroll = columnaActual * anchoColumna;

      // Añadir un pequeño margen de corrección para evitar desvíos
      this.scrollTo({
        left: nuevoScroll + 0.1,  // Ajuste ligero para evitar desvíos
        behavior: 'smooth'
      });
    });

    // Filtro de capítulos
    filtroCapitulo.addEventListener("input", function () {
      const filtro = this.value.toLowerCase();
      const botones = capContenedor.querySelectorAll(".episode-btn");
      let primerCoincidencia = null;

      botones.forEach((btn, index) => {
        const texto = btn.textContent.toLowerCase();
        const coincide = texto.includes(filtro);
        if (coincide && primerCoincidencia === null) primerCoincidencia = index;
      });

      if (primerCoincidencia !== null) {
        const elemento = botones[primerCoincidencia].parentElement;
        elemento.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    // Obtener y actualizar progreso de capítulos vistos
    obtenerCapitulosVistos(id)
      .then(episodiosVistos => {
        actualizarProgresoCapitulos(anime.episodes.length, episodiosVistos);
        
        // Desplazar al primer episodio no visto
        const botones = capContenedor.querySelectorAll('.episode-btn');
        const primerEpisodioNoVisto = Array.from(botones).find(btn => !btn.classList.contains('ep-visto'));
        
        if (primerEpisodioNoVisto) {
          primerEpisodioNoVisto.parentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      });
  })
  .catch(err => {
    console.error("Error al cargar datos del anime:", err);
    document.getElementById("descripcion").textContent = "Error al cargar el anime.";
  });

    
  function crearBotonesEpisodios(anime, capContenedor) {
    // Limpiar el contenido previo del contenedor
    capContenedor.innerHTML = '';
  
    const fragmentEpisodios = document.createDocumentFragment();
  
    // Obtener capítulos vistos antes de crear los botones
    obtenerCapitulosVistos(id).then(capitulosVistos => {
      const episodios = Array.isArray(anime?.episodes) ? anime.episodes : [];
      const vistos = Array.isArray(capitulosVistos) ? capitulosVistos : [];
      episodios.forEach(ep => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
  
        const estaVisto = vistos.includes(ep.number.toString());
        const icon = crearIconoEstado(estaVisto);
  
        btn.className = `episode-btn ${estaVisto ? 'ep-visto' : 'ep-no-visto'}`;
        btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;
  
        // Asignar eventos para cambiar el estado de visto
        btn.addEventListener('click', async () => {
          await manejarEstadoEpisodio(btn, icon, ep, estaVisto);
          window.location.href = `ver.html?animeId=${id}&url=${encodeURIComponent(ep.url)}`;
        });
  
        icon.addEventListener('click', (e) => {
          e.stopPropagation();
          manejarEstadoEpisodio(btn, icon, ep, estaVisto);
        });
  
        btn.appendChild(icon);
        li.appendChild(btn);
        fragmentEpisodios.appendChild(li);
      });
  
      capContenedor.appendChild(fragmentEpisodios);
    }).catch(error => {
      const episodios = Array.isArray(anime?.episodes) ? anime.episodes : [];
      console.error("Error al obtener capítulos vistos:", error);
      // Crear botones sin estado de visto si hay error
      episodios.forEach(ep => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.className = `episode-btn ep-no-visto`;
        btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;
  
        const icon = crearIconoEstado(false);
  
        btn.addEventListener('click', () => {
          window.location.href = `ver.html?animeId=${id}&url=${encodeURIComponent(ep.url)}`;
        });
  
        icon.addEventListener('click', (e) => {
          e.stopPropagation();
          manejarEstadoEpisodio(btn, icon, ep, false);
        });
  
        btn.appendChild(icon);
        li.appendChild(btn);
        fragmentEpisodios.appendChild(li);
      });
  
      capContenedor.appendChild(fragmentEpisodios);
    });
  }
  
  // Crear el ícono de visto/no visto
  function crearIconoEstado(estaVisto) {
    const icon = document.createElement("img");
    icon.className = "icon-eye";
    icon.src = estaVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
    icon.alt = "visto";
    return icon;
  }
  
  // Manejar el cambio de estado de un episodio
  async function manejarEstadoEpisodio(btn, icon, ep, estaVisto) {
    const estadoVistoActual = btn.classList.contains("ep-visto");
    const nuevoEstado = !estadoVistoActual;
    btn.classList.toggle("ep-visto", nuevoEstado);
    btn.classList.toggle("ep-no-visto", !nuevoEstado);
    icon.src = nuevoEstado ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
  
    try {
      const titulo = document.getElementById("titulo").textContent;
      await toggleCapituloVisto(id, titulo, ep.number, nuevoEstado);
    } catch (error) {
      console.error("Error al cambiar estado del capítulo:", error);
      // Revertir cambios visuales si hay un error
      btn.classList.toggle("ep-visto", estaVisto);
      btn.classList.toggle("ep-no-visto", !estaVisto);
      icon.src = estaVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
    }
  }
  
  // Función para alternar capítulos vistos
  async function toggleCapituloVisto(animeId, titulo, episodio, esVisto) {
    const user = auth.currentUser;
    if (!user) {
      alert("Debes iniciar sesión para marcar capítulos.");
      throw "Usuario no autenticado";
    }
  
    const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);
  
    try {
      const docSnap = await getDoc(animeRef);
      const datosActuales = docSnap.exists() ? docSnap.data() : {};
  
      let episodiosActuales, episodiosUnicos;
      if (esVisto) {
        episodiosActuales = datosActuales.episodiosVistos || [];
        episodiosUnicos = new Set([...episodiosActuales, episodio.toString()]);
      } else {
        episodiosActuales = datosActuales.episodiosVistos || [];
        episodiosUnicos = episodiosActuales.filter(ep => ep !== episodio.toString());
      }
  
      await setDoc(animeRef, { 
        titulo, 
        fechaAgregado: serverTimestamp(),
        episodiosVistos: Array.from(episodiosUnicos)
      });
  
      const totalEpisodios = document.querySelectorAll('.episode-btn').length;
      actualizarProgresoCapitulos(totalEpisodios, Array.from(episodiosUnicos));
  
      return { mensaje: `Episodio ${episodio} ${esVisto ? 'marcado' : 'desmarcado'} como visto` };
    } catch (error) {
      console.error("Error al cambiar estado del capítulo:", error);
      alert("Hubo un error al cambiar el estado del capítulo.");
      throw error;
    }
  }
  
  // Función para obtener capítulos vistos de un anime
  async function obtenerCapitulosVistos(animeId) {
    const user = auth.currentUser;
    if (!user) return [];
  
    try {
      const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);
      const docSnap = await getDoc(animeRef);
  
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.episodiosVistos || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error al obtener capítulos vistos:", error);
      return [];
    }
  }
  
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


