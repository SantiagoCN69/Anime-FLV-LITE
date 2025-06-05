import { db, auth } from './firebase-login.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  where,
  serverTimestamp,
  setDoc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { observerAnimeCards } from './utils.js';

let userID = localStorage.getItem('userID');

document.addEventListener('DOMContentLoaded', () => {
  const contadores = document.querySelectorAll('span.contador');
  contadores.forEach(contadorSpan => {
    let tiempoRestante = 100;
    contadorSpan.textContent = tiempoRestante + 's';
    const intervalo = setInterval(() => {
      tiempoRestante--;
      if (tiempoRestante >= 0) {
        contadorSpan.textContent = tiempoRestante + 's';
      } else {
        clearInterval(intervalo);
        contadorSpan.textContent = '';
      }
    }, 230);
  });
});

function ver(id) {
  window.location.href = `anime.html?id=${id}`;
}

let favoritosCargados = false;
let viendoCargado = false;
let pendientesCargados = false;
let completadosCargados = false;
let ultimosCapsCargados = false;

function mostrarSeccionDesdeHash() {
  let hash = window.location.hash;
  if (!hash) {
    if (!ultimosCapsCargados) {
      cargarUltimosCapitulos();
      cargarhistorial();
      ultimosCapsCargados = true;
    }
    return;
  }

  const id = decodeURIComponent(hash.substring(1));
  const seccion = document.getElementById(id);
  if (!seccion) return;

  // Ocultar todas las secciones
  document.querySelectorAll(".content-section").forEach(sec => 
    sec.classList.toggle("hidden", sec.id !== id)
  );

  // Actualizar el menú activo
  document.querySelectorAll('.sidebar li').forEach(item => 
    item.classList.toggle('active-menu-item', item.getAttribute('data-target') === id)
  );

switch(id) {
    case 'Mis-Favoritos':
      if (!favoritosCargados) {
        cargarFavoritos();
        favoritosCargados = true;
      }
      break;
    case 'Viendo':
      if (!viendoCargado) {
        cargarViendo();
        viendoCargado = true;
      }
      break;
    case 'Pendientes':
      if (!pendientesCargados) {
        cargarPendientes();
        pendientesCargados = true;
      }
      break;
    case 'Completados':
      if (!completadosCargados) {
        cargarCompletados();
        completadosCargados = true;
      }
      break;
    case 'Ultimos-Episodios':
      if (!ultimosCapsCargados) {
        cargarUltimosCapitulos();
        cargarhistorial();
        ultimosCapsCargados = true;
      }
      break;
}
}

window.addEventListener("DOMContentLoaded", () => {
  mostrarSeccionDesdeHash();
});
window.addEventListener("hashchange", () => {
  mostrarSeccionDesdeHash();
});

window.handleHashChange = function () {
  let hash = window.location.hash.substring(1);

  if (!hash) {
    hash = 'Ultimos-Episodios';
    history.replaceState(null, '', '#' + hash);
  }

  document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));

  const targetSection = document.getElementById(hash);
  if (targetSection) {
    targetSection.classList.remove('hidden');

    const activeMenuItem = document.querySelector(`.sidebar li[data-target="${hash}"]`);
    if (activeMenuItem) {
      document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
      activeMenuItem.classList.add('active');
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    cargarUltimosCapsVistos(),
  ])

  const sidebarItems = document.querySelectorAll('.sidebar li');
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      history.replaceState(null, '', `#${targetId}`);
      mostrarSeccionDesdeHash();
      document.querySelectorAll('.anime-card').forEach(el => el.classList.remove('show'));
      observerAnimeCards();
    });
  });

});


