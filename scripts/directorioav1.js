import { observerAnimeCards, aplicarViewTransition } from './utils.js';

const valorFiltroav1 = (btn) => btn.id.replace(/-av1$/, '');

// constantes botones filtro
const btnFiltroGenero = document.getElementById('btn-filtro-genero-av1');

const btnFiltroTipo = document.getElementById('btn-filtro-tipo-av1');
const btnFiltroEstado = document.getElementById('btn-filtro-estado-av1');
const btnFiltroOrden = document.getElementById('btn-filtro-orden-av1');

// constantes filtros
const filtroGenero = document.getElementById('filtro-genero-av1');

const filtroTipo = document.getElementById('filtro-tipo-av1');
const filtroEstado = document.getElementById('filtro-estado-av1');
const filtroOrden = document.getElementById('filtro-orden-av1');

const filtros = [
    { btn: btnFiltroGenero, filtro: filtroGenero },

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
const contador = document.getElementById('contador-av1');
let count = 100;
setInterval(() => {
    count--;
    contador.textContent = count + 's';
    if (count === 0) {
        initLoading.remove();
    }
}, 230);

// carga inicial 
const initLoading = document.getElementById('init-loading-av1');
const resultadosContainer = document.getElementById('resultados-av1');

function crearAnimeCardResultados(anime) {
console.log(anime);

    const coverImage = anime.cover || anime.image || 'img/loading.png';
    const div = document.createElement('div');
    div.className = 'anime-card';
    div.style.setProperty('--cover', `url(${coverImage})`);
    let urlPart;
    if (anime.url) {
        const urlParts = anime.url.replace(/\/$/, '').split('/');
        urlPart = urlParts[urlParts.length - 1];
    } else {
        urlPart = anime.id || anime.title?.toLowerCase().replace(/\s+/g, '-');
    }
    div.innerHTML = `
    <a href="anime.html?id=${urlPart}" id="anime-${urlPart}">
    <div class="container-img">
      <img src="${coverImage}" class="cover" alt="${anime.title}">
      <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
      <span class="estado">${anime.type || ''}</span>
    </div>
    <strong>${anime.title}</strong>
    </a>`;
    div.addEventListener('click', () => {
      aplicarViewTransition(urlPart);
    });
    return div;
}


function centrarPaginacion() {
  const paginationContainer = document.getElementById('pagination-directorio-av1');
  const botones = paginationContainer.querySelectorAll('button');
  const botonActual = botones[currentPage - 1];

  if (botonActual) {
    const offsetLeft = botonActual.offsetLeft;
    const botonWidth = botonActual.offsetWidth;
    const containerWidth = paginationContainer.offsetWidth;

    const scrollLeft = offsetLeft - (containerWidth / 2) + (botonWidth / 2);
    paginationContainer.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
  }
}



// Sistema de caché para animes
localStorage.removeItem("animes_cache");


const CACHE_KEY = 'animes_cache_directorio';

// Inicializar elementos del DOM
const paginationContainer = document.getElementById('pagination-directorio-av1');

let currentPage = 1;
let totalPages = 1;


function updatePagination(data) {
  
  let paginasTotales = data.PaginasTotales;
  if (!paginasTotales) {
    paginasTotales = 1;
  } 
  
  // Convertir a número
  totalPages = parseInt(paginasTotales);
  if (isNaN(totalPages)) {
    totalPages = 1; 
  }
  
  paginationContainer.innerHTML = '';  
  
  // Crear botones de paginación
  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement('button');
    button.className = 'page-button';
    button.textContent = i;
    button.addEventListener('click', () => cambiarPagina(i));
    paginationContainer.appendChild(button);
  }
  centrarPaginacion();
  // Actualizar el botón activo
  const buttons = paginationContainer.querySelectorAll('.page-button');
  buttons.forEach(button => {
    button.classList.toggle('active', parseInt(button.textContent) === currentPage);
  });
}

