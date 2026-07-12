import { observerAnimeCards } from "./utils.js";
let currentPage = 1;
let type = null;
let filters = null;
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

function updatePagination(pagination) {
  const paginationContainer = document.getElementById('pagination-populares');
  paginationContainer.innerHTML = '';
  for (let i = 1; i <= pagination.last_visible_page; i++) {
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
function createAnimeCard(anime, eslink) {
    const div = document.createElement('div');
    let typeHtml = '';
    let estadoHtml = '';
    let ratingHtml = '';
    const animeId = formatAnimeId(anime.title);  
    div.className = 'anime-card';
    div.style.setProperty('--cover', `url(${anime.images.webp.image_url})`);
    

    if (!eslink) {estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="No disponible">Proximamente</span>`;}
    else {
    if (anime.status) {if (anime.status === 'Currently Airing') {estadoHtml = `<span class="estado"><img src="../icons/circle-solid-blue.svg" alt="En emision">En emision</span>`;}
      else {estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="Finalizado">Finalizado</span>`;}
    }
    }
    if (anime.score) {ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.score}">${anime.score}/10</span>`;}
    if (anime.type) {typeHtml = `<span class="type supder">${anime.type}</span>`;}
    
    div.innerHTML = `
<a href="${eslink ? 'anime.html?id=' + formatAnimeId(anime.title) : '#'}">

      <div class="container-img">
        <img src="${anime.images.webp.image_url}" class="cover" alt="${anime.title}">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        ${estadoHtml}
        ${ratingHtml}
        ${typeHtml}
      </div>
      <strong>${anime.title}</strong>
    </a>`;
    div.addEventListener('click', () => {
      if (ratingHtml){
      div.querySelector('.rating').style.setProperty('view-transition-name', 'rating' + animeId);
      }
      div.querySelector('strong').style.setProperty('view-transition-name', 'title' + animeId);
      div.querySelector('.container-img').style.setProperty('view-transition-name', animeId);
    });
    if (!eslink) {
      div.style.pointerEvents = 'none';
    }
    return div;
}
async function cargarPopulares() {
    type = type || null;
    filters = filters || null;
  try {
    const container = document.getElementById('populares');
    
    if (!container) return;
    
    container.innerHTML = '<span class="span-carga">Cargando animes populares...</div>';
		let url = 'https://api.jikan.moe/v4/top/anime';
		const params = new URLSearchParams();
		if (type) params.append('type', type);
		if (filters) params.append('filter', filters);
		if (filters !== 'upcoming' && type !== 'ova' && type !== 'ona') {
			params.append('page', currentPage);
		}
		url += '?' + params.toString();
		const response = await fetch(url);
		if (!response.ok) {
      console.error("Error al cargar los datos:", response.status);
      let errorMessage = 'Error al cargar los animes.';
      if (response.status === 504) {
        errorMessage = 'La API no da respuestas válidas. Intenta más tarde.';
      } else if (response.status === 429) {
        errorMessage = 'Has hecho demasiadas solicitudes. Espera un momento antes de intentar de nuevo.';
      } else if (response.status >= 500) {
        errorMessage = 'Error en el servidor de la API. Intenta más tarde.';
      } else if (response.status === 404) {
        errorMessage = 'No se encontraron resultados.';
      }
      container.innerHTML = `<span class="span-carga">${errorMessage}</span>`;
      return;
		}
		const data = await response.json();
    const animes = data.data || [];

    container.innerHTML = '';
    
    animes.forEach(anime => {
      if (filters === 'upcoming') {
      const card = createAnimeCard(anime, false);
      if (card) container.appendChild(card);
      observerAnimeCards();
    }
    else {
      const card = createAnimeCard(anime, true);
      if (card) container.appendChild(card);
      observerAnimeCards();
    }    });
    
    if (filters !== 'upcoming' && type !== 'ova' && type !== 'ona') {
      updatePagination(data.pagination);
      centrarPaginacion();
    } else {
      document.getElementById('pagination-populares').innerHTML = '';
    }
    
    
  } catch (error) {
    console.error('Error al cargar populares:', error);
    const container = document.getElementById('populares');
    if (container) {
      container.innerHTML = '<span class="span-carga">Error al cargar los animes. Api en mantenimiento.</span>';
    }
  }

}

cargarPopulares();


const btns = document.querySelectorAll('#nav-populares .filtro-section > button');
btns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        });
    });

// Función para manejar los botones de filtro
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
            
            if (filterType === 'type') {
                type = btn.dataset.type || null;
            } else if (filterType === 'filter') {
                filters = btn.dataset.type || null;
            }
            
            currentPage = 1;
            cargarPopulares();
        });
    });
}

setupFilterButtons('#nav-populares-type-section > button', 'btn-populares-filtro-type', 'type');
setupFilterButtons('#nav-populares-filtro-section > button', 'btn-populares-filtro-filters', 'filter');

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