function crearElementoSiguienteCapitulo(itemData) {
  const btn = document.createElement('div');
  btn.className = 'btn-siguiente-capitulo';
  
  const portada = document.createElement('img');
  portada.src = itemData.portada;
  portada.alt = itemData.titulo;
  portada.className = 'portada-anime';
  portada.onerror = () => {
    portada.src = 'path/to/default/image.png'; 
  };
  
  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  const spanTitulo = document.createElement('span'); 
  spanTitulo.classList.add('texto-2-lineas');
  spanTitulo.textContent = itemData.titulo;

  const spanEpisodio = document.createElement('span');
  spanEpisodio.className = 'texto-episodio';
  spanEpisodio.textContent = `Ep. ${itemData.siguienteCapitulo}`;

  contenedorTexto.appendChild(spanTitulo);
  contenedorTexto.appendChild(spanEpisodio);
  
  btn.appendChild(portada);
  btn.appendChild(contenedorTexto);
  
  btn.addEventListener('click', () => {
    window.location.href = `ver.html?animeId=${itemData.animeId}&url=${itemData.siguienteCapitulo}`;
  });

  return btn;
}

async function cargarUltimosCapsVistos() {
  console.log('Ejecutando cargarUltimosCapsVistos');
  const ultimosCapsContainer = document.getElementById('ultimos-caps-viendo');
  if (!ultimosCapsContainer) return;

  const renderizarBotones = (datos) => {
    ultimosCapsContainer.innerHTML = ''; 
    if (!datos || datos.length === 0) {
      ultimosCapsContainer.innerHTML = '<p>No tienes capítulos siguientes disponibles.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(itemData => {
      const btn = crearElementoSiguienteCapitulo(itemData);
      if (btn) {
        fragment.appendChild(btn);
      }
    });
    ultimosCapsContainer.appendChild(fragment);
  };

  const user = await new Promise(resolve => {
    onAuthStateChanged(auth, (user) => {
      resolve(user);
    });
  });

  if (!user) {
    ultimosCapsContainer.innerHTML = '<p>Inicia sesión para ver tus últimos capítulos</p>';
    return;
  }

  const cacheKey = `ultimosCapsVistosCache_`;
  let cachedData = null;

  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
      cachedData = JSON.parse(cachedDataString);
      if (Array.isArray(cachedData)) {
        renderizarBotones(cachedData);
      } else {
        cachedData = null;
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error al leer o parsear caché:", error);
    cachedData = null;
    localStorage.removeItem(cacheKey);
  }

  try {
    const ref = collection(doc(db, "usuarios", user.uid), "caps-vistos");
    const q = query(ref, orderBy('fechaAgregado', 'desc'), limit(6));
    const snap = await getDocs(q);
    let freshData = [];

    if (!snap.empty) {
      const capVistos = snap.docs
        .map(docSnap => ({
          animeId: docSnap.id,
          ...docSnap.data()
        }))
        .sort((a, b) => {
          const fechaA = new Date(a.fechaAgregado?.toDate?.() || a.fechaAgregado || 0);
          const fechaB = new Date(b.fechaAgregado?.toDate?.() || b.fechaAgregado || 0);
          return fechaB - fechaA; 
        })
        .slice(0, 6); 

      const animeRefs = capVistos.map(cap => doc(db, "datos-animes", cap.animeId));
      const animeDocsSnap = await Promise.all(animeRefs.map(ref => getDoc(ref)));

      const animeDataMap = {};
      animeDocsSnap.forEach((docSnap, i) => {
        if (docSnap.exists()) {
          animeDataMap[capVistos[i].animeId] = docSnap.data();
        }
      });

      freshData = capVistos.map(cap => {
        const animeDetails = animeDataMap[cap.animeId];

        if (!animeDetails || !animeDetails.portada || !animeDetails.episodios || !animeDetails.titulo) {
          return null;
        }

        const ultimoCapVisto = Math.max(...(cap.episodiosVistos || []).map(Number), 0);
        const siguienteCapitulo = ultimoCapVisto + 1;
        
        const episodiosDelAnime = typeof animeDetails.episodios === 'object' && animeDetails.episodios !== null ? animeDetails.episodios : {};
        const siguienteEpisodio = Object.values(episodiosDelAnime)
          .find(ep => ep.number === siguienteCapitulo);

        if (siguienteEpisodio?.url) {
          return {
            animeId: cap.animeId,
            portada: animeDetails.portada,
            titulo: animeDetails.titulo,
            siguienteCapitulo,
            siguienteEpisodioUrl: siguienteEpisodio.url
          };
        }
        return null;
      }).filter(Boolean);
    }
    const freshDataString = JSON.stringify(freshData);
    const cachedDataString = JSON.stringify(cachedData);

    if (freshDataString !== cachedDataString) {
      renderizarBotones(freshData);
      localStorage.setItem(cacheKey, freshDataString);
    } else {
      if (cachedData === null && freshData.length === 0) {
      } else if (cachedData === null && freshData.length > 0) {
        renderizarBotones(freshData);
        localStorage.setItem(cacheKey, freshDataString);
      } else {
      }
    }

  } catch (error) {
    console.error('Error general al cargar últimos capítulos vistos desde Firestore:', error);
    if (cachedData === null) {
      ultimosCapsContainer.innerHTML = '<p>Error al cargar últimos capítulos</p>';
    }
  }
}

  // Función para crear tarjeta de anime
  function createAnimeCard(anime) {
    const div = document.createElement('div');
    let chapterHtml = ''; 
    let estadoHtml = '';
    let ratingHtml = '';

    div.className = 'anime-card';
    div.style.setProperty('--cover', `url(${anime.portada})`);
    
    if (anime.siguienteCapitulo) {
      chapterHtml = `<span id="chapter">Episodio ${anime.siguienteCapitulo}</span>`;
    }
    
    if (anime.estado) {
      if (anime.estado === 'En emision') {
        estadoHtml = `<span class="estado"><img src="../icons/circle-solid-blue.svg" alt="${anime.estado}">${anime.estado}</span>`;
      }
      else{
        estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="${anime.estado}">${anime.estado}</span>`;
      }
    }
    
    if (anime.rating) {
      ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
    }
    
    div.innerHTML = `
      <div class="container-img">
        <img src="${anime.portada}" class="cover" alt="${anime.titulo}">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        ${chapterHtml}
        ${estadoHtml}
        ${ratingHtml}
      </div>
      <strong>${anime.titulo}</strong>
    `;
    
    div.addEventListener('click', () => {
      if (anime.id) {
        ver(anime.id);
      }
    });
  
    return div;
  }

  function leerCache(key) {
    try {
      const raw = localStorage.getItem(key);
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Error leyendo cache (${key}):`, e);
      localStorage.removeItem(key);
    }
    return null;
  }
  
  function guardarCache(key, data) {
    if (!Array.isArray(data) || data.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    const dataToCache = data.slice(0, 20);
    localStorage.setItem(key, JSON.stringify(dataToCache));
  }

  async function cargarUltimosCapitulos() {
    console.log('Ejecutando carga de últimos capítulos');
    const container = document.getElementById('ultimos-episodios');
    const cacheKey = 'ultimosEpisodiosGeneralesCache';
    const docId = 'ultimosCapitulos'; 
  
    // Función para renderizar los capítulos
    const render = (datos) => {
      document.querySelectorAll('.init-loading-servidores').forEach(el => el.style.display = 'none');
      container.innerHTML = '';
  
      if (!datos?.length) {
        container.innerHTML = '<p>No se encontraron últimos episodios.</p>';
        return;
      }
  
      const fragment = document.createDocumentFragment();
      datos.forEach(anime => {
        const card = createAnimeCard({
          id: anime.url?.split('/').pop()?.replace(/-\d+$/, '') || '',
          portada: anime.cover || '',
          titulo: anime.title || 'Sin título',
          siguienteCapitulo: anime.chapter?.toString() || ''
        });
        if (card) fragment.appendChild(card);
      });
      container.appendChild(fragment);
      observerAnimeCards();
    };
  
    // 1. Cargar desde caché local
    let cached = leerCache(cacheKey);
    if (cached) {
      render(cached);
    }
  
    const normalizar = obj => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(normalizar);
        
        return Object.keys(obj).sort().reduce((res, key) => ({
          ...res,
          [key]: normalizar(obj[key])
        }), {});
      };
    
    // 2. Intentar cargar desde Firestore
    try {
      const docRef = doc(db, 'ultimos-capitulos', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const firestoreData = docSnap.data().items || [];
  
        if (JSON.stringify(normalizar(cached)) !== JSON.stringify(normalizar(firestoreData))) {
          console.log('Datos diferentes, actualizando desde Firestore');
          render(firestoreData);
          guardarCache(cacheKey, firestoreData);
          cached = firestoreData;
        }
      }
    } catch (err) {
      console.error('Error al obtener datos de Firestore:', err);
    }
  
    // 3. Cargar desde la API si es necesario
    try {
      const res = await fetch('https://backend-animeflv-lite.onrender.com/api/latest');
      const apiData = await res.json();
  
      if (!Array.isArray(apiData)) {
        throw new Error('Formato de respuesta inválido');
      }
  
      if (JSON.stringify(normalizar(apiData)) !== JSON.stringify(normalizar(cached))) {
        console.log('Datos diferentes a la caché, actualizando desde API');
        render(apiData);
        guardarCache(cacheKey, apiData);
        cached = apiData;
        // Actualizar Firestore con los nuevos datos
        try {
          const docRef = doc(db, 'ultimos-capitulos', docId);
          await setDoc(docRef, { 
            items: apiData
          }, { merge: true });
        } catch (firestoreError) {
          console.error('Error al actualizar Firestore:', firestoreError);
        }
      }
    } catch (err) {
      console.error('Error al obtener datos de la API:', err);
    }
}

