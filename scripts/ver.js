const TMDB_API_KEY = "2e33599c8f4125cdb44029031486d35f";

// Función para buscar anime en TMDB
async function buscarAnimeTMDB(titulo) {
  const url = new URL(
    "https://api.themoviedb.org/3/search/tv"
  );

  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("query", titulo);
  url.searchParams.set("language", "en-US");

  const respuesta = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!respuesta.ok) {
    throw new Error(`Error TMDB: ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  return datos.results.map(anime => ({
    id: anime.id,
    titulo: anime.name,
    tituloOriginal: anime.original_name,
    fecha: anime.first_air_date
  }));
}

function quitarSufijoTemporada(titulo) {
  return String(titulo || "")
    .replace(/(?:\s|-)\d+(?:st|nd|rd|th)[\s-]+season\b.*$/i, "")
    .replace(/(?:\s|-)(?:season|temporada)[\s-]*\d+\b.*$/i, "")
    .replace(/(?:\s|-)(?:second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|primera|segunda|tercera|cuarta|quinta|sexta|séptima|septima|octava|novena|décima|decima)[\s-]+(?:season|temporada)\b.*$/i, "")
    .replace(/(?:\s|-)dai[\s-]+\d+[\s-]+ki\b.*$/i, "")
    .replace(/(?:\s|-)r\d+\b.*$/i, "")
    .trim();
}

async function buscarAnimeTMDBConRespaldo(titulo) {
  const tituloBase = quitarSufijoTemporada(titulo);
  const consultas = [...new Set([titulo, tituloBase].filter(Boolean))];

  for (const consulta of consultas) {
    const resultados = await buscarAnimeTMDB(consulta);
    logVidrift("Consulta TMDB", { consulta, resultados });
    if (resultados.length) return resultados;
  }

  return [];
}

function detectarTemporadaDesdeAnimeId(id) {
  const slug = String(id || "").toLowerCase();
  const ordinales = {
    first: 1, primera: 1, primer: 1,
    second: 2, segunda: 2, segundo: 2,
    third: 3, tercera: 3, tercero: 3,
    fourth: 4, cuarta: 4, cuarto: 4,
    fifth: 5, quinta: 5, quinto: 5,
    sixth: 6, sexta: 6, sexto: 6,
    seventh: 7, septima: 7, séptima: 7,
    eighth: 8, octava: 8, octavo: 8,
    ninth: 9, novena: 9, noveno: 9,
    tenth: 10, decima: 10, décima: 10
  };
  const romanos = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5,
    vi: 6, vii: 7, viii: 8, ix: 9, x: 10
  };
  const patrones = [
    /(?:^|-)(\d+)(?:st|nd|rd|th)-(?:season|temporada)(?:-|$)/,
    /(?:^|-)(?:season|temporada)-(\d+)(?:-|$)/,
    /(?:^|-)(\d+)-(?:season|temporada)(?:-|$)/,
    /(?:^|-)(?:s|t)-(\d+)(?:-|$)/,
    /(?:^|-)(?:s|t)(\d+)(?:-|$)/,
    /(?:^|-)(?:season|temporada)(\d+)(?:-|$)/,
    /(?:^|-)dai-(\d+)-ki(?:-|$)/,
    /-r(\d+)(?:-|$)/,
    /(?:^|-)r(\d+)(?:-|$)/
  ];

  for (const patron of patrones) {
    const coincidencia = slug.match(patron);
    const temporada = Number(coincidencia?.[1]);
    if (Number.isInteger(temporada) && temporada > 0) return temporada;
  }

  const marcadorOrdinal = slug.match(/(?:^|-)(first|primera|primer|second|segunda|segundo|third|tercera|tercero|fourth|cuarta|cuarto|fifth|quinta|quinto|sixth|sexta|sexto|seventh|septima|séptima|eighth|octava|octavo|ninth|novena|noveno|tenth|decima|décima)-(?:season|temporada)(?:-|$)/)
    || slug.match(/(?:^|-)(?:season|temporada)-(first|primera|primer|second|segunda|segundo|third|tercera|tercero|fourth|cuarta|cuarto|fifth|quinta|quinto|sixth|sexta|sexto|seventh|septima|séptima|eighth|octava|octavo|ninth|novena|noveno|tenth|decima|décima)(?:-|$)/);
  if (marcadorOrdinal) return ordinales[marcadorOrdinal[1]];

  const marcadorRomano = slug.match(/(?:^|-)(?:season|temporada)-(i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:-|$)/)
    || slug.match(/(?:^|-)(i|ii|iii|iv|v|vi|vii|viii|ix|x)-(?:season|temporada)(?:-|$)/);
  if (marcadorRomano) return romanos[marcadorRomano[1]];

  return 1;
}

async function verificarTemporadaTMDB(tmdbId, temporada) {
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${temporada}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");

  try {
    const respuesta = await fetch(url, { headers: { accept: "application/json" } });
    if (!respuesta.ok) return false;

    const datos = await respuesta.json();
    return Number(datos.season_number) === temporada;
  } catch {
    return false;
  }
}

async function resolverTemporadaVidrift(tmdbId, temporadaGuardada) {
  // Solo loggear si no es una precarga
  if (!window._temporadaLogHecho) {
    console.log("📋 resolverTemporadaVidrift llamado con:", { tmdbId, temporadaGuardada, animeId });
    window._temporadaLogHecho = true;
  }

  // Detectar si el animeId tiene un sufijo de temporada explícito
  const temporadaDetectada = detectarTemporadaDesdeAnimeId(animeId);
  const tieneSufijoTemporada = temporadaDetectada !== 1;

  if (!window._temporadaLogHecho) {
    console.log("🔍 Tiene sufijo de temporada:", tieneSufijoTemporada, "temporadaDetectada:", temporadaDetectada);
  }

  // Solo usar la temporada guardada si NO hay un sufijo de temporada en el nombre
  const temporadaManual = Number(temporadaGuardada);
  if (!tieneSufijoTemporada && Number.isInteger(temporadaManual) && temporadaManual > 0) {
    logVidrift("Temporada recuperada de Firestore", { animeId, tmdbId, temporada: temporadaManual });
    return temporadaManual;
  }

  logVidrift("Temporada detectada desde el slug", { animeId, tmdbId, temporada: temporadaDetectada });

  const existe = await verificarTemporadaTMDB(tmdbId, temporadaDetectada);
  if (!existe) {
    logVidrift("La temporada detectada no existe en TMDB", { animeId, tmdbId, temporada: temporadaDetectada });
    return null;
  }

  logVidrift("Temporada confirmada por TMDB", { animeId, tmdbId, temporada: temporadaDetectada });
  return temporadaDetectada;
}

async function seleccionarResultadoTMDBParaVidrift(resultados) {
  console.log("📋 seleccionarResultadoTMDBParaVidrift llamado con:", { animeId, resultadosCount: resultados.length });
  const temporada = detectarTemporadaDesdeAnimeId(animeId);

  for (const resultado of resultados) {
    const existe = await verificarTemporadaTMDB(resultado.id, temporada);
    logVidrift("Comprobando resultado TMDB para la temporada", {
      tmdbId: resultado.id,
      titulo: resultado.titulo,
      tituloOriginal: resultado.tituloOriginal,
      temporada,
      existe
    });
    if (existe) return { tmdbId: resultado.id, tmdbSeason: temporada, resultado };
  }

  return null;
}

const params = new URLSearchParams(location.search);
const animeId = params.get("id");
const episodeNumber = params.get("episode");
const serversParam = params.get("servers"); // "sub" o "dob"

// Los eventos detallados solo se muestran durante desarrollo. En producción
// se conservan los errores y cambios automáticos que requieren atención.
const MODO_DIAGNOSTICO_REPRODUCTOR = false;
// Se cambia solo tras confirmar que el servidor ya entregó una lista estable
// de pistas sin español; los estados genéricos x1/x2 no cuentan como prueba.
const FALLBACK_AUTOMATICO_ACTIVO = true;
const esDesarrollo = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
const debugLog = console.log;
const logVidrift = console.log;
const logVidriftClave = console.log;

// Algunos proveedores pueden forzar una navegación del documento superior. El
// navegador limpia la consola en ese caso, así que conservamos el último salto
// durante unos segundos y lo restauramos tras la recarga para diagnosticarlo.
const CLAVE_ULTIMO_SALTO_SERVIDOR = "anizen:ultimo-salto-servidor";
try {
  const saltoPendiente = sessionStorage.getItem(CLAVE_ULTIMO_SALTO_SERVIDOR);
  if (saltoPendiente) {
    sessionStorage.removeItem(CLAVE_ULTIMO_SALTO_SERVIDOR);
  }
} catch {
  // sessionStorage puede no estar disponible en navegadores con privacidad estricta.
}

function registrarCambioAutomaticoServidor(detalles) {
  try {
    sessionStorage.setItem(CLAVE_ULTIMO_SALTO_SERVIDOR, JSON.stringify({
      ...detalles,
      fecha: new Date().toISOString()
    }));
    setTimeout(() => sessionStorage.removeItem(CLAVE_ULTIMO_SALTO_SERVIDOR), 15000);
  } catch {
    // No se puede persistir
  }
}
const btnVolverAnime = document.getElementById("btn-volver-anime");
btnVolverAnime.href = `/anime?id=${animeId}`;

// Leer preferencia de servidores de localStorage
const serversPreference = localStorage.getItem("serverPreference");

document.title = "AniZen - " + animeId.replaceAll("-", " ") + " - " + episodeNumber;

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
let tituloAnime = animeId.replaceAll("-", " ");
let portadaAnime = '';
let episodioActualIndex = parseInt(episodeNumber);
let embeds = [];
let bloquearAnuncios = localStorage.getItem("bloquearAnuncios") !== "false";
// Prioridad: parámetro URL > preferencia localStorage > default (sub)
let preferenciaDoblado = serversParam === "dob" || (serversParam === null && serversPreference === "dob");
// Puede cambiar temporalmente si un episodio solo tiene enlaces en el otro
// idioma; no usarlo como preferencia del usuario dentro de Vidrift.
let modoDoblado = preferenciaDoblado;
let servidorActualIndex = 0;
let loadingTimeout = null;
// Identifica la carga activa para que un timeout/error tardío de un servidor
// anterior no cambie el servidor que el usuario ya seleccionó.
let reproduccionActualId = 0;
let limpiarPreferenciaSubtitulos = null;
let ventanaVidriftActiva = null;

const CACHE_TTL = 5 * 60 * 1000;
const serverCache = new Map();
let firestoreEnPausaPorCuota = false;
let avisoCuotaMostrado = false;

function esErrorDeCuotaFirestore(error) {
  return error?.code === "resource-exhausted" || error?.code === "quota-exceeded";
}

function activarModoApiDirecta(error) {
  if (!esErrorDeCuotaFirestore(error)) return false;

  firestoreEnPausaPorCuota = true;
  if (!avisoCuotaMostrado) {

    avisoCuotaMostrado = true;
  }
  return true;
}

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
    preferenciaDoblado = modoDoblado;
    
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
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

// Inicialización de Firebase optimizada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

const btnCap = document.getElementById("btn-cap");
btnVolverAnime.textContent = animeId.replaceAll("-", " ");
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
    debugLog("No hay usuario autenticado; no se actualiza el estado del capítulo.");
    return;
  }

  const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
  const docSnap = await getDoc(animeRef);
  const capitulosVistos = docSnap.exists() ? docSnap.data().episodiosVistos || [] : [];
  
  // Guardar TODOS los capítulos vistos en variable global para usar en el dropdown
  capitulosVistosGlobales = capitulosVistos;

  if (!episodios || episodios.length === 0 || episodioActualIndex < 0 ) {
    debugLog("Lista de episodios no disponible o índice inválido.");
    return;
  }

  const episodioId = String(episodioActualIndex);
  const estaVisto = capitulosVistos.includes(episodioId);

  if (!btnEstadoCapitulo || !textoEstado) {
    debugLog("No se encontraron elementos de UI para el estado del capítulo.");
    return;
  }
  estaVisto ? btnEstadoCapitulo.classList.add("visto") : btnEstadoCapitulo.classList.remove("visto");
  textoEstado.textContent = estaVisto ? "Visto" : "No visto";
}

async function toggleYGuardarEstadoCapitulo() {
  if (toggleInProgress) {
    debugLog("Operación de capítulo en progreso; clic ignorado.");
    return;
  }
  const user = localStorage.getItem("userID");
  if (!user) {
    mostrarPildora("no-user");
    return;
  }
  mostrarPildora(true, null, true);
  toggleInProgress = true;

  try {
    const animeRef = doc(db, "usuarios", user, "caps-vistos", animeId);
    const docSnap = await getDoc(animeRef);
    const episodiosVistos = docSnap.exists() ? docSnap.data().episodiosVistos || [] : [];

    if (!episodios || episodios.length === 0 || episodioActualIndex < 0) {
      debugLog("Lista de episodios no disponible o índice inválido.");
      return;
    }

    const episodioId = String(episodioActualIndex);
    const titulo = btnVolverAnime.textContent;

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
          portada: portadaAnime,
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

      // Revertir UI en caso de error
      // await refrescarUIEstadoCapitulo();
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

    }
  } else {
    debugLog("Usuario no autenticado según authStateReady.");
  }
});

btnEstadoCapitulo.addEventListener("click", async () => {
  const user = localStorage.getItem("userID");
  if (!user) {
    mostrarPildora("no-user");
    return
  }
  if (toggleInProgress) {
    debugLog("Clic ignorado: operación en progreso.");
    return;
  }
  try {
//carga instatanea segun la clase actual 
    const isVisto = btnEstadoCapitulo.classList.contains('visto');
    if (isVisto) {
      btnEstadoCapitulo.classList.remove('visto');
      btnEstadoCapitulo.classList.add('no-visto');
    } else {
      btnEstadoCapitulo.classList.remove('no-visto');
      btnEstadoCapitulo.classList.add('visto');
    }

    await toggleYGuardarEstadoCapitulo();
    await refrescarUIEstadoCapitulo();
  } catch (error) {

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

    }
  });
}


function crearNoticiaHTML(noticia) {
  const tarjeta = document.createElement('a');
  tarjeta.className = 'tarjeta-noticia';
  
  // Usar el enlace directo del nuevo formato
  const enlace = noticia.enlace || noticia.slug || '';
  tarjeta.href = enlace || '#';
  if (enlace) tarjeta.target = '_blank';
  
  // Usar la imagen URL del nuevo formato
  const imagenSrc = noticia.imagenUrl || noticia.image || '';
  
  // Obtener título del nuevo formato
  const titulo = noticia.titulo || noticia.title || 'Sin título';
  
  // Filtrar la fecha para quitar lo que está después de "por"
  const fechaOriginal = noticia.fechaAutor || noticia.date || '';
  const fechaFiltrada = fechaOriginal.includes(' por ') 
    ? fechaOriginal.split(' por ')[0] 
    : fechaOriginal;
  
  tarjeta.innerHTML = `
    <img src="${imagenSrc}" 
        alt="${titulo}" 
        class="noticia-imagen"
        loading="lazy"
        onerror="this.style.display='none'">
    <h3 class="noticia-titulo">${titulo}</h3>
    <p class="noticia-fecha">${fechaFiltrada || 'Sin fecha'}</p>
  `;

  return tarjeta;
}

function extraerListaNoticias(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.noticias)) return payload.noticias;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

async function manejarNoticias() {
  const contenedorNoticias = document.getElementById('noticias_container');
  const initLoadingNoticias = document.getElementById('init-loading-noticias');

  if (!contenedorNoticias || !initLoadingNoticias) return;

  // 1. Cargar primero de Firestore (caché rápido)
  try {
    const noticiasRef = doc(db, "noticias", "noticias");
    const docSnap = await getDoc(noticiasRef);

    if (docSnap.exists()) {
      const datosFirestore = docSnap.data();
      const noticiasFirestore = extraerListaNoticias(datosFirestore?.noticias);

      initLoadingNoticias.style.display = 'none';
      noticiasFirestore.forEach((noticia) => {
        const tarjeta = crearNoticiaHTML(noticia);
        contenedorNoticias.appendChild(tarjeta);
      });
    }
  } catch (error) {

  }

  // 2. Cargar noticias desde la API
  try {
    const respuesta = await fetch("https://backend-noticias-anime.onrender.com/api/noticias");
    const payloadAPI = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      throw new Error(`API noticias ${respuesta.status}`);
    }

    const noticiasAPI = extraerListaNoticias(payloadAPI);

    if (noticiasAPI.length) {
      contenedorNoticias.innerHTML = '';
      noticiasAPI.forEach((noticia) => {
        const tarjeta = crearNoticiaHTML(noticia);
        contenedorNoticias.appendChild(tarjeta);
      });

      // Guardar actualización en Firestore
      try {
        const noticiasRef = doc(db, "noticias", "noticias");
        await setDoc(noticiasRef, { noticias: noticiasAPI });
      } catch (error) {

      }
    }
  } catch (error) {

  } finally {
    initLoadingNoticias.style.display = 'none';
  }

  // Scroll horizontal en pantallas pequeñas
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
  return servidoresApi.map((servidor) => ({
    name: servidor.name || "", // 🔥 NUEVO: Conservamos el nombre original para saber si tiene (Lat)
    type: servidor.type || "", // 🔥 NUEVO: Conservamos el tipo (player, download)
    url: typeof servidor === "string" ? servidor : servidor.url
  }));
}

function reordenarServidores(servidores) {
  if (!servidores || servidores.length === 0) return servidores;

  const jkanimePriority = [];
  const priority = [];
  const other = [];
  const mediafire = [];

  servidores.forEach(srv => {
    if (!srv?.url) {
      other.push(srv);
      return;
    }

    const url = srv.url.toLowerCase();

    // Zilla-Networks filtrado completamente (no funciona por hotlinking)
    if (url.includes('zilla-networks.com')) {
      return; // Omitir este servidor
    }
    // Solo jkanime con /umv?e= y /um?e= tienen prioridad máxima
    else if ((url.includes('jkanime.net') || url.includes('jkplayer')) &&
             (url.includes('/umv?e=') || url.includes('/um?e='))) {
      jkanimePriority.push(srv);
    }
    else if (url.includes('yourupload.com/embed/')) {
      priority.push(srv);
    }
    else if (url.includes('mega.nz/')) {
      priority.push(srv);
    }
    else if (url.includes('mp4upload.com')) {
      priority.push(srv);
    }
    else if (url.includes('mediafire.com')) {
      mediafire.push({ ...srv, name: "Descargar" });
    }
    else {
      other.push(srv);
    }
  });

  return [...jkanimePriority, ...priority, ...other, ...mediafire];
}

async function obtenerServidoresDesdeApi(episodio) {
  const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?animeid=${animeId}&cap=${episodio.number}`);
  if (!res.ok) {
    debugLog(`La API respondió ${res.status} para el capítulo ${episodio.number}.`);
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
  if (firestoreEnPausaPorCuota) return false;

  const animeDatosRef = doc(db, "datos-animes", animeId);
  try {
    await runTransaction(db, async (transaction) => {
      const animeDatosSnap = await transaction.get(animeDatosRef);
      const animeDatos = animeDatosSnap.data() || {};
      const episodios = Array.isArray(animeDatos.episodios) ? [...animeDatos.episodios] : [];
      const episodioIndex = episodios.findIndex(e => String(e.number) === String(ep.number));
      const servidoresExistentes = episodioIndex === -1
        ? []
        : Array.isArray(episodios[episodioIndex].servidores) ? episodios[episodioIndex].servidores : [];

      // Conservar todos los servidores ya guardados (incluidos los manuales),
      // y sumar solamente URLs nuevas de la API.
      const clavesExistentes = new Set(servidoresExistentes.map(s => s?.url || s?.code).filter(Boolean));
      const servidoresFinales = [...servidoresExistentes];
      servidores.forEach(servidor => {
        const clave = servidor?.url || servidor?.code;
        if (!clave || !clavesExistentes.has(clave)) {
          servidoresFinales.push(servidor);
          if (clave) clavesExistentes.add(clave);
        }
      });

      if (episodioIndex !== -1) {
        episodios[episodioIndex] = { ...episodios[episodioIndex], servidores: servidoresFinales };
      } else {
        episodios.push({ number: ep.number, servidores: servidoresFinales });
      }

      transaction.set(animeDatosRef, { episodios }, { merge: true });
    });
    return true;
  } catch (error) {
    if (activarModoApiDirecta(error)) return false;
    throw error;
  }
}

function obtenerServidoresValidosDeFirestore(animeDatos, episodio) {
  // 🔥 CAMBIO: Buscar por number en lugar de url (ya que url puede estar vacío)
  const episodioGuardado = animeDatos?.episodios?.find(e => String(e.number) === String(episodio.number));
  const servidores = episodioGuardado?.servidores;

  if (!servidores?.length) return [];

  // No usar el formato anterior: necesita renovarse desde la API.
  const esFormatoViejo = servidores.some(s => s.nombre && s.name === undefined);
  return esFormatoViejo ? [] : servidores;
}

function guardarServidoresEnCache(episodio, servidores) {
  const servidoresOrdenados = reordenarServidores(servidores);
  const cacheKey = `servers_${animeId}_${episodio.number}`;
  serverCache.set(cacheKey, { data: servidoresOrdenados, time: Date.now() });
  return servidoresOrdenados;
}

function obtenerSiguienteEpisodio(index) {
  return episodios.find(e => String(e.number) === String(Number(index) + 1));
}

async function precargarSiguienteEpisodio(index, datosFirestore = undefined) {
  const siguiente = obtenerSiguienteEpisodio(index);
  if (!siguiente) return;

  const cacheKey = `servers_${animeId}_${siguiente.number}`;
  const cached = serverCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    siguiente.servidores = cached.data;
    return;
  }

  // La primera lectura ya trae todos los episodios del anime. Reutilizarla evita
  // una petición adicional y deja listo el siguiente capítulo de inmediato.
  const servidoresFirestore = obtenerServidoresValidosDeFirestore(datosFirestore, siguiente);
  if (servidoresFirestore.length) {
    siguiente.servidores = guardarServidoresEnCache(siguiente, servidoresFirestore);
    return;
  }

  // Si Firestore no tiene servidores válidos, conservar la precarga actual desde API.
  const servidores = await sincronizarServidoresConApi(siguiente, datosFirestore);
  if (servidores?.length) {
    siguiente.servidores = servidores;
  }
}

async function sincronizarServidoresConApi(ep, datosFirestore = undefined) {
  // Si no recibimos la lectura inicial, consultar Firestore antes de acudir a la API.
  if (!firestoreEnPausaPorCuota) try {
    if (datosFirestore === undefined) {
      const animeDatosRef = doc(db, "datos-animes", animeId);
      const animeDatosSnap = await getDoc(animeDatosRef);
      datosFirestore = animeDatosSnap.data() || {};
    }

    const servidoresFirestore = obtenerServidoresValidosDeFirestore(datosFirestore, ep);
    if (servidoresFirestore.length) {
      return guardarServidoresEnCache(ep, servidoresFirestore);
    }
  } catch (error) {
    if (!activarModoApiDirecta(error)) {

    }
  }

  // Firestore no tenía servidores válidos: usar el respaldo actual de la API.
  try {
    const servidoresApi = await obtenerServidoresDesdeApi(ep);
    if (!servidoresApi?.length) {
      return [];
    }

    await guardarServidoresEnFirestore(ep, servidoresApi);
    return guardarServidoresEnCache(ep, servidoresApi);
  } catch (error) {

    throw error;
  }
}

async function cargarEpisodios() {

  if (!firestoreEnPausaPorCuota) try {
    const episodiosRef = doc(db, "datos-animes", animeId);
    const docSnap = await getDoc(episodiosRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      tituloAnime = data.titulo || data.title || tituloAnime;
      portadaAnime = data.portada || data.cover || '';
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
    if (!activarModoApiDirecta(err)) {
      debugLog("Error al cargar desde Firestore; se intentará la API.", err);
    }
  }

  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${encodeURIComponent(animeId)}`);
    if (!res.ok) throw new Error(`API anime respondió ${res.status}`);

    const data = await res.json();
    tituloAnime = data.title || tituloAnime;

    episodios = (data.episodes || []).map(ep => ({ number: ep.number }));

    if (!episodios.length) {
      throw new Error("La API no devolvió episodios");
    }

    const animeData = {
      cover: data.cover || '',
      banner: data.banner || ''
    };

    aplicarFondoAnime(animeData);

    if (!firestoreEnPausaPorCuota) {
      try {
        const animeRef = doc(db, "datos-animes", animeId);
        await runTransaction(db, async (transaction) => {
          const actual = await transaction.get(animeRef);
          const episodiosGuardados = actual.exists() ? actual.data().episodios || [] : [];
          const guardadosPorNumero = new Map(episodiosGuardados.map(ep => [String(ep.number), ep]));
          const episodiosFusionados = episodios.map(ep => {
            const guardado = guardadosPorNumero.get(String(ep.number));
            if (!guardado) return ep;
            guardadosPorNumero.delete(String(ep.number));
            return {
              ...guardado,
              ...ep,
              ...(Array.isArray(guardado.servidores) ? { servidores: guardado.servidores } : {})
            };
          });

          // No eliminar capítulos que la API no haya devuelto todavía.
          episodios = [...episodiosFusionados, ...guardadosPorNumero.values()];
          transaction.set(animeRef, {
            episodios,
            titulo: data.title || animeId,
            cover: data.cover || '',
            banner: data.banner || ''
          }, { merge: true });
        });
      } catch (error) {
        if (!activarModoApiDirecta(error)) {

        }
      }
    }

    // Generar dropdown después de cargar episodios
    if (typeof generarDropdownCapitulos === 'function') {
      generarDropdownCapitulos();
    }
    // Actualizar texto de botones de navegación
    actualizarTextoBotonesNavegacion();
    await cargarVideoDesdeEpisodio(episodioActualIndex);
    return episodios;
  } catch (err) {

    const controles = document.getElementById("controles");
    if (controles) {
      controles.innerHTML = "<span class='span-carga'>404 No hay servidores disponibles para este episodio.</span>";
    }
    throw err;
  }
}

function aplicarFondoAnime(anime) {
  const bannerUrl = anime.banner;
  const portadaUrl = anime.portada || anime.cover;

  // Función auxiliar para no repetir código al inyectar el CSS
  const aplicarEstilos = (url) => {
    if (url) {
      document.body.style.setProperty('--background-image', `url('${url}')`);
      document.body.classList.add('fondo-animado');
    }
  };

  // Si por alguna razón el banner viene vacío o nulo de origen, aplicamos portada directamente
  if (!bannerUrl) {
    aplicarEstilos(portadaUrl);
    return;
  }

  // Creamos una imagen en memoria para comprobar si el link es accesible
  const img = new Image();

  img.onload = () => {
    // El link es válido y la imagen cargó correctamente
    aplicarEstilos(bannerUrl);
  };

  img.onerror = () => {
    // El link está roto, la imagen no existe o tiene bloqueos de CORS
    debugLog(`Error al cargar el banner ${bannerUrl}; se usa la portada como respaldo.`);
    aplicarEstilos(portadaUrl);
  };

  // Al asignar el src, el navegador intenta descargarla y dispara onload u onerror
  img.src = bannerUrl;
}

// Firestore puede tener el anime, pero no todos sus capítulos (por ejemplo,
// después de limitar las escrituras para proteger la cuota). En ese caso no
// debemos terminar en un 404 local: recuperamos el listado actual desde la API
// y conservamos los servidores que ya estaban disponibles en memoria.
async function recuperarEpisodioFaltanteDesdeApi(numeroEpisodio) {
  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${encodeURIComponent(animeId)}`);
    if (!res.ok) {
      throw new Error(`API anime respondió ${res.status}`);
    }

    const data = await res.json();
    const episodiosApi = (data.episodes || []).map(ep => ({ number: ep.number }));
    const episodioSolicitado = episodiosApi.find(ep => String(ep.number) === String(numeroEpisodio));

    if (!episodioSolicitado) return null;

    const episodiosLocales = new Map(episodios.map(ep => [String(ep.number), ep]));
    episodios = episodiosApi.map(ep => {
      const episodioLocal = episodiosLocales.get(String(ep.number));
      return episodioLocal
        ? { ...ep, ...episodioLocal }
        : ep;
    });

    aplicarFondoAnime({ cover: data.cover || '', banner: data.banner || '' });
    dropdownGenerado = false;
    generarDropdownCapitulos();
    actualizarTextoBotonesNavegacion();
    return episodioSolicitado;
  } catch (error) {

    return null;
  }
}

