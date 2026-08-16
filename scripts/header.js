import { observerAnimeCards } from './utils.js';
import { IA_SECTION_HTML, attachIaGridWheelScroll, loadIaRecommendationsIntoGrid } from './ai-recommendations.js';

// === UTILIDADES ===
function normalizarTexto(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '');
}

function mostrarMensajeError(container, mensaje) {
  if (!container) return;
  container.classList.remove('sin-resultados');
  container.innerHTML = `<span class="no-results">${mensaje}</span>`;
}

function setDisplay(element, value) {
  if (element) {
    element.style.display = value;
  }
}

function limpiarVistaAnimePage() {
  setDisplay(animeDetails, 'grid');
  if (mainContainer) {
    mainContainer.innerHTML = '';
    mainContainer.style.display = 'none';
    mainContainer.classList.remove('sin-resultados');
  }
  limpiarSeccionIA();
  setDisplay(disqusThread, 'block');
  setDisplay(relacionados, 'flex');
  setDisplay(verAnime, 'flex');
  setDisplay(mainLab, 'flex');
}

function limpiarSeccionIA() {
  if (currentIaController) {
    currentIaController.abort();
    currentIaController = null;
  }
  document.querySelectorAll('#recomendaciones-ia-busqueda').forEach(el => el.remove());
}

function limpiarVistaIndexPage(loadingSpan, contadorSpan, seccionResultados, resultadosContainer) {
  if (loadingSpan) loadingSpan.style.display = 'none';
  if (contadorSpan) contadorSpan.textContent = '';
  if (seccionResultados) seccionResultados.classList.add('hidden');
  if (resultadosContainer) {
    resultadosContainer.innerHTML = '';
    resultadosContainer.classList.remove('sin-resultados');
  }
  limpiarSeccionIA();
  handlesearchChange();
}

// === VARIABLES ===
const pathname = location.pathname;
const isAnimePage = pathname.endsWith('/anime.html') || pathname.endsWith('anime.html');
const isVerPage = pathname.endsWith('/ver.html') || pathname.endsWith('ver.html');
const isDirectorioPage = pathname.includes('/directorio');
const isLabPage = pathname.includes('/Recomendaciones');
const isIndexPage = pathname === '/' || pathname.endsWith('/index.html');
const mainContainer = document.getElementById('main');
const animeDetails = document.querySelector('.anime-details');
const verAnime = document.getElementById('main-ver');
const mainLab = document.getElementById('main-Recomendaciones');
const sidebar = document.querySelector('.sidebar');
const menuBtn = document.getElementById('menu-toggle');
const disqusThread = document.getElementById('disqus_thread');
const relacionados = document.getElementById('relacionados');

// === SEARCH UI ===
const btnSearch = document.getElementById('btn-search');
if (btnSearch) {
  btnSearch.addEventListener('click', () => {
    document.querySelector('header')?.classList.add('search-active');
    const input = document.getElementById('busqueda');
    if (input) input.focus();
    if (sidebar) sidebar.classList.remove('active');
    if (menuBtn) menuBtn.classList.remove('active');
  });
}

const btnCloseSearch = document.getElementById('btn-close-search');
if (btnCloseSearch) {
  btnCloseSearch.addEventListener('click', () => {
    document.querySelector('header')?.classList.remove('search-active');
    const input = document.getElementById('busqueda');
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input'));
  });
}

// === BÚSQUEDAS RECIENTES ===
function guardarBusquedaReciente(anime) {
  const coverImage = anime.cover || anime.image || 'img/loading.png';
  let animeId = anime.id;
  if (!animeId && anime.url) {
    const urlParts = anime.url.replace(/\/$/, '').split('/');
    animeId = urlParts[urlParts.length - 1];
  }
  if (!animeId) {
    animeId = anime.title?.toLowerCase().replace(/\s+/g, '-');
  }
  
  const busquedas = JSON.parse(localStorage.getItem('busquedas_recientes') || '[]');
  const nuevaBusqueda = { 
    id: animeId, 
    title: anime.title || anime.name || '', 
    cover: coverImage,
    type: anime.type || ''
  };
  
  const filtrado = busquedas.filter(b => b.id !== animeId);
  filtrado.unshift(nuevaBusqueda);
  
  if (filtrado.length > 5) filtrado.pop();
  
  localStorage.setItem('busquedas_recientes', JSON.stringify(filtrado));
}

