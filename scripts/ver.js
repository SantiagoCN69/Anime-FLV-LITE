const params = new URLSearchParams(location.search);
const animeId = params.get("id");
const episodeNumber = params.get("episode");
const serversParam = params.get("servers"); // "sub" o "dob"
const btnVolver = document.getElementById("btn-volver-anime");
const tituloAnime = document.getElementById("titulo-anime");
btnVolver.href = `/anime?id=${animeId}`;

// Leer preferencia de servidores de localStorage
const serversPreference = localStorage.getItem("serverPreference");

document.title = "AniZen - " + animeId + " - " + episodeNumber;

const btnSiguiente = document.getElementById("btn-siguiente-capitulo");
const btnAnterior = document.getElementById("btn-anterior-capitulo");
const btnSelectorCapitulo = document.getElementById("btn-selector-capitulo");
const dropdownCapitulos = document.getElementById("dropdown-capitulos");
const numeroCapituloActual = document.getElementById("numero-capitulo-actual");
const textoAnterior = document.getElementById("texto-anterior");
const textoSiguiente = document.getElementById("texto-siguiente");

// Variable global para capítulos vistos (compartida con refrescarUIEstadoCapitulo)
let capitulosVistosGlobales = [];

// Cache del dropdown generado para evitar regeneraciones innecesarias
let dropdownGenerado = false;

let episodios = [];
let episodioActualIndex = parseInt(episodeNumber);
let embeds = [];
let bloquearAnuncios = localStorage.getItem("bloquearAnuncios") !== "false";
// Prioridad: parámetro URL > preferencia localStorage > default (sub)
let modoDoblado = serversParam === "dob" || (serversParam === null && serversPreference === "dob");

const btnBloquear = document.getElementById("btn-bloquear-anuncios");

// Función helper simple para obtener el número de capítulo
function getNumeroCapitulo(episodio, index) {
  if (episodio && typeof episodio === 'object' && 'number' in episodio) {
    // Convertir a número para evitar problemas de comparación string vs number
    return parseInt(episodio.number, 10);
  }
  // Para arrays simples: detectar si el primer capítulo es 0
  if (episodios.length > 0 && episodios[0] === 0) {
    return index;
  }
  return index + 1;
}

// Funciones globales para el selector de capítulos
function generarDropdownCapitulos() {
  if (!dropdownCapitulos || !episodios || episodios.length === 0) return;
  
  if (dropdownGenerado) {
    actualizarEstadoActivoDropdown();
    return;
  }
  
  dropdownCapitulos.innerHTML = "";
  
  const titulo = document.createElement("div");
  titulo.className = "dropdown-titulo";
  titulo.textContent = "Seleccionar episodio";
  dropdownCapitulos.appendChild(titulo);
  
  const grid = document.createElement("div");
  grid.className = "dropdown-grid";
  
  const capitulosVistosSet = new Set(capitulosVistosGlobales);
  
  grid.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      const numCapitulo = parseInt(e.target.dataset.episode, 10);
      seleccionarCapitulo(numCapitulo);
    }
  });
  
  const fragment = document.createDocumentFragment();
  
  episodios.forEach((episodio, index) => {
    const btn = document.createElement("button");
    const numCapitulo = getNumeroCapitulo(episodio, index);
    btn.textContent = numCapitulo;
    btn.dataset.episode = numCapitulo;
    
    if (numCapitulo === episodioActualIndex) {
      btn.classList.add("activo");
    }
    
    if (capitulosVistosSet.has(String(numCapitulo))) {
      btn.classList.add("visto");
    }
    
    fragment.appendChild(btn);
  });
  
  grid.appendChild(fragment);
  dropdownCapitulos.appendChild(grid);
  dropdownGenerado = true;
}

// Función optimizada para actualizar solo el estado activo sin regenerar todo
function actualizarEstadoActivoDropdown() {
  const grid = dropdownCapitulos.querySelector('.dropdown-grid');
  if (!grid) return;
  
  const capitulosVistosSet = new Set(capitulosVistosGlobales);
  const botones = grid.querySelectorAll('button');
  
  botones.forEach(btn => {
    const numCapitulo = parseInt(btn.dataset.episode);
    btn.classList.toggle('activo', numCapitulo === episodioActualIndex);
    btn.classList.toggle('visto', capitulosVistosSet.has(String(numCapitulo)));
  });
}