async function cargarVideoDesdeEpisodio(index) {
  const controles = document.getElementById("controles");
  // Si no hay en Firestore, mostrar indicador de carga
  document.getElementById("controles").innerHTML = "<span id='cargando-servidores'></span>";
  controles.classList.remove("con-mediafire");
  btnCap.textContent = `Episodio ${index}`;
  let ep = episodios.find(ep => String(ep.number) === String(index));
  if (!ep) {
    debugLog("El episodio no está en Firestore; comprobando la API.", index);
    ep = await recuperarEpisodioFaltanteDesdeApi(index);

    if (!ep) {
      btnCap.textContent = "Episodio desconocido";
      document.getElementById("controles").innerHTML = "<span class='span-carga'><h2>404</h2><br>No se encontró el episodio.</span>";
      return;
    }
  }

  // Actualizar índice y URL siempre, incluso si no hay servidores
  episodioActualIndex = index;
  history.replaceState({}, "", `/ver.html?id=${animeId}&episode=${ep.number}&servers=${modoDoblado ? "dob" : "sub"}`);

  //verificar si hay carga en el cche generado por la pre carga dle sigueite cap
  const cacheKey = "servers_" + animeId + "_" + ep.number;

  const cached = serverCache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_TTL) {
    renderizarServidores(cached.data);
    precargarSiguienteEpisodio(index).catch(() => {});
    return;
  }

  // 1. Cargar servidores de Firestore primero (instantáneo)
  let servidoresFirestore = [];
  let datosFirestore = null;
  if (!firestoreEnPausaPorCuota) try {
    const animeDatosRef = doc(db, "datos-animes", animeId);
    const animeDatosSnap = await getDoc(animeDatosRef);
    datosFirestore = animeDatosSnap.data() || {};
    servidoresFirestore = obtenerServidoresValidosDeFirestore(datosFirestore, ep);
  } catch (error) {
    if (!activarModoApiDirecta(error)) {

    }
  }

  // Dejar preparado el siguiente capítulo con los datos que ya devolvió Firestore.
  // Solo consultará la API para ese capítulo si no hay servidores guardados.
  precargarSiguienteEpisodio(index, datosFirestore).catch(() => {});

  // 2. Si hay servidores en Firestore, mostrarlos inmediatamente
  if (servidoresFirestore.length) {
    ep.servidores = guardarServidoresEnCache(ep, servidoresFirestore);
    renderizarServidores(ep.servidores);
  } else {

  }

  // 3. Sincronizar con la API en segundo plano
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
    // 1. Filtrar únicamente los servidores de la API que NO están en Firestore
    const servidoresNuevos = servidoresApi.filter(nuevo =>
      !servidoresFirestore.some(existente =>
        (existente.url && existente.url === nuevo.url) ||
        (existente.code && existente.code === nuevo.code) ||
        (existente.name === nuevo.name && existente.url === nuevo.url)
      )
    );

    // 2. Si hay servidores verdaderamente nuevos
    if (servidoresNuevos.length > 0) {
      // Fusionar los existentes con los nuevos
      const servidoresCombinados = [...servidoresFirestore, ...servidoresNuevos];

      // Reordenar la lista combinada
      ep.servidores = reordenarServidores(servidoresCombinados);

      guardarServidoresEnCache(ep, ep.servidores);
      // Actualizar la interfaz
      renderizarServidores(ep.servidores);
      // Guardar no puede bloquear la reproducción: si Firestore llega a 429,
      // la interfaz ya sigue usando los datos directos de la API.
      guardarServidoresEnFirestore(ep, ep.servidores).catch(error => {

      });
    } else if (!servidoresFirestore.length) {
      // Caso inicial: Firestore estaba vacío y la API devolvió resultados
      ep.servidores = reordenarServidores(servidoresApi);
      guardarServidoresEnCache(ep, ep.servidores);
      renderizarServidores(ep.servidores);
      guardarServidoresEnFirestore(ep, ep.servidores).catch(error => {

      });
    }
  } else if (!servidoresFirestore.length) {
    // API no devolvió servidores y no hay en Firestore
    document.getElementById("video").innerHTML = "No se encontraron servidores.";
    document.getElementById("controles").innerHTML = "";
  }
} catch (error) {

  if (!servidoresFirestore.length) {
    document.getElementById("video").innerHTML = "Error al cargar servidores.";
    document.getElementById("controles").innerHTML = "";
  }
}

  actualizarEstadoBotones();

  return ep;
}

