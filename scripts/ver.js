const params = new URLSearchParams(location.search);
const animeId = params.get("id");
const episodioUrl = params.get("url");
const btnVolver = document.getElementById("btn-volver-anime");
const tituloAnime = document.getElementById("titulo-anime");
btnVolver.href = `anime.html?id=${animeId}`;

document.title = "AniZen - " + animeId + " - " + episodioUrl;

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
  const servidorActivoBtn = document.querySelector("#controles .servidor-activo");
  if (embeds.length && servidorActivoBtn) {
    const botonesServidor = Array.from(document.querySelectorAll("#controles button"));
    const indiceServidorActivo = botonesServidor.indexOf(servidorActivoBtn);
    if (indiceServidorActivo !== -1) {
      mostrarVideo(embeds[indiceServidorActivo], servidorActivoBtn);
    }
  }
});

btnCensura.addEventListener("click", () => {
  censuraActiva = !censuraActiva;
  btnCensura.textContent = `Censura: ${censuraActiva ? "ON" : "OFF"}`;
  btnCensura.classList.toggle("activo", censuraActiva);
  document.querySelector(".reproductor-container").classList.toggle("censure", censuraActiva);
});

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

// Inicialización de Firebase optimizada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

function ponerTitulo(id) {
  const tituloAnime = document.getElementById('titulo-anime');
  tituloAnime.textContent = "Volver a " + id;
}
ponerTitulo(animeId);

async function refrescarUIEstadoCapitulo() {
  const user = localStorage.getItem("userID");
  if (!user) {
    console.warn('refrescarUIEstadoCapitulo: No hay usuario autenticado, no se actualiza UI de estado del capítulo.');
    return;
  }

  const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
  const docSnap = await getDoc(animeRef);
  const capitulosVistos = docSnap.exists() ? docSnap.data().episodiosVistos || [] : [];

  if (!episodios || episodios.length === 0 || episodioActualIndex < 0 || episodioActualIndex >= episodios.length) {
    console.warn('refrescarUIEstadoCapitulo: Lista de episodios no disponible o índice inválido.');
    return;
  }

  const episodioActual = episodios[episodioActualIndex];
  if (!episodioActual) {
    console.warn('refrescarUIEstadoCapitulo: Episodio no válido o no encontrado.');
    return;
  }

  const episodioId = String(episodioActual.number || episodioActual.title);
  const estaVisto = capitulosVistos.includes(episodioId);

  // Actualizar el estado de la interfaz
  const btnEstadoCapitulo = document.getElementById("btn-estado-capitulo");
  const textoEstado = document.getElementById("texto-estado-capitulo");
  let iconoVisto = document.getElementById("icon-estado-capitulo");

  if (!btnEstadoCapitulo || !textoEstado) {
    console.warn('refrescarUIEstadoCapitulo: No se encontraron elementos de UI para el estado del capítulo.');
    return;
  }

  btnEstadoCapitulo.classList.toggle("visto", estaVisto);
  textoEstado.textContent = estaVisto ? "Visto" : "No visto";
  textoEstado.classList.toggle("visto", estaVisto);
}

async function toggleYGuardarEstadoCapitulo() {
  const user = localStorage.getItem("userID");
  if (!user) {
    console.warn('toggleYGuardarEstadoCapitulo: No hay usuario autenticado.');
    window.alert('Inicia sesión para guardar tu progreso de capítulos, animes y mucho más!.');
    return;
  }

  const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
  const docSnap = await getDoc(animeRef);
  const capitulosVistos = docSnap.exists() ? docSnap.data().episodiosVistos || [] : [];

  if (!episodios || episodios.length === 0 || episodioActualIndex < 0 || episodioActualIndex >= episodios.length) {
    console.warn('toggleYGuardarEstadoCapitulo: Lista de episodios no disponible o índice inválido.');
    return;
  }
  const episodioActual = episodios[episodioActualIndex];
  if (!episodioActual) {
    console.warn('toggleYGuardarEstadoCapitulo: Episodio actual no encontrado.');
    return;
  }
  const episodioId = String(episodioActual.number || episodioActual.title);
  const titulo = tituloAnime.textContent; // Asumiendo que tituloAnime está disponible globalmente y actualizado

  const estaVistoActualmente = capitulosVistos.includes(episodioId);
  const nuevoEstadoVisto = !estaVistoActualmente; // Alternamos el estado

  const episodiosActuales = new Set(capitulosVistos);
  if (nuevoEstadoVisto) {
    episodiosActuales.add(episodioId);
  } else {
    episodiosActuales.delete(episodioId);
  }

  try {
    await setDoc(animeRef, {
      titulo,
      fechaAgregado: serverTimestamp(), // O podrías querer actualizar solo si se añade un nuevo anime
      episodiosVistos: Array.from(episodiosActuales)
    });
  } catch (error) {
    console.error("Error al guardar estado del capítulo en Firestore:", error);
  }
}
// Esperar a que el estado de autenticación esté listo
document.addEventListener("authStateReady", async (event) => {
  if (event.detail.user) {
    try {
      await refrescarUIEstadoCapitulo();
    } catch (error) {
      console.error("Error en refrescarUIEstadoCapitulo tras authStateReady", error);
    }
  } else {
    console.warn("Usuario no autenticado según authStateReady en ver.js");
  }
});