async function cargarhistorial() {
  console.log('Ejecutando cargarhistorial');
  const historialContainer = document.getElementById('historial');
  const historialh2 = document.getElementById('historialh2');
  if (!historialContainer) return;

  historialContainer.innerHTML = '';
  const claves = Object.keys(localStorage);
  const animesRecientes = [];
  
  // Filtrar solo las claves que empiezan con 'anime_'
  const clavesAnime = claves.filter(clave => clave.startsWith('anime_'));
  
  for (const clave of clavesAnime) {
    try {
      const datos = JSON.parse(localStorage.getItem(clave));
      if (datos && datos._cachedAt) { 
        animesRecientes.push({
          id: clave.replace('anime_', ''), 
          titulo: datos.titulo || 'Sin título',
          estado: datos.estado || 'Sin estado',
          rating: datos.rating || 'Sin rating',
          portada: datos.portada || '',
          _cachedAt: datos._cachedAt
        });
      }
    } catch (e) {
      console.error('Error al procesar datos del localStorage:', e);
    }
  }
  
  // Ordenar por fecha
  animesRecientes.sort((a, b) => b._cachedAt - a._cachedAt);
  const animesAMostrar = animesRecientes.slice(0, 20);
  
  // Mostrar u ocultar según si hay animes
  if (animesAMostrar.length > 0) {
    historialh2.classList.remove('hidden');
    historialContainer.classList.remove('hidden');
    
    const fragment = document.createDocumentFragment();
    animesAMostrar.forEach(anime => {
      const card = createAnimeCard(anime);
      if (card) fragment.appendChild(card);
    });
    historialContainer.appendChild(fragment);
    observerAnimeCards();
  } else {
    historialh2.classList.add('hidden');
    historialContainer.classList.add('hidden');
  }
}

