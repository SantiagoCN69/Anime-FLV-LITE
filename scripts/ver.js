const params = new URLSearchParams(location.search);
const animeId = params.get("animeId");
const episodioUrl = params.get("url");
const btnVolver = document.getElementById("btn-volver-anime");
const tituloAnime = document.getElementById("titulo-anime");
btnVolver.href = `anime.html?id=${animeId}`;



const btnSiguiente = document.getElementById("btn-siguiente-capitulo");
const btnAnterior = document.getElementById("btn-anterior-capitulo");

let episodios = [];
let episodioActualIndex = -1;
let embeds = [];
let bloquearAnuncios = true;
let censuraActiva = true;

const btnBloquear = document.getElementById("btn-bloquear-anuncios");
const btnCensura = document.getElementById("btn-censura");

// Inicializar estado del botón de AdBlock de manera segura
document.addEventListener('DOMContentLoaded', () => {
    if (btnBloquear) {
        btnBloquear.classList.add("activo");
        btnBloquear.textContent = "AdBlock: ON";
    }

    // Inicializar estado del botón de Censura y el video
    if (btnCensura) {
        btnCensura.classList.toggle("activo", censuraActiva);
        btnCensura.textContent = `Censura: ${censuraActiva ? "ON" : "OFF"}`;
        document.querySelector(".reproductor-container").classList.toggle("censure", censuraActiva);
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

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
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
  const user = auth.currentUser;
  if (!user) {
    console.warn('refrescarUIEstadoCapitulo: No hay usuario autenticado, no se actualiza UI de estado del capítulo.');
    return;
  }

  const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);
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

  if (!iconoVisto) {
    iconoVisto = document.createElement("img");
    iconoVisto.id = "icon-estado-capitulo";
    // Asegurarse de que el ícono se añada solo si btnEstadoCapitulo existe
    btnEstadoCapitulo.appendChild(iconoVisto); 
  }

  btnEstadoCapitulo.classList.toggle("visto", estaVisto);
  textoEstado.textContent = estaVisto ? "Visto" : "No visto";
  textoEstado.classList.toggle("visto", estaVisto);
  iconoVisto.classList.toggle("visto", estaVisto);
  iconoVisto.src = estaVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
}

async function toggleYGuardarEstadoCapitulo() {
  const user = auth.currentUser;
  if (!user) {
    console.warn('toggleYGuardarEstadoCapitulo: No hay usuario autenticado.');
    return;
  }

  const animeRef = doc(db, "usuarios", user.uid, "caps-vistos", animeId);
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
    await refrescarUIEstadoCapitulo(); // Refrescar UI después de guardar
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
    await refrescarUIEstadoCapitulo();
    await toggleYGuardarEstadoCapitulo();
  } catch (error) {
    console.error("Error al cambiar y guardar estado del capítulo", error);
  }
});

// Función para obtener y mostrar noticias

async function mostrarNoticiasDesdeFirestore() {
  const contenedorNoticias = document.getElementById('noticias_container');
  const initLoadingNoticias = document.getElementById('init-loading-noticias');

  try {
    const db = getFirestore();
    const cacheCollection = collection(db, 'cache');

    contenedorNoticias.innerHTML = '';
    const nuevasCacheSnapshot = await getDocs(
      query(cacheCollection, orderBy('date', 'desc'))
    );

    nuevasCacheSnapshot.forEach(doc => {
      const noticia = doc.data();
      const tarjetaNoticia = document.createElement('div');
      tarjetaNoticia.classList.add('tarjeta-noticia');
      tarjetaNoticia.innerHTML = `
        <img src="${noticia.image}" alt="${noticia.title}" class="noticia-imagen">
        <h3 class="noticia-titulo">${noticia.title}</h3>
        <p class="noticia-fecha">${noticia.date}</p>
      `;
      tarjetaNoticia.addEventListener('click', () => {
        window.open(`https://somoskudasai.com/noticias/${noticia.slug}`, '_blank');
      });
      contenedorNoticias.appendChild(tarjetaNoticia);
    });

    initLoadingNoticias.style.display = 'none';
  } catch (error) {
    console.error('❌ Error al mostrar noticias:', error);
    initLoadingNoticias.textContent = 'Error al mostrar las noticias.';
  }
}

async function obtenerNoticias() {
  const initLoadingNoticias = document.getElementById('init-loading-noticias');

  try {
    if (!getApps().length) {
      initializeApp(firebaseConfig);
    }
    const db = getFirestore();
    const cacheCollection = collection(db, 'cache');

    // Mostrar primero las noticias ya guardadas
    await mostrarNoticiasDesdeFirestore();

    // Luego sincronizar con la API
    const firestoreSnap = await getDocs(cacheCollection);
    const noticiasFirestore = new Map();
    firestoreSnap.forEach(doc => {
      noticiasFirestore.set(doc.id, doc.data());
    });

    const respuesta = await fetch('https://backend-noticias-anime.onrender.com/api/noticias');
    const noticiasAPI = await respuesta.json();
    const noticiasAPIMap = new Map();
    noticiasAPI.forEach(noticia => {
      noticiasAPIMap.set(noticia.title, noticia);
    });

    for (const [tituloAPI, noticiaAPI] of noticiasAPIMap) {
      if (!noticiasFirestore.has(tituloAPI)) {
        const noticiaRef = doc(cacheCollection, tituloAPI);
        await setDoc(noticiaRef, { ...noticiaAPI, timestamp: serverTimestamp() });
      } else {
        const noticiaFirestore = noticiasFirestore.get(tituloAPI);
        const { timestamp, ...firestoreData } = noticiaFirestore;
        const { ...apiData } = noticiaAPI;
        if (JSON.stringify(apiData) !== JSON.stringify(firestoreData)) {
          const noticiaRef = doc(cacheCollection, tituloAPI);
          await setDoc(noticiaRef, { ...noticiaAPI, timestamp: serverTimestamp() });
        }
      }
    }

    for (const tituloFirestore of noticiasFirestore.keys()) {
      if (!noticiasAPIMap.has(tituloFirestore)) {
        const noticiaRef = doc(cacheCollection, tituloFirestore);
        await deleteDoc(noticiaRef);
      }
    }

    // Mostrar nuevamente después de sincronizar
    await mostrarNoticiasDesdeFirestore();

  } catch (error) {
    console.error('❌ Error al sincronizar noticias:', error);
    initLoadingNoticias.textContent = 'Error al cargar las noticias.';
  }
}

obtenerNoticias();



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
  console.log("episodi actual: ", ep);
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
    console.log("servidores cargados de firestore: ", ep.servidores);
  } catch (error) {
    console.error("Error al cargar datos desde Firestore:", error);
  }

  // 2. Si no hay servidores, usar el backend
  if (!ep.servidores || !ep.servidores.length) {
    console.log("No se encontraron servidores en Firestore, cargando desde el backend.");
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

  history.replaceState({}, "", `ver.html?animeId=${animeId}&url=${ep.number}`);

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
  console.log("siguiente: ", siguiente);
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
        console.log(`Pre-cargado episodio ${siguiente.number}`);
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

    if (url.toLowerCase().includes("mega")) {
      const btnCensura = document.getElementById("btn-censura");
      if (btnCensura && censuraActiva) {
        btnCensura.click();
      }
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
    actualizarEstadoBotones();
    await refrescarUIEstadoCapitulo();
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
    await refrescarUIEstadoCapitulo();
    actualizarEstadoBotones();
  }
});


cargarEpisodios().then(actualizarEstadoBotones);


