import { db, auth } from './firebase-login.js';
import {collection, doc, getDocs, getDoc, updateDoc, setDoc, query, orderBy, limit} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { observerAnimeCards } from './utils.js';

let userID = localStorage.getItem('userID') || "null";

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

let favoritosCargados = false;
let viendoCargado = false;
let pendientesCargados = false;
let completadosCargados = false;
let ultimosCapsCargados = false;
let continuarViendoCargado = false;
let directorioCargado = false;
let labCargado = false;
let popularesCargados = false;

function mostrarSeccionDesdesearch() {
  console.log(window.location.search);
  let search = window.location.search;

  let id = decodeURIComponent(search.substring(1)) || 'Ultimos-Episodios';
  const seccion = document.getElementById(id);
  if (!seccion) {
    id = 'Ultimos-Episodios';
    history.replaceState(null, '', '?Ultimos-Episodios');
  };

  // Ocultar todas las secciones
  document.querySelectorAll(".content-section").forEach(sec => 
    sec.classList.toggle("hidden", sec.id !== id)
  );

  // Actualizar el menú activo
  document.querySelectorAll('.menu-item').forEach(item => 
    item.classList.toggle('active-menu-item', item.getAttribute('data-target') === id)
  );

switch(id) {
    case 'Mis-Favoritos':
      if (!favoritosCargados) {
        const DocRef = doc(db, "usuarios", userID, "favoritos", "lista");
        cargarDatos(document.getElementById('favoritos'), DocRef);
        favoritosCargados = true;
      }
      break;
    case 'Viendo':
      if (!viendoCargado) {
        const DocRef = doc(db, "usuarios", userID, "estados", "viendo");
        cargarDatos(document.getElementById('viendo'), DocRef);
        viendoCargado = true;
      }
      break;
    case 'Pendientes':
      if (!pendientesCargados) {
        const DocRef = doc(db, "usuarios", userID, "estados", "pendiente");
        cargarDatos(document.getElementById('pendientes'), DocRef);
        pendientesCargados = true;
      }
      break;
    case 'Completados':
      if (!completadosCargados) {
        const DocRef = doc(db, "usuarios", userID, "estados", "visto");
        cargarDatos(document.getElementById('completados'), DocRef);
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
    case 'Continuar-viendo':
      if (!continuarViendoCargado) {
        cargarContinuarViendo();
        continuarViendoCargado = true;
      }
      break;
    case 'Directorio':
      if (!directorioCargado) {
        cargarFetch("directorio");
        directorioCargado = true;
      }
      break;
    case 'Lab':
      if (!labCargado) {
        cargarFetch("lab");
        labCargado = true;
      }
      break;
    case "Populares" :
      if (!popularesCargados) {
        cargarFetch("populares");
        popularesCargados = true;
      }
      break;
}
document.querySelectorAll('.anime-card').forEach(el => el.classList.remove('show'));
observerAnimeCards();
}

window.addEventListener("DOMContentLoaded", () => {
  mostrarSeccionDesdesearch();
});
window.addEventListener("searchchange", () => {
  mostrarSeccionDesdesearch();
});

window.handlesearchChange = function () {
  let search = window.location.search.substring(1);

  if (!search) {
    search = 'Ultimos-Episodios';
    history.replaceState(null, '', '?' + search);
  }

  document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));

  const targetSection = document.getElementById(search);
  if (targetSection) {
    targetSection.classList.remove('hidden');

    const activeMenuItem = document.querySelector(`.menu-item[data-target="${search}"]`);
    if (activeMenuItem) {
      document.querySelectorAll('.menu-item').forEach(li => li.classList.remove('active'));
      activeMenuItem.classList.add('active');
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    cargarUltimosCapsVistos(),
  ])
  if(localStorage.getItem("ultimosCapsVistosCache_" + userID) === null) {
    document.getElementById("Continuar-viendo").innerHTML = '<span class="span-carga">Inicia sesión para ver los animes que estás viendo actualmente</span>'
  }
  const sidebarItems = document.querySelectorAll('.menu-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      history.replaceState(null, '', `?${targetId}`);
      mostrarSeccionDesdesearch();
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
    window.location.href = `ver.html?id=${itemData.id}&url=${itemData.siguienteCapitulo}`;
  });

  return btn;
}

