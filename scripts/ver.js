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
let episodioActualIndex = parseInt(episodioUrl);
let embeds = [];
let bloquearAnuncios = true;
let censuraActiva = false;

const btnBloquear = document.getElementById("btn-bloquear-anuncios");
const btnCensura = document.getElementById("btn-censura");

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

const btnCap = document.getElementById("btn-cap");
tituloAnime.textContent = animeId;
btnCap.textContent = `Episodio ${params.get('url')}`;

const btnEstadoCapitulo = document.getElementById("btn-estado-capitulo");
const textoEstado = document.getElementById("texto-estado-capitulo");
let toggleInProgress = false;

async function refrescarUIEstadoCapitulo() {
  const user = localStorage.getItem("userID");
  if (!user) {
    console.warn('refrescarUIEstadoCapitulo: No hay usuario autenticado, no se actualiza UI de estado del capítulo.');
    return;
  }

  const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
  const docSnap = await getDoc(animeRef);
  const capitulosVistos = docSnap.exists() ? docSnap.data().episodiosVistos || [] : [];

  if (!episodios || episodios.length === 0 || episodioActualIndex < 0 ) {
    console.warn('refrescarUIEstadoCapitulo: Lista de episodios no disponible o índice inválido.');
    return;
  }

  const episodioId = String(episodioActualIndex);
  const estaVisto = capitulosVistos.includes(episodioId);

  if (!btnEstadoCapitulo || !textoEstado) {
    console.warn('refrescarUIEstadoCapitulo: No se encontraron elementos de UI para el estado del capítulo.');
    return;
  }
  estaVisto ? btnEstadoCapitulo.classList.add("visto") : btnEstadoCapitulo.classList.remove("visto");
  textoEstado.textContent = estaVisto ? "Visto" : "No visto";
}

