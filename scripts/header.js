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


// Toggle del menú
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-toggle");
  const sidebar = document.querySelector(".sidebar");

  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active");
  });

  // Opcional: ocultar sidebar al hacer clic en una opción
  document.querySelectorAll(".sidebar li").forEach(item => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 600) {
        sidebar.classList.remove("active");
      }
    });
  });

  // Ocultar sidebar al hacer scroll en dispositivos móviles
  window.addEventListener("scroll", () => {
    if (window.innerWidth <= 600 && sidebar.classList.contains("active")) {
      sidebar.classList.remove("active");
    }
  });

  // Cerrar sidebar al hacer clic fuera de él
  document.addEventListener("click", (event) => {
    if (!sidebar.contains(event.target) && !menuBtn.contains(event.target) && sidebar.classList.contains("active")) {
      sidebar.classList.remove("active");
    }
  });
});

//sidebar
const menuItems = document.querySelectorAll(".sidebar li");
const sections = document.querySelectorAll(".content-section");

menuItems.forEach(item => {
  item.addEventListener("click", () => {
    const targetId = item.getAttribute("data-target");

    sections.forEach(sec => {
      sec.classList.add("hidden");
    });

    document.getElementById(targetId).classList.remove("hidden");
  });
});

