import { observerAnimeCards, crearAnimeCard } from "./utils.js";
import { fetchMALRanking, MAL_RANKING_TYPES } from "./mal-api.js";

let currentPage = 1;
const rankingGuardado = localStorage.getItem('populares_filtro_activo');
let rankingType = MAL_RANKING_TYPES.includes(rankingGuardado) ? rankingGuardado : 'bypopularity'; // Valor por defecto

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

function updatePagination(paging) {
  const paginationContainer = document.getElementById('pagination-populares');
  paginationContainer.innerHTML = '';

  const nextPageUrl = paging?.next;

  // Cambia el rango visual (ejemplo: 20 páginas hacia adelante y atrás)
  const range = 99;
  let minPage = Math.max(1, currentPage - 5); // Muestra 5 páginas hacia atrás
  let maxPage = currentPage + range;          // Y 100 hacia adelante

  if (!nextPageUrl) {
    maxPage = currentPage; // Si MAL indica que no hay más datos, frena ahí
  }

  minPage = Math.max(1, minPage);

  for (let i = minPage; i <= maxPage; i++) {
    const button = document.createElement('button');
    button.className = 'page-button';
    button.textContent = i;
    button.addEventListener('click', () => cambiarPagina(i));
    button.classList.toggle('active', i === currentPage);
    paginationContainer.appendChild(button);
  }
}
function cambiarPagina(page) {
  currentPage = page;
  cargarPopulares();
}

async function cargarPopulares() {
  try {
    const container = document.getElementById('populares');

    if (!container) return;

    container.innerHTML = '<span class="span-carga">Cargando animes populares...</span>';

    // Usar API de MAL v2 a través del proxy para obtener ranking
    const offset = (currentPage - 1) * 20;
    const malData = await fetchMALRanking({
      ranking_type: rankingType,
      limit: 20,
      offset
    });

    renderizarResultados(malData.animes || []);
    updatePagination(malData.paging);
    centrarPaginacion();

  } catch (error) {
    console.error('Error al cargar populares desde API:', error);

    const container = document.getElementById('populares');
    if (container) {
      container.innerHTML = '<span class="span-carga">API de MyAnimeList en mantenimiento. Intenta más tarde.</span>';
    }
  }
}

function renderizarResultados(animes) {
  const container = document.getElementById('populares');
  if (!container) return;

  container.innerHTML = '';

  const cards = [];
  animes.forEach(anime => {
    const card = crearAnimeCard(anime);
    if (card) {
      container.appendChild(card);
      cards.push(card);
    }
  });

  observerAnimeCards(cards);
}

cargarPopulares();


const btns = document.querySelectorAll('#nav-populares .filtro-section > button');
btns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        });
    });

// Función para manejar los botones de filtro de ranking
function setupRankingFilterButtons(buttonsSelector, targetButtonId) {
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

            rankingType = btn.dataset.ranking || 'bypopularity';
            localStorage.setItem('populares_filtro_activo', rankingType);
            currentPage = 1;
            cargarPopulares();
        });
    });
}

setupRankingFilterButtons('#nav-populares-ranking-section > button', 'btn-populares-filtro-ranking');

// Refleja el último filtro elegido al entrar a la sección
const btnRankingActivo = document.querySelector(`#nav-populares-ranking-section > button[data-ranking="${rankingType}"]`);
if (btnRankingActivo) {
    btnRankingActivo.classList.add('active');
    const spanTrigger = document.querySelector('#btn-populares-filtro-ranking span');
    if (spanTrigger) spanTrigger.textContent = btnRankingActivo.textContent.trim();
}

const btnAlert = document.getElementById('btn-populares-alert');
const modal = document.getElementById('modal-populares');
if (btnAlert && modal) {
  btnAlert.addEventListener('click', () => {
      modal.classList.add('active');
  });
  modal.addEventListener('click', () => {
      modal.classList.remove('active');
  });
}
const cerrarModalYFiltros = () => {
    modal?.classList.remove('active');
    document.querySelectorAll('.btn-filtro').forEach(opcion => {
        opcion.classList.remove('active');
    });
};
window.addEventListener('scroll', cerrarModalYFiltros);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) cerrarModalYFiltros();
});


const scrollContainer = document.querySelector('#pagination-populares');

scrollContainer?.addEventListener('wheel', (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    scrollContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });
