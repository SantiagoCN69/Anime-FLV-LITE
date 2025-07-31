import { observerAnimeCards, aplicarViewTransition } from './utils.js';
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
    const urlPart = anime.url.split('/').slice(2).join('/');
    div.innerHTML = `
    <a href="anime.html?id=${urlPart}" id="anime-${urlPart}">
    <div class="container-img">
      <img src="${anime.cover}" class="cover" alt="${anime.title}">
      <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
      <span class="estado">${anime.type}</span>
    </div>
    <strong>${anime.title}</strong>
    </a>`;
    div.addEventListener('click', () => {
      aplicarViewTransition(urlPart);
    });
    return div;
}


function centrarPaginacion() {
  const paginationContainer = document.getElementById('pagination-directorio');
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
const paginationContainer = document.getElementById('pagination-directorio');

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
  fetch(`https://backend-animeflv-lite.onrender.com/api/browse?${link}&page=${currentPage}`)
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
    const cachedData = null;
  
    const params = new URLSearchParams(window.location.search);
    if (params.has('genre[]')) {
      const genero = params.get('genre[]');
      
        const generoNormalizado = genero.replace(/\s+/g, '-');
        const botonGenero = document.getElementById(generoNormalizado);
        
        if (botonGenero) {
          botonGenero.classList.add('active');
          const generosActivos = Array.from(document.querySelectorAll('#filtro-genero .btn-filtro-opcion.active'));
          if (generosBtn && generosBtn.querySelector('span')) {
            generosBtn.querySelector('span').textContent = generosActivos.length > 0 ? `(${generosActivos.length})` : 'Todos';
          }
        }

      
      fetch(`https://backend-animeflv-lite.onrender.com/api/browse?order=default&genre[]=${genero}`)
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
      // Verificar si la caché corresponde a la página actual
      if (page === currentPage) {
        data.forEach(anime => {
          const card = crearAnimeCardResultados(anime);
          resultadosContainer.appendChild(card);
        });
        observerAnimeCards();
        updatePagination({ animes: data, PaginasTotales });

        //compara con la api para ver si hay cambios
        await fetch(`https://backend-animeflv-lite.onrender.com/api/browse?order=default&page=${currentPage}`)
        .then(response => response.json())
        .then(data => {
          const parsedCache = JSON.parse(cachedData);
          if (data.animes[0].title === parsedCache.data[0].title && data.animes[1].title === parsedCache.data[1].title) {
            //console.log('iguales');
            //console.log(data.animes[0].title);
            //console.log(parsedCache.data[0].title);
            return;
          } else {
            console.log('distintos');
            console.log(data.animes[0].title);
            console.log(parsedCache.data[0].title);
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
          console.error('Error en la petición:', error.message);
          console.error('Stack trace:', error.stack);
        });
      }
    }
    else {
      fetch(`https://backend-animeflv-lite.onrender.com/api/browse?order=default`)
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

    const orden = ordenesActivos.length > 0 ? ordenesActivos[0] : 'default';
    
    link += '&order=' + orden;

    return link;
}

generosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const generosActivos = Array.from(generosOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (generosActivos.length > 0) {
            generosBtn.querySelector('span').textContent = `(${generosActivos.length})`;
        } else {
            generosBtn.querySelector('span').textContent = 'Todos';
        }
        
        actualizarLinkBusqueda();
    });
});

anosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const anosActivos = Array.from(anosOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (anosActivos.length > 0) {
            anoBtn.querySelector('span').textContent = `(${anosActivos.length})`;
        } else {
            anoBtn.querySelector('span').textContent = 'Todos';
        }
        
        actualizarLinkBusqueda();
    });
});
tiposOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const tiposActivos = Array.from(tiposOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (tiposActivos.length > 0) {
            tipoBtn.querySelector('span').textContent = `(${tiposActivos.length})`;
        } else {
            tipoBtn.querySelector('span').textContent = 'Todos';
        }
        
        actualizarLinkBusqueda();
    });
});

estadosOpciones.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const estadosActivos = Array.from(estadosOpciones)
            .filter(btn => btn.classList.contains('active'));
        
        if (estadosActivos.length > 0) {
            estadoBtn.querySelector('span').textContent = `(${estadosActivos.length})`;
        } else {
            estadoBtn.querySelector('span').textContent = 'Todos';
        }
        
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

btnFiltrar.addEventListener('click', async () => {
    const link = actualizarLinkBusqueda();
    resultadosContainer.innerHTML = '<span class="span-carga">Cargando...</span>';
    
    try {
        const response = await fetch(link);
        const data = await response.json();
        
        resultadosContainer.innerHTML = '';
        
        const linkSolo = link.split('/browse?')[1]; 
        console.log(linkSolo);
        const fullUrl = "?Directorio" + linkSolo;
        history.pushState({}, '', fullUrl);
        
        
        if (data.animes && data.animes.length > 0) {
            data.animes.forEach(anime => {
                const card = crearAnimeCardResultados(anime);
                resultadosContainer.appendChild(card);
            });
            observerAnimeCards()
        } else {
            resultadosContainer.innerHTML = '<span class="span-carga">No se encontraron resultados</span>';
        }
        
        currentPage = 1; 
        updatePagination(data);
    } catch (error) {
        console.error('Error al cargar animes:', error);
        resultadosContainer.innerHTML = '<p>Error al cargar los animes</p>';
    }
});
const scrollContainer = document.querySelector('#pagination-directorio');

scrollContainer.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    scrollContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });


cargarAnimesConCache(); 
