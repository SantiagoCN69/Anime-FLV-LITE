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

// Cargar últimos capítulos solo en index
function cargarUltimosCapitulos() {
  fetch('https://backend-animeflv-lite.onrender.com/api/latest')
    .then(res => res.json())
    .then(mostrarResultados)
    .catch(err => console.error("Error al cargar capítulos:", err));
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
// Función para cargar capítulos recientes
function cargarCapitulosRecientes() {
  fetch('https://backend-animeflv-lite.onrender.com/api/latest')
    .then(res => res.json())
    .then(data => {
      if (!mainContainer) return;
      mainContainer.innerHTML = '';
      mostrarResultados(data);
    })
    .catch(err => console.error('Error al cargar capítulos recientes:', err));
}

function mostrarResultados(data) {
  // Verificar si estamos en la página de índice
  if (!isIndexPage) return;

  // Ocultar todas las secciones
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
  
  // Obtener o crear la sección de resultados
  let resultadosSection = document.getElementById('Resultados-Busqueda');
  if (!resultadosSection) {
    const newSection = document.createElement('section');
    newSection.id = 'Resultados-Busqueda';
    newSection.className = 'content-section';
    newSection.innerHTML = '<h2>Resultados de Búsqueda</h2><div id="resultados-busqueda" class="grid-animes"></div>';
    document.querySelector('main').appendChild(newSection);
    resultadosSection = newSection;
  }
  resultadosSection.classList.remove('hidden');

  const resultadosContainer = document.getElementById('resultados-busqueda');
  if (!resultadosContainer) return;
  resultadosContainer.innerHTML = '';

  const resultados = data.data || data;

  if (resultados.length === 0) {
    resultadosContainer.innerHTML = '<p>No se encontraron resultados</p>';
    return;
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
    div.style.backgroundImage = `url(${anime.cover})`;
    div.innerHTML = `
      <img src="${anime.cover}" alt="${anime.title || anime.name}">
      <strong>${anime.title || anime.name}</strong>
    `;
    div.addEventListener('click', () => ver(animeId));
    resultadosContainer.appendChild(div);
  });

  // Actualizar URL
  history.pushState(null, '', '#Resultados-Busqueda');

  // Actualizar sidebar
  const menuItems = document.querySelectorAll('.sidebar li');
  menuItems.forEach(item => item.classList.remove('active'));
}

// Cargar últimos capítulos solo en index
if (isIndexPage) {
  document.addEventListener('DOMContentLoaded', () => {
    cargarCapitulosRecientes();
  });
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

