import { observerAnimeCards } from './utils.js';

let scheduleData = [];
let currentDay = '';
let eventsBound = false;

const API_URL = 'https://backend-animeflv-lite.onrender.com/api/schedule';
const CACHE_KEY = 'cache-horarios';
const DOM = {
  buttons: document.getElementById('day-buttons'),
  search: document.getElementById('search-input'),
  grid: document.getElementById('anime-grid')
};

const renderButtons = () => {
  if (!DOM.buttons) return;
  DOM.buttons.innerHTML = '';
  
  scheduleData.forEach(item => {
    const btn = document.createElement('button');
    btn.className = `btn-day ${item.day === currentDay ? 'active' : ''}`;
    btn.textContent = item.day;
    
    btn.addEventListener('click', () => {
      currentDay = item.day;
      if (DOM.search) DOM.search.value = '';
      applyFilter();
    });
    
    DOM.buttons.appendChild(btn);
  });
};

function slug(str) {
  const clean = str
    .toLowerCase()
    .trim()
    .replace(/[:'".,!?]/g, '')
    .replace(/\s+/g, '-');
  return `${clean}`;
}

const renderInitialGrid = () => {
  if (!DOM.grid) return;
  DOM.grid.innerHTML = '';
  
  const fragment = document.createDocumentFragment();

  
  scheduleData.forEach(d => {
    d.animes.forEach(a => {
      const div = document.createElement("a");
      div.className = "anime-card anime-card-schedule";
      div.href = `/anime.html?id=${slug(a.title)}`;
      div.dataset.day = d.day;
      div.dataset.title = a.title.toLowerCase();

      let timeago = ""
      timeago = a.time_ago
        ? `<div class="content" data-time_ago="${a.time_ago}">`
        : "";

      div.innerHTML = `
        <div class="container-img">
            <img class="cover" src="${a.image}" alt="${a.title}" loading="lazy">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver" onerror="this.style.display='none'">
            <span class="rating">${a.type}</span>
          <span class="estado">Capítulo ${a.last_episode || 1}</span>
          </div>
        ${timeago}
            <strong>${a.title}</strong>
        ${timeago ? '</div>' : ''}
      `;
      div.addEventListener('click', () => {
      const h3 = div.querySelector('strong');
      const containerImg = div.querySelector('.container-img');
      
      if (h3) h3.style.setProperty('view-transition-name', 'title' + slug(a.title));
      if (containerImg) containerImg.style.setProperty('view-transition-name', slug(a.title));
    });
      fragment.appendChild(div);
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

  if (query === '') {
    cards.forEach(card => {
      if (card.dataset.day === currentDay) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    document.querySelectorAll('.btn-day').forEach(b => {
      b.classList.toggle('active', b.textContent === currentDay);
    });
  } else {
    cards.forEach(card => {
      if (card.dataset.title.includes(query)) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });
    
    document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
  }

  if (noResultsMessage) {
    noResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
  }
};

const processData = (data, isInitial = false) => {
  scheduleData = data;
  if (scheduleData.length > 0) {
    
    if (!currentDay) {
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const hoy = diasSemana[new Date().getDay()];
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