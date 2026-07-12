import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";
import { observerAnimeCards, aplicarViewTransition } from "./utils.js";
import { IA_SECTION_HTML, attachIaGridWheelScroll, loadIaRecommendationsIntoGrid } from "./ai-recommendations.js";

// Inicializar Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let id = new URLSearchParams(location.search).get("id");

document.title = "AniZen - " + id;

const userID = localStorage.getItem("userID");

const getCacheKey = id => `anime_${id}`;

const cargarDatosDesdeCache = id => {
  try {
    const data = localStorage.getItem(getCacheKey(id));
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const actualizarCache = (id, anime) => {
  const existingData = localStorage.getItem(getCacheKey(id));
  const existingAnime = existingData ? JSON.parse(existingData) : null;
  
  const fechaActualizacion = existingAnime?._cachedAt || Date.now();
  const toCache = { ...anime, _cachedAt: fechaActualizacion };
  localStorage.setItem(getCacheKey(id), JSON.stringify(toCache));
  
  const animes = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('anime_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data._cachedAt) {
          animes.push({ id: key, fecha: data._cachedAt });
        }
      } catch (e) {
        console.error(`Error al procesar anime ${key}:`, e);
        localStorage.removeItem(key);
      }
    }
  }

  if (animes.length > 20) {
    try {
      const animesOrdenados = animes.sort((a, b) => b.fecha - a.fecha);
      const animesAEliminar = animesOrdenados.slice(20);
      
      animesAEliminar.forEach(anime => {
        localStorage.removeItem(anime.id);
      });
    } catch (e) {
      console.error('Error al eliminar animes viejos:', e);
    }
  }
};

// DOM references
const tituloEl = document.getElementById("titulo");
const statusEl = document.getElementById("status");
const portadaEl = document.getElementById("portada");
const descripcionEl = document.getElementById("descripcion");
const generoContainer = document.querySelector(".genero");
const capContenedor = document.getElementById("capitulos");
const filtroCapitulo = document.getElementById("filtro-capitulo");
const ratingEl = document.getElementById("rating");
const initLoadingCap = document.getElementById("init-loading-cap");

function quitarTildesYEspacios(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ /g, '-')
    .toLowerCase();
}

const renderGeneros = (container, generos) => {
  container.innerHTML = '';
  if (generos && generos.length) {
    generos.slice(0, 5).forEach(g => {
      const a = document.createElement('a');
      a.textContent = g;
      a.className = 'genre-link';
      const generoUrl = g.toLowerCase() === 'aventuras' ? 'aventura' : g;
      a.href = `index.html?DirectorioJK&genero=${quitarTildesYEspacios(generoUrl)}`;


      container.appendChild(a);
    });
  } else {
    container.textContent = 'Géneros no disponibles.';
  }
};

// Renderizar relacionados
let isRendering = false;
let capituloToggleInProgress = false;
let estadoToggleInProgress = false;

async function renderRelacionados(anime) {
  const relacionadosContainer = document.getElementById('animes-relacionados');
  const relacionadosSection = document.getElementById('relacionados');
  const initLoading = document.getElementById('init-loading-relacionados');
  
  // Validaciones iniciales
  if (!relacionadosContainer || !anime?.relacionados?.length) {
    if (relacionadosSection) relacionadosSection.style.display = 'none';
    return;
  }

  // Prevenir múltiples renderizados simultáneos
  if (isRendering) return;
  isRendering = true;

  // Mostrar sección y loading
  if (relacionadosSection) relacionadosSection.style.display = 'flex';
  if (initLoading) initLoading.style.display = 'block';
  relacionadosContainer.innerHTML = '';

  try {
    // Crear un Set para evitar duplicados
    const titulosUnicos = new Set();
    const relacionesUnicas = anime.relacionados.filter(rel => {
      const esUnico = !titulosUnicos.has(rel.title);
      if (esUnico) titulosUnicos.add(rel.title);
      return esUnico;
    });
    // Hacer todas las peticiones en paralelo
    const resultados = await Promise.allSettled(
      relacionesUnicas.map(relacionado =>
        fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(relacionado.title)}`)
          .then(res => {
            console.log('fetch relacionado:', res);
            return res.ok ? res.json() : Promise.reject(`HTTP Error: ${res.status}`);
          })
          .then(data => ({
            data: data[0],
            relation: relacionado.relation
          }))
      )
    );

    // Crear fragmento para mejor rendimiento
    const fragment = document.createDocumentFragment();
    const idsAgregados = new Set();

    resultados.forEach(({ status, value }, index) => {
      if (status === 'fulfilled' && value?.data && !idsAgregados.has(value.data.id)) {
        idsAgregados.add(value.data.id);
        const card = crearAnimeCard(value.data);
        const relationSpan = document.createElement('span');
        relationSpan.className = 'relation-tag';
        relationSpan.textContent = value.relation;
        card.appendChild(relationSpan);
        if (card) {
        fragment.appendChild(card);
        }
      }
    });
    
    if (fragment.children.length > 0) {
    relacionadosContainer.appendChild(fragment);
    observerAnimeCards();
    }
    else {
      if (relacionadosSection) relacionadosSection.style.display = 'none';
    }
  } catch (error) {
    
    if (relacionadosSection) relacionadosSection.style.display = 'none';
    console.error('Error al cargar animes relacionados:', error);
  } finally {
    if (initLoading) initLoading.style.display = 'none';
    isRendering = false;
  }
}

function crearAnimeCard(anime) {
  const coverImage = anime.cover || anime.image || 'img/loading.png';
  let animeId = anime.id;
  if (!animeId && anime.url) {
    const urlParts = anime.url.replace(/\/$/, '').split('/');
    animeId = urlParts[urlParts.length - 1];
  }
  if (!animeId) {
    animeId = anime.title?.toLowerCase().replace(/\s+/g, '-');
  }
  const div = document.createElement('div');
  let ratingHtml = '';
  if (anime.rating) {
    ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
  }
  div.className = 'anime-card';
  div.style.setProperty('--cover', `url(${coverImage})`);
  div.innerHTML = `
  <a href="anime.html?id=${animeId}" id="anime-${animeId}">
  <div class="container-img">
    <img src="${coverImage}" class="cover" alt="${anime.title || anime.name}">
    <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
    ${ratingHtml}
    <span class="estado">${anime.type || ''}</span>
  </div>
  <strong>${anime.title || anime.name}</strong>
</a>`;
  div.addEventListener('click', () => {
    aplicarViewTransition(anime.id, ratingHtml);
  });
  return div;
}

const BANNER_PESO_MIN_BYTES = 7 * 1024;
const BANNER_PESO_PROXIES = [
  'https://animeflvlite.netlify.app/.netlify/functions/banner-peso',
  // Puedes agregar tu localhost aquí
];

async function obtenerPesoBanner(url) {
  if (!url) return null;
  const q = `?url=${encodeURIComponent(url)}`;

  for (const base of BANNER_PESO_PROXIES) {
    try {
      const res = await fetch(`${base}${q}`);
      if (!res.ok) continue;
      const { bytes } = await res.json();
      if (typeof bytes === 'number' && bytes > 0) return bytes;
    } catch {
      /* Pasa al siguiente proxy si este falla */
    }
  }
  return null;
}

function verificarCargaImagen(url) {
  return new Promise(resolve => {
    const img = new Image();
    
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);

    img.src = url;
  });
}

async function esBannerValido(url) {
  const [peso, cargaOk] = await Promise.all([
    obtenerPesoBanner(url),
    verificarCargaImagen(url)
  ]);

  if (!peso || peso < BANNER_PESO_MIN_BYTES) return false;
  
  if (!cargaOk) return false;

  return true;
}

async function aplicarFondoAnime(anime) {
  const portada = anime.portada || anime.cover;
  const banner = anime.banner;
  document.body.style.backgroundImage = `url(${banner})`;
  if (!banner) {
    document.body.style.backgroundImage = portada ? `url(${portada})` : '';
    return;
  }

  const bannerValido = await esBannerValido(banner);

  if (bannerValido) {
    document.body.style.backgroundImage = `url(${banner})`;
  } else {
    document.body.style.backgroundImage = portada ? `url(${portada})` : '';
  }
}
const renderAnime = anime => {
  anime.estado === "En emision"
  ? (statusEl.innerHTML = `<img src="../icons/circle-solid-blue.svg">${anime.estado}`, statusEl.classList.add("en-emision"))
  : (statusEl.innerHTML = `<img src="../icons/circle-solid.svg">${anime.estado}`, statusEl.classList.remove("en-emision"));


  tituloEl.textContent = anime.titulo;
  document.getElementById("portadacarga").classList.add("cargado");
  portadaEl.src = anime.portada;
  aplicarFondoAnime(anime);
  descripcionEl.textContent = anime.descripcion;
  renderGeneros(generoContainer, anime.generos);
  if (anime.rating === null) {
    ratingEl.style.display = 'none';
  } else {
    ratingEl.textContent = anime.rating + "/5";
  }
  if (anime.estado === "Por estrenar") {
    statusEl.innerHTML = `<img src="../icons/circle-solid-yellow.svg">${anime.estado}`;
    statusEl.classList.add("estrenando");
    document.getElementsByClassName("anime-container3")[0].innerHTML = "<span id='anime-proximo-estrenar'>Próximamente en estreno. Los capítulos aún no están disponibles.</span>";
    return;
  } else {
    statusEl.classList.remove("estrenando");
  }
  crearBotonesEpisodios(anime);
  renderRelacionados(anime);
};

const getAnchoColumna = () => {
  const li = capContenedor.querySelector('li');
  if (!li) return 0;
  const anchoLi = li.getBoundingClientRect().width;
  const gap = 16;
  return anchoLi + gap;
};

const debounce = (fn, delay = 200) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const createEpisodeButton = (ep, vistos = []) => {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  const visto = vistos.includes(ep.number.toString());
  btn.className = `episode-btn ${visto ? 'ep-visto' : 'ep-no-visto'}`;
  btn.textContent = `Episodio ${
  ep.number !== undefined && ep.number !== null ? 
  ep.number : 
  (ep.title || 'desconocido')
}`;

  const icon = document.createElement('img');
  icon.className = 'icon-eye';
  icon.src = visto ? '/icons/eye-solid.svg' : '/icons/eye-slash-solid.svg';
  icon.alt = 'visto';

  btn.appendChild(icon);
  li.appendChild(btn);

  btn.addEventListener('click', async () => {
    if (btn.classList.contains("ep-no-visto")) {
      await manejarEstadoEpisodio(btn, icon, ep);
    }
    window.location.href = `ver.html?id=${id}&url=${ep.number}`;
  });

  icon.addEventListener('click', e => {
    e.stopPropagation();
    manejarEstadoEpisodio(btn, icon, ep);
  });

  return li;
};

function mostrarOverlayCapitulosCompletados() {
  // Evita duplicados
  if (capContenedor.querySelector(".caps-completados-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "caps-completados-overlay";
  overlay.innerHTML = `
    <div class="caps-completados-card">
      <div class="caps-completados-icono">🏆</div>
      <h3>¡Felicidades!</h3>
      <p>Has visto todos los episodios disponibles.</p>
    </div>
  `;

  capContenedor.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("show"));

  setTimeout(() => {
    overlay.classList.remove("show");
    overlay.addEventListener("transitionend", () => overlay.remove(), {
      once: true,
    });
  }, 3000);
}

async function crearBotonesEpisodios(anime) {
    capContenedor.innerHTML = '';
    const episodios = Array.isArray(anime.episodios) ? anime.episodios : [];
    
    // 1. Obtenemos los vistos originales
    let vistosOriginales = await obtenerCapitulosVistos(id) || [];
    
    // 2. Creamos un Set con los números de episodios que SÍ existen para validación rápida
    const numerosValidos = new Set(episodios.map(ep => ep.number));
    
    // 3. Filtramos: solo dejamos los que existen en el Set
    const vistos = vistosOriginales.filter(num => numerosValidos.has(num));

    // 4. (Opcional pero recomendado) Si hubo cambios, actualiza en Firebase
    if (vistos.length !== vistosOriginales.length) {
        console.log("Se detectaron episodios antiguos o inválidos, limpiando...");
        // Reemplaza 'actualizarCapitulosVistos' por el nombre real de tu función de guardado
        await actualizarCapitulosVistos(id, vistos); 
    }

    const fragment = document.createDocumentFragment();
    episodios.forEach(ep => fragment.appendChild(createEpisodeButton(ep, vistos)));
    capContenedor.appendChild(fragment);

    if (initLoadingCap) initLoadingCap.style.display = 'none';
    if (episodios.length > 0) {
        actualizarProgresoCapitulos(episodios.length, vistos);
    }

    capContenedor.classList.add("cargado");
    capContenedor.style.setProperty("--caps", episodios.length);

const hacerScroll = () => {
    const primerNoVisto = capContenedor.querySelector(".episode-btn.ep-no-visto");

    // 🔴 si no hay ninguno, salimos SIEMPRE
    if (!primerNoVisto) {
        if (episodios.length > 1) {
            mostrarOverlayCapitulosCompletados();
        }
        return;
    }

    const target = primerNoVisto.closest("li");
    if (!target) return;

    capContenedor.scrollTo({
        left: target.offsetLeft
    });
};
    capContenedor.addEventListener(
        "transitionend",
        function handler(e) {
            if (e.propertyName !== "height") return;
            capContenedor.removeEventListener("transitionend", handler);
            requestAnimationFrame(hacerScroll);
        },
        { once: true }
    );
}
async function actualizarCapitulosVistos(animeId, episodiosLimpios) {
  try {
    const user = localStorage.getItem("userID");
    if (!user) {
      console.warn("No hay usuario autenticado.");
      return;
    }

    const ref = doc(db, 'usuarios', user, 'caps-vistos', animeId);
    
    // Usamos updateDoc para actualizar solo el array de episodiosVistos
    // manteniendo intactos el 'titulo' y 'fechaAgregado' que ya existen.
    await updateDoc(ref, {
      episodiosVistos: episodiosLimpios
    });
    
    console.log("Base de datos limpia: episodios inválidos eliminados con éxito.");
  } catch (error) {
    console.error("Error al limpiar los capítulos en Firestore:", error);
  }
}
capContenedor.addEventListener('wheel', e => {
  e.preventDefault();

  const ancho = getAnchoColumna();
  if (!ancho) return;

  const dir = e.deltaY > 0 ? 1 : -1;
  const curr = capContenedor.scrollLeft;

  const col = Math.round(curr / ancho);
  const target = (col + dir) * ancho;

  const maxScroll = capContenedor.scrollWidth - capContenedor.clientWidth;

  capContenedor.scrollTo({
    left: Math.max(0, Math.min(target, maxScroll)),
    behavior: 'smooth'
  });

}, { passive: false });

let scrollTimeout;
capContenedor.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const ancho = getAnchoColumna();
    if (!ancho) return;
    const col = Math.round(capContenedor.scrollLeft / ancho);
    capContenedor.scrollTo({ left: col * ancho, behavior: 'smooth' });
  }, 100);
});

filtroCapitulo.addEventListener('input', debounce(() => {
  const filtro = filtroCapitulo.value.toLowerCase();
  const botones = capContenedor.querySelectorAll('.episode-btn');
  const idx = Array.from(botones).findIndex(btn => btn.textContent.toLowerCase().includes(filtro));
  if (idx >= 0) botones[idx].parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));

async function manejarEstadoEpisodio(btn, icon, ep) {
  const user = localStorage.getItem("userID");
  if (!user) {
    return;
  }
  if (capituloToggleInProgress) {
    console.warn('manejarEstadoEpisodio: Operación en progreso, ignorando clic.');
    return;
  }

  const nuevo = !btn.classList.contains('ep-visto');
  
  try {
    const titulo = tituloEl.textContent;
    await toggleCapituloVisto(id, titulo, ep.number, nuevo);
    // Actualizar UI después de confirmar con Firebase
    btn.classList.toggle('ep-visto', nuevo);
    btn.classList.toggle('ep-no-visto', !nuevo);
    icon.src = nuevo ? '/icons/eye-solid.svg' : '/icons/eye-slash-solid.svg';
  } catch (e) {
    console.error('Error al cambiar estado del episodio:', e);
    // Revertir UI en caso de error
    await refrescarEstadoEpisodio(btn, icon, ep);
  }
}

async function toggleCapituloVisto(animeId, titulo, episodio, esVisto) {
  if (capituloToggleInProgress) {
    console.warn('toggleCapituloVisto: Operación en progreso, ignorando.');
    return;
  }

  capituloToggleInProgress = true;

  try {
    const user = localStorage.getItem("userID");
    if (!user) {
      console.warn('toggleCapituloVisto: No hay usuario autenticado.');
      return;
    }

    const ref = doc(db, 'usuarios', user, 'caps-vistos', animeId);
    const { episodiosVistos = [] } = (await getDoc(ref)).data() || {};

    const nuevosEpisodios = new Set(episodiosVistos.filter(ep => ep && ep !== "undefined"));
    if (esVisto) {
      nuevosEpisodios.add(episodio.toString());
    } else {
      nuevosEpisodios.delete(episodio.toString());
    }

    await setDoc(ref, {
      titulo,
      fechaAgregado: serverTimestamp(),
      episodiosVistos: [...nuevosEpisodios]
    });

    actualizarProgresoCapitulos(document.querySelectorAll('.episode-btn').length, [...nuevosEpisodios]);
    const total = document.querySelectorAll(".episode-btn").length;

    if (esVisto && nuevosEpisodios.size === total && total > 0) {
        mostrarOverlayCapitulosCompletados();
    }
    mostrarPildora("capvisto", esVisto, null, episodio);
  } catch (error) {
    console.error("Error al guardar estado del capítulo en Firestore:", error);
    throw error;
  } finally {
    capituloToggleInProgress = false;
  }
} 


async function refrescarEstadoEpisodio(btn, icon, ep) {
  const user = localStorage.getItem("userID");
  if (!user) return;

  try {
    const ref = doc(db, 'usuarios', user, 'caps-vistos', id);
    const snap = await getDoc(ref);
    const episodiosVistos = snap.exists() ? snap.data().episodiosVistos || [] : [];
    const visto = episodiosVistos.includes(ep.number.toString());

    btn.classList.toggle('ep-visto', visto);
    btn.classList.toggle('ep-no-visto', !visto);
    icon.src = visto ? '/icons/eye-solid.svg' : '/icons/eye-slash-solid.svg';
  } catch (error) {
    console.error('Error al refrescar estado del episodio:', error);
  }
}

async function obtenerCapitulosVistos(animeId) {
  return new Promise((resolve, reject) => { 
    const fetchChaptersLogic = async (userInstance) => {
      if (!userInstance) {
        console.warn("obtenerCapitulosVistos: No hay instancia de usuario. Retornando [].");
        resolve([]); 
        return;
      }
      try {
        const ref = doc(db, 'usuarios', userInstance.uid, 'caps-vistos', animeId);
        const snap = await getDoc(ref);
        resolve(snap.exists() ? snap.data().episodiosVistos || [] : []); 
      } catch (error) {
        console.error("Error al obtener capítulos vistos:", error);
        reject(error); 
      }
    };

    let resolved = false; 
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); 
      if (!resolved) {
        resolved = true;
        await fetchChaptersLogic(user); 
      }
    }, (error) => {
      if (!resolved) {
         resolved = true;
         console.error("Error en onAuthStateChanged:", error);
         reject(error); 
         unsubscribe(); 
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe(); 
        console.warn("obtenerCapitulosVistos timed out esperando estado de auth. Retornando [].");
        resolve([]); 
      }
    }, 10000); 
  });
}

//comparar datos antes de jecutar renderAnime
function compararDatos(a, b) {
  // Validación rápida de nulos/undefined
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  // Función de comparación rápida de strings
  const strEqual = (str1, str2) => 
    String(str1 || '').trim() === String(str2 || '').trim();

  // Comparación de campos básicos (validación temprana)
  const camposBasicos = [
    ['titulo', strEqual],
    ['portada', strEqual],
    ['banner', strEqual],
    ['descripcion', strEqual],
    ['rating', strEqual],
    ['estado', strEqual]
  ];

  if (camposBasicos.some(([campo, comparar]) => 
    !comparar(a[campo], b[campo]))
  ) {
    return false;
  }

  // Comparación de arrays de géneros
  if (a.generos?.length !== b.generos?.length || 
      !a.generos.every((g, i) => strEqual(g, b.generos[i]))) {
    return false;
  }

  // Función para comparar arrays de objetos con claves específicas
  const compararArrays = (arrA, arrB, keys) => {
    if (arrA?.length !== arrB?.length) return false;
    
    const normalizar = (obj) => 
      keys.map(k => String(obj?.[k] || '').trim().toLowerCase());
    
    const aSorted = [...arrA].sort((x, y) => 
      normalizar(x).join('|').localeCompare(normalizar(y).join('|'))
    );
    
    const bSorted = [...arrB].sort((x, y) => 
      normalizar(x).join('|').localeCompare(normalizar(y).join('|'))
    );
    
    return aSorted.every((item, i) => 
      normalizar(item).join('|') === normalizar(bSorted[i]).join('|')
    );
  };

  // Comparar episodios y relacionados
  return (
    compararArrays(a.episodios || [], b.episodios || [], ['number', 'url']) &&
    compararArrays(a.relacionados || [], b.relacionados || [], ['title', 'relation'])
  );
}

// Función para normalizar datos de la API (maneja ambos formatos)
function normalizarDatosAPI(data) {
  // Verificar si tiene el formato nuevo con "sources"
  if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
    const sourceData = data.sources[0].data;
    // Usar datos de sources[0].data si existen, si no usar datos del nivel superior
    return {
      titulo: sourceData?.title || data.title || '',
      portada: sourceData?.cover || data.cover || '',
      banner: data.banner || '',
      descripcion: sourceData?.synopsis || data.synopsis || '',
      generos: sourceData?.genres || data.genres || [],
      rating: data.rating || null,
      estado: sourceData?.status || data.status || null,
      episodios: (sourceData?.episodes || data.episodes || []).map(ep => ({ number: ep.number, url: ep.url })),
      relacionados: (data.related || []).map(ep => ({ title: ep.title, relation: ep.relation })) || [],
    };
  }
  // Formato antiguo (directo)
  return {
    titulo: data.title || '',
    portada: data.cover || '',
    banner: data.banner || '',
    descripcion: data.synopsis || '',
    generos: data.genres || [],
    rating: data.rating || null,
    estado: data.status || null,
    episodios: (data.episodes || []).map(ep => ({ number: ep.number, url: ep.url })),
    relacionados: (data.related || []).map(ep => ({ title: ep.title, relation: ep.relation })) || [],
  };
}

async function cargarAnime(idauxiliar) {
  if (idauxiliar) {
    console.log(idauxiliar);
    id = idauxiliar;
  }
  if (!id) {
    const letras = "abcdefghijklmnopqrstuvwxyz";
    const letraRandom = letras[Math.floor(Math.random() * letras.length)];
    return cargarAnime(letraRandom);
  }

  // 1. Cargar desde caché (si existe)
  let cached = cargarDatosDesdeCache(id);
  if (cached) {
    renderAnime(cached);
  }
  // 2. Cargar desde Firestore siempre
  try {
    const docSnap = await getDoc(doc(db, 'datos-animes', id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (!compararDatos(cached, data)) {
        actualizarCache(id, data);
        cached = data;
        renderAnime(data);
      }
    }
  } catch (err) {
    console.error('Error al cargar desde Firestore:', err);
  }

  // 3. Cargar desde API externa y actualizar todo
  try {
    const res = await fetch(`http://localhost:3001/api/anime?id=${id}`);
    const data = await res.json();
    const anime = normalizarDatosAPI(data);

    if (!compararDatos(cached, anime)) {
      // Preservar servidores existentes en Firestore
      const docSnap = await getDoc(doc(db, 'datos-animes', id));
      if (docSnap.exists()) {
        const dataFirestore = docSnap.data();
        if (dataFirestore.episodios) {
          anime.episodios = anime.episodios.map(ep => {
            const epFirestore = dataFirestore.episodios.find(e => e.url === ep.url);
            if (epFirestore?.servidores) {
              return { ...ep, servidores: epFirestore.servidores };
            }
            return ep;
          });
        }
      }
      await setDoc(doc(db, 'datos-animes', id), { ...anime, fechaGuardado: serverTimestamp() }, { merge: true });
      actualizarCache(id, anime);
      renderAnime(anime);
    }
    
    if (data.message === 'Anime no encontrado en ninguna fuente') {
    const inputBusqueda = document.getElementById('busqueda');
    const id = new URLSearchParams(window.location.search).get('id');
    if (inputBusqueda) {
    document.querySelector('header')?.classList.add('search-active');
    
    inputBusqueda.value = id; 
    
    inputBusqueda.dispatchEvent(new Event('input'));
}}
   }
    catch (err) {
    console.error('Error carga anime:', err)
  }
};
cargarAnime();


// Toggle búsqueda de capítulos
document.getElementById('btn-search-capitulo').addEventListener('click', function () {
  document.querySelector('.header-caps').classList.add('search-active');
  document.getElementById('filtro-capitulo').focus();
});

document.getElementById('btn-close-search-capitulo').addEventListener('click', function () {
  document.querySelector('.header-caps').classList.remove('search-active');
  document.getElementById('filtro-capitulo').value = "";
});



const btnFav = document.getElementById('btn-fav');

actualizarEstadoFavorito()

function actualizarEstadoFavorito() {
  obtenerFavoritosAnime()
    .then(favoritos => {
      const esFavorito = favoritos.includes(id);
      btnFav.classList.toggle("favorito", esFavorito);
    })
    .catch(error => {
      console.error("Error al obtener favoritos:", error);
    });
}

btnFav.addEventListener("click", async () => {
  if (!auth.currentUser) {
    alert("Debes iniciar sesión para agregar a favoritos.");
    return;
  }

  const titulo = document.getElementById("titulo").textContent;

  // Deshabilitamos para evitar spam de clics
  btnFav.disabled = true;

  try {
    // --- RESPUESTA VISUAL INSTANTÁNEA ---
    if (btnFav.classList.contains("activo")) {
      btnFav.classList.remove("activo");
      btnFav.classList.add("desaparecer");
      setTimeout(() => btnFav.classList.remove("desaparecer"), 500);
    } else {
      btnFav.classList.add("activo");
      btnFav.classList.add("aparecer");
      setTimeout(() => btnFav.classList.remove("aparecer"), 500);
    }

    // --- PROCESO INTERNO EN BASE DE DATOS ---
    const res = await toggleFavoritoAnime(titulo);

    // --- ESTADO FINAL ---
    actualizarEstadoFavorito();


  } catch (err) {
    console.error("❌ Error al cambiar favorito:", err);
  } finally {
    btnFav.disabled = false;
  }
});

async function toggleFavoritoAnime(titulo) {
  const user = localStorage.getItem("userID");
  if (!user) {
    throw "Usuario no autenticado";
  }

  const favoritosRef = doc(collection(doc(db, "usuarios", user), "favoritos"), "lista");
  const favoritosDoc = await getDoc(favoritosRef);

  let favoritos = [];
  if (favoritosDoc.exists() && favoritosDoc.data().animes) {
    favoritos = [...favoritosDoc.data().animes];
  }

  const index = favoritos.indexOf(id);

  if (index !== -1) {
    // eliminar
    favoritos.splice(index, 1);
    await setDoc(favoritosRef, { animes: favoritos }, { merge: true });
    mostrarPildora("fav", false, titulo);  
    return { esFavorito: false, mensaje: "Anime eliminado de favoritos" };
  } else {
    // agregar
    favoritos.push(id);
    await setDoc(favoritosRef, { animes: favoritos }, { merge: true });
    mostrarPildora("fav", true, titulo);  
    return { esFavorito: true, mensaje: "Anime agregado a favoritos" };
  }
}

async function obtenerFavoritosAnime() {
  const user = localStorage.getItem("userID");
  if (!user) return [];

  const favoritosRef = doc(collection(doc(db, "usuarios", user), "favoritos"), "lista");
  const favoritosDoc = await getDoc(favoritosRef);
  
  return favoritosDoc.exists() && favoritosDoc.data().animes 
    ? favoritosDoc.data().animes 
    : [];
}



async function actualizarProgresoCapitulos(totalEpisodios, episodiosVistos) {
  const progreso = (episodiosVistos.length / totalEpisodios) * 100;

  const progresoBtn = document.getElementById('btn-progreso');
  if (progresoBtn) {
    progresoBtn.style.setProperty('--progreso', progreso.toFixed(0));
    progresoBtn.style.setProperty('--progreso-text', `"${progreso.toFixed(0)}%"`);
  }

  const progresoElement = document.getElementById('progreso');
  if (progresoElement) {
    progresoElement.style.width = `${progreso}%`;
  }

}

const btnViendo = document.getElementById('btn-viendo');
const btnPendiente = document.getElementById('btn-pendiente');
const btnVisto = document.getElementById('btn-visto');
const estadoText = document.getElementById('estado-text');

const ESTADOS = {
  viendo: {
    color: '#22cee9',
    texto: 'VIENDO',
  },
  pendiente: {
    color: '#ffc107',
    texto: 'PENDIENTE',
  },
  visto: {
    color: '#00c853',
    texto: 'VISTO',
  }
};

let activeBtn, timeout;

const buttons = [btnViendo, btnPendiente, btnVisto, btnFav].filter(Boolean);

const setHover = btn => {
  clearTimeout(timeout);
  if (activeBtn && activeBtn !== btn) activeBtn.classList.remove("touch-hover");
  activeBtn = btn;
  btn?.classList.add("touch-hover");
};

const clearHover = () => {
  timeout = setTimeout(() => {
    activeBtn?.classList.remove("touch-hover");
    activeBtn = null;
  }, 2000);
};

buttons.forEach(btn => {
  btn.addEventListener("touchstart", () => setHover(btn), { passive: true });

  btn.addEventListener("touchmove", e => {
    setHover(document.elementFromPoint(
      e.touches[0].clientX,
      e.touches[0].clientY
    )?.closest("button"));
  }, { passive: true });

  btn.addEventListener("touchend", clearHover, { passive: true });
  btn.addEventListener("touchcancel", clearHover, { passive: true });
});
async function actualizarEstadoFirebase(estado) {
  if (estadoToggleInProgress) {
    console.warn('actualizarEstadoFirebase: Operación en progreso, ignorando.');
    return;
  }

  estadoToggleInProgress = true;

  try {
    const user = localStorage.getItem("userID");
    if (!user) return;

    const estadoActual = await obtenerEstadoActual();

    if (estadoActual === estado) return;

    await limpiarEstadosPrevios();

    if (!estado) return;

    const estadoLower = estado.toLowerCase();
    const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estadoLower);
    const estadoDoc = await getDoc(estadoRef);

    let animes = [];
    if (estadoDoc.exists()) {
      animes = [...(estadoDoc.data().animes || [])];
    }

    if (!animes.includes(id)) {
      animes.push(id);
      await setDoc(estadoRef, { animes }, { merge: true });
      console.log(estadoLower);
      mostrarPildora(estadoLower, true, document.getElementById('titulo')?.textContent || '');
    }
  } catch (error) {
    console.error("Error al actualizar estado en Firebase:", error);
    throw error;
  } finally {
    estadoToggleInProgress = false;
  }
}

