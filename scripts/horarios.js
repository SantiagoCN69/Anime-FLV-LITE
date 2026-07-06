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
      document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDay = item.day;
      DOM.search.value = '';
      renderGrid();
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
  return `/anime.html?id=${clean}`;
}

const renderGrid = (filter = '') => {
  if (!DOM.grid) return;
  DOM.grid.innerHTML = '';
  
  let animesToRender = [];

  if (filter.trim() === '') {
    const dayData = scheduleData.find(d => d.day === currentDay);
    if (dayData) animesToRender = dayData.animes;
    
    document.querySelectorAll('.btn-day').forEach(b => {
      if (b.textContent === currentDay) b.classList.add('active');
    });
  } else {
    scheduleData.forEach(d => {
      const coincidencias = d.animes.filter(a => 
        a.title.toLowerCase().includes(filter.toLowerCase())
      );
      animesToRender = [...animesToRender, ...coincidencias];
    });
    
    document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
  }

  if (animesToRender.length === 0) {
    DOM.grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #a0a5b1;">No se encontraron animes con ese nombre.</p>';
    return;
  }

  animesToRender.forEach(a => {
    const div = document.createElement("a");
    div.className = "anime-card anime-card-schedule";
    div.href = slug(a.title);

    div.innerHTML = `
      <div class="container-img">
          <img class="cover" src="${a.image}" alt="${a.title}" loading="lazy">
          <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver" onerror="this.style.display='none'">
          <span class="rating">${a.type}</span>
          <span class="estado">Capítulo ${a.last_episode}</span>
        </div>
        <div class="content" data-time_ago="${a.time_ago}">
          <strong>${a.title}</strong>
        </div>
    `;
    DOM.grid.appendChild(div);
  });
  
  if (typeof observerAnimeCards === 'function') {
    observerAnimeCards();
  }
};

const processData = (data, isInitial = false) => {
  scheduleData = data;
  if (scheduleData.length > 0) {
    if (!currentDay) currentDay = scheduleData[0].day;
    
    renderButtons();
    renderGrid(DOM.search.value);
    
    if (!eventsBound && DOM.search) {
      DOM.search.addEventListener('input', (e) => renderGrid(e.target.value));
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