function renderizarServidores(todosLosServidores) {
  // Filtramos los servidores antes de renderizarlos
  let servidores = filtrarServidores(todosLosServidores, modoDoblado);

  // Si el episodio solo está disponible en el otro idioma, usarlo en vez de
  // mostrar un falso "No hay servidores disponibles". Antes esto solo cubría
  // doblado -> subtitulado; por eso un episodio exclusivamente (Lat) fallaba
  // cuando la URL abría con servers=sub.
  if (!servidores?.length) {
    const modoAlternativo = !modoDoblado;
    const servidoresAlternativos = filtrarServidores(todosLosServidores, modoAlternativo);

    if (servidoresAlternativos.length) {
      modoDoblado = modoAlternativo;
      servidores = servidoresAlternativos;

      // Reflejar el modo realmente disponible, sin cambiar la preferencia
      // guardada del usuario para otros episodios.
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
      window.history.replaceState({}, "", newUrl);

      const btn = document.getElementById("btn-cambio-servers");
      if (btn) {
        btn.textContent = modoDoblado ? "Server Subtitulados" : "Server Doblados";
        btn.classList.toggle("activo", modoDoblado);
      }
    }
  }

  // Vidrift no depende de los enlaces de este episodio, pero se agrega después
  // de comprobar el idioma alternativo para no impedir ese fallback.
  const vidriftServer = {
    name: "Default",
    type: "player",
    url: "",
    vidrift: true
  };
  servidores = [vidriftServer, ...servidores];

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
    btn.dataset.serverIndex = i;
    btn.setAttribute('data-title', srv.name || extraerNombreDesdeURL(srv.url) || srv.nombre);
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

  // 🔥 Primer video por defecto (omite mediafire)
  if (embeds && embeds.length > 0) {
    const firstPlayable = embeds.find(s =>
      !s.url?.includes("mediafire.com")
    );
    const buttons = controles.querySelectorAll("button");

    if (buttons.length > 0) {
      const indexInEmbeds = embeds.indexOf(firstPlayable || embeds[0]);
      servidorActualIndex = indexInEmbeds;
      const buttonToSelect = buttons[indexInEmbeds] || buttons[0];
      mostrarVideo(firstPlayable || embeds[0], buttonToSelect);
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

async function esEnlaceValidoMega(fileId) {
  debugLog("Verificando si el enlace de Mega es válido.", fileId);
  try {
    const response = await fetch('https://g.api.mega.co.nz/cs', {
      method: 'POST',
      body: JSON.stringify([{ a: 'g', p: fileId }])
    });

    const data = await response.json();

    // Si Mega responde con un entero negativo (ej. -9), el archivo no existe
    if (Array.isArray(data) && typeof data[0] === 'number' && data[0] < 0) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

async function mostrarVideo(link, botonSeleccionado) {
  const url = typeof link === "string" ? link : link.url;
  const esVidrift = link.vidrift === true;
  const reproduccionId = ++reproduccionActualId;
  ventanaVidriftActiva = null;
  limpiarPreferenciaSubtitulos?.();
  limpiarPreferenciaSubtitulos = null;

  const botones = document.querySelectorAll("#controles button");
  botones.forEach(btn => btn.classList.remove("servidor-activo"));

  if (botonSeleccionado) {
    botonSeleccionado.classList.add("servidor-activo");
    servidorActualIndex = Number(botonSeleccionado.dataset.serverIndex);
  }

  const videoDiv = document.getElementById("video");
  videoDiv.innerHTML = "";

  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }

  // Caso especial para Vidrift
  if (esVidrift) {
    videoDiv.innerHTML = "<p class='span-carga'>Cargando servidor Vidrift...</p>";
    // Firestore o TMDB también pueden quedar esperando: no bloquees los demás
    // servidores si el ID no llega en un tiempo razonable.
    loadingTimeout = setTimeout(() => {
      if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "Tiempo de espera al obtener el ID de Vidrift");
    }, 12000);

    // Obtener brandColor dinámico desde la variable CSS --btn
    const computedStyle = getComputedStyle(document.body);
    const btnColor = computedStyle.getPropertyValue('--btn').trim();
    // Convertir el color hexadecimal a formato sin # para Vidrift
    const brandColor = btnColor.startsWith('#') ? btnColor.slice(1) : btnColor || "7c5cff";

    // Función para cargar el iframe con el ID de TMDB
    const cargarIframeConTMDB = (tmdbId, tmdbSeason) => {
      if (reproduccionId !== reproduccionActualId) return;
      if (loadingTimeout) clearTimeout(loadingTimeout);
      debugLog("Cargando Vidrift con el ID de TMDB.", tmdbId);

      // Construir URL con todos los parámetros de branding
      // Formato Vidrift: /tv/{tmdbId}/{temporada}/{episodio}.
      const baseUrl = `https://embed.vidrift.net/embed/tv/${tmdbId}/${tmdbSeason}/${episodioActualIndex}`;
      logVidriftClave("Embed preparado", {
        animeId,
        tmdbId,
        temporada: tmdbSeason,
        episodio: episodioActualIndex,
        baseUrl
      });
      const params = new URLSearchParams({
        brand: "Anizen",
        brandColor: brandColor,
        brandLogo: "https://ani.zenlite.workers.dev/icons/icon3.png",
        poster: "https://ani.zenlite.workers.dev/icons/poster.png",
        watermark: "1",
        showTitle: "1",
        // hide: "episodes",
        // URLSearchParams codifica los espacios; no pasar el valor ya codificado.
        font: "Bebas Neue"
      });
      const vidriftUrl = `${baseUrl}?${params.toString()}`;
      debugLog("URL de Vidrift generada.", vidriftUrl);

      const iframe = document.createElement("iframe");
      iframe.src = vidriftUrl;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.frameBorder = "0";
      iframe.allow = "autoplay; fullscreen";
      iframe.style.border = "0";

      // Los subtítulos españoles se buscan siempre. El audio solo se cambia
      // cuando existe una pista española: si no existe, se conserva el audio
      // del servidor y jamás se activa un fallback por esa razón.
      const preferirAudioEspanol = preferenciaDoblado;
      const preferirSubtitulosEspanol = true;
      logVidrift("Preferencia de idioma aplicada", {
        preferencia: preferenciaDoblado ? "doblado" : "subtitulado",
        modoServidoresActual: modoDoblado ? "doblado" : "subtitulado",
        subtitulosEspanol: preferirSubtitulosEspanol
      });
      let audioComprobado = !preferirAudioEspanol;
      let subtitulosComprobados = !preferirSubtitulosEspanol;
      const servidoresVidriftProbados = new Set();
      let estadoVidriftActual = null;
      // Un state inicial puede contener las pistas provisionales del proveedor.
      // No se debe descartar el servidor hasta que su lista se estabilice.
      let servidorSinEspanol = null;
      let inicioSinEspanol = 0;
      let servidorVidriftPendiente = null;
      let timeoutServidorVidrift = null;
      let subtituloEspanolPendiente = null;
      let intentosSubtituloEspanol = 0;
      let timeoutSubtituloEspanol = null;
      let intervaloEstadoVidrift = null;
      let recibirEstadoVidrift;

      const limpiarListenerVidrift = () => {
        clearTimeout(timeoutServidorVidrift);
        clearTimeout(timeoutSubtituloEspanol);
        clearInterval(intervaloEstadoVidrift);
        window.removeEventListener("message", recibirEstadoVidrift);
      };

      const solicitarEstadoVidrift = () => {
        iframe.contentWindow?.postMessage(
          { type: "vidrift:get-state" },
          "https://embed.vidrift.net"
        );
      };

      const seleccionarSubtituloEspanol = (subtitulo) => {
        if (!subtitulo?.value || estadoVidriftActual?.subtitle === subtitulo.value) {
          subtitulosComprobados = true;
          return;
        }

        subtituloEspanolPendiente = subtitulo.value;
        iframe.contentWindow.postMessage(
          { type: "vidrift:set", subtitle: subtitulo.value },
          "https://embed.vidrift.net"
        );
        logVidriftClave("Solicitando subtítulo en español", {
          servidor: estadoVidriftActual?.server,
          subtitulo: subtitulo.label || subtitulo.value,
          intento: intentosSubtituloEspanol + 1
        });

        clearTimeout(timeoutSubtituloEspanol);
        timeoutSubtituloEspanol = setTimeout(() => {
          if (
            reproduccionId !== reproduccionActualId ||
            subtituloEspanolPendiente !== subtitulo.value ||
            estadoVidriftActual?.subtitle === subtitulo.value
          ) return;

          if (intentosSubtituloEspanol++ < 2) {
            seleccionarSubtituloEspanol(subtitulo);
          } else {
            logVidrift("Vidrift no aplicó el subtítulo en español; se prueba otro servidor interno.", {
              servidor: estadoVidriftActual?.server,
              subtitulo: subtitulo.value
            });
            subtituloEspanolPendiente = null;
            probarSiguienteServidorVidrift();
          }
        }, 1200);
      };

      const probarSiguienteServidorVidrift = () => {
        if (!FALLBACK_AUTOMATICO_ACTIVO) {
          return;
        }

        const servidores = estadoVidriftActual?.servers || [];
        const esServidorDisponible = servidor =>
          servidor?.value &&
          servidor.value !== estadoVidriftActual?.server &&
          servidor.state !== "failed" &&
          !servidoresVidriftProbados.has(servidor.value);
        // Orion expone las pistas con códigos utilizables (por ejemplo mb-es),
        // por eso se prueba antes que proveedores que solo devuelven x1/x2.
        const siguienteServidor = servidores.find(servidor =>
          esServidorDisponible(servidor) && /orion/i.test(`${servidor.value} ${servidor.label || ""}`)
        ) || servidores.find(esServidorDisponible);

        if (!siguienteServidor) {
          logVidrift("No hay más servidores internos con subtítulos en español", {
            animeId,
            servidoresProbados: [...servidoresVidriftProbados]
          });
          limpiarListenerVidrift();
          if (limpiarPreferenciaSubtitulos === limpiarListenerVidrift) {
            limpiarPreferenciaSubtitulos = null;
          }
          if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "No quedan servidores internos de Vidrift con subtítulos en español");
          return;
        }

        servidoresVidriftProbados.add(siguienteServidor.value);
        servidorVidriftPendiente = siguienteServidor.value;
        logVidriftClave("Sin subtítulos en español; probando servidor interno", {
          anterior: estadoVidriftActual?.server,
          siguiente: siguienteServidor.value,
          etiqueta: siguienteServidor.label
        });
        iframe.contentWindow.postMessage(
          { type: "vidrift:set", server: siguienteServidor.value },
          "https://embed.vidrift.net"
        );

        clearTimeout(timeoutServidorVidrift);
        timeoutServidorVidrift = setTimeout(() => {
          if (reproduccionId !== reproduccionActualId || servidorVidriftPendiente !== siguienteServidor.value) return;
          logVidrift("El servidor interno no respondió; se usa el siguiente servidor externo.", {
            servidor: siguienteServidor.value
          });
          limpiarListenerVidrift();
          if (limpiarPreferenciaSubtitulos === limpiarListenerVidrift) {
            limpiarPreferenciaSubtitulos = null;
          }
          intentarSiguienteServidor(reproduccionId, "El servidor interno de Vidrift no respondió");
        }, 6000);
      };

      recibirEstadoVidrift = (event) => {
        if (
          event.origin !== "https://embed.vidrift.net" ||
          event.source !== iframe.contentWindow
        ) return;

        if (event.data?.type === "vidrift:command-error" && event.data.field === "server") {
          clearTimeout(timeoutServidorVidrift);
          servidorVidriftPendiente = null;
          logVidrift("Vidrift rechazó el cambio de servidor; se intenta otro.", event.data);
          probarSiguienteServidorVidrift();
          return;
        }
        if (event.data?.type === "vidrift:command-error" && event.data.field === "subtitle") {
          logVidrift("Vidrift rechazó el subtítulo en español; se prueba otro servidor interno.", event.data);
          subtituloEspanolPendiente = null;
          clearTimeout(timeoutSubtituloEspanol);
          probarSiguienteServidorVidrift();
          return;
        }
        if (event.data?.type !== "vidrift:state") return;

        estadoVidriftActual = event.data;
        if (estadoVidriftActual.server) servidoresVidriftProbados.add(estadoVidriftActual.server);
        if (servidorVidriftPendiente) {
          if (estadoVidriftActual.server !== servidorVidriftPendiente) return;
          clearTimeout(timeoutServidorVidrift);
          servidorVidriftPendiente = null;
          subtituloEspanolPendiente = null;
          intentosSubtituloEspanol = 0;
        }

        const normalizarIdioma = (texto) => String(texto || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        const esEspanol = (pista = {}) => {
          // El proveedor puede declarar el idioma en campos distintos. No
          // depender solo de label/value ni de la palabra literal "Español".
          const codigo = String(
            pista.value || pista.code || pista.lang || pista.language || pista.locale || ""
          ).toLowerCase();
          const descripcion = normalizarIdioma([
            pista.label,
            pista.name,
            pista.title,
            pista.language,
            pista.lang,
            pista.locale,
            pista.code
          ].filter(Boolean).join(" "));

          // Vidrift usa mb-es en Orion. Otros proveedores pueden usar es-419,
          // spa o textos como Spanish, Latin Spanish y Castellano.
          return /(?:^|[-_])(?:es|spa)(?:[-_]|$)/i.test(codigo)
            || /\b(?:espanol|spanish|castellano|castilian|latam|latino(?:americano)?)\b/.test(descripcion);
        };
        const audioEspanol = event.data.audios?.find(esEspanol);
        const subtituloEspanol = event.data.subtitles?.find(esEspanol);
        logVidrift("Estado de pistas recibido", {
          servidor: event.data.server,
          subtituloActivo: event.data.subtitle,
          subtitulos: event.data.subtitles?.map(({ value, label }) => ({ value, label }))
        });
        if (preferirSubtitulosEspanol) {
          logVidrift("Pista española detectada", {
            servidor: event.data.server,
            subtitulo: subtituloEspanol || null
          });
        }

        if (preferirAudioEspanol && audioEspanol) {
          iframe.contentWindow.postMessage(
            { type: "vidrift:set", audio: audioEspanol.value },
            "https://embed.vidrift.net"
          );
        }
        if (preferirSubtitulosEspanol && subtituloEspanol) {
          servidorSinEspanol = null;
          inicioSinEspanol = 0;
          if (event.data.subtitle === subtituloEspanol.value) {
            subtituloEspanolPendiente = null;
            clearTimeout(timeoutSubtituloEspanol);
            subtitulosComprobados = true;
            logVidrift("Subtítulo en español confirmado", {
              servidor: event.data.server,
              subtitulo: subtituloEspanol.label || subtituloEspanol.value
            });
          } else if (subtituloEspanolPendiente !== subtituloEspanol.value) {
            intentosSubtituloEspanol = 0;
            seleccionarSubtituloEspanol(subtituloEspanol);
          }
        }

        // Al iniciar, algunos proveedores devuelven una lista temporal (por
        // ejemplo x1/x2) y cargan los subtítulos reales segundos después. Solo
        // se descarta un servidor si durante 6 s sigue declarando pistas sin
        // español; así no se salta una pista que sí aparece en su menú.
        const pistasGenericas = event.data.subtitles?.some(pista =>
          /^x\d+(?:-\d+)?$/i.test(String(pista?.value || ""))
        );
        if (
          preferirSubtitulosEspanol &&
          !subtituloEspanol &&
          Array.isArray(event.data.subtitles) &&
          event.data.subtitles.length > 0 &&
          !pistasGenericas
        ) {
          const servidor = event.data.server || "desconocido";
          if (servidorSinEspanol !== servidor) {
            servidorSinEspanol = servidor;
            inicioSinEspanol = Date.now();
            logVidrift("Esperando las pistas finales antes de descartar el servidor", {
              servidor,
              esperaMs: 6000
            });
            return;
          }
          if (Date.now() - inicioSinEspanol < 6000) return;

          probarSiguienteServidorVidrift();
          return;
        }

        if (preferirSubtitulosEspanol && !subtituloEspanol && pistasGenericas) {
          const orionDisponible = event.data.servers?.some(servidor =>
            servidor?.value &&
            servidor.value !== event.data.server &&
            servidor.state !== "failed" &&
            !servidoresVidriftProbados.has(servidor.value) &&
            /orion/i.test(`${servidor.value} ${servidor.label || ""}`)
          );

          // Las pistas x1/x2 no permiten elegir idioma. Se espera el mismo
          // tiempo de estabilización y luego se prueba Orion, sin abandonar
          // Vidrift si Orion no existe.
          if (!orionDisponible) return;
          const servidor = event.data.server || "desconocido";
          if (servidorSinEspanol !== servidor) {
            servidorSinEspanol = servidor;
            inicioSinEspanol = Date.now();
            logVidrift("Pistas genéricas: esperando antes de probar Orion", {
              servidor,
              esperaMs: 6000
            });
            return;
          }
          if (Date.now() - inicioSinEspanol < 6000) return;

          probarSiguienteServidorVidrift();
          return;
        }

        if (preferirAudioEspanol) {
          // Un arreglo vacío representa una sola pista de audio: también es
          // un estado resuelto y no debe mantener el sondeo activo.
          audioComprobado ||= Array.isArray(event.data.audios);
        }
        if (preferirSubtitulosEspanol) {
          subtitulosComprobados ||= event.data.subtitle === subtituloEspanol?.value;
        }
        if (audioComprobado && subtitulosComprobados) {
          limpiarListenerVidrift();
          if (limpiarPreferenciaSubtitulos === limpiarListenerVidrift) {
            limpiarPreferenciaSubtitulos = null;
          }
        }
      };
      window.addEventListener("message", recibirEstadoVidrift);
      limpiarPreferenciaSubtitulos = limpiarListenerVidrift;
      setTimeout(() => {
        if (reproduccionId === reproduccionActualId) {
          limpiarListenerVidrift();
          if (limpiarPreferenciaSubtitulos === limpiarListenerVidrift) {
            limpiarPreferenciaSubtitulos = null;
          }
        }
      }, 30000);

      iframe.addEventListener("error", () => {
        if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "El iframe de Vidrift produjo un error");
      });
      loadingTimeout = setTimeout(() => {
        if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "Vidrift tardó demasiado en cargar");
      }, 12000);
      iframe.addEventListener("load", () => {
        if (reproduccionId !== reproduccionActualId) return;
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
        solicitarEstadoVidrift();
        // Algunos proveedores terminan de exponer las pistas unos segundos
        // después de cargar o de cambiar de servidor interno.
        intervaloEstadoVidrift = setInterval(solicitarEstadoVidrift, 1500);
      });

      if (reproduccionId !== reproduccionActualId) return;
      videoDiv.innerHTML = "";
      videoDiv.appendChild(iframe);
      ventanaVidriftActiva = iframe.contentWindow;
    };

    // Primero intentar obtener el ID de TMDB desde Firestore
    try {
      debugLog("Buscando ID de TMDB en Firestore.", animeId);
      const animeDatosRef = doc(db, "datos-animes", animeId);
      const animeDatosSnap = await getDoc(animeDatosRef);

      if (animeDatosSnap.exists()) {
        const animeDatos = animeDatosSnap.data();
        if (animeDatos.tmdbId) {
          debugLog("ID de TMDB encontrado en Firestore.", animeDatos.tmdbId);
          const tmdbSeason = await resolverTemporadaVidrift(animeDatos.tmdbId, animeDatos.tmdbSeason);
          if (!tmdbSeason) {
            if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "La temporada guardada no existe en TMDB");
            return;
          }
          logVidrift("ID recuperado de Firestore", {
            animeId,
            tmdbId: animeDatos.tmdbId,
            temporada: tmdbSeason,
            episodio: episodioActualIndex
          });
          if (Number(animeDatos.tmdbSeason) !== tmdbSeason) {
            setDoc(animeDatosRef, { tmdbSeason }, { merge: true }).catch(error => {

            });
          }
          cargarIframeConTMDB(animeDatos.tmdbId, tmdbSeason);
          return;
        } else {
          debugLog("El documento de Firestore no tiene tmdbId.");
        }
      } else {
        debugLog("El documento no existe en Firestore.");
      }

      // Si no está en Firestore, buscar en TMDB
      debugLog("Buscando el anime en TMDB.", tituloAnime);
      const resultados = await buscarAnimeTMDBConRespaldo(tituloAnime);
      debugLog("Resultados obtenidos de TMDB.", resultados);
      logVidrift("Resultados de búsqueda TMDB", { animeId, resultados });

      if (resultados && resultados.length > 0) {
        const seleccion = await seleccionarResultadoTMDBParaVidrift(resultados);
        if (!seleccion) {
          logVidrift("Ningún resultado de TMDB contiene la temporada solicitada.", {
            animeId,
            temporada: detectarTemporadaDesdeAnimeId(animeId)
          });
          if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "TMDB no devolvió una coincidencia con la temporada solicitada");
          return;
        }
        const { tmdbId, tmdbSeason, resultado } = seleccion;
        logVidrift("Primer resultado seleccionado", {
          animeId,
          seleccionado: resultado,
          tmdbId,
          temporada: tmdbSeason
        });

        // Guardar la asociación TMDB completa para no volver a detectarla.
        try {
          await setDoc(animeDatosRef, { tmdbId, tmdbSeason }, { merge: true });
          debugLog("Asociación de TMDB guardada en Firestore.", { tmdbId, tmdbSeason });
        } catch (error) {

        }

        cargarIframeConTMDB(tmdbId, tmdbSeason);
      } else {
        debugLog("No se encontraron resultados en TMDB.");
        if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "TMDB no encontró resultados para el anime");
      }
    } catch (error) {
      // El fallo de Vidrift tiene fallback automático al siguiente servidor.
      debugLog("No se pudo cargar Vidrift; se probará el siguiente servidor.", error);
      if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "Error al consultar Firestore o TMDB para Vidrift");
    }
    return;
  }

  if (url.endsWith(".mp4") || url.endsWith(".m3u8") || url.includes(".mp4?") || url.includes(".m3u8?")) {
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.autoplay = true;
    video.width = "100%";
    video.height = "100%";
    video.style.maxHeight = "80vh";
    video.onerror = () => {
      if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "El archivo de vídeo no se pudo reproducir");
    };
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

    iframe.onerror = () => {
      if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "El iframe del servidor produjo un error");
    };

    // Timeout: 10 segundos para todos
    loadingTimeout = setTimeout(() => {
      if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "El servidor externo tardó demasiado en cargar");
    }, 10000);

    iframe.onload = () => {
      if (reproduccionId !== reproduccionActualId) return;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }
    };

    // Verificar si el archivo de Mega existe antes de cargar
    const isMega = url.includes('mega.nz/');
    if (isMega) {
      debugLog("El enlace corresponde a Mega.");
      const fileIdMatch = url.match(/mega\.nz\/embed\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        esEnlaceValidoMega(fileId).then(valido => {
          if (!valido) {
            if (reproduccionId === reproduccionActualId) intentarSiguienteServidor(reproduccionId, "El enlace de Mega no está disponible");
          } else if (reproduccionId === reproduccionActualId) {
            videoDiv.appendChild(iframe);
          }
        }).catch(() => {
          if (reproduccionId === reproduccionActualId) videoDiv.appendChild(iframe);
        });
        return;
      }
    }

    videoDiv.appendChild(iframe);
  }
}