async function limpiarEstadosPrevios() {
  const user = localStorage.getItem("userID");
  if (!user) return;

  const estados = ['viendo', 'pendiente', 'visto'];

  for (const estado of estados) {
    const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estado);
    const estadoDoc = await getDoc(estadoRef);
    
    if (estadoDoc.exists()) {
      let animes = [...(estadoDoc.data().animes || [])];
      const index = animes.indexOf(id);
       
      if (index !== -1) {
        animes.splice(index, 1);
        await setDoc(estadoRef, { animes }, { merge: true });
      }
    }
  }
}

async function manejarEstadoSeleccionado(btnSeleccionado) {
  if (estadoToggleInProgress) {
    console.warn('manejarEstadoSeleccionado: Operación en progreso, ignorando clic.');
    return;
  }

  const estadoId = btnSeleccionado.id.replace('btn-', '');
  const estado = ESTADOS[estadoId];
  const user = localStorage.getItem("userID");

  if (!user) {
    console.warn('manejarEstadoSeleccionado: No hay usuario autenticado.');
    window.alert('Inicia sesión para guardar tu progreso de capítulos, animes y mucho más!.');
    return;
  }

  if (btnSeleccionado.classList.contains('active')) {
    // Desactivar estado
    try {
      const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estadoId);
      const estadoDoc = await getDoc(estadoRef);

      if (estadoDoc.exists() && Array.isArray(estadoDoc.data().animes)) {
        const animesActualizados = estadoDoc.data().animes.filter(animeId => animeId !== id);
        if (animesActualizados.length !== estadoDoc.data().animes.length) {
          await setDoc(estadoRef, { animes: animesActualizados }, { merge: true });
          console.log(estadoId);
          mostrarPildora(estadoId, false, document.getElementById('titulo')?.textContent || '');
        }
      }
      btnSeleccionado.classList.remove('active');
    } catch (error) {
      console.error('Error al eliminar el estado:', error);
      // Revertir UI en caso de error
      await refrescarEstadoBotones();
    }
    return;
  }

  // Activar nuevo estado
  try {
    await actualizarEstadoFirebase(estadoId.toUpperCase());
    [btnViendo, btnPendiente, btnVisto].forEach(btn => btn.classList.remove('active'));
    btnSeleccionado.classList.add('active');
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    // Revertir UI en caso de error
    await refrescarEstadoBotones();
  }
}

