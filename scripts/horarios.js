import { observerAnimeCards, aplicarViewTransition } from './utils.js';

let scheduleData = [];
let currentDay = '';
let eventsBound = false;

const API_URL = 'https://backend-animeflv-lite.onrender.com/api/schedule';
const CACHE_KEY = 'cache-horarios';
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DOM = {
  buttons: document.getElementById('day-buttons'),
  search: document.getElementById('search-input'),
  grid: document.getElementById('anime-grid')
};

const getTodayName = () => DIAS_SEMANA[new Date().getDay()];

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const getAnimeId = (anime, titleText) => {
  if (anime.id) return anime.id;
  if (anime.url) return anime.url.replace(/\/$/, '').split('/').pop();
  if (anime.cover) {
    return anime.cover.replace(/\/$/, '').split('/').pop().replace(/\.[^/.]+$/, '');
  }
  return titleText.toLowerCase().trim().replace(/[\s\W-]+/g, '-');
};

const crearHorarioCard = (anime) => {
  const titleText = anime.title || 'Título desconocido';
  const cover = anime.cover || 'img/loading.png';
  const id = getAnimeId(anime, titleText);
  const timeAgo = anime.time_ago || '';
  const type = anime.type || '';
  const episode = anime.last_episode || '';

  const card = document.createElement('a');
  card.className = 'anime-card anime-card-schedule';
  card.href = `/anime?id=${encodeURIComponent(id)}`;
  card.id = `anime-${id}`;
  card.dataset.id = id;
  card.dataset.title = titleText.toLowerCase();

  card.innerHTML = `
    <div class="container-img">
      <img src="${escapeHtml(cover)}" class="cover" alt="${escapeHtml(titleText)}" loading="lazy">
    </div>
    <div class="schedule-info">
      <div class="schedule-top">
        <strong>${escapeHtml(titleText)}</strong>
        <div class="schedule-aside">
          ${type ? `<span class="schedule-status">${escapeHtml(type)}</span>` : ''}
          </div>
          </div>
          <div class="schedule-meta">
          ${episode ? `<span class="schedule-ep">EP ${escapeHtml(episode)}</span>` : ''}
          ${timeAgo ? `<span class="schedule-time">${escapeHtml(timeAgo)}</span>` : ''}
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    if (typeof aplicarViewTransition === 'function') aplicarViewTransition(id, '', card);
  });

  return card;
};

const renderButtons = () => {
  if (!DOM.buttons) return;
  DOM.buttons.innerHTML = '';
  const hoy = getTodayName();
  
  scheduleData.forEach(item => {
    const isToday = item.day.toLowerCase() === hoy.toLowerCase();
    const btn = document.createElement('button');
    btn.className = `btn-day ${item.day === currentDay ? 'active' : ''}`;
    btn.dataset.day = item.day;
    
    const dayText = document.createElement('span');
    dayText.textContent = item.day;
    
    const countBadge = document.createElement('span');
    countBadge.className = 'anime-count';
    countBadge.textContent = item.animes.length;
    
    btn.appendChild(dayText);
    btn.appendChild(countBadge);
    if (isToday) {
      const hoyBadge = document.createElement('span');
      hoyBadge.className = 'day-hoy';
      hoyBadge.textContent = 'HOY';
      btn.appendChild(hoyBadge);
    }
    
    btn.addEventListener('click', () => {
      currentDay = item.day;
      if (DOM.search) DOM.search.value = '';
      applyFilter();
    });
    
    DOM.buttons.appendChild(btn);
  });
};

const renderInitialGrid = () => {
  if (!DOM.grid) return;
  DOM.grid.innerHTML = '';
  
  const fragment = document.createDocumentFragment();

  scheduleData.forEach(d => {
    d.animes.forEach(a => {
      const card = crearHorarioCard(a);
      card.dataset.day = d.day;
      fragment.appendChild(card);
    });
  });

  const noResults = document.createElement('p');
  noResults.id = 'no-results-message';
  noResults.style.cssText = 'display:none; text-align:center; grid-column: 1/-1; color: #a0a5b1;';
  noResults.textContent = 'No se encontraron animes con ese nombre.';
  fragment.appendChild(noResults);

  DOM.grid.appendChild(fragment);
  
  if (typeof observerAnimeCards === 'function') {
    observerAnimeCards();
  }
};

const applyFilter = (filterText = '') => {
  const query = filterText.trim().toLowerCase();
  const cards = DOM.grid.querySelectorAll('.anime-card');
  const noResultsMessage = document.getElementById('no-results-message');
  let visibleCount = 0;

    cards.forEach(card => {
      const visible = query === ''
        ? card.dataset.day === currentDay
        : (card.dataset.title || '').includes(query);

      card.style.display = visible ? '' : 'none';
      if (visible) card.classList.add('show');
      if (visible) visibleCount++;
    });

    document.querySelectorAll('.btn-day').forEach(b => {
      b.classList.toggle('active', query === '' && b.dataset.day === currentDay);
    });

  if (noResultsMessage) {
    noResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
  }
};

const processData = (data, isInitial = false) => {
  scheduleData = data;
  if (scheduleData.length > 0) {
    
    if (!currentDay) {
      const hoy = getTodayName();
      const existeHoy = scheduleData.some(d => d.day.toLowerCase() === hoy.toLowerCase());
      currentDay = existeHoy ? scheduleData.find(d => d.day.toLowerCase() === hoy.toLowerCase()).day : scheduleData[0].day;
    }
    
    renderButtons();
    renderInitialGrid(); 
    applyFilter(DOM.search ? DOM.search.value : ''); 
    
    if (!eventsBound && DOM.search) {
      DOM.search.addEventListener('input', (e) => applyFilter(e.target.value));
      eventsBound = true;
    }
  }
};

const init = async () => {
  const cachedString = localStorage.getItem(CACHE_KEY);
  
  if (cachedString) {
    try {
      console.log("💾 Cargando horarios desde caché local...");
      const parsedCache = JSON.parse(cachedString);
      processData(parsedCache, true);
    } catch (e) {
      console.error("⚠️ Error leyendo la caché, limpiando...", e);
      localStorage.removeItem(CACHE_KEY);
    }
  } else {
    console.log("🔍 No hay caché disponible. Esperando a la API...");
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const rawData = await response.json();
    const cleanData = rawData.filter(d => d.day !== "Buscar anime" && d.animes && d.animes.length > 0);
    const apiString = JSON.stringify(cleanData);
    
    if (apiString !== cachedString) {
      console.log("🔄 Los datos de la API son nuevos o diferentes. Actualizando caché y renderizando...");
      localStorage.setItem(CACHE_KEY, apiString);
      processData(cleanData, !cachedString);
    } else {
      console.log("✅ Los datos de la caché están 100% sincronizados con la API.");
    }
  } catch (error) {
    console.error("❌ Error de conexión al cargar la API de horarios:", error);
    if (!cachedString && DOM.grid) {
      DOM.grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #ff6b6b;">Error de conexión al cargar horarios.</p>';
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}