function eliminarBusquedaReciente(animeId, event) {
  event.preventDefault();
  event.stopPropagation();
  
  const busquedas = JSON.parse(localStorage.getItem('busquedas_recientes') || '[]');
  const filtrado = busquedas.filter(b => b.id !== animeId);
  localStorage.setItem('busquedas_recientes', JSON.stringify(filtrado));
  
  renderizarBusquedasRecientes();
}

function eliminarTodasBusquedas(event) {
  event.preventDefault();
  event.stopPropagation();
  
  localStorage.setItem('busquedas_recientes', '[]');
  
  renderizarBusquedasRecientes();
}

function renderizarBusquedasRecientes() {
  const busquedas = JSON.parse(localStorage.getItem('busquedas_recientes') || '[]');
  const input = document.getElementById('busqueda');
  if (!input || busquedas.length === 0) return;
  
  let dropdown = document.getElementById('busquedas-recientes-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'busquedas-recientes-dropdown';
    dropdown.className = 'busquedas-recientes-dropdown';
    input.parentElement.appendChild(dropdown);
  }
  
  dropdown.innerHTML = `
    <div class="busquedas-titulo">
    <div>
      <svg width="16" height="16" viewBox="0 0 69 69" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_36_2)">
          <path d="M32.8226 65.4026C32.8226 64.7294 33.0928 64.0837 33.5736 63.6077C34.0545 63.1316 34.7067 62.8642 35.3867 62.8642C41.8358 62.8643 48.0902 60.6763 53.1076 56.6649C58.1249 52.6535 61.6022 47.061 62.9598 40.8194C64.3175 34.5777 63.4735 28.0639 60.5686 22.3636C57.6637 16.6632 52.8733 12.1206 46.9958 9.49278C41.1182 6.86493 34.5085 6.31058 28.2682 7.92212C22.0279 9.53366 16.5339 13.2137 12.7018 18.3491C8.86966 23.4844 6.93093 29.7648 7.20866 36.1436C7.48639 42.5224 9.96381 48.6143 14.2281 53.4042V44.4789C14.2281 43.8057 14.4982 43.16 14.9791 42.684C15.4599 42.2079 16.1121 41.9405 16.7921 41.9405C17.4721 41.9405 18.1243 42.2079 18.6052 42.684C19.086 43.16 19.3562 43.8057 19.3562 44.4789V58.8399C19.3562 59.1735 19.2897 59.5039 19.1607 59.8121C19.0316 60.1203 18.8424 60.4002 18.604 60.636C18.3655 60.8718 18.0825 61.0587 17.771 61.186C17.4595 61.3134 17.1257 61.3788 16.7887 61.3783H2.28635C1.60632 61.3783 0.954142 61.1109 0.473287 60.6348C-0.00756833 60.1588 -0.27771 59.5131 -0.27771 58.8399C-0.27771 58.1666 -0.00756833 57.5209 0.473287 57.0449C0.954142 56.5688 1.60632 56.3014 2.28635 56.3014H9.97855C5.06314 50.5692 2.27249 43.3469 2.0686 35.8303C1.86471 28.3138 4.25981 20.9537 8.85738 14.9685C13.4549 8.98338 19.9793 4.73215 27.3502 2.91864C34.7211 1.10513 42.4965 1.83811 49.3893 4.99623C56.282 8.15434 61.8787 13.5482 65.2527 20.2848C68.6267 27.0214 69.5757 34.6968 67.9426 42.0402C66.3095 49.3836 62.1922 55.9546 56.2724 60.6654C50.3526 65.3762 42.9852 67.9443 35.3901 67.9445C35.0528 67.9449 34.7188 67.8795 34.4071 67.7519C34.0954 67.6243 33.8121 67.4371 33.5736 67.201C33.3351 66.9648 33.146 66.6845 33.0172 66.3759C32.8883 66.0673 32.8222 65.7365 32.8226 65.4026ZM42.6516 49.1091L33.5679 40.1229C33.0874 39.6457 32.817 38.9996 32.8158 38.3257V20.7257C32.8158 20.0525 33.0859 19.4068 33.5668 18.9307C34.0477 18.4547 34.6998 18.1872 35.3799 18.1872C36.0599 18.1872 36.7121 18.4547 37.1929 18.9307C37.6738 19.4068 37.9439 20.0525 37.9439 20.7257V37.2731L46.272 45.518C46.5168 45.7523 46.712 46.0325 46.8462 46.3422C46.9805 46.652 47.051 46.9851 47.0538 47.3222C47.0566 47.6593 46.9916 47.9935 46.8625 48.3054C46.7334 48.6173 46.5429 48.9006 46.3021 49.1389C46.0612 49.3771 45.7748 49.5654 45.4597 49.6929C45.1445 49.8204 44.8068 49.8845 44.4664 49.8814C44.1259 49.8783 43.7895 49.8081 43.4767 49.6749C43.164 49.5418 42.8811 49.3483 42.6447 49.1057L42.6516 49.1091Z" fill="currentColor"/>
        </g>
        <defs>
          <clipPath id="clip0_36_2">
            <rect width="68.89" height="68.89" fill="white"/>
          </clipPath>
        </defs>
      </svg>
     <h4>Búsquedas recientes</h4>
      </div>
      <button class="btn-borrar-todo" title="Borrar todo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
        Borrar todo
      </button>
    </div>
  `;
  
  const btnBorrarTodo = dropdown.querySelector('.btn-borrar-todo');
  if (btnBorrarTodo) {
    btnBorrarTodo.addEventListener('click', (e) => eliminarTodasBusquedas(e));
  }
  
  busquedas.forEach(anime => {
    const item = document.createElement('div');
    item.className = 'busqueda-item';
    item.innerHTML = `
      <a href="anime.html?id=${anime.id}" class="busqueda-link">
        <img src="${anime.cover}" alt="${anime.title}">
        <div class="busqueda-info">
          <span class="busqueda-titulo">${anime.title}</span>
          ${anime.type ? `<span class="busqueda-type">${anime.type}</span>` : ''}
        </div>
      </a>
      <button class="btn-eliminar-busqueda" data-id="${anime.id}" title="Eliminar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    
    const btnEliminar = item.querySelector('.btn-eliminar-busqueda');
    btnEliminar.addEventListener('click', (e) => eliminarBusquedaReciente(anime.id, e));
    
    dropdown.appendChild(item);
  });
  
  // Agregar sección de tendencias
  const tendenciasSection = document.createElement('div');
  tendenciasSection.className = 'tendencias-section';
  tendenciasSection.innerHTML = `
    <div class="tendencias-titulo">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 6l-9.5 9.5-5-5L1 18"/>
        <path d="M17 6h6v6"/>
      </svg>
      <h4>Tendencias</h4>
    </div>
    <div class="tendencias-tags">
      <a href="/index.html?DirectorioJK&genero=isekai" class="tendencia-tag">isekai</a>
      <a href="/index.html?DirectorioJK&temporada=invierno" class="tendencia-tag">Invierno</a>
      <a href="/index.html?DirectorioJK&genero=shonen" class="tendencia-tag">shonen</a>
      <a href="/index.html?DirectorioJK&genero=romance" class="tendencia-tag">romance</a>
      <a href="/index.html?DirectorioJK&genero=seinen" class="tendencia-tag">seinen</a>
      <a href="/index.html?DirectorioJK&fecha=2025" class="tendencia-tag">2025</a>
    </div>
  `;
  dropdown.appendChild(tendenciasSection);
}

function ocultarBusquedasRecientes() {
  const dropdown = document.getElementById('busquedas-recientes-dropdown');
  if (dropdown) dropdown.remove();
}

// === CREAR CARD ===
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
        <img src="${coverImage}" class="cover" alt="${anime.title || anime.name || 'anime'}">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        ${ratingHtml}
        <span class="estado">${anime.type || ''}</span>
      </div>
      <strong>${anime.title || anime.name || ''}</strong>
    </a>
  `;
  div.addEventListener('click', () => {
    guardarBusquedaReciente(anime);
    if (typeof aplicarViewTransition === 'function') aplicarViewTransition(animeId, ratingHtml);
  });
  return div;
}

// === RENDER SIN RESULTADOS ===
function renderSinResultados(container, searchTerm, searchId) {
  if (!container) return;
  limpiarSeccionIA();
  container.classList.add('sin-resultados');
  container.innerHTML = `
    <img src="/img/cat.png" id="img-sin-resultados" alt="sin resultados">
    <div id="text-sin-resultados">
      <span id="span-sin-resultados">No se encontraron resultados</span>
      <span id="span-sin-resultados2">Prueba buscando de otra manera.</span>
    </div>
    <div id="sugerencias-sin-resultados">
      <h2>Sugerencias</h2>
      <div id="anime-grid-sin-resultados"><span class="span-carga">cargando...</span></div>
    </div>
  `;
  const scrollHorizontal = container.querySelector('#anime-grid-sin-resultados');
  if (scrollHorizontal) {
    scrollHorizontal.onwheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollHorizontal.scrollLeft += e.deltaY;
      }
    };
  }

  const iaSection = document.createElement('div');
  iaSection.innerHTML = IA_SECTION_HTML.trim();
  const iaBlock = iaSection.firstElementChild;
  container.insertAdjacentElement('afterend', iaBlock);

  const porcentajeARecortar = Math.ceil(searchTerm.length * 0.4);
  const recortado = searchTerm.slice(0, -porcentajeARecortar);
  const animeGrid = document.getElementById('anime-grid-sin-resultados');
  if (animeGrid && recortado.length >= 3) {
    cargarSugerenciasSinResultados(recortado, animeGrid);
  }
  cargarRecomendacionesIA(searchTerm, searchId);
}