async function refrescarEstadoBotones() {
  const user = localStorage.getItem("userID");
  if (!user) return;

  try {
    const estadoActual = await obtenerEstadoActual();
    [btnViendo, btnPendiente, btnVisto].forEach(btn => btn.classList.remove('active'));

    if (estadoActual) {
      const btn = document.getElementById(`btn-${estadoActual.toLowerCase()}`);
      if (btn) btn.classList.add('active');
    }
  } catch (error) {
    console.error('Error al refrescar estado de botones:', error);
  }
}

async function obtenerEstadoActual() {
  const user = localStorage.getItem("userID");
  if (!user) return null;

  const estados = ['viendo', 'pendiente', 'visto'];
  
  for (const estado of estados) {
    const estadoRef = doc(collection(doc(db, "usuarios", user), "estados"), estado);
    const estadoDoc = await getDoc(estadoRef);
    
    if (estadoDoc.exists() && Array.isArray(estadoDoc.data().animes)) {
      if (estadoDoc.data().animes.includes(id)) {
        return estado.toUpperCase();
      }
    }
  }
  return null;
}
obtenerEstadoActual().then(estado => {
  if (estado) {
    const btnSeleccionado = document.getElementById(`btn-${estado.toLowerCase()}`);
    if (btnSeleccionado) manejarEstadoSeleccionado(btnSeleccionado);
  }
});

