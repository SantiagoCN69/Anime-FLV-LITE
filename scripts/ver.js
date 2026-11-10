const TMDB_API_KEY = "2e33599c8f4125cdb44029031486d35f";
const MODO_DIAGNOSTICO_REPRODUCTOR = false;
const esDesarrollo = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
const debugLog = (esDesarrollo || MODO_DIAGNOSTICO_REPRODUCTOR) ? console.log.bind(console) : () => {};

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
    fecha: anime.first_air_date,
    popularidad: anime.popularity
  }));
}

function quitarSufijoTemporada(titulo) {
  return String(titulo || "")
    .replace(/(?:\s|-)\d+(?:st|nd|rd|th)[\s-]+season\b.*$/i, "")
    .replace(/(?:\s|-)(?:season|temporada)[\s-]*\d+\b.*$/i, "")
    .replace(/(?:\s|-)(?:second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|primera|segunda|tercera|cuarta|quinta|sexta|séptima|septima|octava|novena|décima|decima)[\s-]+(?:season|temporada)\b.*$/i, "")
    .replace(/(?:\s|-)dai[\s-]+\d+[\s-]+ki\b.*$/i, "")
    .replace(/(?:\s|-)r\d+\b.*$/i, "")
    .replace(/[\s-]+(?:season|temporada)[\s-]*(?:i{1,3}|iv|vi{0,3}|ix|x)\b.*$/i, "")
    .replace(/[\s-]+(?:i{1,3}|iv|vi{0,3}|ix|x)[\s-]*$/i, "")
    .replace(/[\s-]+$/, "")
    .trim();
}

function normalizarNombre(nombre) {
  return String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[^a-z0-9]/g, "") // Solo letras y números
    .trim();
}

async function buscarAnimeTMDBConRespaldo(titulo) {
  const tituloBase = quitarSufijoTemporada(titulo);
  const consultas = [...new Set([titulo, tituloBase].filter(Boolean))];

  for (const consulta of consultas) {
    const resultados = await buscarAnimeTMDB(consulta);
    debugLog("[Vidrift] Consulta TMDB", { consulta, resultados });
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
    || slug.match(/(?:^|-)(i|ii|iii|iv|v|vi|vii|viii|ix|x)-(?:season|temporada)(?:-|$)/)
    || slug.match(/(?:^|-)(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/);
  if (marcadorRomano) return romanos[marcadorRomano[1]];

  return 1;
}

const cacheVerificacionTemporada = new Map();

async function verificarTemporadaTMDB(tmdbId, temporada) {
  const clave = `${tmdbId}:${temporada}`;
  if (cacheVerificacionTemporada.has(clave)) {
    return cacheVerificacionTemporada.get(clave);
  }

  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${temporada}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");

  try {
    const respuesta = await fetch(url, { headers: { accept: "application/json" } });
    if (!respuesta.ok) {
      cacheVerificacionTemporada.set(clave, false);
      return false;
    }

    const datos = await respuesta.json();
    const existe = Number(datos.season_number) === temporada;
    cacheVerificacionTemporada.set(clave, existe);
    return existe;
  } catch {
    return false;
  }
}

async function resolverTemporadaVidrift(tmdbId, temporadaGuardada) {
  const temporadaDetectada = detectarTemporadaDesdeAnimeId(animeId);
  const temporadaManual = Number(temporadaGuardada);
  const temporadaGuardadaValida = Number.isInteger(temporadaManual) && temporadaManual > 0;
  const tieneSufijoTemporada = temporadaDetectada !== 1;

  if (temporadaGuardadaValida && (!tieneSufijoTemporada || temporadaManual === temporadaDetectada)) {
    debugLog("[Vidrift] Temporada recuperada de Firestore", { animeId, tmdbId, temporada: temporadaManual });
    return temporadaManual;
  }

  debugLog("[Vidrift] Temporada detectada desde el slug", { animeId, tmdbId, temporada: temporadaDetectada });

  const existe = await verificarTemporadaTMDB(tmdbId, temporadaDetectada);
  if (!existe) {
    debugLog("[Vidrift] La temporada detectada no existe en TMDB", { animeId, tmdbId, temporada: temporadaDetectada });
    return temporadaGuardadaValida ? temporadaManual : null;
  }

  debugLog("[Vidrift] Temporada confirmada por TMDB", { animeId, tmdbId, temporada: temporadaDetectada });
  return temporadaDetectada;
}

async function seleccionarResultadoTMDBParaVidrift(resultados) {
  debugLog("[Vidrift] Seleccionando resultado TMDB", { animeId, resultadosCount: resultados.length });
  const temporada = detectarTemporadaDesdeAnimeId(animeId);

  const resultadosValidos = [];

  for (const resultado of resultados) {
    const existe = await verificarTemporadaTMDB(resultado.id, temporada);
    debugLog("[Vidrift] Comprobando resultado TMDB para la temporada", {
      tmdbId: resultado.id,
      titulo: resultado.titulo,
      tituloOriginal: resultado.tituloOriginal,
      temporada,
      existe
    });
    if (existe) {
      resultadosValidos.push({ ...resultado, tmdbId: resultado.id, tmdbSeason: temporada });
    }
  }

  if (resultadosValidos.length === 0) return null;

  // Agrupar por nombre normalizado
  const gruposPorNombre = new Map();
  for (const resultado of resultadosValidos) {
    const nombreNormalizado = normalizarNombre(resultado.titulo);
    if (!gruposPorNombre.has(nombreNormalizado)) {
      gruposPorNombre.set(nombreNormalizado, []);
    }
    gruposPorNombre.get(nombreNormalizado).push(resultado);
  }

  // Si hay grupos con múltiples resultados del mismo nombre, elegir el más popular de cada grupo
  const mejoresDeCadaGrupo = [];
  for (const [nombre, grupo] of gruposPorNombre) {
    if (grupo.length > 1) {
      // Ordenar por popularidad descendente y tomar el primero
      grupo.sort((a, b) => (b.popularidad || 0) - (a.popularidad || 0));
      debugLog("[Vidrift] Múltiples resultados con mismo nombre, eligiendo el más popular", {
        nombre,
        cantidad: grupo.length,
        seleccionado: grupo[0]
      });
    }
    mejoresDeCadaGrupo.push(grupo[0]);
  }

  // Retornar el primero de los mejores (o el único si no hubo agrupación)
  return { tmdbId: mejoresDeCadaGrupo[0].tmdbId, tmdbSeason: mejoresDeCadaGrupo[0].tmdbSeason, resultado: mejoresDeCadaGrupo[0] };
}

const params = new URLSearchParams(location.search);
const animeId = params.get("id");
const episodeNumber = params.get("episode");
const serversParam = params.get("servers"); // "sub" o "dob"

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

function cancelarFallbackDeCarga() {
  if (loadingTimeout) clearTimeout(loadingTimeout);
  loadingTimeout = null;
}

function programarFallbackDeCarga(reproduccionId, demora, motivo) {
  cancelarFallbackDeCarga();
  loadingTimeout = setTimeout(() => {
    if (reproduccionId === reproduccionActualId) {
      intentarSiguienteServidor(reproduccionId, motivo);
    }
  }, demora);
}

function mostrarEstadoDeServidores(mensaje, limpiarControles = false) {
  videoContenedorGlobal.innerHTML = `<p class='span-carga'>${mensaje}</p>`;
  if (limpiarControles) document.getElementById("controles").innerHTML = "";
}

function ejecutarEnSegundoPlano(promesa, contexto) {
  Promise.resolve(promesa).catch(error => debugLog(`${contexto}:`, error));
}
const btnVolverAnime = document.getElementById("btn-volver-anime");
if (btnVolverAnime && animeId) {
  btnVolverAnime.href = `/anime?id=${encodeURIComponent(animeId)}`;
}

// Leer preferencia de servidores de localStorage
const serversPreference = localStorage.getItem("serverPreference");

document.title = animeId
  ? "AniZen - " + animeId.replaceAll("-", " ") + " - " + (episodeNumber || "")
  : "AniZen";

const btnSiguiente = document.getElementById("btn-siguiente-capitulo");
const btnAnterior = document.getElementById("btn-anterior-capitulo");
const btnSelectorCapitulo = document.getElementById("btn-selector-capitulo");
const dropdownCapitulos = document.getElementById("dropdown-capitulos");
const numeroCapituloActual = document.getElementById("numero-capitulo-actual");
const textoAnterior = document.getElementById("texto-anterior");
const textoSiguiente = document.getElementById("texto-siguiente");
const videoContenedorGlobal = document.getElementById("video");

// Variable global para capítulos vistos (compartida con refrescarUIEstadoCapitulo)
let capitulosVistosGlobales = [];

// Cache del dropdown generado para evitar regeneraciones innecesarias
let dropdownGenerado = false;

let episodios = [];
let tituloAnime = (animeId || "").replaceAll("-", " ");
let portadaAnime = '';
let episodioActualIndex = Number.parseInt(episodeNumber, 10);
// Algunas series incluyen el episodio 0 (especial, prólogo, etc.).
if (!Number.isInteger(episodioActualIndex) || episodioActualIndex < 0) {
  episodioActualIndex = 1;
}
let embeds = [];
let bloquearAnuncios = localStorage.getItem("bloquearAnuncios") !== "false";
// Esta preferencia se lee al abrir el reproductor. Vidrift recibe los
// parámetros correspondientes al crear el iframe.
let modoMaratonActivo = localStorage.getItem("modoMaraton") === "true";
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
let cambioEpisodioVidriftEnCurso = false;
let saltoOutroVidriftEnCurso = false;
let cacheTmdbVidrift = null;
let promesaTmdbVidrift = null;
let firestoreTmdbConsultado = false;
let documentoAnimeCache = undefined;

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
  
  sincronizarUINavegacion();
  
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
  const numeroActual = parseInt(episodioActualIndex, 10);
  currentIndex = episodios.findIndex((ep, idx) => getNumeroCapitulo(ep, idx) === numeroActual);
  
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

// Unifica las cuatro actualizaciones de UI que se repetían tras cambiar
// de capítulo (selector, botones y dropdown).
function sincronizarUINavegacion() {
  requestAnimationFrame(() => {
    actualizarNumeroCapitulo();
    actualizarEstadoBotones();
    generarDropdownCapitulos();
    actualizarTextoBotonesNavegacion();
  });
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
  btnBloquear.textContent = "AdBlock";
  btnBloquear.classList.toggle("activo", bloquearAnuncios);
}

btnBloquear?.addEventListener("click", () => {
  bloquearAnuncios = !bloquearAnuncios;
  localStorage.setItem("bloquearAnuncios", String(bloquearAnuncios));
  btnBloquear.textContent = "AdBlock";
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
  btnCambioServers.textContent = modoDoblado ? "subtitulado" : "doblado";
  btnCambioServers.classList.toggle("activo", modoDoblado);
  
  btnCambioServers.addEventListener("click", function() {
    modoDoblado = !modoDoblado;
    preferenciaDoblado = modoDoblado;
    
    // Cambiamos el texto del botón según el estado
    this.textContent = modoDoblado ? "subtitulado" : "doblado";
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

// Botón de modo maratón: misma preferencia que el toggle de preferencias.
// Solo recarga el episodio cuando Vidrift es el servidor activo, porque
// autoskip/autonext se envían como parámetros al crear su iframe.
const btnModoMaraton = document.getElementById("btn-modo-maraton");
if (btnModoMaraton) {
  btnModoMaraton.classList.toggle("activo", modoMaratonActivo);

  btnModoMaraton.addEventListener("click", function() {
    modoMaratonActivo = !modoMaratonActivo;
    localStorage.setItem("modoMaraton", String(modoMaratonActivo));
    this.classList.toggle("activo", modoMaratonActivo);

    const servidorActivo = embeds[servidorActualIndex];
    if (servidorActivo?.vidrift) {
      cargarVideoDesdeEpisodio(episodioActualIndex);
    }
  });
}

function actualizarEstadoBotonDoblado(servidores) {
  const btn = document.getElementById("btn-cambio-servers");
  if (!btn) return;

  const tienedoblado = servidores.some(s => 
    (s.name || "").toLowerCase().includes("(lat)")
  );

  if (!tienedoblado) {
    btn.disabled = true;
    if (modoDoblado) {
      modoDoblado = false;
      btn.textContent = "Doblado";
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("servers", "sub");
      window.history.replaceState({}, "", newUrl);
      // No guardar en localStorage en cambio automático
    }
  } else {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.textContent = modoDoblado ? "subtitulado" : "doblado";
    btn.classList.toggle("activo", modoDoblado);
  }
}

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, deleteDoc, runTransaction, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

// Inicialización de Firebase optimizada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

const btnCap = document.getElementById("btn-cap");
if (btnVolverAnime) btnVolverAnime.textContent = tituloAnime;
if (btnCap) btnCap.textContent = `Episodio ${episodioActualIndex}`;

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
    const titulo = btnVolverAnime?.textContent || tituloAnime;

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
          episodiosVistos: nuevoEstadoVisto ? arrayUnion(episodioId) : arrayRemove(episodioId),
          esFinalizadoPorVistos: esFinalizadoPorVistos
        }, { merge: true });
      }

      capitulosVistosGlobales = arrayNuevosVistos;
      dropdownGenerado = false;
      generarDropdownCapitulos();

      mostrarPildora(nuevoEstadoVisto, episodioActualIndex);
    } catch (error) {

      // Revertir UI en caso de error
      // await refrescarUIEstadoCapitulo();
    }
  } finally {
    toggleInProgress = false;
  }
}
// A diferencia del botón, este flujo nunca desmarca un capítulo ya visto.
async function marcarCapituloActualComoVisto() {
  const usuario = localStorage.getItem("userID");
  if (!usuario || toggleInProgress || btnEstadoCapitulo?.classList.contains("visto")) return;

  await toggleYGuardarEstadoCapitulo();
}

// Esperar a que el estado de autenticación esté listo
document.addEventListener("authStateReady", async (event) => {
  if (event.detail.user) {
    try {
      await refrescarUIEstadoCapitulo();
    } catch (error) {
      debugLog("Error al refrescar el estado del capítulo tras authStateReady:", error);
    }
  } else {
    debugLog("Usuario no autenticado según authStateReady.");
  }
});

btnEstadoCapitulo?.addEventListener("click", async () => {
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


function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlNoticiaSegura(url) {
  const valor = String(url || "").trim();
  const protocolo = valor.slice(0, valor.indexOf(":") + 1).toLowerCase();
  if (protocolo === "javascript:" || protocolo === "data:") return "";
  return valor;
}

function crearNoticiaHTML(noticia) {
  const tarjeta = document.createElement('a');
  tarjeta.className = 'tarjeta-noticia';
  
  const enlace = urlNoticiaSegura(noticia.enlace || noticia.slug || '');
  tarjeta.href = enlace || '#';
  if (enlace) {
    tarjeta.target = '_blank';
    tarjeta.rel = 'noopener noreferrer';
  }
  
  const imagenSrc = urlNoticiaSegura(noticia.imagenUrl || noticia.image || '');
  const titulo = escaparHTML(noticia.titulo || noticia.title || 'Sin título');
  const fechaOriginal = noticia.fechaAutor || noticia.date || '';
  const fechaFiltrada = fechaOriginal.includes(' por ') 
    ? fechaOriginal.split(' por ')[0] 
    : fechaOriginal;
  
  tarjeta.innerHTML = `
    <img src="${escaparHTML(imagenSrc)}" 
        alt="${titulo}" 
        class="noticia-imagen"
        loading="lazy"
        onerror="this.style.display='none'">
    <h3 class="noticia-titulo">${titulo}</h3>
    <p class="noticia-fecha">${escaparHTML(fechaFiltrada || 'Sin fecha')}</p>
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

  const renderizarNoticias = (noticias) => {
    contenedorNoticias.innerHTML = '';
    noticias.forEach((noticia) => {
      const tarjeta = crearNoticiaHTML(noticia);
      contenedorNoticias.appendChild(tarjeta);
    });
  };

  const cargarDesdeFirestore = async () => {
    try {
      const noticiasRef = doc(db, "noticias", "noticias");
      const docSnap = await getDoc(noticiasRef);

      if (docSnap.exists()) {
        const noticiasFirestore = extraerListaNoticias(docSnap.data()?.noticias);
        if (noticiasFirestore.length) {
          initLoadingNoticias.style.display = 'none';
          renderizarNoticias(noticiasFirestore);
        }
      }
    } catch (error) {

    }
  };

  const guardarEnFirestore = async (noticiasAPI) => {
    try {
      const noticiasRef = doc(db, "noticias", "noticias");
      await setDoc(noticiasRef, { noticias: noticiasAPI });
    } catch (error) {

    }
  };

  const fetchNoticiasAPI = async () => {
    const respuesta = await fetch("https://backend-noticias-anime.onrender.com/api/noticias");
    const payloadAPI = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      throw new Error(`API noticias ${respuesta.status}`);
    }

    const noticiasAPI = extraerListaNoticias(payloadAPI);
    if (!noticiasAPI.length) {
      throw new Error('API noticias vacía');
    }

    return noticiasAPI;
  };

  // La API envuelta para que nunca rechace la carrera
  const apiPromise = fetchNoticiasAPI()
    .then((noticias) => ({ noticias }))
    .catch(() => ({ noticias: null }));

  // 1 segundo de espera: si la API responde antes, Firestore no se toca
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ timeout: true }), 1000)
  );

  const primerResultado = await Promise.race([apiPromise, timeoutPromise]);

  if (!primerResultado.timeout && primerResultado.noticias) {
    // API rápida: render directo, sin leer ni escribir Firestore
    initLoadingNoticias.style.display = 'none';
    renderizarNoticias(primerResultado.noticias);
  } else {
    // API lenta o fallida: mostrar caché de Firestore mientras tanto
    await cargarDesdeFirestore();

    // Cuando la API responda, actualizar render y Firestore
    const resultadoFinal = await apiPromise;
    if (resultadoFinal.noticias) {
      initLoadingNoticias.style.display = 'none';
      renderizarNoticias(resultadoFinal.noticias);
      await guardarEnFirestore(resultadoFinal.noticias);
    }
  }

  initLoadingNoticias.style.display = 'none';

  // Scroll horizontal en pantallas pequeñas
  contenedorNoticias.addEventListener('wheel', (evento) => {
    if (evento.deltaY !== 0 && window.innerWidth <= 1100) {
      evento.preventDefault();
      contenedorNoticias.scrollLeft += evento.deltaY;
    }
  });
}

manejarNoticias();


function filtrarServidores(servidores, solodoblado = false) {
  if (!servidores) return [];
  return servidores.filter(servidor => {
    // Buscamos en 'name' (el de la API original)
    const nombreOriginal = (servidor.name || "").toLowerCase();
    const tieneLat = nombreOriginal.includes('(lat)');
    
    return solodoblado ? tieneLat : !tieneLat;
  });
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
      if (documentoAnimeCache) {
        documentoAnimeCache = { ...documentoAnimeCache, episodios };
      }
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
  // Si no recibimos la lectura inicial, reutilizar la caché del documento
  // y solo consultar Firestore cuando todavía no se haya leído.
  if (!firestoreEnPausaPorCuota) try {
    if (!datosFirestore) {
      datosFirestore = documentoAnimeCache;
    }
    if (!datosFirestore) {
      const animeDatosRef = doc(db, "datos-animes", animeId);
      const animeDatosSnap = await getDoc(animeDatosRef);
      datosFirestore = animeDatosSnap.data() || {};
      recordarDocumentoAnime(datosFirestore);
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
      recordarDocumentoAnime(data);
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
        let datosDocumentoPrevio = null;
        await runTransaction(db, async (transaction) => {
          const actual = await transaction.get(animeRef);
          datosDocumentoPrevio = actual.exists() ? actual.data() : null;
          const episodiosGuardados = datosDocumentoPrevio?.episodios || [];
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
        // Refrescar la caché con lo que quedó en Firestore para que las
        // funciones siguientes no tengan que volver a leer el documento.
        recordarDocumentoAnime({
          ...(datosDocumentoPrevio || {}),
          episodios,
          titulo: data.title || animeId,
          cover: data.cover || '',
          banner: data.banner || ''
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
    const hayEpisodioNuevo = episodiosApi.some(ep => !episodiosLocales.has(String(ep.number)));
    episodios = episodiosApi.map(ep => {
      const episodioLocal = episodiosLocales.get(String(ep.number));
      return episodioLocal
        ? { ...ep, ...episodioLocal }
        : ep;
    });

    if (hayEpisodioNuevo) {
      // El capítulo nuevo puede haber llegado a Firestore con sus servidores;
      // soltar la caché para que la siguiente lectura no use datos viejos.
      documentoAnimeCache = undefined;
    }

    aplicarFondoAnime({ cover: data.cover || '', banner: data.banner || '' });
    dropdownGenerado = false;
    generarDropdownCapitulos();
    actualizarTextoBotonesNavegacion();
    return episodioSolicitado;
  } catch (error) {

    return null;
  }
}

async function obtenerDatosAnimeParaServidores() {
  if (firestoreEnPausaPorCuota) return null;
  try {
    if (documentoAnimeCache) return documentoAnimeCache;
    const animeDatosSnap = await getDoc(doc(db, "datos-animes", animeId));
    const datos = animeDatosSnap.data() || {};
    recordarDocumentoAnime(datos);
    return datos;
  } catch (error) {
    activarModoApiDirecta(error);
    return null;
  }
}

function sonElMismoServidor(a, b) {
  return (a.url && a.url === b.url)
    || (a.code && a.code === b.code)
    || (a.name === b.name && a.url === b.url);
}

function combinarServidores(guardados, recibidos) {
  return [...guardados, ...recibidos.filter(nuevo =>
    !guardados.some(existente => sonElMismoServidor(existente, nuevo))
  )];
}

function aplicarServidoresDeApi(ep, servidores, mantenerReproduccion) {
  ep.servidores = guardarServidoresEnCache(ep, servidores);
  renderizarServidores(ep.servidores, { mantenerReproduccion });
  ejecutarEnSegundoPlano(
    guardarServidoresEnFirestore(ep, ep.servidores),
    "No se pudieron guardar los servidores obtenidos de la API"
  );
}

async function cargarVideoDesdeEpisodio(index) {
  const controles = document.getElementById("controles");
  controles.innerHTML = "<span id='cargando-servidores'></span>";
  controles.classList.remove("con-mediafire");
  btnCap.textContent = `Episodio ${index}`;

  let ep = episodios.find(ep => String(ep.number) === String(index))
    || await recuperarEpisodioFaltanteDesdeApi(index);
  if (!ep) {
    btnCap.textContent = "Episodio desconocido";
    controles.innerHTML = "<span class='span-carga'><h2>404</h2><br>No se encontró el episodio.</span>";
    return;
  }

  episodioActualIndex = index;
  history.replaceState({}, "", `ver.html?id=${animeId}&episode=${ep.number}&servers=${modoDoblado ? "dob" : "sub"}`);

  const cacheKey = `servers_${animeId}_${ep.number}`;
  const cached = serverCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    renderizarServidores(cached.data);
    ejecutarEnSegundoPlano(precargarSiguienteEpisodio(index), "No se pudo precargar el siguiente episodio");
    return;
  }

  const datosFirestore = await obtenerDatosAnimeParaServidores();
  const servidoresFirestore = obtenerServidoresValidosDeFirestore(datosFirestore, ep);
  ejecutarEnSegundoPlano(
    precargarSiguienteEpisodio(index, datosFirestore),
    "No se pudo precargar el siguiente episodio"
  );

  if (servidoresFirestore.length) {
    ep.servidores = guardarServidoresEnCache(ep, servidoresFirestore);
    renderizarServidores(ep.servidores);
  }

  try {
    const servidoresApi = await obtenerServidoresDesdeApi(ep);
    if (servidoresApi === null) {
      if (!servidoresFirestore.length) mostrarEstadoDeServidores("No se encontraron servidores.", true);
      return ep;
    }

    const servidoresCombinados = combinarServidores(servidoresFirestore, servidoresApi);
    if (servidoresCombinados.length > servidoresFirestore.length) {
      aplicarServidoresDeApi(ep, servidoresCombinados, servidoresFirestore.length > 0);
    } else if (!servidoresFirestore.length) {
      mostrarEstadoDeServidores("No se encontraron servidores.", true);
    }
  } catch (error) {
    if (!servidoresFirestore.length) mostrarEstadoDeServidores("Error al cargar servidores.", true);
  } finally {
    actualizarEstadoBotones();
  }

  return ep;
}

function renderizarServidores(todosLosServidores, opciones = {}) {
  const servidorAnterior = embeds[servidorActualIndex];
  const mantenerReproduccion = Boolean(opciones.mantenerReproduccion && reproduccionActualId);

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
        btn.textContent = modoDoblado ? "subtitulado" : "doblado";
        btn.classList.toggle("activo", modoDoblado);
      }
    }
  }

  // Vidrift no depende de los enlaces de este episodio, pero se agrega después
  // de comprobar el idioma alternativo para no impedir ese fallback.
  const vidriftServer = {
    name: "Vidrift",
    type: "player",
    url: "",
    vidrift: true
  };
  servidores = [vidriftServer, ...servidores];

  if (!servidores?.length) {
    videoContenedorGlobal.innerHTML = modoDoblado 
      ? "<p class='span-carga'>No hay servidores doblados disponibles para este episodio.</p>" 
      : "<p class='span-carga'>No hay servidores disponibles.</p>";
    document.getElementById("controles").innerHTML = "";
    return;
  }

  // Clonamos el array para no mutar los datos en caché
  embeds = [...servidores];

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
      a.rel = "noopener noreferrer";
      controles.appendChild(a);
      controles.classList.add("con-mediafire");
      return;
    }

    // 🔥 RESTO -> button normal
    const btn = document.createElement("button");
    btn.textContent = String(srv.name || '').split(" ")[0] || `${i + 1}`;
    btn.dataset.serverIndex = i;
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
      let indexInEmbeds = embeds.indexOf(firstPlayable || embeds[0]);

      if (mantenerReproduccion) {
        if (servidorAnterior?.vidrift) {
          indexInEmbeds = embeds.findIndex(servidor => servidor.vidrift);
        } else if (servidorAnterior?.url) {
          indexInEmbeds = embeds.findIndex(servidor => servidor.url === servidorAnterior.url);
        }
        if (indexInEmbeds < 0) indexInEmbeds = servidorActualIndex;
      }

      servidorActualIndex = indexInEmbeds;
      const buttonToSelect = buttons[indexInEmbeds] || buttons[0];

      if (mantenerReproduccion) {
        buttonToSelect?.classList.add("servidor-activo");
      } else {
        mostrarVideo(firstPlayable || embeds[0], buttonToSelect);
      }
    } else {
      videoContenedorGlobal.innerHTML = "No se encontraron botones de servidor.";
    }
  } else {
    videoContenedorGlobal.innerHTML = "No hay servidores disponibles para mostrar.";
  }
  actualizarEstadoBotonDoblado(todosLosServidores);
}

const controles = document.getElementById("controles");

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

function cacheTmdbEsValida() {
  return cacheTmdbVidrift?.animeId === animeId && Boolean(cacheTmdbVidrift?.tmdbId);
}

function guardarCacheTmdbVidrift(tmdbId, tmdbSeason) {
  cacheTmdbVidrift = {
    animeId,
    tmdbId,
    tmdbSeason: Number(tmdbSeason) > 0 ? Number(tmdbSeason) : detectarTemporadaDesdeAnimeId(animeId)
  };
}

function sembrarCacheTmdbDesdeDatos(datos) {
  firestoreTmdbConsultado = true;
  if (!datos?.tmdbId || cacheTmdbEsValida()) return;
  const temporadaDetectada = detectarTemporadaDesdeAnimeId(animeId);
  const temporadaGuardada = Number(datos.tmdbSeason);
  const temporada = temporadaGuardada > 0 && (temporadaDetectada === 1 || temporadaGuardada === temporadaDetectada)
    ? temporadaGuardada
    : temporadaDetectada;
  guardarCacheTmdbVidrift(datos.tmdbId, temporada);
}

function recordarDocumentoAnime(datos) {
  if (!datos) return;
  documentoAnimeCache = datos;
  sembrarCacheTmdbDesdeDatos(datos);
}

async function resolverDatosTmdbVidrift() {
  if (cacheTmdbEsValida()) return cacheTmdbVidrift;
  if (promesaTmdbVidrift) return promesaTmdbVidrift;

  promesaTmdbVidrift = (async () => {
    const animeDatosRef = doc(db, "datos-animes", animeId);

    if (!cacheTmdbEsValida() && !firestoreTmdbConsultado) {
      firestoreTmdbConsultado = true;
      let animeDatos = documentoAnimeCache;

      if (!animeDatos) {
        debugLog("Buscando ID de TMDB en Firestore.", animeId);
        const animeDatosSnap = await getDoc(animeDatosRef);

        if (animeDatosSnap.exists()) {
          animeDatos = animeDatosSnap.data();
          recordarDocumentoAnime(animeDatos);
        } else {
          debugLog("El documento no existe en Firestore.");
        }
      }

      if (animeDatos?.tmdbId) {
        debugLog("ID de TMDB encontrado en Firestore.", animeDatos.tmdbId);
        const tmdbSeason = await resolverTemporadaVidrift(animeDatos.tmdbId, animeDatos.tmdbSeason);
        if (!tmdbSeason) return null;
        guardarCacheTmdbVidrift(animeDatos.tmdbId, tmdbSeason);
        if (Number(animeDatos.tmdbSeason) !== tmdbSeason) {
          ejecutarEnSegundoPlano(
            setDoc(animeDatosRef, { tmdbSeason }, { merge: true }),
            "No se pudo actualizar la temporada TMDB en Firestore"
          );
        }
        debugLog("[Vidrift] ID recuperado de Firestore", {
          animeId,
          tmdbId: animeDatos.tmdbId,
          temporada: tmdbSeason,
          episodio: episodioActualIndex
        });
        return cacheTmdbVidrift;
      }
      if (animeDatos) {
        debugLog("El documento de Firestore no tiene tmdbId.");
      }
    } else if (cacheTmdbEsValida()) {
      return cacheTmdbVidrift;
    }

    debugLog("Buscando el anime en TMDB.", tituloAnime);
    const resultados = await buscarAnimeTMDBConRespaldo(tituloAnime);
    debugLog("Resultados obtenidos de TMDB.", resultados);
    debugLog("[Vidrift] Resultados de búsqueda TMDB", { animeId, resultados });

    if (!resultados?.length) {
      debugLog("No se encontraron resultados en TMDB.");
      return { error: "TMDB no encontró resultados para el anime" };
    }

    const seleccion = await seleccionarResultadoTMDBParaVidrift(resultados);
    if (!seleccion) {
      debugLog("[Vidrift] Ningún resultado de TMDB contiene la temporada solicitada.", {
        animeId,
        temporada: detectarTemporadaDesdeAnimeId(animeId)
      });
      return { error: "TMDB no devolvió una coincidencia con la temporada solicitada" };
    }

    const { tmdbId, tmdbSeason, resultado } = seleccion;
    debugLog("[Vidrift] Primer resultado seleccionado", {
      animeId,
      seleccionado: resultado,
      tmdbId,
      temporada: tmdbSeason
    });

    guardarCacheTmdbVidrift(tmdbId, tmdbSeason);
    ejecutarEnSegundoPlano(
      setDoc(animeDatosRef, { tmdbId, tmdbSeason }, { merge: true }),
      "No se pudo guardar la asociación TMDB en Firestore"
    );

    return cacheTmdbVidrift;
  })()
    .catch(error => {
      debugLog("No se pudo cargar Vidrift; se probará el siguiente servidor.", error);
      return { error: "Error al consultar Firestore o TMDB para Vidrift" };
    })
    .finally(() => {
      promesaTmdbVidrift = null;
    });

  return promesaTmdbVidrift;
}

// Con fs=parent el fullscreen vive en #video, que no se destruye al cambiar
// de reproductor: el navegador mantiene el estado y no hay nada que capturar
// ni restaurar entre capítulos.
function elementoEnPantallaCompleta() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function solicitarPantallaCompleta(elemento) {
  const metodo = elemento?.requestFullscreen || elemento?.webkitRequestFullscreen;
  if (!metodo) throw new Error("requestFullscreen no está disponible");
  return metodo.call(elemento);
}

function salirDePantallaCompleta() {
  if (document.exitFullscreen) return document.exitFullscreen();
  return document.webkitExitFullscreen?.();
}

function soportaPantallaCompletaContenedor() {
  const videoDiv = videoContenedorGlobal;
  return !!(videoDiv?.requestFullscreen || videoDiv?.webkitRequestFullscreen);
}

// Navegadores sin Fullscreen API en elementos (iPhone Safari) no pueden poner
// #video en fullscreen real: se simula con position:fixed vía la clase
// video-fs-simulado, que además quita bordes y márgenes.
let pantallaCompletaSimulada = false;

function aplicarPantallaCompletaSimulada() {
  pantallaCompletaSimulada = true;
  document.documentElement.classList.add("video-fs-simulado", "video-pantalla-completa");
}

function quitarPantallaCompletaSimulada() {
  pantallaCompletaSimulada = false;
  document.documentElement.classList.remove("video-fs-simulado");
  manejarCambioPantallaCompleta();
}

const manejarCambioPantallaCompleta = () => {
  const elemento = elementoEnPantallaCompleta();
  const videoDiv = videoContenedorGlobal;
  // Marca <html> mientras #video (o su contenido) ocupa la pantalla para que
  // el CSS quite el gutter del scrollbar y el borde del reproductor.
  const enPantallaVideo = pantallaCompletaSimulada || (!!elemento && videoDiv && (elemento === videoDiv || videoDiv.contains(elemento)));
  document.documentElement.classList.toggle("video-pantalla-completa", enPantallaVideo);
  enviarEstadoFullscreenVidrift();
};

["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]
  .forEach(evento => document.addEventListener(evento, manejarCambioPantallaCompleta));

// Con fs=parent Vidrift delega el fullscreen a la página: el objetivo es
// #video, que no se destruye al cambiar de episodio, así el salto automático
// de capítulo conserva la pantalla completa sin necesitar un nuevo gesto.
function enviarEstadoFullscreenVidrift() {
  if (!ventanaVidriftActiva) return;
  const videoDiv = videoContenedorGlobal;
  const elemento = elementoEnPantallaCompleta();
  const on = pantallaCompletaSimulada || (!!elemento && videoDiv.contains(elemento));
  ventanaVidriftActiva.postMessage(
    { type: "vidrift:fullscreen-state", on },
    ORIGEN_VIDRIFT
  );
}

async function manejarFullscreenVidrift(solicitar) {
  const videoDiv = videoContenedorGlobal;
  if (solicitar) {
    if (elementoEnPantallaCompleta() || pantallaCompletaSimulada) return;
    if (soportaPantallaCompletaContenedor()) {
      try {
        await solicitarPantallaCompleta(videoDiv);
        enviarEstadoFullscreenVidrift();
        return;
      } catch (error) {
        debugLog("[Vidrift] requestFullscreen rechazado", error?.message || error);
      }
    }
    // Sin Fullscreen API en elementos (iPhone) o si el navegador la rechaza:
    // fullscreen simulado con CSS fijo sobre #video.
    aplicarPantallaCompletaSimulada();
    enviarEstadoFullscreenVidrift();
    return;
  }
  if (pantallaCompletaSimulada) {
    quitarPantallaCompletaSimulada();
    enviarEstadoFullscreenVidrift();
    return;
  }
  const elemento = elementoEnPantallaCompleta();
  if (elemento && videoDiv.contains(elemento)) {
    try {
      await salirDePantallaCompleta();
    } catch {
      // El usuario ya pudo haber salido con Esc; no hay nada que hacer.
    }
  }
  enviarEstadoFullscreenVidrift();
}

function esFuenteVideoDirecta(url) {
  return /\.(?:mp4|m3u8)(?:\?|$)/i.test(url);
}

function crearVideoDirecto(url, reproduccionId) {
  const video = document.createElement("video");
  video.src = url;
  video.controls = true;
  video.autoplay = true;
  video.width = "100%";
  video.height = "100%";
  video.style.maxHeight = "80vh";
  video.onerror = () => {
    if (reproduccionId === reproduccionActualId) {
      intentarSiguienteServidor(reproduccionId, "El archivo de vídeo no se pudo reproducir");
    }
  };

  return video;
}

function crearIframeServidor(url, reproduccionId) {
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.width = "100%";
  iframe.height = "100%";
  iframe.style.border = "none";
  iframe.allowFullscreen = true;
  iframe.scrolling = "no";
  if (bloquearAnuncios) iframe.sandbox = "allow-scripts allow-same-origin allow-forms";

  iframe.onerror = () => {
    if (reproduccionId === reproduccionActualId) {
      intentarSiguienteServidor(reproduccionId, "El iframe del servidor produjo un error");
    }
  };
  iframe.onload = () => {
    if (reproduccionId === reproduccionActualId) {
      cancelarFallbackDeCarga();
    }
  };
  programarFallbackDeCarga(reproduccionId, 10000, "El servidor externo tardó demasiado en cargar");
  return iframe;
}

function cargarIframeServidor(url, videoDiv, reproduccionId) {
  const iframe = crearIframeServidor(url, reproduccionId);
  const insertar = () => {
    if (reproduccionId === reproduccionActualId) videoDiv.appendChild(iframe);
  };
  const fileId = url.match(/mega\.nz\/embed\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!fileId) return insertar();

  esEnlaceValidoMega(fileId)
    .then(valido => valido ? insertar() : intentarSiguienteServidor(reproduccionId, "El enlace de Mega no está disponible"))
    .catch(insertar);
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

  const videoDiv = videoContenedorGlobal;
  videoDiv.innerHTML = "";

  cancelarFallbackDeCarga();

  // Caso especial para Vidrift
  if (esVidrift) {
    videoDiv.innerHTML = "<p class='span-carga'>Cargando servidor Vidrift...</p>";
    // Firestore o TMDB también pueden quedar esperando: no bloquees los demás
    // servidores si el ID no llega en un tiempo razonable.
    programarFallbackDeCarga(reproduccionId, 12000, "Tiempo de espera al obtener el ID de Vidrift");

    // Obtener brandColor dinámico desde la variable CSS --btn
    const computedStyle = getComputedStyle(document.body);
    const btnColor = computedStyle.getPropertyValue('--btn').trim();
    // Convertir el color hexadecimal a formato sin # para Vidrift
    const brandColor = btnColor.startsWith('#') ? btnColor.slice(1) : btnColor || "7c5cff";

    // Función para cargar el iframe con el ID de TMDB
    const cargarIframeConTMDB = (tmdbId, tmdbSeason) => {
      if (reproduccionId !== reproduccionActualId) return;
      cancelarFallbackDeCarga();
      debugLog("Cargando Vidrift con el ID de TMDB.", tmdbId);

      // Construir URL con todos los parámetros de branding
      // Formato Vidrift: /tv/{tmdbId}/{temporada}/{episodio}.
      const baseUrl = `https://embed.vidrift.net/embed/tv/${tmdbId}/${tmdbSeason}/${episodioActualIndex}`;
      debugLog("[Vidrift] Embed preparado", {
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
        font: "Bebas Neue",
        // hide: "episodes",
        // URLSearchParams codifica los espacios; no pasar el valor ya codificado.
        autoskip: modoMaratonActivo ? "1" : "0",
        autonext: modoMaratonActivo ? "1" : "0"
      });
      // Con fs=parent el botón de fullscreen del player avisa por
      // postMessage y la página pone en fullscreen #video, que sobrevive
      // al reemplazo del iframe: el salto automático de capítulo no sale
      // de pantalla completa (requestFullscreen sin gesto sería rechazado).
      // fs=parent se envía siempre: donde hay Fullscreen API el fullscreen es
      // real sobre #video; en iPhone el padre lo simula con CSS fijo.
      params.set("fs", "parent");
      const vidriftUrl = `${baseUrl}?${params.toString()}`;
      debugLog("URL de Vidrift generada.", vidriftUrl);

      const iframe = document.createElement("iframe");
      iframe.src = vidriftUrl;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.frameBorder = "0";
      iframe.allowFullscreen = true;
      iframe.allow = "autoplay; fullscreen";
      iframe.style.border = "0";

      // Los subtítulos españoles se buscan siempre. El audio solo se cambia
      // cuando existe una pista española: si no existe, se conserva el audio
      // del servidor y jamás se activa un fallback por esa razón.
      const preferirAudioEspanol = preferenciaDoblado;
      const preferirSubtitulosEspanol = true;
      debugLog("[Vidrift] Preferencia de idioma aplicada", {
        preferencia: preferenciaDoblado ? "doblado" : "subtitulado",
        modoServidoresActual: modoDoblado ? "doblado" : "subtitulado",
        subtitulosEspanol: preferirSubtitulosEspanol
      });
      let audioComprobado = !preferirAudioEspanol;
      let subtitulosComprobados = !preferirSubtitulosEspanol;
      let estadoVidriftActual = null;
      let subtituloEspanolPendiente = null;
      let intentosSubtituloEspanol = 0;
      let timeoutSubtituloEspanol = null;
      let intervaloEstadoVidrift = null;
      let recibirEstadoVidrift;
      let intentosInfoSiguiente = 0;

      const enviarInformacionSiguienteAVidrift = () => {
        const siguiente = episodios.find(({ number }) => Number(number) > episodioActualIndex);

        // La lista de capítulos y el iframe se cargan en paralelo. Esperar un
        // instante evita ocultar el botón "Siguiente episodio" por error.
        if (!siguiente && episodios.length === 0 && intentosInfoSiguiente++ < 8) {
          setTimeout(enviarInformacionSiguienteAVidrift, 500);
          return;
        }

        const next = siguiente
          ? { season: tmdbSeason, episode: Number(siguiente.number) }
          : null;
        iframe.contentWindow?.postMessage(
          { type: "vidrift:nextup-info", next },
          ORIGEN_VIDRIFT
        );
        debugLog("[Vidrift] Información de siguiente capítulo enviada.", {
          siguiente: next,
          modoMaratonActivo
        });
      };

      const limpiarListenerVidrift = () => {
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
        debugLog("[Vidrift] Solicitando subtítulo en español", {
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
            debugLog("[Vidrift] Vidrift no aplicó el subtítulo en español; se conserva el servidor actual.", {
              servidor: estadoVidriftActual?.server,
              subtitulo: subtitulo.value
            });
            subtituloEspanolPendiente = null;
          }
        }, 1200);
      };

      recibirEstadoVidrift = (event) => {
        if (
          event.origin !== "https://embed.vidrift.net" ||
          event.source !== iframe.contentWindow
        ) return;

        if (event.data?.type === "vidrift:command-error" && event.data.field === "subtitle") {
          debugLog("[Vidrift] Vidrift rechazó el subtítulo en español; se conserva el servidor actual.", event.data);
          subtituloEspanolPendiente = null;
          clearTimeout(timeoutSubtituloEspanol);
          return;
        }
        if (event.data?.type !== "vidrift:state") return;

        estadoVidriftActual = event.data;

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
        debugLog("[Vidrift] Estado de pistas recibido", {
          servidor: event.data.server,
          subtituloActivo: event.data.subtitle,
          subtitulos: event.data.subtitles?.map(({ value, label }) => ({ value, label }))
        });
        if (preferirSubtitulosEspanol) {
          debugLog("[Vidrift] Pista española detectada", {
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
          if (event.data.subtitle === subtituloEspanol.value) {
            subtituloEspanolPendiente = null;
            clearTimeout(timeoutSubtituloEspanol);
            subtitulosComprobados = true;
            debugLog("[Vidrift] Subtítulo en español confirmado", {
              servidor: event.data.server,
              subtitulo: subtituloEspanol.label || subtituloEspanol.value
            });
          } else if (subtituloEspanolPendiente !== subtituloEspanol.value) {
            intentosSubtituloEspanol = 0;
            seleccionarSubtituloEspanol(subtituloEspanol);
          }
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
      programarFallbackDeCarga(reproduccionId, 12000, "Vidrift tardó demasiado en cargar");
      iframe.addEventListener("load", () => {
        if (reproduccionId !== reproduccionActualId) return;
        cancelarFallbackDeCarga();
        enviarEstadoFullscreenVidrift();
        solicitarEstadoVidrift();
        enviarInformacionSiguienteAVidrift();
        // Algunos proveedores terminan de exponer las pistas unos segundos
        // después de cargar o de cambiar de servidor interno.
        intervaloEstadoVidrift = setInterval(solicitarEstadoVidrift, 1500);
      });

      if (reproduccionId !== reproduccionActualId) return;
      videoDiv.innerHTML = "";
      videoDiv.appendChild(iframe);
      ventanaVidriftActiva = iframe.contentWindow;
    };

    const asociacion = await resolverDatosTmdbVidrift();
    if (reproduccionId !== reproduccionActualId) return;

    if (!asociacion?.tmdbId) {
      const motivo = asociacion?.error
        || (asociacion === null ? "La temporada guardada no existe en TMDB" : "Error al consultar Firestore o TMDB para Vidrift");
      intentarSiguienteServidor(reproduccionId, motivo);
      return;
    }

    cargarIframeConTMDB(asociacion.tmdbId, asociacion.tmdbSeason);
    return;
  }

  if (esFuenteVideoDirecta(url)) {
    videoDiv.appendChild(crearVideoDirecto(url, reproduccionId));
    return;
  }

  cargarIframeServidor(url, videoDiv, reproduccionId);
}

function intentarSiguienteServidor(reproduccionId = reproduccionActualId, motivo = "El servidor actual falló o no respondió") {
  if (reproduccionId !== reproduccionActualId) return;

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
    mostrarEstadoDeServidores("No hay más servidores disponibles para este episodio.");
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
    desde: embeds[servidorActualIndex]?.name || "desconocido",
    hacia: siguienteServidor.name || `Servidor ${siguienteIndice + 1}`,
    motivo
  });

  const pill = document.createElement("div");
  pill.className = "pildora pildora-default";
  // El motivo también se muestra en pantalla: Live Server y algunos iframes
  // pueden limpiar la consola mientras se reemplaza el reproductor.
  pill.textContent = `Servidor no disponible: ${motivo}. Cambiando a ${siguienteServidor.name || `Servidor ${siguienteIndice + 1}`}.`;
  pill.title = motivo;
  document.body.appendChild(pill);
  // setTimeout en vez de animationend: con .animaciones-off animationend nunca
  // se dispara y la píldora quedaría fija en pantalla.
  setTimeout(() => pill.remove(), 3000);

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

async function irAlSiguienteCapitulo() {
  const ultimoEpisodio = episodios[episodios.length - 1];
  if (ultimoEpisodio && episodioActualIndex < ultimoEpisodio.number) {
    await marcarCapituloActualComoVisto();
    await cargarVideoDesdeEpisodio(episodioActualIndex + 1);
    refrescarUIEstadoCapitulo();
    sincronizarUINavegacion();
    return true;
  }
  return false;
}

// Configurar navegación de botones
btnSiguiente.addEventListener("click", async (e) => {
  e.preventDefault();
  await irAlSiguienteCapitulo();
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
    sincronizarUINavegacion();
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

const ORIGEN_VIDRIFT = "https://embed.vidrift.net";

// Listener para detectar cambios de episodio en el iframe de Vidrift
window.addEventListener('message', async (event) => {
  // Verificar que el mensaje viene de Vidrift
  if (event.origin !== 'https://embed.vidrift.net' && event.origin !== 'https://vidrift.net') {
    return;
  }

  // Solo responder al iframe actualmente visible. Evita que un iframe que
  // acaba de reemplazarse altere la URL o el progreso.
  if (event.source !== ventanaVidriftActiva) return;

  // Con fs=parent el botón de fullscreen del player llega como mensaje.
  // Debe responderse dentro del handler para que el clic del usuario dentro
  // del iframe siga contando como gesto de requestFullscreen.
  if (event.data?.type === "vidrift:fullscreen") {
    manejarFullscreenVidrift(event.data.on === true);
    return;
  }

  // Vidrift emite este evento al comenzar créditos o el ending. En modo
  // maratón saltamos de inmediato, sin esperar los cinco segundos de la
  // tarjeta "Siguiente episodio".
  if (event.data?.type === "vidrift:nextup" && modoMaratonActivo) {
    if (saltoOutroVidriftEnCurso) return;
    saltoOutroVidriftEnCurso = true;
    try {
      const avanzo = await irAlSiguienteCapitulo();
      debugLog("[Vidrift] Outro omitido por modo maratón.", { avanzo });
    } finally {
      saltoOutroVidriftEnCurso = false;
    }
    return;
  }

  // Algunos embeds piden al padre continuar con el siguiente capítulo en
  // vez de navegar internamente. Usamos el mismo flujo que el botón externo
  // para guardar el visto, mantener la URL y crear el nuevo iframe.
  if (event.data?.type === "vidrift:nextup-play") {
    const avanzo = await irAlSiguienteCapitulo();
    debugLog("[Vidrift] Solicitud de siguiente capítulo atendida.", { avanzo });
    return;
  }

  // Un capítulo marcado como no emitido no podrá reproducirse en Vidrift.
  if (event.data?.type === "vidrift:unreleased") {
    console.warn("[Vidrift] El capítulo aún no está emitido; se probará el siguiente servidor.", {
      animeId,
      episodio: episodioActualIndex
    });
    intentarSiguienteServidor(reproduccionActualId, "Vidrift indicó que el capítulo no está emitido");
    return;
  }

  // "vidrift:episode" es el evento oficial. Se conserva episodeChange por
  // compatibilidad con embeds anteriores.
  const esCambioDeEpisodio = ["vidrift:episode", "episodeChange"].includes(event.data?.type);
  const nuevoEpisodio = esCambioDeEpisodio ? event.data.episode : null;

  const numeroEpisodio = Number(nuevoEpisodio);
  if (
    Number.isInteger(numeroEpisodio) &&
    numeroEpisodio > 0 &&
    numeroEpisodio !== episodioActualIndex &&
    !cambioEpisodioVidriftEnCurso
  ) {
    cambioEpisodioVidriftEnCurso = true;
    debugLog("[Vidrift] Cambio interno de capítulo detectado.", numeroEpisodio);

    try {
      // Se hace antes de actualizar el índice, igual que al usar el botón
      // externo de capítulo siguiente.
      await marcarCapituloActualComoVisto();

      // Actualizar el episodio actual
      episodioActualIndex = numeroEpisodio;

      // Actualizar URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.set("episode", numeroEpisodio);
      newUrl.searchParams.set("servers", modoDoblado ? "dob" : "sub");
      window.history.pushState({}, "", newUrl);

      sincronizarUINavegacion();

      // Refrescar estado de visto.
      await refrescarUIEstadoCapitulo();
    } finally {
      cambioEpisodioVidriftEnCurso = false;
    }
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

  // setTimeout en vez de animationend: con .animaciones-off animationend nunca
  // se dispara y la píldora quedaría fija en pantalla.
  setTimeout(() => pill.remove(), 3000);
}

// Swipe para descartar la píldora: vertical u horizontal según el eje dominante.
// Se desactiva la animación CSS (animation pisa los estilos inline) y se
// transiciona manualmente; funciona igual con .animaciones-off.
// Solo cuenta el gesto si empieza sobre la píldora, y .pildora usa
// touch-action: none para que el navegador no lo cancele como scroll (pointercancel).
let pillSwipeStart = null;
document.addEventListener("pointerdown", (e) => {
  pillSwipeStart = e.target.closest?.(".pildora")
    ? { x: e.clientX, y: e.clientY }
    : null;
});
document.addEventListener("pointerup", (e) => {
  if (!pillSwipeStart) return;
  const dx = e.clientX - pillSwipeStart.x;
  const dy = e.clientY - pillSwipeStart.y;
  pillSwipeStart = null;
  const pill = document.querySelector(".pildora");
  if (!pill) return;
  const vertical = Math.abs(dy) > Math.abs(dx);
  const dist = vertical ? dy : dx;
  if (Math.abs(dist) < 60) return;
  pill.style.animation = "none";
  void pill.offsetHeight;
  pill.style.transition = "transform .35s ease-in, opacity .35s ease-in, filter .35s ease-in";
  pill.style.opacity = "0";
  pill.style.filter = "blur(8px)";
  pill.style.transform = vertical
    ? `translateX(-50%) translateY(${dist > 0 ? "140px" : "-140px"})`
    : `translateX(-50%) translateX(${dist > 0 ? "140px" : "-140px"})`;
  setTimeout(() => pill.remove(), 400);
});
document.addEventListener("pointercancel", () => { pillSwipeStart = null; });


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