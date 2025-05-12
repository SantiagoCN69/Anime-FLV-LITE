const params = new URLSearchParams(location.search);
const animeId = params.get("animeId");
const episodioUrl = decodeURIComponent(params.get("url") || "");
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

async function obtenerTituloAnime(id) {
  try {
    // 1. Verificar si el título del anime está en Firestore
    const animeRef = doc(db, 'datos-animes', id);
    const animeSnap = await getDoc(animeRef);

    let titulo = "Anime"; // Título por defecto

    if (animeSnap.exists()) {
      // Si el título existe en Firestore, lo cargamos
      titulo = animeSnap.data().titulo || "Anime";
    } else {
      // Si no existe, lo obtenemos desde la API
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${id}`);
      const data = await res.json();
      
      // 2. Guardar el título del anime en Firestore
      titulo = data.title || "Anime";
      await setDoc(doc(db, 'datos-animes', id), { titulo, fechaGuardado: serverTimestamp() }, { merge: true });
    }

    // 3. Mostrar el título en la interfaz
    const tituloAnime = document.getElementById('titulo-anime');
    tituloAnime.textContent = "Volver a " + titulo;
  } catch (err) {
    console.error('Error al obtener título del anime:', err);
    const tituloAnime = document.getElementById('titulo-anime');
    tituloAnime.textContent = "Error al cargar título";
  }
}

// Llamar a la función pasando el ID del anime
obtenerTituloAnime(animeId);

async function refrescarUIEstadoCapitulo() {
  const user = auth.currentUser;
  if (!user) {
    // No actualizamos UI si no hay usuario, podría mostrar "No visto" incorrectamente
    // o podríamos decidir mostrar un estado deshabilitado/oculto.
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
    alert('Debe iniciar sesión para marcar capítulos como vistos.');
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

async function obtenerNoticias() {
  const contenedorNoticias = document.getElementById('noticias_container');
  const initLoadingServidores = document.querySelector('.init-loading-servidores');

  try {
    // Inicializar Firebase si no está inicializado
    if (!getApps().length) {
      initializeApp(firebaseConfig);
    }
    const db = getFirestore();
    const cacheCollection = collection(db, 'cache');

    // 1. Obtener todas las noticias de Firestore
    const firestoreSnap = await getDocs(cacheCollection);
    const noticiasFirestore = new Map(); 
    firestoreSnap.forEach(doc => {
      noticiasFirestore.set(doc.id, doc.data());
    });

    // 2. Obtener noticias de la API
    const respuesta = await fetch('https://backend-noticias-anime.onrender.com/api/noticias');
    const noticiasAPI = await respuesta.json();
    const noticiasAPIMap = new Map(); 
    noticiasAPI.forEach(noticia => {
      noticiasAPIMap.set(noticia.title, noticia); 
    });

    // 3. Identificar y agregar nuevas noticias desde la API a Firestore
    for (const [tituloAPI, noticiaAPI] of noticiasAPIMap) {
      if (!noticiasFirestore.has(tituloAPI)) {
        const noticiaRef = doc(cacheCollection, tituloAPI);
        await setDoc(noticiaRef, { ...noticiaAPI, timestamp: serverTimestamp() });
      } else {
        // Opcional: podrías verificar si la noticia existente necesita actualización
        const noticiaFirestore = noticiasFirestore.get(tituloAPI);
        const { timestamp, ...firestoreData } = noticiaFirestore;
        const { ...apiData } = noticiaAPI;
        if (JSON.stringify(apiData) !== JSON.stringify(firestoreData)) {
          const noticiaRef = doc(cacheCollection, tituloAPI);
          await setDoc(noticiaRef, { ...noticiaAPI, timestamp: serverTimestamp() });
        }
      }
    }

    // 4. Identificar y eliminar noticias de Firestore que no están en la API
    for (const tituloFirestore of noticiasFirestore.keys()) {
      if (!noticiasAPIMap.has(tituloFirestore)) {
        const noticiaRef = doc(cacheCollection, tituloFirestore);
        await deleteDoc(noticiaRef);
      }
    }

    // 5. Volver a obtener y renderizar todas las noticias actualizadas de Firestore (ordenadas)
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

    initLoadingServidores.style.display = 'none';

  } catch (error) {
    console.error('❌ Error al sincronizar noticias:', error);
    initLoadingServidores.textContent = 'Error al cargar las noticias.';
  }
}

obtenerNoticias();



async function cargarEpisodios() {
  try {
    // Intentamos cargar el episodio desde Firestore
    const episodiosRef = doc(db, "datos-animes", animeId);  // Cambia esto a la ruta de Firestore que corresponda
    const docSnap = await getDoc(episodiosRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      episodios = data.episodios || [];
      episodioActualIndex = episodios.findIndex(ep => ep.url === episodioUrl);

      if (episodioActualIndex === -1) {
        console.warn("Episodio no encontrado en Firestore, cargando desde API externa.");
        throw new Error("Episodio no encontrado en Firestore");
      }

      // Si encontramos el episodio en Firestore, cargamos el video
      await cargarVideoDesdeEpisodio(episodioActualIndex);
      return episodios;
    } else {
      throw new Error("No se encontraron episodios en Firestore, cargando desde la API externa.");
    }
  } catch (err) {
    console.warn("Error al cargar desde Firestore:", err);
    
    // Si falla con Firestore, cargamos desde la API externa
    try {
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episodes?id=${animeId}`);
      const data = await res.json();
      episodios = data.episodes || [];
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
}


async function cargarVideoDesdeEpisodio(index) {
  const ep = episodios[index];
  const btnCap = document.getElementById("btn-cap"); 
  if (btnCap && ep) {
    btnCap.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;
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
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?url=${encodeURIComponent(ep.url)}`);
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

  history.replaceState({}, "", `ver.html?animeId=${animeId}&url=${encodeURIComponent(ep.url)}`);

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
      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?url=${encodeURIComponent(siguiente.url)}`);
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
      if (btnCensura) {
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