function intentarSiguienteServidor(reproduccionId = reproduccionActualId, motivo = "El servidor actual falló o no respondió") {
  if (reproduccionId !== reproduccionActualId) return;

  if (!FALLBACK_AUTOMATICO_ACTIVO) {
    console.info("[Reproducción] Cambio automático desactivado; se conserva el servidor actual.", {
      animeId,
      episodio: episodioActualIndex,
      servidorActual: embeds[servidorActualIndex]?.nombre || embeds[servidorActualIndex]?.name || "desconocido",
      motivo
    });
    return;
  }

  const siguienteIndice = embeds.findIndex((servidor, indice) =>
    indice > servidorActualIndex && !servidor.url?.includes("mediafire.com")
  );

  if (siguienteIndice === -1) {
    limpiarPreferenciaSubtitulos?.();
    limpiarPreferenciaSubtitulos = null;
    console.error("[Reproducción] No hay más servidores disponibles.", {
      animeId,
      episodio: episodioActualIndex,
      servidorActual: embeds[servidorActualIndex]?.nombre || embeds[servidorActualIndex]?.name || "desconocido",
      motivo
    });
    document.getElementById("video").innerHTML = "<p class='span-carga'>No hay más servidores disponibles para este episodio.</p>";
    return;
  }

  const siguienteServidor = embeds[siguienteIndice];
  const siguienteBoton = document.querySelector(`#controles button[data-server-index="${siguienteIndice}"]`);
  if (!siguienteBoton) return;

  // Esto se conserva también en producción: un salto automático debe ser
  // trazable sin habilitar el registro detallado de Vidrift.
  registrarCambioAutomaticoServidor({
    animeId,
    episodio: episodioActualIndex,
    desde: embeds[servidorActualIndex]?.nombre || embeds[servidorActualIndex]?.name || "desconocido",
    hacia: siguienteServidor.nombre || siguienteServidor.name || `Servidor ${siguienteIndice + 1}`,
    motivo
  });

  const pill = document.createElement("div");
  pill.className = "pildora pildora-default";
  // El motivo también se muestra en pantalla: Live Server y algunos iframes
  // pueden limpiar la consola mientras se reemplaza el reproductor.
  pill.textContent = `Servidor no disponible: ${motivo}. Cambiando a ${siguienteServidor.nombre || siguienteServidor.name || `Servidor ${siguienteIndice + 1}`}.`;
  pill.title = motivo;
  document.body.appendChild(pill);
  pill.addEventListener("animationend", () => pill.remove(), { once: true });

  mostrarVideo(siguienteServidor, siguienteBoton);
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
    const user = localStorage.getItem("userID");
    if (user && marcarVistoBtn && !marcarVistoBtn.classList.contains('visto') && !toggleInProgress) {
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

function establecerModoCine(activo) {
  document.body.classList.toggle("cine", activo);
  localStorage.setItem("cineActivo", String(activo));
}

// Listener para detectar cambios de episodio en el iframe de Vidrift
window.addEventListener('message', (event) => {
  // Verificar que el mensaje viene de Vidrift
  if (event.origin !== 'https://embed.vidrift.net' && event.origin !== 'https://vidrift.net') {
    return;
  }

  // Un capítulo marcado como no emitido no podrá reproducirse en Vidrift.
  // Solo atendemos el iframe visible para no reaccionar a mensajes atrasados.
  if (event.data?.type === "vidrift:unreleased" && event.source === ventanaVidriftActiva) {
    console.warn("[Vidrift] El capítulo aún no está emitido; se probará el siguiente servidor.", {
      animeId,
      episodio: episodioActualIndex
    });
    intentarSiguienteServidor(reproduccionActualId, "Vidrift indicó que el capítulo no está emitido");
    return;
  }

  // Detectar cambio de episodio (puede tener diferentes formatos)
  let nuevoEpisodio = null;

  if (event.data && event.data.type === "vidrift:episode") {
    nuevoEpisodio = event.data.episode;
  } else if (event.data && event.data.type === 'episodeChange') {
    nuevoEpisodio = event.data.episode;
  } else if (event.data && event.data.episode) {
    nuevoEpisodio = event.data.episode;
  } else if (event.data && event.data.ep) {
    nuevoEpisodio = event.data.ep;
  } else if (event.data && typeof event.data === 'number') {
    nuevoEpisodio = event.data;
  }

  const numeroEpisodio = Number(nuevoEpisodio);
  if (Number.isInteger(numeroEpisodio) && numeroEpisodio > 0 && numeroEpisodio !== episodioActualIndex) {
    debugLog("Cambio de episodio detectado.", numeroEpisodio);

    // Actualizar el episodio actual
    episodioActualIndex = numeroEpisodio;

    // Actualizar URL
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("episode", numeroEpisodio);
    newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
    window.history.pushState({}, "", newUrl);

    // Actualizar UI
    actualizarNumeroCapitulo();
    actualizarEstadoBotones();
    generarDropdownCapitulos();
    actualizarTextoBotonesNavegacion();

    // Refrescar estado de visto
    refrescarUIEstadoCapitulo();
  }
});

function mostrarPildora(estado = true, cap = null, actualizando = false) {
  const pillAnterior = document.querySelector('.pildora');
  if (pillAnterior) pillAnterior.remove();
  
  const pill = document.createElement("div");

  if (estado === "no-user") {
    pill.className = "pildora pildora-no-user";
    pill.textContent = "Inicia sesión para guardar tu progreso";
    pill.onclick = () => {
      const confirmBtn = document.getElementById("confirm-login");
      if (confirmBtn) confirmBtn.click();
    };
  } else if (actualizando) {
    pill.className = "pildora pildora-default";
    pill.textContent = "Actualizando...";
  } else {
    const capTexto = cap ? ` ${cap}` : "";
    pill.className = `pildora pildora-${estado ? "visto" : "eliminado"}`;
    pill.textContent = estado
      ? `Capítulo${capTexto} marcado como visto`
      : `Capítulo${capTexto} eliminado de vistos`;
  }

  document.body.appendChild(pill);

  pill.addEventListener('animationend', () => {
    pill.remove();
  }, { once: true });
}


document.addEventListener('DOMContentLoaded', () => {
  const cineBtn = document.getElementById('cine');
  const overlay = document.getElementById('cine-overlay');

  cineBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    establecerModoCine(!document.body.classList.contains('cine'));
  });

  overlay?.addEventListener('click', () => establecerModoCine(false));

  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('cine')) return;

    if (!e.target.closest('button, a, input, select, textarea')) {
      establecerModoCine(false);
    }
  });
});
