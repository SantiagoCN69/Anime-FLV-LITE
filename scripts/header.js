// Función para normalizar texto (remover tildes y pasar a minúsculas)
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const isAnimePage = location.pathname.includes('anime.html');
const isIndexPage = location.pathname === '/' || location.pathname.endsWith('index.html');
const animeDetails = document.querySelector('.anime-details');
const mainContainer = document.getElementById('main');

// Toggle de búsqueda para móviles
document.getElementById('btn-search').addEventListener('click', function () {
  document.querySelector('header').classList.add('search-active');
  document.getElementById('busqueda').focus();
});

// Cerrar búsqueda
document.getElementById('btn-close-search').addEventListener('click', function () {
  document.querySelector('header').classList.remove('search-active');
  document.getElementById('busqueda').value = "";
  if (animeDetails) animeDetails.style.display = 'grid';
  if (mainContainer) mainContainer.innerHTML = "";
  if (isIndexPage) cargarUltimosCapitulos();
});

// Función de búsqueda en tiempo real
const busquedaInput = document.getElementById('busqueda');
let busquedaTimer;

busquedaInput.addEventListener('input', function () {
  clearTimeout(busquedaTimer);

  const valor = this.value.trim();

  if (!valor) {
    if (animeDetails) animeDetails.style.display = 'grid';
    if (mainContainer) mainContainer.innerHTML = "";
    if (isIndexPage) cargarUltimosCapitulos();
    return;
  }

  busquedaTimer = setTimeout(() => {
    const queryNormalizada = normalizarTexto(valor);
    fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${valor}`)
      .then(res => res.json())
      .then(res => {
        const resultadosFiltrados = res.data.filter(anime =>
          normalizarTexto(anime.title).includes(queryNormalizada)
        );
        mostrarResultados(resultadosFiltrados);
      })
      .catch(err => console.error("Error al buscar anime:", err));
  }, 300);
});

// Mostrar resultados (últimos o búsqueda)
function mostrarResultados(data) {
  if (!mainContainer) return;
  mainContainer.innerHTML = "";

  const resultados = data.data || data;

  if (isAnimePage) {
    if (resultados.length > 0) {
      if (animeDetails) animeDetails.style.display = 'none';
    } else {
      if (animeDetails) animeDetails.style.display = 'grid';
      return;
    }
  }

  resultados.forEach(anime => {
    let animeId = '';
    if (anime.url) {
      const urlParts = anime.url.split('/');
      const fullId = urlParts[urlParts.length - 1];
      animeId = fullId.replace(/-\d+$/, '');
    } else if (anime.id) {
      animeId = anime.id.replace(/-\d+$/, '');
    } else {
      animeId = extraerIdDeLink(anime.link || '');
    }

    const div = document.createElement('div');
    div.className = 'anime-card';
    div.style.backgroundImage = `url(${anime.cover || anime.image || anime.poster || ''})`;
    div.innerHTML = `
      <img src="${anime.cover || anime.image || anime.poster || ''}" alt="${anime.title || anime.name}">
      <strong>${anime.title || anime.name}</strong>
    `;
    div.addEventListener('click', () => ver(animeId));
    mainContainer.appendChild(div);
  });
}

// Cargar últimos capítulos solo en index
if (isIndexPage) {
  document.addEventListener('DOMContentLoaded', () => {
    cargarUltimosCapitulos();
  });

  function cargarUltimosCapitulos() {
    fetch('https://backend-animeflv-lite.onrender.com/api/latest')
      .then(res => res.json())
      .then(mostrarResultados)
      .catch(err => console.error("Error al cargar capítulos:", err));
  }
}

// Extrae el id de un link tipo '/anime/dragon-ball-z' => 'dragon-ball-z'
function extraerIdDeLink(link) {
  if (!link) return '';
  const partes = link.split('/');
  return partes[partes.length - 1] || '';
}

// Redirige a la página de anime
function ver(id) {
  location.href = `anime.html?id=${id}`;
}