function seleccionarCapitulo(numCapitulo) {
  if (numCapitulo === episodioActualIndex) return;
  
  // Actualizar estado
  episodioActualIndex = numCapitulo;
  
  // Actualizar URL sin recargar la página (incluyendo el modo actual)
  const newUrl = new URL(window.location);
  newUrl.searchParams.set("episode", numCapitulo);
  newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
  window.history.pushState({}, "", newUrl);
  
  // Cerrar dropdown inmediatamente
  if (dropdownCapitulos) {
    dropdownCapitulos.classList.add("oculto");
  }
  if (btnSelectorCapitulo) {
    btnSelectorCapitulo.classList.remove("open");
  }
  
  // Usar requestAnimationFrame para optimizar actualizaciones de UI
  requestAnimationFrame(() => {
    actualizarNumeroCapitulo();
    actualizarEstadoBotones();
    generarDropdownCapitulos();
    actualizarTextoBotonesNavegacion();
  });
  
  // Cargar el nuevo episodio (async, no bloquea UI)
  cargarVideoDesdeEpisodio(numCapitulo);
  
  // Refrescar estado de visto (async, no bloquea UI)
  refrescarUIEstadoCapitulo();
}

function actualizarNumeroCapitulo() {
  if (numeroCapituloActual) {
    numeroCapituloActual.textContent = `Episodio ${episodioActualIndex}`;
  }
  document.title = "AniZen - " + animeId + " - " + episodioActualIndex;
  const btnCapElement = document.getElementById("btn-cap");
  if (btnCapElement) {
    btnCapElement.textContent = `Episodio ${episodioActualIndex}`;
  }
  actualizarTextoBotonesNavegacion();
}

function actualizarTextoBotonesNavegacion() {
  if (!episodios || episodios.length === 0) return;
  
  // Buscar el índice actual de forma más robusta
  let currentIndex = -1;
  
  // Primero intentar buscar por número exacto (usando comparación numérica)
  currentIndex = episodios.findIndex(ep => {
    const num = getNumeroCapitulo(ep, episodios.indexOf(ep));
    return num === parseInt(episodioActualIndex, 10);
  });
  
  // Si no encuentra, buscar por índice directo (fallback)
  if (currentIndex === -1) {
    currentIndex = episodios.findIndex((_, idx) => {
      const num = getNumeroCapitulo(episodios[idx], idx);
      return num === parseInt(episodioActualIndex, 10);
    });
  }
  
  // Último fallback: usar episodioActualIndex - 1
  if (currentIndex === -1) {
    currentIndex = parseInt(episodioActualIndex, 10) - 1;
  }
  
  if (textoAnterior) {
    if (currentIndex > 0) {
      const epAnterior = episodios[currentIndex - 1];
      const numAnterior = getNumeroCapitulo(epAnterior, currentIndex - 1);
      textoAnterior.textContent = `EP ${numAnterior}`;
    } else {
      textoAnterior.textContent = "EP -";
    }
  }
  
  if (textoSiguiente) {
    if (currentIndex >= 0 && currentIndex < episodios.length - 1) {
      const epSiguiente = episodios[currentIndex + 1];
      const numSiguiente = getNumeroCapitulo(epSiguiente, currentIndex + 1);
      textoSiguiente.textContent = `EP ${numSiguiente}`;
    } else {
      textoSiguiente.textContent = "EP +";
    }
  }
}

// Funcionalidad del selector de capítulos
if (btnSelectorCapitulo && dropdownCapitulos) {
  // Toggle del dropdown
  btnSelectorCapitulo.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownCapitulos.classList.toggle("oculto");
    btnSelectorCapitulo.classList.toggle("open");
  });

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!btnSelectorCapitulo.contains(e.target) && !dropdownCapitulos.contains(e.target)) {
      dropdownCapitulos.classList.add("oculto");
      btnSelectorCapitulo.classList.remove("open");
    }
  });
}


if (btnBloquear) {
  btnBloquear.textContent = `AdBlock: ${bloquearAnuncios ? "ON" : "OFF"}`;
  btnBloquear.classList.toggle("activo", bloquearAnuncios);
}

