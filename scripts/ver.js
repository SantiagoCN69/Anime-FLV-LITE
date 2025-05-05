const params = new URLSearchParams(location.search);
const animeId = params.get("animeId");
const episodioUrl = decodeURIComponent(params.get("url") || "");
const btnVolver = document.getElementById("btn-volver-anime");
const tituloAnime = document.getElementById("titulo-anime");
btnVolver.href = `anime.html?id=${animeId}`;

// Obtener título del anime
async function obtenerTituloAnime() {
    try {
        const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${animeId}`);
        const data = await res.json();
        tituloAnime.textContent = data.title || "Anime";
        btnVolver.textContent = `Volver a ${data.title || "Anime"}`;
    } catch (error) {
        console.error("Error al obtener título del anime:", error);
        tituloAnime.textContent = "Anime";
        btnVolver.textContent = "Volver a Anime";
    }
}
obtenerTituloAnime();

const btnSiguiente = document.getElementById("btn-siguiente-capitulo");
const btnAnterior = document.getElementById("btn-anterior-capitulo");

let episodios = [];
let episodioActualIndex = -1;
let embeds = [];
let bloquearAnuncios = true;
let censuraActiva = false;

const btnBloquear = document.getElementById("btn-bloquear-anuncios");
const btnCensura = document.getElementById("btn-censura");

// Inicializar estado del botón de AdBlock de manera segura
document.addEventListener('DOMContentLoaded', () => {
    if (btnBloquear) {
        btnBloquear.classList.add("activo");
        btnBloquear.textContent = "AdBlock: ON";
    }
});

btnBloquear.addEventListener("click", () => {
  bloquearAnuncios = !bloquearAnuncios;
  btnBloquear.textContent = `AdBlock: ${bloquearAnuncios ? "ON" : "OFF"}`;
  btnBloquear.classList.toggle("activo", bloquearAnuncios);
  const servidorActivo = document.querySelector("#controles .servidor-activo");
  if (embeds.length && servidorActivo) mostrarVideo(embeds[embeds.indexOf(servidorActivo.dataset.link)], servidorActivo);
});

btnCensura.addEventListener("click", () => {
  censuraActiva = !censuraActiva;
  btnCensura.textContent = `Censura: ${censuraActiva ? "ON" : "OFF"}`;
  btnCensura.classList.toggle("activo", censuraActiva);
  document.getElementById("video").classList.toggle("censure", censuraActiva);
});

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

// Inicialización de Firebase optimizada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

// Función optimizada para alternar capítulos vistos
async function toggleCapituloVisto(animeId, titulo, episodio, esVisto) {
  const user = auth.currentUser;
  if (!user) {
    alert("Debes iniciar sesión para marcar capítulos.");
    return false;
  }

  const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);

  try {
    const docSnap = await getDoc(animeRef);
    const datosActuales = docSnap.exists() ? docSnap.data() : {};
    const episodiosActuales = new Set(datosActuales.episodiosVistos || []);

    esVisto ? episodiosActuales.add(episodio.toString()) : episodiosActuales.delete(episodio.toString());

    await setDoc(animeRef, { 
      titulo, 
      fechaAgregado: serverTimestamp(),
      episodiosVistos: Array.from(episodiosActuales)
    });

    return esVisto;
  } catch (error) {
    console.error("Error al cambiar estado del capítulo:", error);
    alert("Hubo un error al cambiar el estado del capítulo.");
    return false;
  }
}

// Función optimizada para obtener capítulos vistos
async function obtenerCapitulosVistos(animeId) {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);
    const docSnap = await getDoc(animeRef);
    return docSnap.exists() ? (docSnap.data().episodiosVistos || []) : [];
  } catch (error) {
    console.error("Error al obtener capítulos vistos:", error);
    return [];
  }
}

// Función para actualizar el estado del capítulo
async function actualizarEstadoCapitulo() {
  console.log('Iniciando actualizarEstadoCapitulo');
  console.log('Estado actual:', {
    user: !!auth.currentUser,
    animeId,
    episodios: episodios.length,
    episodioActualIndex
  });

  const user = auth.currentUser;
  if (!user) {
    console.warn('No hay usuario autenticado');
    return;
  }
  if (!animeId) {
    console.warn('No hay animeId');
    return;
  }
  if (!episodios || episodios.length === 0) {
    console.warn('No hay episodios');
    return;
  }
  if (episodioActualIndex === -1) {
    console.warn('Índice de episodio no válido');
    return;
  }

  try {
    const capitulosVistos = await obtenerCapitulosVistos(animeId);
    const episodioActual = episodios[episodioActualIndex];

    console.log('Episodio actual:', episodioActual);

    const btnEstadoCapitulo = document.getElementById("btn-estado-capitulo");
    const textoEstado = document.getElementById("texto-estado-capitulo");

    // Verificar que todos los elementos existan
    if (!btnEstadoCapitulo) {
      console.warn("Botón de estado de capítulo no encontrado");
      return;
    }
    if (!textoEstado) {
      console.warn("Texto de estado no encontrado");
      return;
    }

    // Crear ícono si no existe
    let iconoVisto = document.getElementById("icon-estado-capitulo");
    if (!iconoVisto) {
      iconoVisto = document.createElement("img");
      iconoVisto.id = "icon-estado-capitulo";
      iconoVisto.src = "/icons/eye-slash-solid.svg";
      btnEstadoCapitulo.appendChild(iconoVisto);
    }

    const episodioId = String(episodioActual.number || episodioActual.title);

    console.log("Capítulos vistos:", capitulosVistos);
    console.log("Episodio actual ID:", episodioId);

    // Modificar para que siempre se actualice desde la base de datos
    const estaVisto = capitulosVistos.includes(episodioId);
    btnEstadoCapitulo.classList.toggle("visto", estaVisto);
    
    textoEstado.textContent = estaVisto ? "Visto" : "No visto";
    textoEstado.classList.toggle("visto", estaVisto);
    
    // Actualizar ícono
    iconoVisto.classList.toggle("visto", estaVisto);
    iconoVisto.src = estaVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
  } catch (error) {
    console.error("Error al actualizar estado del capítulo:", error);
  }
}

// Verificación de capítulos vistos al cargar
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await actualizarEstadoCapitulo();
  }
});

// Función para esperar a que se carguen los episodios
function esperarCargaEpisodios() {
  return new Promise((resolve) => {
    const checkEpisodios = () => {
      if (episodios && episodios.length > 0) {
        resolve();
      } else {
        setTimeout(checkEpisodios, 100);
      }
    };
    checkEpisodios();
  });
}

// Llamar a la función de actualización cuando se carga el contenido
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await esperarCargaEpisodios();
    if (auth.currentUser) {
      await actualizarEstadoCapitulo();
    } else {
      // Esperar autenticación
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          await actualizarEstadoCapitulo();
        }
      });
    }
  } catch (error) {
    console.error("Error en la carga inicial:", error);
  }
});

async function cargarEpisodios() {
  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episodes?id=${animeId}`);
    const data = await res.json();
    episodios = data.episodes;
    episodioActualIndex = episodios.findIndex(ep => ep.url === episodioUrl);
    if (episodioActualIndex === -1) throw new Error("Episodio no encontrado");
    await cargarVideoDesdeEpisodio(episodioActualIndex);
    return episodios;
  } catch (err) {
    document.getElementById("video").innerHTML = "Error al cargar episodio.";
    console.error(err);
    return [];
  }
}

