import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

// Inicializar Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const id = new URLSearchParams(location.search).get("id");

// Función para alternar favoritos
async function toggleFavoritoAnime(animeId, titulo) {
  const user = auth.currentUser;
  if (!user) {
    console.log("Usuario no autenticado");
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

// Cargar información del anime
document.getElementById("descripcion").innerHTML = '<div class="loading">Cargando información...</div>';

fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${id}`)
  .then(res => res.json())
  .then(anime => {
    document.getElementById("titulo").textContent = anime.title;
    document.getElementById("portada").src = anime.cover;
    document.body.style.backgroundImage = `url(${anime.cover})`;
    document.getElementById("descripcion").textContent = anime.synopsis;

    const capContenedor = document.getElementById("capitulos");
    const filtroCapitulo = document.getElementById("filtro-capitulo");

    // Scroll horizontal con la rueda del mouse
    capContenedor.addEventListener("wheel", function (e) {
      e.preventDefault();
      const columnas = this.querySelectorAll("li");
      if (columnas.length === 0) return;
      const anchoColumna = columnas[0].offsetWidth;
      const direccion = e.deltaY > 0 ? 1 : -1;
      const scrollActual = this.scrollLeft;
      const columnaActual = Math.floor(scrollActual / anchoColumna);
      const nuevoScroll = (columnaActual + direccion) * anchoColumna;
      const scrollMaximo = (columnas.length - 1) * anchoColumna;
      this.scrollLeft = Math.max(0, Math.min(nuevoScroll, scrollMaximo));
    }, { passive: false });

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

    // Cargar vistos desde localStorage
    const vistos = cargarEstado();

    // Crear botones de episodios con fragmento para mejor rendimiento
    const fragmentEpisodios = document.createDocumentFragment();
    anime.episodes.forEach(ep => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = `episode-btn ${vistos[ep.number] ? 'ep-visto' : 'ep-no-visto'}`;
      btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;

      // Ícono de visto/no visto con mejor manejo de eventos
      const icon = document.createElement("img");
      icon.className = "icon-eye";
      icon.src = vistos[ep.number] ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
      icon.alt = "visto";

      const toggleEpisodeState = () => {
        const esVisto = btn.classList.toggle("ep-visto");
        btn.classList.toggle("ep-no-visto");
        icon.src = esVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
        guardarEstado(ep.number, esVisto);
      };

      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEpisodeState();
      });

      btn.appendChild(icon);

      // Al hacer clic en el botón, redirigir al episodio
      btn.addEventListener('click', () => {
        window.location.href = `ver.html?animeId=${id}&url=${encodeURIComponent(ep.url)}`;
      });

      li.appendChild(btn);
      fragmentEpisodios.appendChild(li);
    });

    // Añadir todos los episodios de una vez para mejor rendimiento
    capContenedor.appendChild(fragmentEpisodios);
  })
  .catch(err => {
    console.error("Error al cargar datos del anime:", err);
    document.getElementById("descripcion").textContent = "Error al cargar el anime.";
  });

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

// Funciones para localStorage
function guardarEstado(epNum, visto) {
  const clave = `anime-${id}`;
  const data = JSON.parse(localStorage.getItem(clave)) || {};
  data[epNum] = visto;
  localStorage.setItem(clave, JSON.stringify(data));
}

function cargarEstado() {
  const clave = `anime-${id}`;
  return JSON.parse(localStorage.getItem(clave)) || {};
}

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
  const titulo = document.getElementById("titulo").textContent;

  btnFav.disabled = true;

  toggleFavoritoAnime(id, titulo)
    .then(res => {
      console.log(res.mensaje);
      actualizarEstadoFavorito();
    })
    .catch(err => {
      console.error("Error al cambiar favorito:", err);
    })
    .finally(() => {
      btnFav.disabled = false;
    });
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

// Función para actualizar el botón visual
async function actualizarBotonEstado() {
  const estadoActual = await obtenerEstadoActual();
  btnEstado.textContent = estadoActual;
  btnEstado.className = "";
  btnEstado.classList.add(CLASES_ESTADOS[estadoActual] || "estado-default");
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

  await limpiarEstadosPrevios();

  if (["VIENDO", "PENDIENTE", "VISTO"].includes(siguienteEstado)) {
    const ref = doc(collection(doc(db, "usuarios", user.uid), siguienteEstado.toLowerCase()), id);
    await setDoc(ref, {
      titulo: document.getElementById("titulo").textContent,
      fechaAgregado: serverTimestamp()
    });
  }

  actualizarBotonEstado();
});

// Cargar estado al iniciar sesión
onAuthStateChanged(auth, (user) => {
  if (user) actualizarBotonEstado();
});