async function cargarRecomendacionesIA(searchTerm, searchId) {
  if (currentIaController) currentIaController.abort();
  currentIaController = new AbortController();

  const grid = document.getElementById('anime-grid-ia-busqueda');
  if (!grid) return;

  attachIaGridWheelScroll(grid);

  await loadIaRecommendationsIntoGrid({
    searchTerm,
    grid,
    isStale: () => searchId !== undefined && searchId !== currentSearch,
    signal: currentIaController.signal,
    crearAnimeCard,
    observerAnimeCards
  });
}

// === SUGERENCIAS ===
async function cargarSugerenciasSinResultados(id, container) {
  try {
    const response = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error('Error al cargar sugerencias');
    const animeData = await response.json();
    const resultados = animeData || [];
    if (resultados.length === 0) {
      const porcentajeARecortar = Math.ceil(id.length * 0.4);
      const recortado = id.slice(0, -porcentajeARecortar);
      if (recortado.length >= 3) return cargarSugerenciasSinResultados(recortado, container);
      return;
    }
    container.innerHTML = '';
    resultados.forEach(anime => container.appendChild(crearAnimeCard(anime)));
    observerAnimeCards();
  } catch (error) {
    console.error('Error al cargar sugerencias:', error);
  }
}

// === MOSTRAR RESULTADOS ===
function mostrarResultados(data, searchTerm, searchId) {
  const resultados = data.data || data || [];
  limpiarSeccionIA();

  if (isIndexPage) {
    const resultadosContainer = document.getElementById('resultados-busqueda');
    const seccionResultados = document.getElementById('Busqueda-Resultados');
    const busquedaH2 = document.getElementById('busqueda-h2');

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));

    if (!resultadosContainer) return;
    resultadosContainer.innerHTML = '';

    if (resultados.length > 0) {
      resultadosContainer.classList.remove('sin-resultados');
      seccionResultados?.classList.remove('hidden');
      resultados.forEach(anime => resultadosContainer.appendChild(crearAnimeCard(anime)));
      if (busquedaH2) busquedaH2.textContent = 'Resultados de busqueda: ' + resultados.length;
      observerAnimeCards();
    } else {
      seccionResultados?.classList.remove('hidden');
      renderSinResultados(resultadosContainer, searchTerm, searchId);
      if (busquedaH2) busquedaH2.textContent = 'No hay resultados';
    }
    return;
  }

  if (!mainContainer) return;
  mainContainer.innerHTML = '';
  mainContainer.style.display = 'grid';

  if (isAnimePage || isVerPage || isDirectorioPage || isLabPage) {
    setDisplay(animeDetails, 'none');
    setDisplay(disqusThread, 'none');
    setDisplay(relacionados, 'none');
    setDisplay(mainLab, 'none');
    setDisplay(verAnime, 'none');

    if (resultados.length === 0) {
      renderSinResultados(mainContainer, searchTerm, searchId);
      return;
    }

    mainContainer.classList.remove('sin-resultados');
    resultados.forEach(anime => mainContainer.appendChild(crearAnimeCard(anime)));
    observerAnimeCards();
  }
}

