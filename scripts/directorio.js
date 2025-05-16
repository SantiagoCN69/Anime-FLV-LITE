// constantes botones filtro
const btnFiltroGenero = document.getElementById('btn-filtro-genero');
const btnFiltroAno = document.getElementById('btn-filtro-ano');
const btnFiltroTipo = document.getElementById('btn-filtro-tipo');
const btnFiltroEstado = document.getElementById('btn-filtro-estado');
const btnFiltroOrden = document.getElementById('btn-filtro-orden');

// constantes filtros
const filtroGenero = document.getElementById('filtro-genero');
const filtroAno = document.getElementById('filtro-ano');
const filtroTipo = document.getElementById('filtro-tipo');
const filtroEstado = document.getElementById('filtro-estado');
const filtroOrden = document.getElementById('filtro-orden');

const filtros = [
    { btn: btnFiltroGenero, filtro: filtroGenero },
    { btn: btnFiltroAno, filtro: filtroAno },
    { btn: btnFiltroTipo, filtro: filtroTipo },
    { btn: btnFiltroEstado, filtro: filtroEstado },
    { btn: btnFiltroOrden, filtro: filtroOrden }
];

// eventos botones filtro
filtros.forEach(({ btn, filtro }) => {
    btn.addEventListener('click', (e) => {
        // Cerrar todos los filtros
        filtros.forEach(({ btn: otherBtn, filtro: otherFiltro }) => {
            if (otherBtn !== btn) {
                otherBtn.classList.remove('active');
                otherFiltro.classList.remove('active');
            }
        });
        
        // Alternar el filtro actual
        btn.classList.toggle('active');
        filtro.classList.toggle('active');
    });
});

// Cerrar filtros al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-filtro') && !e.target.closest('.filtro-opciones')) {
        filtros.forEach(({ btn, filtro }) => {
            btn.classList.remove('active');
            filtro.classList.remove('active');
        });
    }
});

// Evitar que los clics dentro del filtro lo cierren
filtros.forEach(({ filtro }) => {
    filtro.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});

// contador 
const contador = document.getElementById('contador');
let count = 100;
setInterval(() => {
    count--;
    contador.textContent = count + 's';
    if (count === 0) {
        initLoading.remove();
    }
}, 230);

// carga inicial 
const initLoading = document.getElementById('init-loading');
const resultadosContainer = document.getElementById('resultados');

function crearAnimeCardResultados(anime) {
    const div = document.createElement('div');
    div.className = 'anime-card';
    div.style.setProperty('--cover', `url(${anime.cover})`);
    div.innerHTML = `
    <div class="container-img">
      <img src="${anime.cover}" class="cover" alt="${anime.title}">
      <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
      <span class="estado">${anime.type}</span>
    </div>
    <strong>${anime.title}</strong>
    `;
    const urlPart = anime.url.split('/').slice(2).join('/');
    div.addEventListener('click', () => window.location.href = `anime.html?id=${urlPart}`);
    return div;
}
// Sistema de caché para animes
const CACHE_KEY = 'animes_cache';

// Inicializar elementos del DOM
console.log('Iniciando inicialización del DOM...');
const paginationContainer = document.getElementById('pagination');

console.log('Elementos del DOM:');
console.log('paginationContainer:', paginationContainer);

let currentPage = 1;
let totalPages = 1;

// Verificar si hay caché existente
const cachedData = localStorage.getItem(CACHE_KEY);
if (cachedData) {
    console.log('Caché encontrada:', JSON.parse(cachedData));
} else {
    console.log('No hay caché existente');
}

function updatePagination(data) {
  console.log('Datos recibidos para paginación:', data);
  
  // Intentar obtener el total de páginas de diferentes formas
  let paginasTotales = data.PaginasTotales;
  if (!paginasTotales) {
    console.log('No se encontró PaginasTotales');
    paginasTotales = 1; // Si no hay páginas totales, asumimos 1 página
  } else {
    console.log('PaginasTotales encontrado:', paginasTotales);
  }
  
  // Convertir a número
  totalPages = parseInt(paginasTotales);
  if (isNaN(totalPages)) {
    console.log('Error: PaginasTotales no es un número válido');
    totalPages = 1; 
  }
  
  console.log('Total de páginas final:', totalPages);
  paginationContainer.innerHTML = '';  
  
  // Crear botones de paginación
  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement('button');
    button.className = 'page-button';
    button.textContent = i;
    button.addEventListener('click', () => cambiarPagina(i));
    paginationContainer.appendChild(button);
  }
  
  // Actualizar el botón activo
  const buttons = paginationContainer.querySelectorAll('.page-button');
  buttons.forEach(button => {
    button.classList.toggle('active', parseInt(button.textContent) === currentPage);
  });
}