async function toggleYGuardarEstadoCapitulo() {
  if (toggleInProgress) {
    console.warn('toggleYGuardarEstadoCapitulo: Operación en progreso, ignorando clic.');
    return;
  }

  toggleInProgress = true;

  try {
    const user = localStorage.getItem("userID");
    if (!user) {
      console.warn('toggleYGuardarEstadoCapitulo: No hay usuario autenticado.');
      return;
    }

    const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
    const docSnap = await getDoc(animeRef);
    const episodiosVistos = docSnap.exists() ? docSnap.data().episodiosVistos || [] : [];

    if (!episodios || episodios.length === 0 || episodioActualIndex < 0) {
      console.warn('toggleYGuardarEstadoCapitulo: Lista de episodios no disponible o índice inválido.');
      return;
    }

    const episodioId = String(episodioActualIndex);
    const titulo = tituloAnime.textContent;

    const estaVistoActualmente = episodiosVistos.includes(episodioId);
    const nuevoEstadoVisto = !estaVistoActualmente;

    const episodiosActuales = new Set(episodiosVistos);
    if (nuevoEstadoVisto) {
      episodiosActuales.add(episodioId);
    } else {
      episodiosActuales.delete(episodioId);
    }

    try {
      await setDoc(animeRef, {
        titulo,
        fechaAgregado: serverTimestamp(),
        episodiosVistos: Array.from(episodiosActuales)
      });
      mostrarPildora(nuevoEstadoVisto, episodioActualIndex);
    } catch (error) {
      console.error("Error al guardar estado del capítulo en Firestore:", error);
      // Revertir UI en caso de error
      await refrescarUIEstadoCapitulo();
    }
  } finally {
    toggleInProgress = false;
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

btnEstadoCapitulo.addEventListener("click", async () => {
  const user = localStorage.getItem("userID");
  if (!user) {
    window.alert('Inicia sesión para guardar tu progreso de capítulos, animes y mucho más!.');
    return
  }
  if (toggleInProgress) {
    console.warn('Click ignorado: operación en progreso');
    return;
  }
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



function extraerUrlsServidores(servidores) {
  if (!Array.isArray(servidores)) return [];
  return servidores
    .map(s => (typeof s === "string" ? s : s?.url))
    .filter(Boolean)
    .sort();
}

function servidoresSonIguales(servidoresA, servidoresB) {
  const urlsA = extraerUrlsServidores(servidoresA);
  const urlsB = extraerUrlsServidores(servidoresB);
  if (urlsA.length !== urlsB.length) return false;
  return urlsA.every((url, i) => url === urlsB[i]);
}

function mapearServidoresApi(servidoresApi) {
  return servidoresApi.map((servidor, index) => ({
    nombre: `Servidor ${index + 1}`,
    url: typeof servidor === "string" ? servidor : servidor.url
  }));
}

function reordenarServidores(servidores) {
  if (!servidores || servidores.length === 0) return servidores;

  let jkPlayers = [];
  let mp4uploadServer = null;
  let megaServer = null;
  let yourUploadServer = null;
  const mediafireServers = [];
  const otherServers = [];

  servidores.forEach(srv => {
    if (srv && typeof srv.url === "string") {

      const url = srv.url.toLowerCase();

      if (srv.type === "player" || url.includes("jkplayer")) {
        jkPlayers.push(srv);
      }

      else if (srv.url.includes('mp4upload.com')) {
        mp4uploadServer = srv;

      } else if (srv.url.includes('mega.nz/')) {
        megaServer = srv;

      } else if (srv.url.includes('yourupload.com/embed/')) {
        yourUploadServer = srv;

      }

      else if (url.includes('mediafire.com')) {
        mediafireServers.push({
          ...srv,
          name: "Descargar"
        });

      } else {
        otherServers.push(srv);
      }

    } else {
      otherServers.push(srv);
    }
  });

  const orderedEmbeds = [];

  orderedEmbeds.push(...jkPlayers);

  if (mp4uploadServer) orderedEmbeds.push(mp4uploadServer);
  if (megaServer) orderedEmbeds.push(megaServer);
  if (yourUploadServer) orderedEmbeds.push(yourUploadServer);

  orderedEmbeds.push(...otherServers);

  orderedEmbeds.push(...mediafireServers);

  return orderedEmbeds;
}

function convertirUrlAjkanime(url) {
  // Si ya es de jkanime, retornarla tal cual
  if (url.includes('jkanime.net')) {
    return url;
  }

  // Convertir de animeflv a jkanime
  // animeflv: https://www3.animeflv.net/ver/nanatsu-no-taizai-1
  // jkanime: https://jkanime.net/nanatsu-no-taizai/1/
  if (url.includes('animeflv.net/ver/')) {
    const match = url.match(/animeflv\.net\/ver\/(.+)-(\d+)$/);
    if (match) {
      const animeName = match[1];
      const episodeNumber = match[2];
      return `https://jkanime.net/${animeName}/${episodeNumber}/`;
    }
  }

  return url;
}

async function obtenerServidoresDesdeApi(episodio) {
  const urlEpisodio = convertirUrlAjkanime(episodio.url);
  console.log("[obtenerServidoresDesdeApi] URL original:", episodio.url);
  console.log("[obtenerServidoresDesdeApi] URL convertida:", urlEpisodio);

  const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?url=${encodeURIComponent(urlEpisodio)}`);
  if (!res.ok) {
    console.warn(`[API episode] API respondió ${res.status} para: ${urlEpisodio}`);
    return null; // Retornar null en lugar de lanzar error
  }

  const data = await res.json();
  console.log("[API episode] Respuesta completa:", data);
  console.log("[API episode] Servidores:", data.servidores);

  if (!data.servidores?.length) {
    console.log("[API episode] No se encontraron servidores en la respuesta");
    return [];
  }

  const servidoresMapeados = mapearServidoresApi(data.servidores);
  console.log("[API episode] Servidores mapeados:", servidoresMapeados);
  return servidoresMapeados;
}

async function guardarServidoresEnFirestore(ep, servidores) {
  const animeDatosRef = doc(db, "datos-animes", animeId);
  const animeDatosSnap = await getDoc(animeDatosRef);
  const animeDatos = animeDatosSnap.data() || {};

  if (!animeDatos.episodios) animeDatos.episodios = [];
  const episodioIndex = animeDatos.episodios.findIndex(e => e.url === ep.url);

  if (episodioIndex !== -1) {
    animeDatos.episodios[episodioIndex].servidores = servidores;
  } else {
    animeDatos.episodios.push({ ...ep, servidores });
  }

  await setDoc(animeDatosRef, { episodios: animeDatos.episodios }, { merge: true });
}

// Caché en memoria para servidores
const serverCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getServerCacheKey(url) {
  return `servers_${url}`;
}

async function sincronizarServidoresConApi(ep) {
  const cacheKey = getServerCacheKey(ep.url);
  const cached = serverCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    console.log("[Servidores] ⚡ Usando caché en memoria (5 min):", cacheKey);
    return cached.data;
  }

  console.log("[Servidores] 🔄 No hay caché válido, consultando API...");
  let servidoresFirestore = [];

  try {
    const animeDatosRef = doc(db, "datos-animes", animeId);
    const animeDatosSnap = await getDoc(animeDatosRef);
    const animeDatos = animeDatosSnap.data() || {};
    const episodioGuardado = animeDatos.episodios?.find(e => e.url === ep.url);

    if (episodioGuardado?.servidores?.length) {
      servidoresFirestore = episodioGuardado.servidores;
    }
  } catch (error) {
    console.error("[servidores] Error al leer Firestore:", error);
  }

  try {
    const servidoresApi = await obtenerServidoresDesdeApi(ep);

    if (servidoresApi === null) {
      // API falló (404 u otro error), usar respaldo de Firestore
      if (servidoresFirestore.length) {
        console.log("[servidores] API falló, usando respaldo de Firestore");
        const result = reordenarServidores(servidoresFirestore);
        serverCache.set(cacheKey, { data: result, time: Date.now() });
        return result;
      }
      return [];
    }

    if (servidoresApi.length) {
      const iguales = servidoresSonIguales(servidoresFirestore, servidoresApi);

      if (!iguales) {
        await guardarServidoresEnFirestore(ep, servidoresApi);
      }

      const result = reordenarServidores(servidoresApi);
      serverCache.set(cacheKey, { data: result, time: Date.now() });
      console.log("[Servidores] 💾 Guardado en caché:", cacheKey);
      return result;
    }

    // Si la API no devuelve servidores, usar los de Firestore como respaldo (sin guardar)
    if (servidoresFirestore.length) {
      console.log("[servidores] API no devolvió servidores, usando respaldo de Firestore");
      const result = reordenarServidores(servidoresFirestore);
      serverCache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    }

    return [];
  } catch (error) {
    console.error("[servidores] Error inesperado al consultar API:", error);
    // Si hay error inesperado, usar los de Firestore como respaldo (sin guardar)
    if (servidoresFirestore.length) {
      console.log("[servidores] Error inesperado, usando respaldo de Firestore");
      const result = reordenarServidores(servidoresFirestore);
      serverCache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    }
    throw error;
  }
}

async function cargarEpisodios() {
  console.log('cargarEpisodios - Iniciando');
  try {
    const episodiosRef = doc(db, "datos-animes", animeId);
    const docSnap = await getDoc(episodiosRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('Datos de Firestore:', data);
      episodios = data.episodios || [];
      console.log('Llamando aplicarFondoAnime con datos de Firestore');
      aplicarFondoAnime(data);
      if (episodios.length) {
        await cargarVideoDesdeEpisodio(episodioActualIndex);
        return episodios;
      }
    }
    throw new Error("No hay episodios en Firestore");
  } catch (err) {
    console.warn("Error al cargar desde Firestore, intentando API:", err);
  }

  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${encodeURIComponent(animeId)}`);
    if (!res.ok) throw new Error(`API anime respondió ${res.status}`);

    const data = await res.json();
    console.log('Datos de API:', data);
    episodios = (data.episodes || []).map(ep => ({ number: ep.number, url: ep.url }));

    if (!episodios.length) {
      throw new Error("La API no devolvió episodios");
    }

    const animeData = {
      portada: data.cover || '',
      banner: data.banner || ''
    };
    console.log('animeData para fondo:', animeData);
    console.log('Llamando aplicarFondoAnime con datos de API');
    aplicarFondoAnime(animeData);

    await setDoc(doc(db, "datos-animes", animeId), {
      episodios,
      titulo: data.title || animeId,
      portada: data.cover || '',
      banner: data.banner || ''
    }, { merge: true });

    await cargarVideoDesdeEpisodio(episodioActualIndex);
    return episodios;
  } catch (err) {
    console.error("Error al cargar episodios desde API:", err);
    const controles = document.getElementById("controles");
    if (controles) {
      controles.innerHTML = "<span class='span-carga'><h2>Error</h2><br>No se pudieron cargar los episodios.</span>";
    }
    throw err;
  }
}

function aplicarFondoAnime(anime) {
  const imagenUrl = anime.portada || anime.banner;
  if (imagenUrl) {
    document.body.style.backgroundImage = `url('${imagenUrl}')`;
    console.log('Fondo aplicado:', imagenUrl);
  } else {
    console.log('No hay imagen para fondo');
  }
}


async function cargarVideoDesdeEpisodio(index) {
  console.log("[cargarVideoDesdeEpisodio] Índice recibido:", index);
  console.log("[cargarVideoDesdeEpisodio] Array de episodios:", episodios);
  console.log("[cargarVideoDesdeEpisodio] Longitud de episodios:", episodios.length);
  btnCap.textContent = `Episodio ${index}`;
  const ep = episodios.find(ep => String(ep.number) === String(index));
  console.log("[cargarVideoDesdeEpisodio] Episodio encontrado:", ep);
  if (!ep) {
    console.warn("[cargarVideoDesdeEpisodio] No se encontró el episodio con number:", index);
    btnCap.textContent = "Episodio desconocido";
    document.getElementById("controles").innerHTML = "<span class='span-carga'><h2>404</h2><br>No se encontro el episodio.</span>";
    return;
  }

  // Actualizar índice y URL siempre, incluso si no hay servidores
  episodioActualIndex = index;
  history.replaceState({}, "", `ver.html?id=${animeId}&url=${ep.number}`);

  // 1. Cargar servidores de Firestore primero (instantáneo)
  let servidoresFirestore = [];
  try {
    const animeDatosRef = doc(db, "datos-animes", animeId);
    const animeDatosSnap = await getDoc(animeDatosRef);
    const animeDatos = animeDatosSnap.data() || {};
    const episodioGuardado = animeDatos.episodios?.find(e => e.url === ep.url);

    if (episodioGuardado?.servidores?.length) {
      servidoresFirestore = episodioGuardado.servidores;
      console.log("[cargarVideoDesdeEpisodio] Servidores cargados de Firestore:", servidoresFirestore.length);
    }
  } catch (error) {
    console.error("[cargarVideoDesdeEpisodio] Error al leer servidores de Firestore:", error);
  }

  // 2. Si hay servidores en Firestore, mostrarlos inmediatamente
  if (servidoresFirestore.length) {
    ep.servidores = reordenarServidores(servidoresFirestore);
    renderizarServidores(ep.servidores);
  } else {
    // Si no hay en Firestore, mostrar indicador de carga
    document.getElementById("controles").innerHTML = "<span class='span-carga'>Cargando servidores...</span>";
  }

  // 3. Sincronizar con la API en segundo plano
  try {
    const servidoresApi = await obtenerServidoresDesdeApi(ep);

    if (servidoresApi === null) {
      // API falló, mantener los de Firestore si existen
      if (!servidoresFirestore.length) {
        document.getElementById("video").innerHTML = "No se encontraron servidores.";
        document.getElementById("controles").innerHTML = "";
      }
      actualizarEstadoBotones();
      return ep;
    }

    if (servidoresApi.length) {
      const iguales = servidoresSonIguales(servidoresFirestore, servidoresApi);

      if (!iguales) {
        // Actualizar Firestore con los nuevos servidores
        await guardarServidoresEnFirestore(ep, servidoresApi);
      }

      // Si los servidores son diferentes, actualizar la UI
      if (!iguales) {
        ep.servidores = reordenarServidores(servidoresApi);
        renderizarServidores(ep.servidores);
      }
    } else if (!servidoresFirestore.length) {
      // API no devolvió servidores y no hay en Firestore
      document.getElementById("video").innerHTML = "No se encontraron servidores.";
      document.getElementById("controles").innerHTML = "";
    }
  } catch (error) {
    console.error("[cargarVideoDesdeEpisodio] Error al sincronizar con API:", error);
    if (!servidoresFirestore.length) {
      document.getElementById("video").innerHTML = "Error al cargar servidores.";
      document.getElementById("controles").innerHTML = "";
    }
  }

  actualizarEstadoBotones();

  // Pre-cargar siguiente episodio (si existe)
  const siguiente = episodios.find(e => e.number === index + 1);

  if (siguiente) {
    sincronizarServidoresConApi(siguiente)
      .then(servidores => {
        if (servidores?.length) {
          siguiente.servidores = servidores;
        }
      })
      .catch(() => {});
  }

  return ep;
}

function renderizarServidores(servidores) {
  if (!servidores?.length) {
    document.getElementById("video").innerHTML = "No hay servidores disponibles.";
    document.getElementById("controles").innerHTML = "";
    return;
  }

  embeds = servidores;

  // Reasignar nombres de servidor según el nuevo orden
  embeds.forEach((srv, i) => {
    srv.nombre = `Servidor ${i + 1}`;
  });

  const controles = document.getElementById("controles");
  controles.innerHTML = "";
  embeds.forEach((srv, i) => {

    const url = srv.url?.toLowerCase?.() || "";

    // 🔥 MEDIAFIRE -> <a> DESCARGAR
  if (url.includes("mediafire.com")) {
  const a = document.createElement("a");
  a.href = srv.url;

  a.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.5" d="M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 3V16M12 16L16 11.625M12 16L8 11.625"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  a.classList.add("btn-descarga");

      a.target = "_blank";
      a.setAttribute('data-title', extraerNombreDesdeURL(srv.url));
      a.rel = "noopener noreferrer";
      controles.appendChild(a);
      return;
    }

    // 🔥 RESTO -> button normal
    const btn = document.createElement("button");
    btn.textContent = srv.nombre
      ? srv.nombre.replace("Servidor ", "")
      : `${i + 1}`;

    btn.setAttribute('data-title', extraerNombreDesdeURL(srv.url));
    btn.onclick = () => mostrarVideo(srv, btn);

    controles.appendChild(btn);
  });

  // 🔥 primer video igual que antes
  if (embeds && embeds.length > 0) {
    const firstPlayable = embeds.find(s => !s.url?.includes("mediafire.com"));
    const buttons = controles.querySelectorAll("button");

    if (buttons.length > 0) {
      mostrarVideo(firstPlayable || embeds[0], buttons[0]);
    } else {
      document.getElementById("video").innerHTML =
        "No se encontraron botones de servidor.";
    }
  } else {
    document.getElementById("video").innerHTML =
      "No hay servidores disponibles para mostrar.";
  }
}

const controles = document.getElementById("controles");

const tooltip = document.createElement("div");
tooltip.className = "tooltip-global";
tooltip.style.position = "fixed";
document.body.appendChild(tooltip);

let currentEl = null;
let hideTimer = null;
let scrollTimer = null;
let rafPending = false;
let lastRect = null;

function updateTooltip() {
  rafPending = false;
  if (!currentEl) {
    tooltip.style.opacity = "0";
    return;
  }

  tooltip.textContent = currentEl.getAttribute("data-title") || "";
  
  const rect = lastRect || currentEl.getBoundingClientRect();
  lastRect = null;

  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 10}px`;
  tooltip.style.opacity = "1";
}

function scheduleUpdate(forceRectRefresh = false) {
  if (forceRectRefresh && currentEl) {
    lastRect = currentEl.getBoundingClientRect();
  }
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(updateTooltip);
}

function setCurrent(el) {
  if (el === currentEl) return;
  currentEl = el;
  scheduleUpdate(true);
}

function clearTimers() {
  clearTimeout(hideTimer);
  clearTimeout(scrollTimer);
}

function hideTooltip(delay = 0) {
  clearTimers();
  if (delay === 0) {
    currentEl = null;
    tooltip.style.opacity = "0";
  } else {
    hideTimer = setTimeout(() => {
      currentEl = null;
      tooltip.style.opacity = "0";
    }, delay);
  }
}

controles.addEventListener("touchstart", onTouch, { passive: true });
controles.addEventListener("touchmove", onTouch, { passive: true });
controles.addEventListener("touchend", () => hideTooltip(1200), { passive: true });

function onTouch(e) {
  const t = e.touches[0];
  if (!t) return;

  const el = document.elementFromPoint(t.clientX, t.clientY);
  const btn = el?.closest?.("button, a");

  if (!btn || !controles.contains(btn)) {
    hideTooltip();
    return;
  }

  clearTimers();
  setCurrent(btn);
}

controles.addEventListener("mouseover", (e) => {
  const el = e.target.closest("button, a");
  if (!el) return;
  setCurrent(el);
});

controles.addEventListener("mousemove", () => {
  if (currentEl) scheduleUpdate(true);
});

controles.addEventListener("mouseout", (e) => {
  const related = e.relatedTarget;
  if (currentEl && currentEl.contains(related)) return;
  hideTooltip();
});

controles.addEventListener("scroll", () => {
  if (!currentEl) return;
  scheduleUpdate(true);
  clearTimers();
  scrollTimer = setTimeout(() => hideTooltip(), 1500);
}, { passive: true });

//funcion extraer nombre del link
function extraerNombreDesdeURL(url) {
  try {
    const sinProtocolo = url.split('//')[1];
    if (!sinProtocolo) return null;

    const partes = sinProtocolo.split('.');
    let nombre;
    
    if (sinProtocolo.startsWith('www.')) {
      nombre = partes[1];
    } else {
      nombre = partes[0];
    }
    
    // Convertir primera letra a mayúscula
    return nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : null;
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
  const primerEpisodio = episodios[0];
  const esPrimerEpisodio = primerEpisodio ? episodioActualIndex <= primerEpisodio.number : true;
  btnAnterior.disabled = esPrimerEpisodio;
  btnAnterior.classList.toggle('desactivado', esPrimerEpisodio);

  const ultimoEpisodio = episodios[episodios.length - 1];
  const esUltimoEpisodio = ultimoEpisodio ? episodioActualIndex >= ultimoEpisodio.number : true;
  btnSiguiente.disabled = esUltimoEpisodio;
  btnSiguiente.classList.toggle('desactivado', esUltimoEpisodio);
}

// Configurar navegación de botones
btnSiguiente.addEventListener("click", async (e) => {
  e.preventDefault();
  const ultimoEpisodio = episodios[episodios.length - 1];
  if (ultimoEpisodio && episodioActualIndex < ultimoEpisodio.number) {
    const marcarVistoBtn = document.getElementById("btn-estado-capitulo");
    if (marcarVistoBtn && !marcarVistoBtn.classList.contains('visto') && !toggleInProgress) {
      await toggleYGuardarEstadoCapitulo();
    }
    await cargarVideoDesdeEpisodio(episodioActualIndex + 1);
    refrescarUIEstadoCapitulo();
    actualizarEstadoBotones();
  }
});

btnAnterior.addEventListener("click", async (e) => {
  e.preventDefault();
  const primerEpisodio = episodios[0];
  if (primerEpisodio && episodioActualIndex > primerEpisodio.number) {
    const marcarVistoBtn = document.getElementById("btn-estado-capitulo");
    if (marcarVistoBtn && marcarVistoBtn.classList.contains('visto') && !toggleInProgress) {
      await toggleYGuardarEstadoCapitulo();
    }
    await cargarVideoDesdeEpisodio(episodioActualIndex - 1);
    refrescarUIEstadoCapitulo();
    actualizarEstadoBotones();
  }
});


cargarEpisodios()
  .then(actualizarEstadoBotones)
  .catch(error => {
    console.error("Error al cargar episodios inicialmente:", error);
  });

function mostrarPildora(estado = true, cap = null) {
  const pillAnterior = document.querySelector('.pildora');
  if (pillAnterior) {
    pillAnterior.remove();
  }
  
  if (cap) {
    cap = ` ${cap}`;
  }
  const pill = document.createElement("div");
  pill.classList.add("pildora");
  
  if (!estado) {
    pill.classList.add("pildora-eliminado");
  } else {
    pill.classList.add("pildora-visto");
  }

  const accion = estado ? `Capítulo ${cap} marcado como visto` : `Capítulo ${cap} eliminado de vistos`;
  pill.textContent = accion;

  document.body.appendChild(pill);

  requestAnimationFrame(() => {
    pill.classList.add("mostrar");
  });

  setTimeout(() => {
    pill.classList.remove("mostrar");
    pill.addEventListener('transitionend', () => pill.remove());
  }, 3000);
}