btnViendo.addEventListener('click', () => manejarEstadoSeleccionado(btnViendo));
btnPendiente.addEventListener('click', () => manejarEstadoSeleccionado(btnPendiente));
btnVisto.addEventListener('click', () => manejarEstadoSeleccionado(btnVisto));


document.addEventListener("click", (e) => {
  const seccion = document.getElementById("Estados");
  if (!seccion) return;
  const btnEstado = document.getElementById("btn-estado");
  if (seccion.classList.contains("active") && 
      !seccion.contains(e.target) && 
      !btnEstado.contains(e.target)) {
    seccion.classList.remove("active");
  }
});

const scrollContainer = document.querySelector('#animes-relacionados');

scrollContainer.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault(); 
    scrollContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });

//modal portada
const modal = document.createElement('div');
modal.id = 'modalImagen';
modal.innerHTML = `<img src="" alt="Vista Ampliada">`;
document.body.appendChild(modal);

const modalImg = modal.querySelector('img');

portadaEl.addEventListener('click', () => {
  modalImg.src = portadaEl.src;
  modal.classList.add('active');
});

// Cerrar al hacer clic en la imagen del modal
modal.addEventListener('click', () => {
  modal.classList.remove('active');
});
window.addEventListener('scroll', () => {
  modal.classList.remove('active');
});