function cambiarPagina(page) {
  currentPage = page;
  cargarAnimesConCache();
}

function cargarAnimesConCache() {
  console.log('Iniciando carga de animes...');
  console.log('Página actual:', currentPage);
  
  // Mostrar caché existente
  const cachedData = localStorage.getItem(CACHE_KEY);
  if (cachedData) {
    const { data } = JSON.parse(cachedData);
    
    // Verificar si la caché tiene la página actual
    if (data.page === currentPage) {
      console.log('Usando caché para página:', currentPage);
      resultadosContainer.innerHTML = '';
      data.animes.forEach(anime => resultadosContainer.appendChild(crearAnimeCardResultados(anime)));
      updatePagination(data);
      return;
    }
  }

  // Hacer la petición a la API
  console.log('Haciendo petición a la API...');
  fetch(`https://backend-animeflv-lite.onrender.com/api/browse?order=default&page=${currentPage}`)
    .then(response => {
      console.log('Respuesta de la API:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('Datos recibidos:', data);
      
      // Actualizar la caché con la página actual
      localStorage.setItem(CACHE_KEY, JSON.stringify({ 
        data: data.animes,
        page: currentPage,
        PaginasTotales: data.PaginasTotales
      }));
      
      // Mostrar los datos
      resultadosContainer.innerHTML = '';
      data.animes.forEach(anime => resultadosContainer.appendChild(crearAnimeCardResultados(anime)));
      
      updatePagination(data);
    })
    .catch(error => {
      console.error('Error detallado:', error);
      console.error('Error en la petición:', error.message);
      console.error('Stack trace:', error.stack);
    });
}

// Cargar animes al inicio
cargarAnimesConCache();



// Sistema de filtros de género
const generosBtn = document.getElementById('btn-filtro-genero');
const generosOpciones = document.querySelectorAll('#filtro-genero .btn-filtro-opcion');
const btnFiltrar = document.getElementById('btn-filtrar');

// Sistema de filtros de año
const anoBtn = document.getElementById('btn-filtro-ano');
const anosOpciones = document.querySelectorAll('#filtro-ano .btn-filtro-opcion');

// Sistema de filtros de tipo
const tipoBtn = document.getElementById('btn-filtro-tipo');
const tiposOpciones = document.querySelectorAll('#filtro-tipo .btn-filtro-opcion');

// Sistema de filtros de estado
const estadoBtn = document.getElementById('btn-filtro-estado');
const estadosOpciones = document.querySelectorAll('#filtro-estado .btn-filtro-opcion');

// Sistema de filtros de orden
const ordenBtn = document.getElementById('btn-filtro-orden');
const ordenesOpciones = document.querySelectorAll('#filtro-orden .btn-filtro-opcion');

// Función para actualizar el link de búsqueda
function actualizarLinkBusqueda() {
    // Obtener los géneros activos
    const generosActivos = Array.from(generosOpciones)
        .filter(btn => btn.classList.contains('active'))
        .map(btn => btn.id);

    // Obtener los años activos
    const anosActivos = Array.from(document.querySelectorAll('#filtro-ano .btn-filtro-opcion'))
        .filter(btn => btn.classList.contains('active'))
        .map(btn => btn.id);

    // Obtener los tipos activos
    const tiposActivos = Array.from(document.querySelectorAll('#filtro-tipo .btn-filtro-opcion'))
        .filter(btn => btn.classList.contains('active'))
        .map(btn => btn.id);

    // Obtener los estados activos
    const estadosActivos = Array.from(document.querySelectorAll('#filtro-estado .btn-filtro-opcion'))
        .filter(btn => btn.classList.contains('active'))
        .map(btn => btn.id);

    // Obtener los ordenes activos
    const ordenesActivos = Array.from(document.querySelectorAll('#filtro-orden .btn-filtro-opcion'))
        .filter(btn => btn.classList.contains('active'))
        .map(btn => btn.id);

    // Construir el link
    let link = 'https://backend-animeflv-lite.onrender.com/api/browse?';
    
    // Agregar géneros si hay
    if (generosActivos.length > 0) {
        link += 'genre%5B%5D=' + generosActivos.join('&genre%5B%5D=');
    }

    // Agregar años si hay
    if (anosActivos.length > 0) {
        if (generosActivos.length > 0) link += '&'; // Agregar & si ya hay géneros
        link += 'year%5B%5D=' + anosActivos.join('&year%5B%5D=');
    }

    // Agregar tipos si hay
    if (tiposActivos.length > 0) {
        if (generosActivos.length > 0 || anosActivos.length > 0) link += '&'; // Agregar & si ya hay géneros o años
        link += 'type%5B%5D=' + tiposActivos.join('&type%5B%5D=');
    }

    // Agregar estados si hay
    if (estadosActivos.length > 0) {
        if (generosActivos.length > 0 || anosActivos.length > 0 || tiposActivos.length > 0) link += '&'; // Agregar & si ya hay géneros, años o tipos
        link += 'status%5B%5D=' + estadosActivos.join('&status%5B%5D=');
    }

    // Agregar orden al final
    const orden = ordenesActivos.length > 0 && (generosActivos.length > 0 || anosActivos.length > 0 || tiposActivos.length > 0 || estadosActivos.length > 0) 
        ? ordenesActivos[0] // Usar el primer orden seleccionado
        : 'default';
    
    link += '&order=' + orden;
    
    console.log('Link actual:', link);
    return link;
}

// Event listeners para los botones de género
generosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        // Alternar clase active
        btn.classList.toggle('active');
        
        // Actualizar el texto del botón principal
        const generosActivos = Array.from(generosOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (generosActivos.length > 0) {
            generosBtn.querySelector('span').textContent = `(${generosActivos.length})`;
        } else {
            generosBtn.querySelector('span').textContent = 'Todos';
        }
        
        // Actualizar el link
        actualizarLinkBusqueda();
    });
});