async function cargarUltimosCapsVistos() {
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



  if (!userID || userID === "null") {
    ultimosCapsContainer.innerHTML = '<p>Inicia sesión para ver tus últimos capítulos</p>';
    return;
  }

  const cacheKey = `ultimosCapsVistosCache_` + userID;
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
    const ref = collection(doc(db, "usuarios", userID), "caps-vistos");
    const q = query(ref, orderBy('fechaAgregado', 'desc'), limit(8));
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
        .slice(0, 8); 

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
            id: cap.animeId,
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
    
    if (anime.siguienteCapitulo) {chapterHtml = `<span id="chapter">Episodio ${anime.siguienteCapitulo}</span>`;}
    if (anime.estado) {if (anime.estado === 'En emision') {estadoHtml = `<span class="estado"><img src="../icons/circle-solid-blue.svg" alt="${anime.estado}">${anime.estado}</span>`;}
      else {estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="${anime.estado}">${anime.estado}</span>`;}
    }
    if (anime.rating) {ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;}
    
    div.innerHTML = `
    <a href="anime.html?id=${anime.id}">
      <div class="container-img">
        <img src="${anime.portada}" class="cover" alt="${anime.titulo}">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        ${chapterHtml}
        ${estadoHtml}
        ${ratingHtml}
      </div>
      <strong>${anime.titulo}</strong>
    </a>`;
    
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
  try {
    if (!Array.isArray(data) || data.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    const dataToCache = data.slice(0, 20);
    localStorage.setItem(key, JSON.stringify(dataToCache));
  } catch (e) {
    console.error(`Error guardando cache (${key}):`, e);
    localStorage.removeItem(key);
  }
}

async function cargarUltimosCapitulos() {
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
        if(apiData.length > 0) {
        render(apiData);
        guardarCache(cacheKey, apiData);
        cached = apiData;
        }
        // Actualizar Firestore con los nuevos datos
        try {
          // Solo guardar en Firestore si hay datos
          if (apiData && apiData.length > 0) {
            const docRef = doc(db, 'ultimos-capitulos', docId);
            await setDoc(docRef, { 
              items: apiData,
              lastUpdated: new Date().toISOString()
            }, { merge: true });
          }
        } catch (firestoreError) {
          console.error('Error al actualizar Firestore:', firestoreError);
        }
      }
    } catch (err) {
      console.error('Error al obtener datos de la API:', err);
    }
}

async function cargarhistorial() {
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

function guardarCache2(key, data) {
  try {
    if (!data || !data.length) {
      localStorage.removeItem(key);
      console.log('No hay datos para guardar en caché');
      return;
    }
    // Guardar solo los primeros 3 para depuración
    const dataToCache = data.slice(0, 10);
    localStorage.setItem(key, JSON.stringify(dataToCache));
  } catch (e) {
    console.error('Error al guardar en caché:', e);
  }
}

function agregarAnimesAlContenedor(animes, contenedor) {
  const fragment = document.createDocumentFragment();
  animes.forEach(anime => {
      const card = createAnimeCard(anime);
      if (card) fragment.appendChild(card);
  });
  contenedor.appendChild(fragment);
  observerAnimeCards();
}

function manejarBotonVerMas(container, DocRef, hayMas, limite, offset, numAnimes) {
  const btnAnterior = container.querySelector('.ver-mas-btn');
  if (btnAnterior) {
    container.removeChild(btnAnterior);
  }

  if (hayMas) {
    const verMasBtn = document.createElement('button');
    verMasBtn.className = 'ver-mas-btn';
    verMasBtn.textContent = 'Ver más';
    verMasBtn.onclick = () => cargarDatos(container, DocRef, limite, offset + numAnimes);
    container.appendChild(verMasBtn);
  }
}

async function cargarDatos(container, DocRef, limite = 10, offset = 0) {
  if (!userID || userID === "null") {
    container.innerHTML = '<p>Inicia sesión para ver tus animes en ' + container.id + '</p>';
    return;
}
  const btnAnterior = container.querySelector('.ver-mas-btn');
  if (btnAnterior) {
    btnAnterior.textContent = "cargando...";
  }
  
  const h2 = document.querySelector('#' + container.id + 'h2');
  if (!userID || userID === "null") {
    container.innerHTML = '<p>Inicia sesión para ver tus animes en ' + container.id + '</p>';
    return;
}

  const cacheKey = `${container.id}Cache_${userID}`;
  const cachedData = leerCache(cacheKey);

  // Mostrar caché si es la primera carga
  if (cachedData && offset === 0) {
      agregarAnimesAlContenedor(cachedData, container);
      h2.dataset.text = "Disponibles: " + cachedData.length;
  }

  try {
      // Obtener lista de favoritos
      const Doc = await getDoc(DocRef);
      let titulos = Doc.exists() ? [...(Doc.data().animes || [])].filter(titulo => titulo != null).reverse() : [];
      h2.dataset.text = "Disponibles: " + titulos.length;

      if (titulos.length === 0) {
          container.innerHTML = '<p>No tienes animes en ' + container.id + '</p>';
          localStorage.removeItem(cacheKey);
          return;
      }

      // Verificar caché solo si es primera página
      if (offset === 0 && cachedData) {
          const ultimosTitulos = titulos.slice(0, limite).toString();
          const titulosCache = cachedData.map(a => a.id).slice(0, limite).toString();
          if (ultimosTitulos === titulosCache) {
              const hayMas = offset + limite < titulos.length;
              manejarBotonVerMas(container, DocRef, hayMas, limite, offset, cachedData.length);
              return;
          } 
        }
      // Obtener los IDs de los animes a buscar
      const idsABuscar = titulos.slice(offset, offset + limite);
      let animes = [];
      const idsNoEncontrados = [];
      
      // Obtener cada documento por su ID
      for (const id of idsABuscar) {
        const docSnap = await getDoc(doc(db, "datos-animes", id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          animes.push({
            id: docSnap.id,
            titulo: data.titulo,
            portada: data.portada || 'img/background.webp',
            estado: data.estado || 'No disponible',
            rating: data.rating || null
          });
        } else {
          console.log(`No se encontró el anime con ID: ${id} en datos-animes, se eliminará de la lista`);
          idsNoEncontrados.push(id);
        }
      }
      
      // Si hay IDs no encontrados, actualizar la lista del usuario
      if (idsNoEncontrados.length > 0) {
        const nuevosTitulos = titulos.filter(id => !idsNoEncontrados.includes(id));
        if (nuevosTitulos.length !== titulos.length) {
          try {
            await updateDoc(DocRef, { animes: nuevosTitulos });
            console.log(`Se eliminaron ${idsNoEncontrados.length} animes no encontrados de ${container.id}`);
          } catch (error) {
            console.error('Error al actualizar la lista de animes:', error);
          }
        }
      }
      // Actualizar caché si es primera página
      if (offset === 0) {
        const cacheAnimes = animes.slice(0, limite);
        const animesOrdenados = titulos
            .slice(0, limite)
            .map(id => cacheAnimes.find(a => a.id === id))
            .filter(Boolean);
        guardarCache2(cacheKey, animesOrdenados);
        container.innerHTML = '';
        agregarAnimesAlContenedor(animesOrdenados, container);
        manejarBotonVerMas(container, DocRef, offset + limite < titulos.length, limite, offset, animesOrdenados.length);
        return;
      }
      agregarAnimesAlContenedor(animes, container);
      manejarBotonVerMas(container, DocRef, offset + limite < titulos.length, limite, offset, animes.length);

  } catch (error) {
      console.error('Error al cargar favoritos:', error);
      container.innerHTML = '<p>Error al cargar los favoritos</p>';
  }
}

async function cargarContinuarViendo() {
  const container = document.getElementById('continuar-viendo');
  const h2 = document.getElementById('continuarviendoh2');
  const cachekey = "ultimosCapsVistosCache_" + userID;
  if (!container) return;
  container.innerHTML = '';
  if(localStorage.getItem(cachekey) === null) {
    return;
  }
   let datos = JSON.parse(localStorage.getItem(cachekey));
   datos.forEach(data => {
    container.appendChild(createAnimeCard(data));
    observerAnimeCards();
   })
   h2.dataset.text = "Disponibles: " + datos.length;
}

function cargarFetch(direccion) {
  const main = document.getElementById('main-' + direccion);
  if (!main) return;
  fetch(direccion + '.html')
    .then(res => res.text())
    .then(html => {
      const temp = document.createElement('div');
      temp.innerHTML = html;

      const nuevoMain = temp.querySelector('main');
      if (nuevoMain) {
        main.innerHTML = nuevoMain.innerHTML;
      }

      const script = document.createElement('script');
      script.src = '/scripts/' + direccion + '.js';
      script.type = 'module';
      document.body.appendChild(script);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  const sections = document.querySelectorAll(".content-section");

  const isMobile = () => window.innerWidth <= 600;

  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    menuBtn.classList.toggle("active");
  });

  let touchStartX = 0;
  let touchEndX = 0;
  const handleSwipe = () => {
    if (sidebar.classList.contains("active")) {
      const dist = touchStartX - touchEndX;
      if (dist > 50) {
        sidebar.classList.remove("active")
        menuBtn.classList.remove("active")
      }
    }
  };
  document.addEventListener("touchstart", e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  document.addEventListener("touchend", e => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, { passive: true });

  // Mapeo de navegación por gestos
  const navigationMap = {
    'Ultimos-Episodios': {
      left: 'Populares',
      right: null,
      targetId: 'navscroll1'
    },
    'Populares': {
      left: 'Continuar-viendo',
      right: 'Ultimos-Episodios',
      targetId: 'navscroll2'
    },
    'Continuar-viendo': {
      left: 'Directorio',
      right: 'Populares',
      targetId: 'navscroll3'
    },
    'Directorio': {
      left: 'Lab',
      right: 'Continuar-viendo',
      targetId: 'navscroll4'
    },
    'Lab': {
      left: null,
      right: 'Directorio',
      targetId: 'navscroll5'
    }
  };
 const excepciones = [
  '.pagination',
  '#recomendaciones-favoritos',
  '#recomendaciones-personalizadas',
 ]

  function handleSectionNavigation(sectionId, direction) {
    const targetSection = navigationMap[sectionId]?.[direction];
    if (!targetSection) return false;
  
    history.replaceState(null, '', `?${targetSection}`);
    mostrarSeccionDesdesearch();
  
    const contenedor = document.getElementById("indexpagination");
    const elemento = contenedor?.querySelector(`[data-target="${targetSection}"]`);
  
    if (contenedor && elemento) {
      const contRect = contenedor.getBoundingClientRect();
      const elRect = elemento.getBoundingClientRect();
  
      const scrollLeftActual = contenedor.scrollLeft;
      const distanciaCentro = (elRect.left - contRect.left) - (contRect.width / 2 - elRect.width / 2);
  
      contenedor.scrollTo({
        left: scrollLeftActual + distanciaCentro,
        behavior: 'smooth'
      });
    }
    return true;
  }
  
  // Función para verificar si un elemento está en las excepciones
  function isElementInExceptions(element) {
    if (!element) return false;
    return excepciones.some(selector => 
      element.closest && element.closest(selector) !== null
    );
  }

  // Función para manejar el inicio del toque
  function handleTouchStart(e) {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const targetElement = document.elementFromPoint(touchX, touchY);
    
    this._touchData = {
      startX: e.changedTouches[0].screenX,
      startY: e.changedTouches[0].screenY,
      isPagination: targetElement?.closest('#indexpagination') !== null,
      isException: isElementInExceptions(targetElement)
    };
  }

  // Función para manejar el fin del toque
  function handleTouchEnd(e) {
    // No hacer nada si es parte de la paginación o está en las excepciones
    if (this._touchData?.isPagination || this._touchData?.isException) return;
    
    const endX = e.changedTouches[0].screenX;
    const endY = e.changedTouches[0].screenY;
    const dx = endX - this._touchData.startX;
    const dy = Math.abs(endY - this._touchData.startY);
    
    // Determinar dirección del deslizamiento
    const direction = Math.abs(dx) > 50 && dy < 35 
      ? dx < 0 ? 'left' : 'right' 
      : null;
    
    if (!direction) return;
    
    const sectionId = this.id;
    
    // No navegar si la barra lateral está activa en ciertas condiciones
    if (sidebar.classList.contains('active') && 
        sectionId === 'Ultimos-Episodios' && 
        direction === 'left') return;
    
    // Manejar navegación o apertura de menú
    if (navigationMap[sectionId] && handleSectionNavigation(sectionId, direction)) {
      return;
    }
    
    // Abrir menú al deslizar a la derecha si no hay otra acción
    if (direction === 'right' && !sidebar.classList.contains('active') && isMobile()) {
      sidebar.classList.add('active');
      menuBtn.classList.add('active');
    }
  }

  // Configurar event listeners para cada sección
  sections.forEach(section => {
    section._touchData = {};
    section.addEventListener('touchstart', handleTouchStart, { passive: true });
    section.addEventListener('touchend', handleTouchEnd, { passive: true });
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
});