btnBloquear?.addEventListener("click", () => {
  bloquearAnuncios = !bloquearAnuncios;
  localStorage.setItem("bloquearAnuncios", String(bloquearAnuncios));
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
// Variable global para controlar el idioma

// Evento para el botón de cambio de servidores
const btnCambioServers = document.getElementById("btn-cambio-servers");
if (btnCambioServers) {
  // Actualizar estado inicial del botón según el parámetro URL o preferencia
  btnCambioServers.textContent = modoDoblado ? "Server Subtitulados" : "Server Doblados";
  btnCambioServers.classList.toggle("activo", modoDoblado);
  
  btnCambioServers.addEventListener("click", function() {
    modoDoblado = !modoDoblado;
    
    // Cambiamos el texto del botón según el estado
    this.textContent = modoDoblado ? "Server Subtitulados" : "Server Doblados";
    this.classList.toggle("activo", modoDoblado); // Por si quieres darle estilos CSS extra
    
    // Guardar preferencia en localStorage
    localStorage.setItem("serverPreference", modoDoblado ? "dob" : "sub");
    
    // Actualizar URL con el nuevo modo
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
    window.history.pushState({}, "", newUrl);
    
    // Al cambiar de modo, recargamos la vista del episodio actual (usará caché, así que es instantáneo)
    if (typeof episodioActualIndex !== 'undefined' && episodioActualIndex !== null) {
      cargarVideoDesdeEpisodio(episodioActualIndex);
    }
  });
}
function actualizarEstadoBotonDoblado(servidores) {
  const btn = document.getElementById("btn-cambio-servers");
  if (!btn) return;

  const tieneDoblados = servidores.some(s => 
    (s.name || "").toLowerCase().includes("(lat)")
  );

  if (!tieneDoblados) {
    btn.disabled = true;
    if (modoDoblado) {
      modoDoblado = false;
      btn.textContent = "Server Doblado";
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("servers", "sub");
      window.history.replaceState({}, "", newUrl);
      // No guardar en localStorage en cambio automático
    }
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.textContent = modoDoblado ? "Server Subtitulados" : "Server Doblados";
    btn.classList.toggle("activo", modoDoblado);
  }
}

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
btnCap.textContent = `Episodio ${episodioActualIndex}`;

// Inicializar el número del capítulo después de que btnCap esté disponible
if (numeroCapituloActual) {
  actualizarNumeroCapitulo();
}

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
  
  // Guardar TODOS los capítulos vistos en variable global para usar en el dropdown
  capitulosVistosGlobales = capitulosVistos;

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
    
    // Mantenemos la estructura condicional if/else
    if (nuevoEstadoVisto) {
      episodiosActuales.add(episodioId);
    } else {
      episodiosActuales.delete(episodioId);
    }

    const arrayNuevosVistos = Array.from(episodiosActuales);

    try {
      if (arrayNuevosVistos.length === 0) {
        // Si ya no quedan episodios vistos, eliminamos el documento
        await deleteDoc(animeRef);
      } else {
        // Obtener estado del anime si existe en esta vista
        const statusElement = document.getElementById('statuscargado');
        const estadoTexto = statusElement ? statusElement.textContent : '';
        const esFinalizadoPorEstado = (estadoTexto === 'Finalizado' || estadoTexto === 'Concluido');
        
        // Verificar si completó todos los capítulos con el array local "episodios"
        const totalEpisodios = episodios.length;
        const vistosTodosLosCaps = arrayNuevosVistos.length >= totalEpisodios && totalEpisodios > 0;
        const esFinalizadoPorVistos = esFinalizadoPorEstado && vistosTodosLosCaps;

        // Guardar con la bandera y con merge para no sobrescribir destructivamente
        await setDoc(animeRef, {
          titulo,
          fechaAgregado: serverTimestamp(),
          episodiosVistos: arrayNuevosVistos,
          esFinalizadoPorVistos: esFinalizadoPorVistos
        }, { merge: true });
      
      // Actualizar la variable global para que el dropdown tenga los datos actualizados
      capitulosVistosGlobales = arrayNuevosVistos;
      
      // Regenerar dropdown para mostrar el nuevo estado
      dropdownGenerado = false;
      generarDropdownCapitulos();
      }

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

// Funcionalidad del botón de compartir
const btnShare = document.getElementById("share");
if (btnShare) {
  btnShare.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          text: `Mira ${animeId} - Episodio ${episodioActualIndex}`,
          url: window.location.href
        });
      } else {
        // Fallback para navegadores que no soportan Web Share API
        navigator.clipboard.writeText(window.location.href).then(() => {
          const originalText = btnShare.innerHTML;
          btnShare.innerHTML = '<img src="icons/check-solid.svg" alt="Copiado">';
          setTimeout(() => {
            btnShare.innerHTML = originalText;
          }, 2000);
        });
      }
    } catch (error) {
      console.error("Error al compartir:", error);
    }
  });
}