// ...

// Evento para cambiar el estado del capítulo al hacer clic

const btnEstadoCapitulo = document.getElementById("btn-estado-capitulo");
btnEstadoCapitulo.addEventListener("click", async () => {
  try {
    await toggleYGuardarEstadoCapitulo();
    await refrescarUIEstadoCapitulo();
  } catch (error) {
    console.error("Error al cambiar y guardar estado del capítulo", error);
  }
});


function crearNoticiaHTML(noticia, base64img) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'tarjeta-noticia';
  
  // Usar la imagen en base64 si está disponible, si no, usar la URL original
  const imagenSrc = base64img || noticia.image;
  
  tarjeta.innerHTML = `
    <img src="${imagenSrc}" 
         alt="${noticia.title}" 
         class="noticia-imagen"
         loading="lazy">
    <h3 class="noticia-titulo">${noticia.title}</h3>
    <p class="noticia-fecha">${noticia.date}</p>
  `;
  
  tarjeta.onclick = () => window.open(`https://somoskudasai.com/noticias/${noticia.slug}`, '_blank');
  return tarjeta;
}

async function manejarNoticias() {
  const contenedorNoticias = document.getElementById('noticias_container');
  const initLoadingNoticias = document.getElementById('init-loading-noticias');
  let noticiasFirestore = [];

  // 1. Cargar primero de Firestore (caché rápido)
  try {
    const noticiasRef = doc(db, "noticias", "noticias");
    const docSnap = await getDoc(noticiasRef);
    if (docSnap.exists()) {
      noticiasFirestore = docSnap.data().noticias;
      // Mostrar noticias desde caché
      initLoadingNoticias.style.display = 'none';
      noticiasFirestore.forEach(noticia => {
        const tarjeta = crearNoticiaHTML(noticia, noticia.image);
        contenedorNoticias.appendChild(tarjeta);
      });
    }
  } catch (error) {
    console.error("Error al cargar noticias de Firestore:", error);
  }

  // 2. Verificar API en segundo plano
  try {
    const respuesta = await fetch("https://backend-noticias-anime.onrender.com/api/noticias");
    const noticiasAPI = await respuesta.json();

    // Función para comparar noticias
    const sonIguales = (a, b) => {
      if (a.length !== b.length) return false;
      return a.every((n, i) => 
        n.title === b[i].title && 
        n.slug === b[i].slug && 
        n.date === b[i].date
      );
    };

    // Si son diferentes o no hay en Firestore, actualizar
    if (!noticiasFirestore.length || !sonIguales(noticiasAPI, noticiasFirestore)) {
      
      // Procesar imágenes
      const noticiasActualizadas = await Promise.all(
        noticiasAPI.map(async noticia => {
          try {
            const res = await fetch(`https://backend-noticias-anime.onrender.com/api/imagen-base64?url=${noticia.image}`);
            initLoadingNoticias.style.display = 'none';
            const { base64 } = await res.json();
            return { ...noticia, image: base64 || noticia.image };
          } catch (error) {
            console.error('Error al procesar imagen:', error);
            return noticia;
          }
        })
      );

      // Actualizar UI
      if (noticiasFirestore.length === 0) {
        contenedorNoticias.innerHTML = '';
        noticiasActualizadas.forEach(noticia => {
          const tarjeta = crearNoticiaHTML(noticia, noticia.image);
          contenedorNoticias.appendChild(tarjeta);
        });
      }

      // Guardar en Firestore
      try {
        const noticiasRef = doc(db, "noticias", "noticias");
        await setDoc(noticiasRef, { noticias: noticiasActualizadas });
      } catch (error) {
        console.error("Error al guardar en Firestore:", error);
      }
    }
  } catch (error) {
    console.error("Error al verificar noticias:", error);
  } finally {
    initLoadingNoticias.style.display = 'none';
  }
}


