import { observerAnimeCards, crearAnimeCard } from "./utils.js";

// --- CONSTANTES GLOBALES ---
const API_BASE_URL = 'https://backend-animeflv-lite.onrender.com/api/browse?source=animeav1&order=score';
const CACHE_KEY = 'animes_cache_populares';

// Mapeos de valores (igual que directorioav1)
const MAPA_TIPOS = { 'tv': 'tv-anime', 'movie': 'pelicula', 'special': 'especial', 'ova': 'ova' };
const MAPA_ESTADOS = { '1': 'emision', '2': 'finalizado', '3': 'proximamente' };

let currentPage = 1;
let tipoFiltro = null;
let estadoFiltro = null;
function formatAnimeId(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function centrarPaginacion() {
  const paginationContainer = document.getElementById('pagination-populares');
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

function updatePagination(PaginasTotales) {
  const paginationContainer = document.getElementById('pagination-populares');
  paginationContainer.innerHTML = '';
  const totalPages = parseInt(PaginasTotales) || 1;
  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement('button');
    button.className = 'page-button';
    button.textContent = i;
    button.addEventListener('click', () => cambiarPagina(i));
    paginationContainer.appendChild(button);
    button.classList.toggle('active', i === currentPage);
  }
}
function cambiarPagina(page) {
  currentPage = page;
  cargarPopulares();
}

// --- UTILIDADES DE FETCH ---
async function fetchData(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error en la red');
  return response.json();
}

async function cargarPopulares() {
  try {
    const container = document.getElementById('populares');

    if (!container) return;

    container.innerHTML = '<span class="span-carga">Cargando animes populares...</span>';

    const params = new URLSearchParams();
    if (tipoFiltro) params.append('category', MAPA_TIPOS[tipoFiltro] || tipoFiltro);
    if (estadoFiltro) params.append('status', MAPA_ESTADOS[estadoFiltro] || estadoFiltro);
    params.append('page', currentPage);

    const url = `${API_BASE_URL}&${params.toString()}`;

    // Verificar cache primero
    const cacheKey = `${CACHE_KEY}_${tipoFiltro || 'all'}_${estadoFiltro || 'all'}_${currentPage}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      const { data: cachedAnimes, PaginasTotales } = JSON.parse(cachedData);
      renderizarResultados(cachedAnimes);
      updatePagination(PaginasTotales);
      centrarPaginacion();
    }

    // Fetch para actualizar en segundo plano
    const data = await fetchData(url);
    const animes = data.animes || [];

    // Si no había cache o los datos cambiaron, actualizar
    if (!cachedData || (animes[0]?.title !== JSON.parse(cachedData).data[0]?.title)) {
      renderizarResultados(animes);
      updatePagination(data.PaginasTotales);
      centrarPaginacion();
      localStorage.setItem(cacheKey, JSON.stringify({ data: animes, PaginasTotales: data.PaginasTotales }));
    }

  } catch (error) {
    console.error('Error al cargar populares:', error);
    const container = document.getElementById('populares');
    if (container) {
      container.innerHTML = '<span class="span-carga">Error al cargar los animes. Api en mantenimiento.</span>';
    }
  }
}

function renderizarResultados(animes) {
  const container = document.getElementById('populares');
  if (!container) return;

  container.innerHTML = '';

  animes.forEach(anime => {
    const card = crearAnimeCard(anime);
    if (card) container.appendChild(card);
  });

  observerAnimeCards();
}

cargarPopulares();


const btns = document.querySelectorAll('#nav-populares .filtro-section > button');
btns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        });
    });

// Función para manejar los botones de filtro (tipo y estado)
function setupFilterButtons(buttonsSelector, targetButtonId, filterType) {
    const buttons = document.querySelectorAll(buttonsSelector);
    const targetButton = document.getElementById(targetButtonId);

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (targetButton) {
                targetButton.classList.remove('active');
                const span = targetButton.querySelector('span');
                if (span) {
                    span.textContent = btn.textContent.trim();
                }
            }

            if (filterType === 'tipo') {
                tipoFiltro = btn.dataset.type || null;
            } else if (filterType === 'estado') {
                estadoFiltro = btn.dataset.type || null;
            }

            currentPage = 1;
            cargarPopulares();
        });
    });
}

setupFilterButtons('#nav-populares-type-section > button', 'btn-populares-filtro-type', 'tipo');
setupFilterButtons('#nav-populares-filtro-section > button', 'btn-populares-filtro-filters', 'estado');

const btnAlert = document.getElementById('btn-populares-alert');
const modal = document.getElementById('modal-populares');
btnAlert.addEventListener('click', () => {
    modal.classList.add('active');
});
modal.addEventListener('click', () => {
    modal.classList.remove('active');
});
window.addEventListener('scroll', () => {
    modal.classList.remove('active');
    document.querySelectorAll('.btn-filtro').forEach(opcion => {
        opcion.classList.remove('active');
    });
});


const scrollContainer = document.querySelector('#pagination-populares');

scrollContainer.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    scrollContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });