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

    // Ajustar scroll a columna completa al terminar
    capContenedor.addEventListener('scrollend', function() {
      const columnas = this.querySelectorAll("li");
      if (columnas.length === 0) return;
      const anchoColumna = columnas[0].offsetWidth;
      const scrollActual = this.scrollLeft;
      const columnaActual = Math.round(scrollActual / anchoColumna);
      const nuevoScroll = columnaActual * anchoColumna;
      
      this.scrollTo({
        left: nuevoScroll,
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

    // Crear botones de episodios con fragmento para mejor rendimiento
    const fragmentEpisodios = document.createDocumentFragment();
    anime.episodes.forEach(ep => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = `episode-btn ep-no-visto`;
      btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;

      // Ícono de visto/no visto con mejor manejo de eventos
      const icon = document.createElement("img");
      icon.className = "icon-eye";
      icon.src = "/icons/eye-slash-solid.svg";
      icon.alt = "visto";

      const toggleEpisodeState = () => {
        const esVisto = btn.classList.toggle("ep-visto");
        btn.classList.toggle("ep-no-visto");
        icon.src = esVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
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
    crearBotonesEpisodios(anime, capContenedor);

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

  } else if (progreso < 100 && estadoActual !== "VIENDO") {
    await limpiarEstadosPrevios();
    const ref = doc(collection(doc(db, "usuarios", user.uid), "viendo"), id);
    await setDoc(ref, {
      titulo: document.getElementById("titulo").textContent,
      fechaAgregado: serverTimestamp()
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


// Función para alternar capítulos vistos
async function toggleCapituloVisto(animeId, titulo, episodio, esVisto) {
  const user = auth.currentUser;
  if (!user) {
    alert("Debes iniciar sesión para marcar capítulos.");
    throw "Usuario no autenticado";
  }

  // Referencia al documento de anime-vistos del usuario
  const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);

  try {
    const docSnap = await getDoc(animeRef);
    const datosActuales = docSnap.exists() ? docSnap.data() : {};

    let episodiosActuales, episodiosUnicos;
    if (esVisto) {
      // Marcar como visto
      episodiosActuales = datosActuales.episodiosVistos || [];
      episodiosUnicos = new Set([...episodiosActuales, episodio.toString()]);

      await setDoc(animeRef, { 
        titulo, 
        fechaAgregado: Date.now(),
        episodiosVistos: Array.from(episodiosUnicos)
      });

      // Actualizar progreso
      const totalEpisodios = document.querySelectorAll('.episode-btn').length;
      actualizarProgresoCapitulos(totalEpisodios, Array.from(episodiosUnicos));

      return { mensaje: `Episodio ${episodio} marcado como visto` };
    } else {
      // Desmarcar como visto
      episodiosActuales = datosActuales.episodiosVistos || [];
      episodiosUnicos = episodiosActuales.filter(ep => ep !== episodio.toString());

      await setDoc(animeRef, { 
        ...datosActuales,
        episodiosVistos: episodiosUnicos
      });

      // Actualizar progreso
      const totalEpisodios = document.querySelectorAll('.episode-btn').length;
      actualizarProgresoCapitulos(totalEpisodios, episodiosUnicos);

      return { mensaje: `Episodio ${episodio} desmarcado como visto` };
    }
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
    // Obtener el documento del anime en la colección caps-vistos
    const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);
    
    // Obtener los datos del documento
    const docSnap = await getDoc(animeRef);

    // Si el documento existe y tiene la propiedad episodiosVistos, devolverla
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


function crearBotonesEpisodios(anime, capContenedor) {
  const fragmentEpisodios = document.createDocumentFragment();
  
  // Obtener capítulos vistos antes de crear los botones
  obtenerCapitulosVistos(id).then(capitulosVistos => {
    anime.episodes.forEach(ep => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      
      // Marcar como visto si ya está en la lista de capítulos vistos
      const estaVisto = capitulosVistos.includes(ep.number.toString());
      btn.className = `episode-btn ${estaVisto ? 'ep-visto' : 'ep-no-visto'}`;
      btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;

      // Ícono de visto/no visto con mejor manejo de eventos
      const icon = document.createElement("img");
      icon.className = "icon-eye";
      icon.src = estaVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
      icon.alt = "visto";

      const toggleEpisodeState = async () => {
        const esVisto = btn.classList.toggle("ep-visto");
        btn.classList.toggle("ep-no-visto");
        icon.src = esVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
        
        // Guardar o eliminar de capítulos vistos
        try {
          const titulo = document.getElementById("titulo").textContent;
          await toggleCapituloVisto(id, titulo, ep.number, esVisto);
        } catch (error) {
          console.error("Error al cambiar estado del capítulo:", error);
          // Revertir cambios visuales si hay un error
          btn.classList.toggle("ep-visto");
          btn.classList.toggle("ep-no-visto");
          icon.src = esVisto ? "/icons/eye-slash-solid.svg" : "/icons/eye-solid.svg";
        }
      };

      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEpisodeState();
      });

      btn.appendChild(icon);

      // Al hacer clic en el botón, marcar como visto y redirigir al episodio
      btn.addEventListener('click', async () => {
        // Si no está marcado como visto, marcarlo
        if (!btn.classList.contains('ep-visto')) {
          btn.classList.toggle('ep-visto');
          btn.classList.toggle('ep-no-visto');
          icon.src = '/icons/eye-solid.svg';
          
          // Guardar el estado de visto
          try {
            const titulo = document.getElementById('titulo').textContent;
            await toggleCapituloVisto(id, titulo, ep.number, true);
          } catch (err) {
            console.error('Error al marcar capítulo como visto:', err);
            // Revertir cambios visuales
            btn.classList.toggle('ep-visto');
            btn.classList.toggle('ep-no-visto');
            icon.src = '/icons/eye-slash-solid.svg';
          }
        }
        
        // Redirigir al episodio
        window.location.href = `ver.html?animeId=${id}&url=${encodeURIComponent(ep.url)}`;
      });

      li.appendChild(btn);
      fragmentEpisodios.appendChild(li);
    });

    // Añadir todos los episodios de una vez para mejor rendimiento
    capContenedor.appendChild(fragmentEpisodios);
  }).catch(error => {
    console.error("Error al obtener capítulos vistos:", error);
    // En caso de error, crear botones sin estado de visto
    anime.episodes.forEach(ep => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = `episode-btn ep-no-visto`;
      btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;

      // Ícono de visto/no visto con mejor manejo de eventos
      const icon = document.createElement("img");
      icon.className = "icon-eye";
      icon.src = "/icons/eye-slash-solid.svg";
      icon.alt = "visto";

      const toggleEpisodeState = async () => {
        const esVisto = btn.classList.toggle("ep-visto");
        btn.classList.toggle("ep-no-visto");
        icon.src = esVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
        
        // Guardar o eliminar de capítulos vistos
        try {
          const titulo = document.getElementById("titulo").textContent;
          await toggleCapituloVisto(id, titulo, ep.number, esVisto);
        } catch (error) {
          console.error("Error al cambiar estado del capítulo:", error);
          // Revertir cambios visuales si hay un error
          btn.classList.toggle("ep-visto");
          btn.classList.toggle("ep-no-visto");
          icon.src = esVisto ? "/icons/eye-slash-solid.svg" : "/icons/eye-solid.svg";
        }
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
  });
}