manejarNoticias();



async function cargarEpisodios() {
  try {
    const episodiosRef = doc(db, "datos-animes", animeId); 
    
    const docSnap = await getDoc(episodiosRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      episodios = data.episodios || [];
      episodioActualIndex = episodios.findIndex(ep => ep.number === parseInt(episodioUrl));
      // Si encontramos el episodio en Firestore, cargamos el video
      await cargarVideoDesdeEpisodio(episodioActualIndex);
      return episodios;
    } else {
      throw new Error("No se encontraron episodios en Firestore, cargando desde la API externa.");
    }
  } catch (err) {
    console.warn("Error al cargar desde Firestore:", err);
    
    
  }
}


async function cargarVideoDesdeEpisodio(index) {
  const ep = episodios[index];
  const btnCap = document.getElementById("btn-cap"); 
  if (btnCap && ep) {
    btnCap.textContent = `Episodio ${ep.number || "desconocido"}`;
  } else if (btnCap) {
    btnCap.textContent = "Episodio desconocido";
    console.warn("No se pudo determinar el episodio actual para btnCap en cargarVideoDesdeEpisodio");
  }


  // 1. Intentar cargar servidores desde Firestore
  try {
    const animeDatosRef = doc(db, 'datos-animes', animeId);
    const animeDatosSnap = await getDoc(animeDatosRef);
    const animeDatos = animeDatosSnap.data() || {};

    const episodioGuardado = animeDatos.episodios?.find(e => e.url === ep.url);
    if (episodioGuardado?.servidores?.length) {
      ep.servidores = episodioGuardado.servidores;
    }
  } catch (error) {
    console.error("Error al cargar datos desde Firestore:", error);
  }

  // 2. Si no hay servidores, usar el backend
  if (!ep.servidores || !ep.servidores.length) {
    try {
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?url=https://www3.animeflv.net/ver/${animeId}-${episodioUrl}`);
      const data = await res.json();

      if (!data.servidores?.length) {
        document.getElementById("video").innerHTML = "No se encontraron servidores.";
        return;
      }

      ep.servidores = data.servidores.map((servidor, index) => ({
        nombre: `Servidor ${index + 1}`,
        url: servidor
      }));

      // Guardar en Firestore
      const animeDatosRef = doc(db, 'datos-animes', animeId);
      const animeDatosSnap = await getDoc(animeDatosRef);
      const animeDatos = animeDatosSnap.data() || {};

      if (!animeDatos.episodios) animeDatos.episodios = [];
      const episodioIndex = animeDatos.episodios.findIndex(e => e.url === ep.url);

      if (episodioIndex !== -1) {
        animeDatos.episodios[episodioIndex].servidores = ep.servidores;
      } else {
        animeDatos.episodios.push({ ...ep });
      }

      await setDoc(animeDatosRef, { episodios: animeDatos.episodios }, { merge: true });
    } catch (error) {
      console.error('Error al cargar desde backend o guardar en Firestore:', error);
    }
  }

  embeds = ep.servidores;
  episodioActualIndex = index;

  // Reordenar servidores: Mega primero, luego YourUpload, luego el resto
  if (embeds && embeds.length > 0) {
    let megaServer = null;
    let yourUploadServer = null;
    const otherServers = [];

    embeds.forEach(srv => {
      if (srv && typeof srv.url === "string") {
        if (srv.url.includes('mega.nz/')) {
          megaServer = srv;
        } else if (srv.url.includes('yourupload.com/embed/')) {
          yourUploadServer = srv;
        } else {
          otherServers.push(srv);
        }
      } else {
        otherServers.push(srv); 
      }
    });

    const orderedEmbeds = [];
    if (megaServer) orderedEmbeds.push(megaServer);
    if (yourUploadServer) orderedEmbeds.push(yourUploadServer);
    orderedEmbeds.push(...otherServers);
    embeds = orderedEmbeds;
  }
  //reasigna los nombres de servidor segun el nuevo orden
  embeds.forEach((srv, i) => {
    srv.nombre = `Servidor ${i + 1}`;
  });

  history.replaceState({}, "", `ver.html?id=${animeId}&url=${ep.number}`);

  const controles = document.getElementById("controles");
  controles.innerHTML = "";
  embeds.forEach((srv, i) => {
    const btn = document.createElement("button");
    btn.textContent = srv.nombre ? srv.nombre.replace("Servidor ", "") : `${i + 1}`;
    btn.title = extraerNombreDesdeURL(srv.url);
    btn.onclick = () => mostrarVideo(srv, btn);
    controles.appendChild(btn);
  });

  // Mostrar el primer video de la lista reordenada (si existe)
  if (embeds && embeds.length > 0) {
    const buttons = controles.querySelectorAll("button");
    if (buttons.length > 0) {
      mostrarVideo(embeds[0], buttons[0]);
    } else {
      // Esto no debería ocurrir si embeds tiene elementos y los botones se crean correctamente
      document.getElementById("video").innerHTML = "No se encontraron botones de servidor.";
    }
  } else {
    document.getElementById("video").innerHTML = "No hay servidores disponibles para mostrar.";
  }

  // Pre-cargar siguiente episodio (si existe)
  const siguiente = episodios[index + 1];
  if (siguiente && (!siguiente.servidores || !siguiente.servidores.length)) {
    try {
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?url=${siguiente.url}`);
      const data = await res.json();

      if (data.servidores?.length) {
        siguiente.servidores = data.servidores.map((srv, i) => ({
          nombre: `Servidor ${i + 1}`,
          url: srv
        }));

        const ref = doc(db, 'datos-animes', animeId);
        const snap = await getDoc(ref);
        const datos = snap.data() || {};
        if (!datos.episodios) datos.episodios = [];

        const idx = datos.episodios.findIndex(e => e.url === siguiente.url);
        if (idx !== -1) {
          datos.episodios[idx].servidores = siguiente.servidores;
        } else {
          datos.episodios.push({ ...siguiente });
        }

        await setDoc(ref, { episodios: datos.episodios }, { merge: true });
      }
    } catch (err) {
      console.warn("No se pudo pre-cargar el siguiente episodio:", err);
    }
  }

  return ep;
}

//funcion extraer nombre del link
function extraerNombreDesdeURL(url) {
  try {
    const sinProtocolo = url.split('//')[1];
    if (!sinProtocolo) return null;

    const partes = sinProtocolo.split('.');
    if (sinProtocolo.startsWith('www.')) {
      return partes[1]; 
    } else {
      return partes[0]; 
    }
  } catch (e) {
    return null;
  }
}

function mostrarVideo(link, botonSeleccionado) {
  const url = typeof link === "string" ? link : link.url;

  const botones = document.querySelectorAll("#controles button");
  botones.forEach(btn => btn.classList.remove("servidor-activo"));
  if (botonSeleccionado) botonSeleccionado.classList.add("servidor-activo");

  const videoDiv = document.getElementById("video");
  videoDiv.innerHTML = "";

  if (url.endsWith(".mp4") || url.endsWith(".m3u8") || url.includes(".mp4?") || url.includes(".m3u8?")) {
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.autoplay = true;
    video.width = "100%";
    video.height = "100%";
    video.style.maxHeight = "80vh";
    videoDiv.appendChild(video);
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = url;
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
    const marcarVistoBtn = document.getElementById("btn-estado-capitulo");
    if (marcarVistoBtn && !marcarVistoBtn.classList.contains('visto')) {
      await toggleYGuardarEstadoCapitulo();
    }
    await cargarVideoDesdeEpisodio(episodioActualIndex + 1);
    refrescarUIEstadoCapitulo();
    actualizarEstadoBotones();
  }
});

btnAnterior.addEventListener("click", async (e) => {
  e.preventDefault();
  if (episodioActualIndex > 0) {
    const marcarVistoBtn = document.getElementById("btn-estado-capitulo");
    if (marcarVistoBtn && marcarVistoBtn.classList.contains('visto')) {
      await toggleYGuardarEstadoCapitulo();
    }
    await cargarVideoDesdeEpisodio(episodioActualIndex - 1);
    refrescarUIEstadoCapitulo();
    actualizarEstadoBotones();
  }
});


cargarEpisodios().then(actualizarEstadoBotones);


