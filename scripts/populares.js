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
function updatePagination(pagination) {
    console.log(pagination);
  const paginationContainer = document.getElementById('pagination');
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
function createAnimeCard(anime) {
    const div = document.createElement('div');
    let typeHtml = '';
    let estadoHtml = '';
    let ratingHtml = '';
  
    div.className = 'anime-card';
    div.style.setProperty('--cover', `url(${anime.images.webp.image_url})`);
    

    if (anime.status) {if (anime.status === 'Currently Airing') {estadoHtml = `<span class="estado"><img src="../icons/circle-solid-blue.svg" alt="Finalizado">Finalizado</span>`;}
      else {estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="${anime.status}">${anime.status}</span>`;}
    }
    if (anime.score) {ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.score}">${anime.score}/10</span>`;}
    if (anime.type) {typeHtml = `<span class="type supder">${anime.type}</span>`;}
    
    div.innerHTML = `
    <a href="anime.html?id=${formatAnimeId(anime.title)}">
      <div class="container-img">
        <img src="${anime.images.webp.image_url}" class="cover" alt="${anime.title}">
        <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        ${estadoHtml}
        ${ratingHtml}
        ${typeHtml}
      </div>
      <strong>${anime.title}</strong>
    </a>`;
    
    return div;
}
async function cargarPopulares() {
    console.log(type, filters);
    type = type || null;
    filters = filters || null;
  try {
    const container = document.getElementById('populares');
    const h2 = document.getElementById('popularesh2');
    
    if (!container || !h2) return;
    
    container.innerHTML = '<span class="span-carga">Cargando animes populares...</div>';
		let url = `https://api.jikan.moe/v4/top/anime?limit=24&page=${currentPage}`;

		if (type) url += `&type=${type}`;
		if (filters) url += `&filter=${filters}`;
		console.log(url);
		const response = await fetch(url);
		if (!response.ok) {
			console.error("Error al cargar los datos:", response.status);
		}
		const data = await response.json();
		console.log(data);
		
    const animes = data.data || [];

    container.innerHTML = '';
    animes.forEach(anime => {
      const card = createAnimeCard(anime);
      if (card) container.appendChild(card);
      observerAnimeCards();
    });
    updatePagination(data.pagination);
    
    h2.dataset.text = `Disponibles: ${animes.length}`;
    
  } catch (error) {
    console.error('Error al cargar populares:', error);
    const container = document.getElementById('populares');
    if (container) {
      container.innerHTML = '<span class="span-carga">Error al cargar los animes. Intenta recargar la página.</span>';
    }
  }

}

cargarPopulares();


const btns = document.querySelectorAll('#nav-populares > button');
btns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) {
            btn.classList.remove('active');
        } else {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
        });
    });

const btnstypes = document.querySelectorAll('#nav-populares-type-section > button');
btnstypes.forEach(btn => {
    btn.addEventListener('click', () => {
        type = btn.dataset.type;
				btnstypes.forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
        cargarPopulares();
    });
});
const btnfilters = document.querySelectorAll('#nav-populares-filtro-section > button');
btnfilters.forEach(btn => {
    btn.addEventListener('click', () => {
        filters = btn.dataset.type;
				btnfilters.forEach(b => b.classList.remove('active'));
				btn.classList.add('active');
        cargarPopulares();
    });
});