// Event listeners para los botones de año
anosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        // Alternar clase active
        btn.classList.toggle('active');
        
        // Actualizar el texto del botón principal
        const anosActivos = Array.from(anosOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (anosActivos.length > 0) {
            anoBtn.querySelector('span').textContent = `(${anosActivos.length})`;
        } else {
            anoBtn.querySelector('span').textContent = 'Todos';
        }
        
        // Actualizar el link
        actualizarLinkBusqueda();
    });
});

// Event listeners para los botones de tipo
tiposOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        // Alternar clase active
        btn.classList.toggle('active');
        
        // Actualizar el texto del botón principal
        const tiposActivos = Array.from(tiposOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (tiposActivos.length > 0) {
            tipoBtn.querySelector('span').textContent = `(${tiposActivos.length})`;
        } else {
            tipoBtn.querySelector('span').textContent = 'Todos';
        }
        
        // Actualizar el link
        actualizarLinkBusqueda();
    });
});

// Event listeners para los botones de estado
estadosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        // Alternar clase active
        btn.classList.toggle('active');
        
        // Actualizar el texto del botón principal
        const estadosActivos = Array.from(estadosOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (estadosActivos.length > 0) {
            estadoBtn.querySelector('span').textContent = `(${estadosActivos.length})`;
        } else {
            estadoBtn.querySelector('span').textContent = 'Todos';
        }
        
        // Actualizar el link
        actualizarLinkBusqueda();
    });
});
// Event listeners para los botones de orden
ordenesOpciones.forEach(btn => {
  btn.addEventListener('click', () => {
      // Desactivar todos los botones de orden
      ordenesOpciones.forEach(b => b.classList.remove('active'));
      
      // Activar solo el botón clickeado
      btn.classList.add('active');
      
      // Actualizar el texto del botón principal
      ordenBtn.querySelector('span').textContent = btn.textContent;
      
      // Actualizar el link
      actualizarLinkBusqueda();
  });
});

// Event listener para el botón filtrar
btnFiltrar.addEventListener('click', async () => {
    // Obtener el link actualizado
    const link = actualizarLinkBusqueda();
    // Limpiar el contenedor de resultados
    resultadosContainer.innerHTML = '';
    
    try {
        const response = await fetch(link);
        const data = await response.json();
        
        // Mostrar los resultados
        resultadosContainer.innerHTML = '';
        
        data.animes.forEach(anime => {
            const card = crearAnimeCardResultados(anime);
            resultadosContainer.appendChild(card);
        });
        
        // Actualizar la paginación
        currentPage = 1; // Reiniciar a la página 1 cuando se filtra
        updatePagination(data);
    } catch (error) {
        console.error('Error al cargar animes:', error);
        resultadosContainer.innerHTML = '<p>Error al cargar los animes</p>';
    }
});





//sidebar
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const swipeThreshold = 50;
const verticalThreshold = 50;

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

window.addEventListener('scroll', () => {
  if (window.innerWidth < 600) {
    if (sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
    }
  }
});

document.addEventListener('click', (event) => {
  const isClickInsideSidebar = sidebar.contains(event.target);
  const isClickOnMenuToggle = menuToggle.contains(event.target);

  if (!isClickInsideSidebar && !isClickOnMenuToggle && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
  }
});

document.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0].screenX;
  touchStartY = event.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', (event) => {
  touchEndX = event.changedTouches[0].screenX;
  touchEndY = event.changedTouches[0].screenY;
  handleSwipeGesture();
}, { passive: true });