function crearNoticiaHTML(noticia, base64img) {
  const tarjeta = document.createElement('a');
  tarjeta.className = 'tarjeta-noticia';
  tarjeta.href = `https://somoskudasai.com/noticias/${noticia.slug}`;
  tarjeta.target = '_blank';
  
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
  contenedorNoticias.addEventListener('wheel', (evento) => {
    if (evento.deltaY !== 0 && window.innerWidth <= 1100) {
      evento.preventDefault();
      contenedorNoticias.scrollLeft += evento.deltaY;
    }
  });
}

manejarNoticias();


function filtrarServidores(servidores, soloDoblados = false) {
  if (!servidores) return [];
  return servidores.filter(servidor => {
    // Buscamos en 'name' (el de la API original)
    const nombreOriginal = (servidor.name || "").toLowerCase();
    const tieneLat = nombreOriginal.includes('(lat)');
    
    return soloDoblados ? tieneLat : !tieneLat;
  });
}

function extraerUrlsServidores(servidores) {
  if (!Array.isArray(servidores)) return [];
  return servidores
    .map(s => (typeof s === "string" ? s : s?.url))
    .filter(Boolean)
    .sort();
}
function normalizarUrl(url) {
  if (!url) return "";
  url = url.trim();
  if (url.includes("jkanime.net/jkplayer")) {
    return url.split("?")[0];
  }
  url = url.replace(/\/+$/, "");
  return url;
}

function servidoresSonIguales(servidoresA, servidoresB) {
  if (!servidoresA || !servidoresB) return false;

  // 🔥 NUEVO: Si los datos de Firestore no tienen el campo 'name', forzamos la actualización
  const formatoViejo = servidoresA.some(s => s.nombre && s.name === undefined);
  if (formatoViejo) {

    return false;
  }

  const urlsA = extraerUrlsServidores(servidoresA).map(normalizarUrl);
  const urlsB = extraerUrlsServidores(servidoresB).map(normalizarUrl);
  if (urlsA.length !== urlsB.length) {

    return false;
  }
  const setB = new Set(urlsB);
  for (let url of urlsA) {
    if (!setB.has(url)) {

      return false;
    }
  }

  return true;
}

function mapearServidoresApi(servidoresApi) {
  return servidoresApi.map((servidor, index) => ({
    nombre: `Servidor ${index + 1}`,
    name: servidor.name || "", // 🔥 NUEVO: Conservamos el nombre original para saber si tiene (Lat)
    type: servidor.type || "", // 🔥 NUEVO: Conservamos el tipo (player, download)
    url: typeof servidor === "string" ? servidor : servidor.url
  }));
}

function reordenarServidores(servidores) {
  if (!servidores || servidores.length === 0) return servidores;

  const players = []; 
  const youruploadServers = [];
  const megaServers = [];
  const mp4uploadServers = [];
  const mediafireServers = [];
  const otherServers = [];

  // 1. Clasificación
  servidores.forEach(srv => {
    if (srv && typeof srv.url === "string") {
      const url = srv.url.toLowerCase();

      // Detecta JKPlayer, Zilla-Networks, o cualquier type="player"
      if (srv.type === "player" || url.includes("jkplayer") || url.includes("zilla-networks.com")) {
        players.push(srv);
      } 
      else if (url.includes('yourupload.com/embed/')) {
        youruploadServers.push(srv); // AHORA ES UN ARREGLO
      } 
      else if (url.includes('mega.nz/')) {
        megaServers.push(srv); // AHORA ES UN ARREGLO
      } 
      else if (url.includes('mp4upload.com')) {
        mp4uploadServers.push(srv); // AHORA ES UN ARREGLO
      } 
      else if (url.includes('mediafire.com')) {
        mediafireServers.push({
          ...srv,
          name: "Descargar"
        });
      } 
      else {
        otherServers.push(srv);
      }

    } else {
      otherServers.push(srv);
    }
  });

  const orderedEmbeds = [];

  // --- 2. Ensamblaje en el nuevo orden ---

  // 1ro: Todos los players (Zilla, JKPlayer, etc.)
  orderedEmbeds.push(...players);

  // 2do: YourUpload (Todos los que haya)
  orderedEmbeds.push(...youruploadServers);

  // 3ro: Mega (Todos los que haya)
  orderedEmbeds.push(...megaServers);

  // 4to: Mp4Upload (Todos los que haya)
  orderedEmbeds.push(...mp4uploadServers);

  // 5to: Todos los demás
  orderedEmbeds.push(...otherServers);

  // 6to y último: Mediafire
  orderedEmbeds.push(...mediafireServers);

  return orderedEmbeds;
}