async function cargarVideoDesdeEpisodio(index) {
  const ep = episodios[index];
  const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?url=${encodeURIComponent(ep.url)}`);
  const data = await res.json();
  if (!data.servidores || !data.servidores.length) {
    document.getElementById("video").innerHTML = "No se encontraron servidores.";
    return;
  }

  // Guardar servidores en el objeto del episodio
  ep.servidores = data.servidores.map((servidor, index) => ({
    nombre: `Servidor ${index + 1}`,
    url: servidor
  }));

  // Actualizar episodios en Firestore
  try {
    const animeDatosRef = doc(db, 'datos-animes', animeId);
    const animeDatosSnap = await getDoc(animeDatosRef);
    const animeDatos = animeDatosSnap.data() || {};

    // Actualizar el episodio específico en el array de episodios
    if (!animeDatos.episodios) animeDatos.episodios = [];
    const episodioIndex = animeDatos.episodios.findIndex(e => e.url === ep.url);
    
    if (episodioIndex !== -1) {
      animeDatos.episodios[episodioIndex] = {
        ...animeDatos.episodios[episodioIndex],
        servidores: ep.servidores
      };
    } else {
      animeDatos.episodios.push({
        ...ep,
        servidores: ep.servidores
      });
    }

    // Guardar los datos actualizados
    await setDoc(animeDatosRef, { episodios: animeDatos.episodios }, { merge: true });
    console.log(`Servidores del episodio ${ep.number} guardados en Firestore`);
  } catch (error) {
    console.error('Error al guardar servidores en Firestore:', error);
  }

  embeds = data.servidores;
  episodioActualIndex = index;

  const btnCap = document.getElementById("btn-cap");
  btnCap.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;

  // Configurar evento para cambiar estado de capítulo
  const btnEstadoCapitulo = document.getElementById("btn-estado-capitulo");
  const textoEstado = document.getElementById("texto-estado-capitulo");
  const iconoVisto = document.getElementById("icon-estado-capitulo");

  if (!iconoVisto) {
    const nuevoIconoVisto = document.createElement("img");
    nuevoIconoVisto.id = "icon-estado-capitulo";
    nuevoIconoVisto.src = "/icons/eye-slash-solid.svg";
    btnEstadoCapitulo.appendChild(nuevoIconoVisto);
  }

  btnEstadoCapitulo.addEventListener("click", async () => {
    const titulo = tituloAnime.textContent;
    const esVisto = !iconoVisto.classList.contains("visto");
    
    try {
      await toggleCapituloVisto(animeId, titulo, ep.number || ep.title, esVisto);
      await actualizarEstadoCapitulo();
    } catch (error) {
      console.error("Error al cambiar estado del capítulo", error);
    }
  });

  await actualizarEstadoCapitulo();
  history.replaceState({}, "", `ver.html?animeId=${animeId}&url=${encodeURIComponent(ep.url)}`);

  const controles = document.getElementById("controles");
  controles.innerHTML = "";
  embeds.forEach((srv, i) => {
    const btn = document.createElement("button");
    btn.textContent = `${i + 1}`;
    btn.dataset.link = srv;
    btn.onclick = () => mostrarVideo(srv, btn);
    controles.appendChild(btn);
  });

  mostrarVideo(embeds[0], controles.querySelector("button"));
  return ep;
}

function mostrarVideo(link, botonSeleccionado) {
  const botones = document.querySelectorAll("#controles button");
  botones.forEach(btn => btn.classList.remove("servidor-activo"));
  if (botonSeleccionado) botonSeleccionado.classList.add("servidor-activo");

  const videoDiv = document.getElementById("video");
  videoDiv.innerHTML = "";

  if (link.endsWith(".mp4") || link.endsWith(".m3u8") || link.includes(".mp4?") || link.includes(".m3u8?")) {
    const video = document.createElement("video");
    video.src = link;
    video.controls = true;
    video.autoplay = true;
    video.width = "100%";
    video.height = "100%";
    video.style.maxHeight = "80vh";
    videoDiv.appendChild(video);
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = link;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.frameBorder = "0";
    iframe.allowFullscreen = true;
    iframe.scrolling = "no";

    if (!bloquearAnuncios) {
      iframe.removeAttribute("sandbox");
    } else {
      iframe.sandbox = "allow-scripts allow-same-origin allow-forms";
    }

    videoDiv.appendChild(iframe);
  }
}

function actualizarEstadoBotones() {
  btnAnterior.disabled = episodioActualIndex <= 0;
  btnAnterior.classList.toggle('desactivado', episodioActualIndex <= 0);

  btnSiguiente.disabled = episodioActualIndex >= episodios.length - 1;
  btnSiguiente.classList.toggle('desactivado', episodioActualIndex >= episodios.length - 1);
}

// Configurar navegación de botones
btnSiguiente.addEventListener("click", async (e) => {
  e.preventDefault();
  if (episodioActualIndex < episodios.length - 1) {
    // Marcar como visto con el botón de siguiente
    const titulo = tituloAnime.textContent;
    const episodioActual = episodios[episodioActualIndex];
    const episodioId = String(episodioActual.number || episodioActual.title);

    try {
      await toggleCapituloVisto(animeId, titulo, episodioId, true);
      await actualizarEstadoCapitulo();
    } catch (error) {
      console.error("Error al marcar capítulo", error);
    }

    await cargarVideoDesdeEpisodio(episodioActualIndex + 1);
    actualizarEstadoBotones();
  }
});

btnAnterior.addEventListener("click", async (e) => {
  e.preventDefault();
  if (episodioActualIndex > 0) {
    // Desmarcar el capítulo actual
    const titulo = tituloAnime.textContent;
    const episodioActual = episodios[episodioActualIndex];
    const episodioId = String(episodioActual.number || episodioActual.title);

    try {
      await toggleCapituloVisto(animeId, titulo, episodioId, false);
      await actualizarEstadoCapitulo();
    } catch (error) {
      console.error("Error al desmarcar capítulo", error);
    }

    await cargarVideoDesdeEpisodio(episodioActualIndex - 1);
    actualizarEstadoBotones();
  }
});

cargarEpisodios().then(actualizarEstadoBotones);