function handleSwipeGesture() {
  const swipeDistanceX = touchEndX - touchStartX;
  const swipeDistanceY = Math.abs(touchEndY - touchStartY);
  const isSwipeRight = swipeDistanceX > swipeThreshold;
  const isSwipeLeft = swipeDistanceX < -swipeThreshold;

  if (isSwipeRight && !sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold) {
    if (window.innerWidth <= 600) {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        function checkScrollAndOpen() {
          if (window.scrollY === 0) {
            sidebar.classList.add('active');
          } else {
            requestAnimationFrame(checkScrollAndOpen);
          }
        }
        requestAnimationFrame(checkScrollAndOpen);
      } else {
        sidebar.classList.add('active');
      }
    } else {
      sidebar.classList.add('active');
    }
  } else if (isSwipeLeft && sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold) {
    sidebar.classList.remove('active');
  }
}


import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let userid = null;
onAuthStateChanged(auth, (user) => {
  if (user) {
    userid = user.uid;
  } else {
    userid = null;
  }
});

function crearElementoSiguienteCapitulo({ portada, titulo, siguienteCapitulo, animeId }) {
  const btn = document.createElement('div');
  btn.className = 'btn-siguiente-capitulo';

  const img = document.createElement('img');
  img.src = portada;
  img.alt = titulo;
  img.className = 'portada-anime';
  img.onerror = () => {
    img.src = 'path/to/default/image.png';
  };

  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  contenedorTexto.innerHTML = `
    <span class="texto-2-lineas">${titulo}</span>
    <span class="texto-episodio">Ep. ${siguienteCapitulo}</span>
  `;

  btn.append(img, contenedorTexto);
  btn.addEventListener('click', () => {
    window.location.href = `ver.html?animeId=${animeId}&url=${encodeURIComponent(siguienteCapitulo)}`;
  });

  return btn;
}

async function cargarUltimosCapsVistos() {
  const container = document.getElementById('ultimos-caps-viendo');
  if (!container) return;

  const renderizar = (datos) => {
    container.innerHTML = '';
    if (!datos?.length) {
      container.innerHTML = '<p>No tienes capítulos siguientes disponibles.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(data => fragment.appendChild(crearElementoSiguienteCapitulo(data)));
    container.appendChild(fragment);
  };

  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    container.innerHTML = '<p>Inicia sesión para ver tus últimos capítulos</p>';
    return;
  }

  const cacheKey = `ultimosCapsVistosCache_${user.uid}`;
  let cachedData = null;

  try {
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      cachedData = JSON.parse(cache);
      if (Array.isArray(cachedData)) renderizar(cachedData);
      else localStorage.removeItem(cacheKey);
    }
  } catch (e) {
    console.error("Error al leer caché:", e);
    localStorage.removeItem(cacheKey);
  }

  try {
    const ref = collection(doc(db, "usuarios", user.uid), "caps-vistos");
    const snap = await getDocs(ref);

    if (snap.empty) return;

    const capVistos = snap.docs.map(docSnap => ({
      animeId: docSnap.id,
      ...docSnap.data()
    })).sort((a, b) => new Date(b.fechaAgregado?.toDate?.() || 0) - new Date(a.fechaAgregado?.toDate?.() || 0))
      .slice(0, 10);

    const animeRefs = capVistos.map(cap => doc(db, "datos-animes", cap.animeId));
    const animeDocs = await Promise.all(animeRefs.map(getDoc));

    const animeMap = {};
    animeDocs.forEach((docSnap, i) => {
      if (docSnap.exists()) animeMap[capVistos[i].animeId] = docSnap.data();
    });

    const freshData = capVistos.map(cap => {
      const anime = animeMap[cap.animeId];
      if (!anime?.portada || !anime?.titulo || !anime?.episodios) return null;

      const sigCapNum = Math.max(...(cap.episodiosVistos || []).map(Number), 0) + 1;
      const sigCap = Object.values(anime.episodios).find(ep => ep.number === sigCapNum);
      if (!sigCap?.url) return null;

      return {
        animeId: cap.animeId,
        portada: anime.portada,
        titulo: anime.titulo,
        siguienteCapitulo: sigCapNum,
        siguienteEpisodioUrl: sigCap.url
      };
    }).filter(Boolean);

    const freshStr = JSON.stringify(freshData);
    const cacheStr = JSON.stringify(cachedData);

    if (freshStr !== cacheStr) {
      renderizar(freshData);
      localStorage.setItem(cacheKey, freshStr);
    }
  } catch (error) {
    console.error('Error al cargar datos desde Firestore:', error);
    if (cachedData === null) container.innerHTML = '<p>Error al cargar últimos capítulos</p>';
  }
}

window.addEventListener('DOMContentLoaded', cargarUltimosCapsVistos);
