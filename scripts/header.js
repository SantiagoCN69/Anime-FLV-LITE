import { observerAnimeCards } from './utils.js';

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
  setDisplay(disqusThread, 'block');
  setDisplay(relacionados, 'flex');
  setDisplay(verAnime, 'flex');
  setDisplay(mainLab, 'flex');
}

function limpiarVistaIndexPage(loadingSpan, contadorSpan, seccionResultados, resultadosContainer) {
  if (loadingSpan) loadingSpan.style.display = 'none';
  if (contadorSpan) contadorSpan.textContent = '';
  if (seccionResultados) seccionResultados.classList.add('hidden');
  if (resultadosContainer) {
    resultadosContainer.innerHTML = '';
    resultadosContainer.classList.remove('sin-resultados');
  }
  handlesearchChange();
}

// === VARIABLES ===
const pathname = location.pathname;
const isAnimePage = pathname.endsWith('/anime.html') || pathname.endsWith('anime.html');
const isVerPage = pathname.endsWith('/ver.html') || pathname.endsWith('ver.html');
const isDirectorioPage = pathname.includes('/directorio');
const isLabPage = pathname.includes('/lab');
const isIndexPage = pathname === '/' || pathname.endsWith('/index.html');
const mainContainer = document.getElementById('main');
const animeDetails = document.querySelector('.anime-details');
const verAnime = document.getElementById('main-ver');
const mainLab = document.getElementById('main-lab');
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

// === CREAR CARD ===
function crearAnimeCard(anime) {
  const animeId = anime.id;
  const div = document.createElement('div');
  let ratingHtml = '';
  if (anime.rating) {
    ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
  }
  div.className = 'anime-card';
  div.style.setProperty('--cover', `url(${anime.cover})`);
  div.innerHTML = `
    <a href="anime.html?id=${animeId}" id="anime-${animeId}">
      <div class="container-img">
        <img src="${anime.cover}" class="cover" alt="${anime.title || anime.name || 'anime'}">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        ${ratingHtml}
        <span class="estado">${anime.type || ''}</span>
      </div>
      <strong>${anime.title || anime.name || ''}</strong>
    </a>
  `;
  div.addEventListener('click', () => {
    if (typeof aplicarViewTransition === 'function') aplicarViewTransition(animeId, ratingHtml);
  });
  return div;
}

// === RENDER SIN RESULTADOS ===
function renderSinResultados(container, searchTerm) {
  if (!container) return;
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
  const porcentajeARecortar = Math.ceil(searchTerm.length * 0.4);
  const recortado = searchTerm.slice(0, -porcentajeARecortar);
  const animeGrid = document.getElementById('anime-grid-sin-resultados');
  if (animeGrid && recortado.length >= 3) {
    cargarSugerenciasSinResultados(recortado, animeGrid);
  }
}

// === SUGERENCIAS ===
async function cargarSugerenciasSinResultados(id, container) {
  try {
    const response = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error('Error al cargar sugerencias');
    const animeData = await response.json();
    const resultados = animeData.data || [];
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
function mostrarResultados(data, searchTerm) {
  const resultados = data.data || data || [];

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
      renderSinResultados(resultadosContainer, searchTerm);
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
      renderSinResultados(mainContainer, searchTerm);
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
let busquedaTimer, busquedaCountdownInterval, initialDelayTimer, currentSearch = 0, currentController = null;

if (busquedaInput) {
  busquedaInput.addEventListener('input', () => {
    currentSearch++;
    const searchId = currentSearch;
    clearTimeout(busquedaTimer);
    clearTimeout(initialDelayTimer);
    if (busquedaCountdownInterval) clearInterval(busquedaCountdownInterval);
    if (currentController) currentController.abort();

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
    } else {
      if (mainContainer) {
        mainContainer.innerHTML = '';
        mainContainer.classList.remove('sin-resultados');
      }
    }

    busquedaTimer = setTimeout(() => {
      const queryNormalizada = normalizarTexto(valor);
      let countdown = 22;

      initialDelayTimer = setTimeout(() => {
        if (searchId === currentSearch && isIndexPage) {
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
      }, 1000);

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
          const filtrados = (resData.data || []).filter(anime => normalizarTexto(anime.title || anime.name || '').includes(queryNormalizada));
          mostrarResultados(filtrados, valor);
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