const renderizarSeccion = (datos, seccionId) => {
  const seccion = document.getElementById(seccionId);
  if (!seccion) return;

  if (!datos || datos.length === 0) {
    seccion.innerHTML = `<p>No tienes animes en ${seccionId}</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  datos.forEach(anime => {
    const card = createAnimeCard(anime);
    if (card) fragment.appendChild(card);
  });
  seccion.appendChild(fragment);
  observerAnimeCards();
}

async function cargarFavoritos() {
  console.log('Ejecutando cargarFavoritos');
  
  const favsContainer = document.getElementById('favoritos');
  if (!favsContainer) return;
  
  if (!userID) {
    favsContainer.innerHTML = '<p>Inicia sesión para ver tus favoritos</p>';
    return;
  }

  const cacheKey = `favoritosCache_${userID}`;
  const cachedData = leerCache(cacheKey);

  // Leer lista de títulos de favoritos
  const favsRef = doc(db, "usuarios", userID, "favoritos", "lista");
  const favsDoc = await getDoc(favsRef);

  const titulosFavoritos = favsDoc.exists() ? favsDoc.data().animes || [] : [];
  if (titulosFavoritos.length === 0) {
    renderizarSeccion([], 'favoritos');
    localStorage.removeItem(cacheKey);
    return;
  }

  // Si hay caché y los títulos coinciden, renderiza directamente
  if (cachedData) {
    const cachedTitulos = cachedData.map(a => a.titulo);
    if (JSON.stringify(titulosFavoritos) === JSON.stringify(cachedTitulos)) {
      console.log('Datos en caché iguales a la base de datos');
      renderizarSeccion(cachedData, 'favoritos');
      return;
    }
  }

  // Obtener datos completos solo si hubo cambio
  const q = query(
    collection(db, "datos-animes"),
    where("titulo", "in", titulosFavoritos)
  );
  const querySnapshot = await getDocs(q);

  const animesPorTitulo = new Map();
  querySnapshot.forEach(doc => {
    const data = doc.data();
    animesPorTitulo.set(data.titulo, {
      id: doc.id,
      titulo: data.titulo,
      portada: data.portada || 'img/background.webp',
      estado: data.estado || 'No disponible',
      rating: data.rating || null
    });
  });

  const animesOrdenados = titulosFavoritos
    .map(t => animesPorTitulo.get(t))
    .filter(Boolean);

  renderizarSeccion(animesOrdenados, 'favoritos');
  guardarCache(cacheKey, animesOrdenados);
}

async function cargarViendo() {
  console.log('Ejecutando cargarViendo');
  const viendoContainer = document.getElementById('viendo');
  if (!viendoContainer) return;

  const renderizarViendo = (datos, reemplazar = false) => {
    if (reemplazar) viendoContainer.innerHTML = '';

    if (!datos || datos.length === 0) {
      viendoContainer.innerHTML = '<p>No tienes animes viendo.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const anime of datos) {
      const card = createAnimeCard(anime || {});
      if (card) fragment.appendChild(card);
    }
    viendoContainer.appendChild(fragment);
    
    // Solo observamos las cards cuando se reemplaza el contenido inicial
    if (reemplazar) observerAnimeCards();
  };

  const dividirEnBloques = (array, tamaño) => {
    const bloques = [];
    for (let i = 0; i < array.length; i += tamaño) {
      bloques.push(array.slice(i, i + tamaño));
    }
    return bloques;
  };

  const obtenerDatosAnime = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, "datos-animes", id));
      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      return {
        id,
        titulo: data.titulo || 'Título no encontrado',
        portada: data.portada || 'img/background.webp',
        estado: data.estado || 'No disponible',
        rating: data.rating || null
      };
    } catch (error) {
      console.error(`Error al obtener anime ${id}:`, error);
      return null;
    }
  };

  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      resolve(user);
    });
  });

  if (!user) {
    viendoContainer.innerHTML = '<p>Inicia sesión para ver tus animes en curso</p>';
    return;
  }

  const userId = user.uid;
  const cacheKey = `viendoCache_${userId}`;
  const cachedData = leerCache(cacheKey);
  if (cachedData) renderizarViendo(cachedData, true);

  try {
    const estadosRef = doc(collection(doc(db, "usuarios", userId), "estados"), "viendo");
    const estadosDoc = await getDoc(estadosRef);
    const ids = estadosDoc.exists() ? estadosDoc.data().animes || [] : [];

    if (ids.length === 0) {
      renderizarViendo([], true);
      localStorage.removeItem(cacheKey);
      return;
    }

    const bloques = dividirEnBloques(ids, 10);
    const freshData = [];

    // Primer bloque (rápido)
    const primerBloque = await Promise.all(bloques[0].map(obtenerDatosAnime));
    const primerosValidos = primerBloque.filter(Boolean);
    freshData.push(...primerosValidos);
    renderizarViendo(primerosValidos, true);

    // Carga diferida de bloques siguientes (mejor rendimiento sin bloquear)
    bloques.slice(1).forEach(async (bloque) => {
      const resultados = await Promise.all(bloque.map(obtenerDatosAnime));
      const nuevos = resultados.filter(Boolean);
      freshData.push(...nuevos);
      renderizarViendo(nuevos);
    });

    guardarCache(cacheKey, freshData);
  } catch (error) {
    console.error('Error al cargar animes en curso desde Firestore:', error);
    if (!cachedData) {
      viendoContainer.innerHTML = '<p>Error al cargar animes en curso.</p>';
    }
  }
}

async function cargarPendientes() {
  console.log('Ejecutando cargarPendientes');
  const cont = document.getElementById('pendientes');
  if (!cont) return;

  const render = (animes, reset = false) => {
    if (reset) cont.innerHTML = '';
    if (!animes || !animes.length) {
      cont.innerHTML = '<p>No tienes animes pendientes.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const anime of animes) {
      const card = createAnimeCard(anime || {});
      if (card) frag.appendChild(card);
    }
    cont.appendChild(frag);
    observerAnimeCards();
  };

  const obtenerDatosAnime = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, "datos-animes", id));
      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      return {
        id,
        titulo: data.titulo || 'Título no encontrado',
        portada: data.portada || 'img/background.webp',
        estado: data.estado || 'No disponible',
        rating: data.rating || null
      };
    } catch {
      return null;
    }
  };

  const user = await new Promise(res => onAuthStateChanged(auth, u => res(u)));
  if (!user) return render([], true);

  const key = `pendientesCache_${user.uid}`;
  const cache = leerCache(key);
  if (cache) render(cache, true);

  try {
    const estadosRef = doc(collection(doc(db, "usuarios", user.uid), "estados"), "pendiente");
    const estadosDoc = await getDoc(estadosRef);
    const data = estadosDoc.exists() ? estadosDoc.data() : {};
    const ids = data.animes || [];

    if (ids.length === 0) {
      render([], true);
      localStorage.removeItem(key);
      return;
    }

    const bloques = [];
    for (let i = 0; i < ids.length; i += 10) bloques.push(ids.slice(i, i + 10));

    const all = [];

    bloques.forEach(async (bloque, index) => {
      const resultados = await Promise.all(bloque.map(obtenerDatosAnime));
      const validos = resultados.filter(Boolean);
      all.push(...validos);
      render(validos, index === 0);

      // Guardar en caché solo al final
      if (index === bloques.length - 1) {
        guardarCache(key, all.map(({ id, titulo, portada, estado, rating }) => ({
          id, titulo, portada, estado, rating
        })));
      }
    });
  } catch {
    if (!cache) {
      cont.innerHTML = '<p>Error al cargar animes pendientes.</p>';
    }
  }
}

async function cargarCompletados() {
  console.log('Ejecutando cargarCompletados');
  const completadosContainer = document.getElementById('completados');
  if (!completadosContainer) return;

  const renderizarCompletados = (datos, reset = false) => {
    if (reset) completadosContainer.innerHTML = '';
    if (!datos || datos.length === 0) {
      completadosContainer.innerHTML = '<p>No tienes animes completados.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(anime => {
      const card = createAnimeCard(anime || {});
      if (card) fragment.appendChild(card);
    });
    completadosContainer.appendChild(fragment);
    observerAnimeCards();
  };

  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });

  if (!user) {
    completadosContainer.innerHTML = '<p>Inicia sesión para ver tus animes completados</p>';
    return;
  }

  const userId = user.uid;
  const cacheKey = `completadosCache_${userId}`;
  const cache = leerCache(cacheKey);

  if (cache) {
    renderizarCompletados(cache, true);
  }

  try {
    const estadosRef = doc(collection(doc(db, "usuarios", userId), "estados"), "visto");
    const estadosDoc = await getDoc(estadosRef);
    
    if (!estadosDoc.exists() || !estadosDoc.data().animes || estadosDoc.data().animes.length === 0) {
      renderizarCompletados([], true);
      localStorage.removeItem(cacheKey);
      return;
    }
    
    const ids = estadosDoc.data().animes;
    const bloques = [];
    for (let i = 0; i < ids.length; i += 10) {
      bloques.push(ids.slice(i, i + 10));
    }
    
    let all = [];
    for (let i = 0; i < bloques.length; i++) {
      const bloque = bloques[i];
      const datos = await Promise.all(
        bloque.map(id =>
          getDoc(doc(db, 'datos-animes', id))
            .then(ds => ds.exists() ? { 
              id, 
              titulo: ds.data().titulo || 'Título no encontrado',
              portada: ds.data().portada || 'img/background.webp',
              estado: ds.data().estado || 'No disponible',
              rating: ds.data().rating || null
            } : null)
            .catch(() => null)
        )
      );
      
      const valid = datos.filter(Boolean);
      all = all.concat(valid);
      renderizarCompletados(valid, i === 0);
    }
    
    guardarCache(cacheKey, all);
  } catch (error) {
    if (!cache) {
      completadosContainer.innerHTML = '<p>Error al cargar animes completados.</p>';
    }
  }
}


// Sidebar toggle y navegación
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const sections = document.querySelectorAll(".content-section");
  const menuItems = [...document.querySelectorAll(".sidebar li")];

  const toggleSidebar = () => sidebar.classList.toggle("active");
  const closeSidebar = () => sidebar.classList.remove("active");
  const isMobile = () => window.innerWidth <= 600;

  menuBtn.addEventListener("click", () => {
    if (!sidebar.classList.contains("active") && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toggleSidebar();
    }
  });

  window.addEventListener("scroll", () => {
    if (isMobile() && sidebar.classList.contains("active")) {
      closeSidebar();
    }
  });

  let touchStartX = 0;
  let touchEndX = 0;
  const handleSwipe = () => {
    if (sidebar.classList.contains("active")) {
      const dist = touchStartX - touchEndX;
      if (dist > 50) closeSidebar();
    }
  };
  document.addEventListener("touchstart", e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  document.addEventListener("touchend", e => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, { passive: true });

  sections.forEach(section => {
    let sx = 0, sy = 0, ex = 0, ey = 0;
  
    section.addEventListener("touchstart", e => {
      sx = e.changedTouches[0].screenX;
      sy = e.changedTouches[0].screenY;
    }, { passive: true });
  
    section.addEventListener("touchend", e => {
      ex = e.changedTouches[0].screenX;
      ey = e.changedTouches[0].screenY;
  
      const dx = ex - sx;
      const dy = Math.abs(ey - sy);
  
      if (dx > 50 && dy < 35 && !sidebar.classList.contains("active") && isMobile()) {
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          const checkScroll = () => {
            if (window.scrollY === 0) {
              sidebar.classList.add("active");
            } else {
              requestAnimationFrame(checkScroll);
            }
          };
          checkScroll(); 
        } else {
          sidebar.classList.add("active");
        }
      }
    }, { passive: true });
  });

  sidebar.addEventListener("touchstart", function(e) {
    this._startY = e.touches[0].pageY;
    this._startScroll = this.scrollTop;
  }, { passive: false });

  sidebar.addEventListener("touchmove", function(e) {
    const y = e.touches[0].pageY;
    const dy = this._startY - y;
    const atTop = this.scrollTop === 0;
    const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight;
    if ((atTop && dy < 0) || (atBottom && dy > 0)) {
      e.preventDefault();
    }
  }, { passive: false });

  const firstItem = menuItems[0];
  firstItem.classList.add("active-menu-item");
  const firstSectionId = firstItem.getAttribute("data-target");
  sections.forEach(s => s.classList.add("hidden"));
  document.getElementById(firstSectionId).classList.remove("hidden");

  menuItems.forEach(item => {
    item.addEventListener("click", () => {
      const id = item.getAttribute("data-target");
      menuItems.forEach(i => i.classList.remove("active-menu-item"));
      item.classList.add("active-menu-item");
      sections.forEach(s => s.classList.add("hidden"));
      document.getElementById(id).classList.remove("hidden");
      if (isMobile()) closeSidebar();
    });
  });
});
