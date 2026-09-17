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

// Función auxiliar para convertir "Hace X minutos/horas" o número de episodio a un peso comparable
const parseTimeWeight = (timeAgo = '', episode = '') => {
  const text = timeAgo.toLowerCase();
  let weight = 0;

  if (text.includes('minuto')) {
    const match = text.match(/\d+/);
    weight = match ? parseInt(match[0], 10) : 1;
  } else if (text.includes('hora')) {
    const match = text.match(/\d+/);
    weight = (match ? parseInt(match[0], 10) : 1) * 60;
  } else if (text.includes('día') || text.includes('ayer')) {
    const match = text.match(/\d+/);
    weight = (match ? parseInt(match[0], 10) : 1) * 1440;
  } else {
    weight = 999999; // Los más antiguos o sin tiempo definido van al final
  }

  return weight;
};

// Función para ordenar los animes: del más reciente al más antiguo
const ordenarAnimesRecientes = (animes) => {
  return animes.sort((a, b) => {
    const weightA = parseTimeWeight(a.time_ago, a.last_episode);
    const weightB = parseTimeWeight(b.time_ago, b.last_episode);
    
    // Menor peso de tiempo transcurrido (hace menos tiempo) significa que salió más reciente -> va arriba
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    
    // Criterio de respaldo: si tienen el mismo tiempo, ordenar por número de episodio descendente (EP más alto arriba)
    const epA = parseInt(a.last_episode, 10) || 0;
    const epB = parseInt(b.last_episode, 10) || 0;
    return epB - epA;
  });
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
    
    const dayText = document.print || document.createElement('span'); // Manteniendo compatibilidad
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
  const query = DOM.search ? DOM.search.value.trim().toLowerCase() : '';

  scheduleData.forEach(d => {
    d.animes.forEach(a => {
      const card = crearHorarioCard(a);
      card.dataset.day = d.day;

      const isVisible = query === '' 
        ? d.day === currentDay 
        : (card.dataset.title || '').includes(query);

      if (!isVisible) {
        card.style.display = 'none';
      } else {
        card.classList.add('show');
      }

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
  // Ordenar los animes de cada día para que los más recientes salgan primero
  scheduleData = data.map(item => ({
    ...item,
    animes: ordenarAnimesRecientes([...item.animes])
  }));

  if (scheduleData.length > 0) {
    if (!currentDay) {
      const hoy = getTodayName();
      const existeHoy = scheduleData.some(d => d.day.toLowerCase() === hoy.toLowerCase());
      currentDay = existeHoy 
        ? scheduleData.find(d => d.day.toLowerCase() === hoy.toLowerCase()).day 
        : scheduleData[0].day;
    }
    
    renderButtons();
    renderInitialGrid();
    
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
      console.log("Error de conexión al cargar horarios.");
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}