//pildora visual check 
function mostrarPildora(opcion, estado = true, anime = null, cap = null) {

  const pillAnterior = document.querySelector('.pildora');
  if (pillAnterior) {
    pillAnterior.remove();
  }
  
  console.log("pildora")

  const pill = document.createElement("div");
  pill.classList.add("pildora");

  const accion = estado ? "Agregado a" : "Eliminado de";

  switch (opcion) {
    case "fav":
      pill.classList.add("pildora-fav");
      pill.textContent = `${anime} ${accion} favoritos`;
      break;
    case "pendiente":
      pill.classList.add("pildora-pendiente");
      pill.textContent = `${anime} ${accion} pendientes`;
      break;
    case "visto":
      pill.classList.add("pildora-visto");
      pill.textContent = `${anime} ${accion} vistos`;
      break;
    case "viendo":
      pill.classList.add("pildora-viendo");
      pill.textContent = `${anime} ${accion} viendo`;
      break;
      case "capvisto":
        pill.classList.add("pildora-visto");
        pill.textContent = `Capítulo ${cap} ${accion} vistos`;
        break;
    default:
      pill.classList.add("pildora-default");
      pill.textContent = estado ? "Acción realizada" : "Acción revertida";
  }
  if (!estado) {
    pill.style.filter = "grayscale(1) brightness(0.7)";
  }
  document.body.appendChild(pill);

  setTimeout(() => {
    pill.classList.add("mostrar");
  }, 50);

  setTimeout(() => {
    pill.classList.remove("mostrar");
    setTimeout(() => pill.remove(), 400); 
  }, 3000);
}
document.getElementById("btn-volver").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.location.href = "https://animeflvlite.netlify.app/";
  }
});