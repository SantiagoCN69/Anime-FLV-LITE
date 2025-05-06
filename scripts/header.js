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
  const input = document.getElementById('busqueda');
  input.value = "";
  input.dispatchEvent(new Event('input')); // fuerza que se limpie todo
});



// Función de búsqueda en tiempo real
const busquedaInput = document.getElementById('busqueda');
let busquedaTimer;

busquedaInput.addEventListener('input', function () {
  clearTimeout(busquedaTimer);

  const valor = this.value.trim();

  if (!valor) {
    if (isIndexPage) {
      const seccionResultados = document.getElementById('Busqueda-Resultados');
      const resultadosContainer = document.getElementById('resultados-busqueda');
  
      seccionResultados.classList.add('hidden');
      resultadosContainer.innerHTML = '';
  
      // Restaurar la sección correspondiente al hash actual
      handleHashChange();
    } else {
      if (animeDetails) animeDetails.style.display = 'grid';
      if (mainContainer) mainContainer.innerHTML = "";
    }
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

// Función para crear una tarjeta de anime
function crearAnimeCard(anime) {
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
  div.style.setProperty('--cover', `url(${anime.cover})`);
  div.innerHTML = `
    <div class="container-img">
      <img src="${anime.cover}" alt="${anime.title || anime.name}">
    </div>
    <strong>${anime.title || anime.name}</strong>
  `;
  div.addEventListener('click', () => ver(animeId));
  return div;
}

// Mostrar resultados (últimos o búsqueda)
function mostrarResultados(data) {
  const resultados = data.data || data;

  if (isIndexPage) {
    const secciones = document.querySelectorAll('.content-section');
    const resultadosContainer = document.getElementById('resultados-busqueda');
    const seccionResultados = document.getElementById('Busqueda-Resultados');

    // Oculta todas las secciones visibles excepto la de resultados
    secciones.forEach(sec => {
      if (!sec.classList.contains('hidden')) {
        sec.classList.add('hidden');
      }
    });

    // Limpia resultados previos
    resultadosContainer.innerHTML = '';

    if (resultados.length > 0) {
      seccionResultados.classList.remove('hidden');
      resultados.forEach(anime => {
        const animeCard = crearAnimeCard(anime);
        resultadosContainer.appendChild(animeCard);
      });
    } else {
      seccionResultados.classList.add('hidden');
      handleHashChange(); // Restaura la sección si no hay resultados
    }
    return; // no renderizamos en mainContainer si es index
  }

  // Para otras páginas (como anime.html)
  if (!mainContainer) return;
  mainContainer.innerHTML = ''; // Limpia el contenedor principal

  if (isAnimePage) {
    if (resultados.length > 0) {
      if (animeDetails) animeDetails.style.display = 'none'; // Oculta detalles si hay resultados
    } else {
      if (animeDetails) animeDetails.style.display = 'grid'; // Muestra detalles si no hay resultados
      return; // No renderizar nada más si no hay resultados en anime.html
    }
  }

  resultados.forEach(anime => {
    const animeCard = crearAnimeCard(anime);
    mainContainer.appendChild(animeCard);
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