function cambiarPagina(page) {
  currentPage = page;
  const link = window.location.search.substring(1);
  resultadosContainer.innerHTML = `<span class="span-carga">Cargando servidores...</span>`;
  fetch(`https://backend-animeflv-lite.onrender.com/api/browse?source=animeav1&${link}&page=${currentPage}`)
    .then(response => {
      return response.json();
    })
    .then(data => {
      resultadosContainer.innerHTML = '';
      data.animes.forEach(anime => {
        const card = crearAnimeCardResultados(anime);
        resultadosContainer.appendChild(card);
        observerAnimeCards();
      });
      updatePagination(data);
    })
    .catch(error => {
      console.error('Error detallado:', error);
      console.error('Error en la petición:', error.message);
      console.error('Stack trace:', error.stack);
    });
}

async function cargarAnimesConCache() {
    const cachedData = localStorage.getItem(CACHE_KEY);
  
    const params = new URLSearchParams(window.location.search);
    if (params.has('genre[]')) {
      const genero = params.get('genre[]');
      
        const generoNormalizado = `${genero.replace(/\s+/g, '-')}-av1`;
        const botonGenero = document.getElementById(generoNormalizado);
        
        if (botonGenero) {
          botonGenero.classList.add('active');
          const generosActivos = Array.from(document.querySelectorAll('#filtro-genero-av1 .btn-filtro-opcion.active'));
          if (generosBtn && generosBtn.querySelector('span')) {
            generosBtn.querySelector('span').textContent = generosActivos.length > 0 ? `(${generosActivos.length})` : 'Todos';
          }
        }

      
      fetch(`https://backend-animeflv-lite.onrender.com/api/browse?source=animeav1&order=default&genre[]=${genero}`)
      .then(response => response.json())
      .then(data => {
        resultadosContainer.innerHTML = '';
        data.animes.forEach(anime => {
          const card = crearAnimeCardResultados(anime);
          resultadosContainer.appendChild(card);
        });
        observerAnimeCards();
        updatePagination(data);
      })
      .catch(error => {
        console.error('Error detallado:', error);
        console.error('Error en la petición:', error.message);
        console.error('Stack trace:', error.stack);
      });
    }
    else {
      
    resultadosContainer.innerHTML = '<span class="span-carga">Cargando...</span>';

    if (cachedData) {
      const { data, page, PaginasTotales } = JSON.parse(cachedData);
      if (page === currentPage) {
        resultadosContainer.innerHTML = '';
        data.forEach(anime => {
          const card = crearAnimeCardResultados(anime);
          resultadosContainer.appendChild(card);
        });
        observerAnimeCards();
        updatePagination({ animes: data, PaginasTotales });

        //compara con la api para ver si hay cambios

        await fetch(`https://backend-animeflv-lite.onrender.com/api/browse?source=animeav1&order=default&page=${currentPage}`)
        .then(response => response.json())
        .then(data => {
          const parsedCache = JSON.parse(cachedData);
          
          // Validamos de forma segura si ambas fuentes tienen información
          const hayDatosNuevos = data && data.animes && data.animes.length > 0;
          const hayDatosViejos = parsedCache && parsedCache.data && parsedCache.data.length > 0;

          // Si ambos tienen datos y el primero coincide, todo está al día
          if (hayDatosNuevos && hayDatosViejos && data.animes[0].title === parsedCache.data[0].title) {
              return; // Son iguales, no hacemos nada
          }
          
          // Si llegamos a esta línea, es porque la caché está vieja o vacía. Actualizamos.
          if (hayDatosNuevos) {
            console.log('Cambios detectados. Actualizando la pantalla y la caché...');
            
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              data: data.animes,
              page: currentPage,
              PaginasTotales: data.PaginasTotales
            }));
      
            resultadosContainer.innerHTML = '';
            data.animes.forEach(anime => {
              const card = crearAnimeCardResultados(anime);
              resultadosContainer.appendChild(card);
            });
            
            observerAnimeCards();
            updatePagination(data);
          }
        })
        .catch(error => {
          console.error('Error detallado:', error);
        });
      }
    }
    else {
      fetch(`https://backend-animeflv-lite.onrender.com/api/browse?source=animeav1&order=default`)
      .then(response => response.json())
      .then(data => {
        resultadosContainer.innerHTML = '';
        data.animes.forEach(anime => {
          const card = crearAnimeCardResultados(anime);
          resultadosContainer.appendChild(card);
        });
        observerAnimeCards();
        updatePagination(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: data.animes,
          page: currentPage,
          PaginasTotales: data.PaginasTotales
        }));
      })
      .catch(error => {
        console.error('Error detallado:', error);
        console.error('Error en la petición:', error.message);
        console.error('Stack trace:', error.stack);
      });
    }
  }
}

const generosBtn = document.getElementById('btn-filtro-genero-av1');
const generosOpciones = document.querySelectorAll('#filtro-genero-av1 .btn-filtro-opcion');
const btnFiltrar = document.getElementById('btn-filtrar-av1');

const anoBtn = document.getElementById('btn-filtro-ano-av1');
const anosOpciones = document.querySelectorAll('#filtro-ano-av1 .btn-filtro-opcion');

const tipoBtn = document.getElementById('btn-filtro-tipo-av1');
const tiposOpciones = document.querySelectorAll('#filtro-tipo-av1 .btn-filtro-opcion');

const estadoBtn = document.getElementById('btn-filtro-estado-av1');
const estadosOpciones = document.querySelectorAll('#filtro-estado-av1 .btn-filtro-opcion');

const ordenBtn = document.getElementById('btn-filtro-orden-av1');
const ordenesOpciones = document.querySelectorAll('#filtro-orden-av1 .btn-filtro-opcion');

// --- Lógica del Slider Doble de Años ---
const inputMinAno = document.getElementById('ano-min');
const inputMaxAno = document.getElementById('ano-max');
const valMinAno = document.getElementById('ano-min-val');
const valMaxAno = document.getElementById('ano-max-val');

function actualizarTextosSlider() {
    let min = parseInt(inputMinAno.value);
    let max = parseInt(inputMaxAno.value);
    
    if (min > max) {
        let temp = min;
        min = max;
        max = temp;
    }
    valMinAno.textContent = min;
    valMaxAno.textContent = max;
}

if (inputMinAno && inputMaxAno) {
    inputMinAno.addEventListener('input', actualizarTextosSlider);
    inputMaxAno.addEventListener('input', actualizarTextosSlider);
}

// --- Función para construir la URL ---
function actualizarLinkBusqueda() {
    const params = new URLSearchParams();

    // 1. Letras
    const letraActiva = document.querySelector('.btn-letra.active');
    if (letraActiva) {
        params.append('letter', letraActiva.dataset.letra);
    }

    // 2. Años desde el Slider
    if (inputMinAno && inputMaxAno) {
        let minYear = parseInt(inputMinAno.value);
        let maxYear = parseInt(inputMaxAno.value);
        if (minYear > maxYear) [minYear, maxYear] = [maxYear, minYear];
        
        if (minYear !== 1990 || maxYear !== 2025) {
            params.append('minYear', minYear);
            params.append('maxYear', maxYear);
        }
    }

    // 3. Géneros
    const generosActivos = Array.from(generosOpciones).filter(btn => btn.classList.contains('active')).map(valorFiltroav1);
    if (generosActivos.length > 0) generosActivos.forEach(g => params.append('genre', g));

    // 4. Tipos
    const mapaTipos = { 'tv': 'tv', 'movie': 'pelicula', 'special': 'especial', 'ova': 'ova' };
    const tiposActivos = Array.from(document.querySelectorAll('#filtro-tipo-av1 .btn-filtro-opcion')).filter(btn => btn.classList.contains('active')).map(btn => mapaTipos[valorFiltroav1(btn)] || valorFiltroav1(btn));
    if (tiposActivos.length > 0) tiposActivos.forEach(t => params.append('category', t));

    // 5. Estados
    const mapaEstados = { '1': 'emision', '2': 'finalizado', '3': 'proximamente' };
    const estadosActivos = Array.from(document.querySelectorAll('#filtro-estado-av1 .btn-filtro-opcion')).filter(btn => btn.classList.contains('active')).map(btn => mapaEstados[valorFiltroav1(btn)] || valorFiltroav1(btn));
    if (estadosActivos.length > 0) estadosActivos.forEach(e => params.append('status', e));

    // 6. Orden
    const mapaOrden = { 'default': '', 'updated': 'updated', 'added': 'added', 'title': 'title', 'rating': 'score' };
    const ordenesActivos = Array.from(document.querySelectorAll('#filtro-orden-av1 .btn-filtro-opcion')).filter(btn => btn.classList.contains('active')).map(btn => mapaOrden[valorFiltroav1(btn)] !== undefined ? mapaOrden[valorFiltroav1(btn)] : valorFiltroav1(btn));
    if (ordenesActivos.length > 0 && ordenesActivos[0] !== '') params.append('order', ordenesActivos[0]);

    return `https://backend-animeflv-lite.onrender.com/api/browse?source=animeav1&${params.toString()}`;
}

// --- Función central para ejecutar la búsqueda ---
async function ejecutarBusqueda() {
    const link = actualizarLinkBusqueda();
    resultadosContainer.innerHTML = '<span class="span-carga">Cargando...</span>';
    
    try {
        const response = await fetch(link);
        const data = await response.json();
        resultadosContainer.innerHTML = '';
        
        const linkSolo = link.split('/browse?')[1]; 
        linkSolo && history.pushState({}, '', '?Directorio&' + linkSolo);
        
        if (data.animes && data.animes.length > 0) {
            data.animes.forEach(anime => {
                const card = crearAnimeCardResultados(anime);
                resultadosContainer.appendChild(card);
            });
            observerAnimeCards();
        } else {
            resultadosContainer.innerHTML = '<span class="span-carga">No se encontraron resultados</span>';
        }
        
        currentPage = 1; 
        updatePagination(data);
    } catch (error) {
        console.error('Error al cargar animes:', error);
        resultadosContainer.innerHTML = '<p>Error al cargar los animes</p>';
    }
}

// --- Actualización visual de los botones de filtro ---
generosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const activos = Array.from(generosOpciones).filter(b => b.classList.contains('active'));
        generosBtn.querySelector('span').textContent = activos.length > 0 ? `(${activos.length})` : 'Todos';
        actualizarLinkBusqueda();
    });
});

tiposOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const activos = Array.from(tiposOpciones).filter(b => b.classList.contains('active'));
        tipoBtn.querySelector('span').textContent = activos.length > 0 ? `(${activos.length})` : 'Todos';
        actualizarLinkBusqueda();
    });
});

estadosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const activos = Array.from(estadosOpciones).filter(b => b.classList.contains('active'));
        estadoBtn.querySelector('span').textContent = activos.length > 0 ? `(${activos.length})` : 'Todos';
        actualizarLinkBusqueda();
    });
});

ordenesOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        ordenesOpciones.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ordenBtn.querySelector('span').textContent = btn.textContent;
        actualizarLinkBusqueda();
    });
});

// --- Eventos de Búsqueda (Botón y Letras) ---
btnFiltrar.addEventListener('click', ejecutarBusqueda);

const botonesLetras = document.querySelectorAll('.btn-letra');
botonesLetras.forEach(btn => {
    btn.addEventListener('click', () => {
        const estabaActivo = btn.classList.contains('active');
        botonesLetras.forEach(b => b.classList.remove('active'));
        if (!estabaActivo) btn.classList.add('active');
        ejecutarBusqueda(); // Búsqueda automática al presionar letra
    });
});

// --- Eventos extras y Carga Inicial ---
const scrollContainer = document.querySelector('#pagination-directorio-av1');
if (scrollContainer) {
    scrollContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            scrollContainer.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

import { mostrarSeccionDesdesearch } from './index.js';

document.getElementById('btn-fuente-directorio-av1').addEventListener('click', () => {
   history.replaceState(null, '', `?DirectorioJK`);
   mostrarSeccionDesdesearch();
});

cargarAnimesConCache();