async function obtenerServidoresDesdeApi(episodio) {
  const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?animeid=${animeId}&cap=${episodio.number}`);
  if (!res.ok) {
    console.warn(`[API episode] API respondió ${res.status} para: ${episodio.url}`);
    return null; // Retornar null en lugar de lanzar error
  }

  const data = await res.json();

  if (!data.servidores?.length) {

    return [];
  }

  const servidoresMapeados = mapearServidoresApi(data.servidores);
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

async function sincronizarServidoresConApi(ep) {
  const cacheKey = `servers_${animeId}_${ep.number}`;
 
  let servidoresFirestore = [];

  try {

    const animeDatosRef = doc(db, "datos-animes", animeId);
    const animeDatosSnap = await getDoc(animeDatosRef);
    
    if (animeDatosSnap.exists()) {
      const animeDatos = animeDatosSnap.data();
      const episodioGuardado = animeDatos.episodios?.find(e => e.url === ep.url);
      
      if (episodioGuardado?.servidores?.length) {
        // 🔥 NUEVO: Rechazar formato viejo en segundo plano también
        const esFormatoViejo = episodioGuardado.servidores.some(s => s.nombre && s.name === undefined);
        
        if (!esFormatoViejo) {
          servidoresFirestore = episodioGuardado.servidores;

        } else {

        }
      } else {

      }
    } else {

    }
  } catch (error) {
    console.error("[Servidores] ❌ Error al leer Firestore:", error);
  }

  // --- INTENTO DE LECTURA API ---
  try {

    const servidoresApi = await obtenerServidoresDesdeApi(ep);

    if (servidoresApi === null) {

      if (servidoresFirestore.length) {
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

      return result;
    }

    // --- RESPALDO SI API ES [] ---
    if (servidoresFirestore.length) {

      const result = reordenarServidores(servidoresFirestore);
      serverCache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    }

    return [];
  } catch (error) {
    console.error("[Servidores] ❌ Error inesperado al consultar API:", error);
    if (servidoresFirestore.length) {

      const result = reordenarServidores(servidoresFirestore);
      serverCache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    }
    throw error;
  }
}

async function cargarEpisodios() {

  try {
    const episodiosRef = doc(db, "datos-animes", animeId);
    const docSnap = await getDoc(episodiosRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      episodios = data.episodios || [];
      aplicarFondoAnime(data);
      if (episodios.length) {
        // Generar dropdown después de cargar episodios
        if (typeof generarDropdownCapitulos === 'function') {
          generarDropdownCapitulos();
        }
        // Actualizar texto de botones de navegación
        actualizarTextoBotonesNavegacion();
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

    episodios = (data.episodes || []).map(ep => ({ number: ep.number, url: ep.url }));

    if (!episodios.length) {
      throw new Error("La API no devolvió episodios");
    }

    const animeData = {
      cover: data.cover || '',
      banner: data.banner || ''
    };

    aplicarFondoAnime(animeData);

    await setDoc(doc(db, "datos-animes", animeId), {
      episodios,
      titulo: data.title || animeId,
      cover: data.cover || '',
      banner: data.banner || ''
    }, { merge: true });

    // Generar dropdown después de cargar episodios
    if (typeof generarDropdownCapitulos === 'function') {
      generarDropdownCapitulos();
    }
    // Actualizar texto de botones de navegación
    actualizarTextoBotonesNavegacion();
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
  const imagenUrl = anime.cover || anime.banner;
  if (imagenUrl) {
    document.body.style.setProperty('--background-image', `url('${imagenUrl}')`);
    document.body.classList.add('fondo-animado');
  }
}

async function cargarVideoDesdeEpisodio(index) {
  const controles = document.getElementById("controles");
  controles.classList.remove("con-mediafire");
  btnCap.textContent = `Episodio ${index}`;
  const ep = episodios.find(ep => String(ep.number) === String(index));
  if (!ep) {
    console.warn("[cargarVideoDesdeEpisodio] No se encontró el episodio con number:", index);
    btnCap.textContent = "Episodio desconocido";
    document.getElementById("controles").innerHTML = "<span class='span-carga'><h2>404</h2><br>No se encontro el episodio.</span>";
    return;
  }

  // Actualizar índice y URL siempre, incluso si no hay servidores
  episodioActualIndex = index;
  history.replaceState({}, "", `/ver?id=${animeId}&episode=${ep.number}&servers=${modoDoblado ? "dob" : "sub"}`);

  //verificar si hay carga en el cche generado por la pre carga dle sigueite cap
  const cacheKey = "servers_" + animeId + "_" + ep.number;

  const cached = serverCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {

    renderizarServidores( cached.data );
    return;
  }
  else{

  }

  // 1. Cargar servidores de Firestore primero (instantáneo)
  let servidoresFirestore = [];
  try {
    const animeDatosRef = doc(db, "datos-animes", animeId);
    const animeDatosSnap = await getDoc(animeDatosRef);
    const animeDatos = animeDatosSnap.data() || {};
    const episodioGuardado = animeDatos.episodios?.find(e => e.url === ep.url);

    if (episodioGuardado?.servidores?.length) {
      // 🔥 NUEVO: Solo cargamos de Firestore si NO es el formato viejo
      const esFormatoViejo = episodioGuardado.servidores.some(s => s.nombre && s.name === undefined);
      
      if (!esFormatoViejo) {
        servidoresFirestore = episodioGuardado.servidores;

      } else {

      }
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

const siguiente = episodios.find(e => String(e.number) === String(index + 1));

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

function renderizarServidores(todosLosServidores) {
  // Filtramos los servidores antes de renderizarlos
  let servidores = filtrarServidores(todosLosServidores, modoDoblado);

  // Si no hay servidores del modo seleccionado, cambiar al otro modo automáticamente
  if (!servidores?.length && modoDoblado) {
    modoDoblado = false;
    servidores = filtrarServidores(todosLosServidores, false);
    
    // Actualizar URL solo (no guardar en localStorage)
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("servers", "sub");
    window.history.replaceState({}, "", newUrl);
    
    // Actualizar botón
    const btn = document.getElementById("btn-cambio-servers");
    if (btn) {
      btn.textContent = "Server Doblado";
      btn.classList.remove("activo");
    }
  }

  if (!servidores?.length) {
    document.getElementById("video").innerHTML = modoDoblado 
      ? "<p class='span-carga'>No hay servidores doblados disponibles para este episodio.</p>" 
      : "<p class='span-carga'>No hay servidores disponibles.</p>";
    document.getElementById("controles").innerHTML = "";
    return;
  }

  // Clonamos el array para no mutar los datos en caché con los nuevos nombres
  embeds = [...servidores]; 

  // Reasignar nombres de servidor según el nuevo orden (solo en la UI)
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
      controles.classList.add("con-mediafire");
      return;
    }

    // 🔥 RESTO -> button normal
    const btn = document.createElement("button");
    btn.textContent = srv.nombre ? srv.nombre.replace("Servidor ", "") : `${i + 1}`;
    btn.setAttribute('data-title', extraerNombreDesdeURL(srv.url));
    btn.onclick = () => mostrarVideo(srv, btn);
    controles.classList.add("cargado");
    
    // Rueda del ratón para scroll horizontal
    controles.addEventListener('wheel', (evento) => {
      if (evento.deltaY !== 0) {
        evento.preventDefault();
        controles.scrollLeft += evento.deltaY; 
      }
    });
    
    controles.appendChild(btn);
  });

  // 🔥 Primer video por defecto
  if (embeds && embeds.length > 0) {
    const firstPlayable = embeds.find(s => !s.url?.includes("mediafire.com"));
    const buttons = controles.querySelectorAll("button");

    if (buttons.length > 0) {
      mostrarVideo(firstPlayable || embeds[0], buttons[0]);
    } else {
      document.getElementById("video").innerHTML = "No se encontraron botones de servidor.";
    }
  } else {
    document.getElementById("video").innerHTML = "No hay servidores disponibles para mostrar.";
  }
  actualizarEstadoBotonDoblado(todosLosServidores);
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
  // Si no hay episodios cargados, mantener botones desactivados
  if (!episodios || episodios.length === 0) {
    btnAnterior.disabled = true;
    btnAnterior.classList.add('desactivado');
    btnSiguiente.disabled = true;
    btnSiguiente.classList.add('desactivado');
    return;
  }

  const primerEpisodio = episodios[0];
  const primerNumero = getNumeroCapitulo(primerEpisodio, 0);
  const esPrimerEpisodio = episodioActualIndex <= primerNumero;
  
  btnAnterior.disabled = esPrimerEpisodio;
  btnAnterior.classList.toggle('desactivado', esPrimerEpisodio);

  const ultimoEpisodio = episodios[episodios.length - 1];
  const ultimoNumero = getNumeroCapitulo(ultimoEpisodio, episodios.length - 1);
  const esUltimoEpisodio = episodioActualIndex >= ultimoNumero;
  btnSiguiente.disabled = esUltimoEpisodio;
  btnSiguiente.classList.toggle('desactivado', esUltimoEpisodio);
  
  // Activar el selector de capítulos cuando hay episodios
  if (btnSelectorCapitulo) {
    btnSelectorCapitulo.disabled = false;
    btnSelectorCapitulo.classList.remove('desactivado');
  }
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
    // Actualizar número del capítulo en el selector
    if (typeof actualizarNumeroCapitulo === 'function') {
      actualizarNumeroCapitulo();
    }
    // Actualizar dropdown
    if (typeof generarDropdownCapitulos === 'function') {
      generarDropdownCapitulos();
    }
    // Actualizar texto de botones de navegación
    actualizarTextoBotonesNavegacion();
  }
});

btnAnterior.addEventListener("click", async (e) => {
  e.preventDefault();
  const primerEpisodio = episodios[0];
  if (primerEpisodio && episodioActualIndex > primerEpisodio.number) {
    // const marcarVistoBtn = document.getElementById("btn-estado-capitulo");
    // if (marcarVistoBtn && marcarVistoBtn.classList.contains('visto') && !toggleInProgress) {
    //   await toggleYGuardarEstadoCapitulo();
    // }
    await cargarVideoDesdeEpisodio(episodioActualIndex - 1);
    refrescarUIEstadoCapitulo();
    actualizarEstadoBotones();
    // Actualizar número del capítulo en el selector
    if (typeof actualizarNumeroCapitulo === 'function') {
      actualizarNumeroCapitulo();
    }
    // Actualizar dropdown
    if (typeof generarDropdownCapitulos === 'function') {
      generarDropdownCapitulos();
    }
    // Actualizar texto de botones de navegación
    actualizarTextoBotonesNavegacion();
  }
});


cargarEpisodios()
  .then(() => {
    actualizarEstadoBotones();
    // Generar dropdown después de cargar episodios inicialmente
    if (typeof generarDropdownCapitulos === 'function') {
      generarDropdownCapitulos();
    }
  })
  .catch(error => {
    console.error("Error al cargar episodios inicialmente:", error);
  });

function mostrarPildora(estado = true, cap = null) {
  const pillAnterior = document.querySelector('.pildora');
  if (pillAnterior) pillAnterior.remove();
  
  const pill = document.createElement("div");
  pill.className = `pildora pildora-${estado ? 'visto' : 'eliminado'}`;

  const capTexto = cap ? ` ${cap}` : "";
  pill.textContent = estado 
    ? `Capítulo${capTexto} marcado como visto` 
    : `Capítulo${capTexto} eliminado de vistos`;

  document.body.appendChild(pill);

  pill.addEventListener('animationend', () => {
    pill.remove();
  }, { once: true });
}