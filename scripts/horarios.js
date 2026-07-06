import { observerAnimeCards } from './utils.js';
let scheduleData = [];
let currentDay = '';

const API_URL = 'https://backend-animeflv-lite.onrender.com/api/schedule';
const DOM = {
  buttons: document.getElementById('day-buttons'),
  search: document.getElementById('search-input'),
  grid: document.getElementById('anime-grid')
};

console.log("1. Estado inicial del DOM:", DOM);

const slug = (text) => text.toString().toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^\w\-]+/g, '')
  .replace(/\-\-+/g, '-')
  .replace(/^-+/, '')
  .replace(/-+$/, '');

const init = async () => {
  console.log("3. Ejecutando init(). Haciendo petición a:", API_URL);
  
  try {
    const response = await fetch(API_URL);
    console.log("4. Respuesta del servidor (status):", response.status, response.ok);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    console.log("5. Datos recibidos (JSON crudo):", data);
    
    // Filtramos para quitar objetos vacíos o el tab de buscar
    scheduleData = data.filter(d => d.day !== "Buscar anime" && d.animes && d.animes.length > 0);
    console.log("6. Datos filtrados y limpios:", scheduleData);
    
    if (scheduleData.length > 0) {
      currentDay = scheduleData[0].day;
      console.log("7. Día por defecto seleccionado:", currentDay);
      
      renderButtons();
      renderGrid();
      bindEvents();
    } else {
      console.warn("ALERTA: El array de datos está vacío después de filtrar.");
    }
  } catch (error) {
    console.error("ERROR CRÍTICO en la petición fetch. Revisa si el backend de Node está corriendo en el puerto 3001 o si hay problemas de CORS:", error);
    if(DOM.grid) {
        DOM.grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #ff6b6b;">Error al cargar los horarios. Revisa la consola (F12).</p>';
    }
  }
};

const renderButtons = () => {
  console.log("8. Renderizando botones...");
  if (!DOM.buttons) return console.error("Falta el contenedor de botones en el HTML");
  
  DOM.buttons.innerHTML = '';
  scheduleData.forEach(item => {
    const btn = document.createElement('button');
    btn.className = `btn-day ${item.day === currentDay ? 'active' : ''}`;
    btn.textContent = item.day;
    
    btn.addEventListener('click', () => {
      console.log(`--> Click en botón de día: ${item.day}`);
      document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDay = item.day;
      DOM.search.value = '';
      renderGrid();
    });
    
    DOM.buttons.appendChild(btn);
  });
};

const renderGrid = (filter = '') => {
  if (!DOM.grid) return;
  DOM.grid.innerHTML = '';
  
  let animesToRender = [];

  // LÓGICA DE FILTRADO
  if (filter.trim() === '') {
    // 1. Si no hay búsqueda, mostramos el día seleccionado
    const dayData = scheduleData.find(d => d.day === currentDay);
    if (dayData) animesToRender = dayData.animes;
    
    // Nos aseguramos de que el botón del día actual esté resaltado
    document.querySelectorAll('.btn-day').forEach(b => {
      if (b.textContent === currentDay) {
        b.classList.add('active');
      }
    });
  } else {
    // 2. Si hay búsqueda, buscamos en TODOS los días
    scheduleData.forEach(d => {
      const coincidencias = d.animes.filter(a => 
        a.title.toLowerCase().includes(filter.toLowerCase())
      );
      animesToRender = [...animesToRender, ...coincidencias];
    });
    
    // Apagamos los botones de días porque estamos en una vista de resultados globales
    document.querySelectorAll('.btn-day').forEach(b => b.classList.remove('active'));
  }

  // Si no hay resultados
  if (animesToRender.length === 0) {
    DOM.grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #a0a5b1;">No se encontraron animes con ese nombre.</p>';
    return;
  }

  // RENDERIZADO DE LAS CARDS
  animesToRender.forEach(a => {
   
    const div = document.createElement("div");
    div.className = "anime-card";

    div.innerHTML = `
      <a href="/anime/${slug(a.title)}">
        <div class="container-img">
          <img class="cover" src="${a.image}" alt="${a.title}" loading="lazy">
          <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver" onerror="this.style.display='none'">
          <span class="estado">${a.type}</span>
          <span class="ultimo-cap">Capítulo ${a.last_episode}</span>
        </div>
        <div class="content">
          <strong>${a.title}</strong>
        </div>
      </a>
    `;
    DOM.grid.appendChild(div);
  });
  
  observerAnimeCards();
};

const bindEvents = () => {
  console.log("10. Vinculando evento de búsqueda...");
  if (!DOM.search) return console.error("Falta el input de búsqueda en el HTML");
  
  DOM.search.addEventListener('input', (e) => {
    console.log(`--> Buscando: "${e.target.value}"`);
    renderGrid(e.target.value);
  });
};

console.log("2. Verificando estado del DOM...");
if (document.readyState === 'loading') {
  // Si el HTML aún está cargando, esperamos
  document.addEventListener('DOMContentLoaded', init);
} else {
  // Si el HTML ya cargó (que es lo que te está pasando), iniciamos de inmediato
  console.log("--> El DOM ya estaba listo. Forzando inicio...");
  init();
}