// === REDIRECCIÓN ===
function ver(id) {
  location.href = `anime.html?id=${id}`;
}

// === BÚSQUEDA ===
const busquedaInput = document.getElementById('busqueda');
let busquedaTimer, busquedaCountdownInterval, initialDelayTimer, currentSearch = 0, currentController = null, currentIaController = null;

if (busquedaInput) {
  busquedaInput.addEventListener('focus', () => {
    if (!busquedaInput.value.trim()) renderizarBusquedasRecientes();
  });
  
  busquedaInput.addEventListener('blur', () => {
    setTimeout(ocultarBusquedasRecientes, 200);
  });
  
  busquedaInput.addEventListener('input', () => {
    ocultarBusquedasRecientes();
    currentSearch++;
    const searchId = currentSearch;
    clearTimeout(busquedaTimer);
    clearTimeout(initialDelayTimer);
    if (busquedaCountdownInterval) clearInterval(busquedaCountdownInterval);
    if (currentController) currentController.abort();
    if (currentIaController) {
      currentIaController.abort();
      currentIaController = null;
    }
    limpiarSeccionIA();

    const valor = busquedaInput.value.trim();
    const loadingSpan = document.getElementById('init-loading-servidores-busqueda');
    const contadorSpan = document.getElementById('contador-busqueda');
    const seccionResultados = document.getElementById('Busqueda-Resultados');
    const resultadosContainer = document.getElementById('resultados-busqueda');

    if (!valor) {
      if (isIndexPage) limpiarVistaIndexPage(loadingSpan, contadorSpan, seccionResultados, resultadosContainer);
      else limpiarVistaAnimePage();
      return;
    }

    if (isIndexPage) {
      document.querySelectorAll('.content-section').forEach(sec => {
        if (sec.id !== 'Busqueda-Resultados' && !sec.classList.contains('hidden')) sec.classList.add('hidden');
      });
      seccionResultados?.classList.remove('hidden');
      if (resultadosContainer) {
        resultadosContainer.innerHTML = '';
        resultadosContainer.classList.remove('sin-resultados');
      }
      limpiarSeccionIA();
    } else {
      if (mainContainer) {
        mainContainer.innerHTML = '';
        mainContainer.classList.remove('sin-resultados');
      }
      limpiarSeccionIA();
    }

    busquedaTimer = setTimeout(() => {
      let countdown = 22;

      initialDelayTimer = setTimeout(() => {
        if (searchId === currentSearch && isIndexPage) {
          console.log('[Search] ⏱️ Mostrando loading después de 100ms');
          if (loadingSpan) loadingSpan.style.display = 'block';
          if (contadorSpan) contadorSpan.textContent = countdown + 's';
          busquedaCountdownInterval = setInterval(() => {
            countdown--;
            if (contadorSpan) contadorSpan.textContent = countdown + 's';
            if (countdown <= 0) {
              clearInterval(busquedaCountdownInterval);
              if (searchId === currentSearch && resultadosContainer && resultadosContainer.innerHTML.trim() === '') {
                if (loadingSpan) loadingSpan.style.display = 'none';
                seccionResultados?.classList.remove('hidden');
                mostrarMensajeError(resultadosContainer, 'El servidor tarda demasiado en responder.');
              }
            }
          }, 1000);
        }
      }, 100);

      currentController = new AbortController();
      fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(valor)}`, { signal: currentController.signal })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
          return res.json();
        })
        .then(resData => {
          if (searchId !== currentSearch) return;
          clearTimeout(initialDelayTimer);
          clearInterval(busquedaCountdownInterval);
          if (isIndexPage && loadingSpan) loadingSpan.style.display = 'none';
          
          const resultados = resData || [];
          console.log('[Search] ✅ Enviando', resultados.length, 'resultados directamente a mostrarResultados');
          
          mostrarResultados(resultados, valor, searchId);
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          if (searchId !== currentSearch) return;
          clearTimeout(initialDelayTimer);
          clearInterval(busquedaCountdownInterval);
          console.error('Error al buscar anime:', err);
          if (isIndexPage) {
            if (loadingSpan) loadingSpan.style.display = 'none';
            seccionResultados?.classList.remove('hidden');
            mostrarMensajeError(resultadosContainer, 'Error al buscar.');
          } else if (mainContainer) {
            mostrarMensajeError(mainContainer, 'Error al buscar.');
          }
        });
    }, 300);
  });
}