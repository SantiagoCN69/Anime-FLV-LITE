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
let busquedaCountdownInterval; // Para el temporizador de la cuenta regresiva de búsqueda
let initialDelayTimer; // Para el retraso de 2s antes de mostrar el loading
let fetchCallMade = false; // Bandera para controlar el estado de la llamada fetch

busquedaInput.addEventListener('input', function () {
  clearTimeout(busquedaTimer);
  clearTimeout(initialDelayTimer);
  if (isIndexPage && busquedaCountdownInterval) {
    clearInterval(busquedaCountdownInterval);
  }
  fetchCallMade = true; // Se cancela cualquier operación pendiente, se asume que fetch terminó o no inició

  const valor = this.value.trim();
  const loadingSpanBusqueda = document.getElementById('init-loading-servidores-busqueda');
  const contadorBusquedaSpan = document.getElementById('contador-busqueda');
  const seccionResultados = document.getElementById('Busqueda-Resultados');
  const resultadosContainer = document.getElementById('resultados-busqueda');

  if (!valor) { // Input está vacío
    if (isIndexPage) {
      if (loadingSpanBusqueda) loadingSpanBusqueda.style.display = 'none';
      if (contadorBusquedaSpan) contadorBusquedaSpan.textContent = '';
      if (seccionResultados) seccionResultados.classList.add('hidden');
      if (resultadosContainer) resultadosContainer.innerHTML = '';
      handleHashChange();
    } else {
      if (animeDetails) animeDetails.style.display = 'grid';
      if (mainContainer) mainContainer.innerHTML = "";
    }
    return;
  }

  if (isIndexPage) {
    const secciones = document.querySelectorAll('.content-section');
    secciones.forEach(sec => {
      if (sec.id !== 'Busqueda-Resultados' && !sec.classList.contains('hidden')) {
        sec.classList.add('hidden');
      }
    });
    if (seccionResultados) seccionResultados.classList.remove('hidden');
    if (resultadosContainer) resultadosContainer.innerHTML = ''; 
    // NO mostrar loadingSpanBusqueda aquí todavía
  }

  busquedaTimer = setTimeout(() => {
    fetchCallMade = false; // La nueva operación de búsqueda va a comenzar
    const queryNormalizada = normalizarTexto(valor);
    let countdownValue = 22; // Cuenta regresiva después del delay de 2s

    // Iniciar temporizador de 2 segundos para mostrar el mensaje de carga
    initialDelayTimer = setTimeout(() => {
      if (!fetchCallMade && isIndexPage) { // Si fetch no ha terminado y estamos en index
        if (loadingSpanBusqueda) loadingSpanBusqueda.style.display = 'block';
        if (contadorBusquedaSpan) contadorBusquedaSpan.textContent = countdownValue + 's';
        
        clearInterval(busquedaCountdownInterval); // Limpiar por si acaso
        busquedaCountdownInterval = setInterval(() => {
          countdownValue--;
          if (contadorBusquedaSpan) contadorBusquedaSpan.textContent = countdownValue + 's';
          if (countdownValue <= 0) {
            clearInterval(busquedaCountdownInterval);
            if (!fetchCallMade && loadingSpanBusqueda && loadingSpanBusqueda.style.display === 'block') {
              loadingSpanBusqueda.style.display = 'none';
              if (resultadosContainer && resultadosContainer.innerHTML.trim() === '') {
                if(seccionResultados && seccionResultados.classList.contains('hidden')) {
                    seccionResultados.classList.remove('hidden');
                 }
                resultadosContainer.innerHTML = '<span class="no-results">El servidor tarda demasiado en responder. Intenta de nuevo.</span>';
              }
            }
          }
        }, 1000);
      }
    }, 1000);

    fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${valor}`)
      .then(res => {
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        return res.json();
      })
      .then(resData => {
        fetchCallMade = true;
        clearTimeout(initialDelayTimer);
        clearInterval(busquedaCountdownInterval);
        if (isIndexPage && loadingSpanBusqueda) loadingSpanBusqueda.style.display = 'none';
        
        const resultadosFiltrados = (resData.data || []).filter(anime =>
          normalizarTexto(anime.title).includes(queryNormalizada)
        );
        mostrarResultados(resultadosFiltrados);
      })
      .catch(err => {
        fetchCallMade = true;
        clearTimeout(initialDelayTimer);
        clearInterval(busquedaCountdownInterval);
        console.error("Error al buscar anime:", err);
        if (isIndexPage) {
          if (loadingSpanBusqueda) loadingSpanBusqueda.style.display = 'none';
          if (seccionResultados) seccionResultados.classList.remove('hidden');
          if (resultadosContainer) resultadosContainer.innerHTML = '<span class="no-results">Error al buscar. Intenta de nuevo más tarde.</span>';
        } else {
           if(mainContainer) mainContainer.innerHTML = '<span class="no-results">Error al buscar. Intenta de nuevo más tarde.</span>';
        }
      });
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
      seccionResultados.classList.remove('hidden');
      resultadosContainer.innerHTML = '<span class="no-results">No hay resultados</span>';
    }
    return; 
  }

  if (!mainContainer) return;
  mainContainer.innerHTML = ''; 

  if (isAnimePage) {
    if (resultados.length > 0) {
      if (animeDetails) animeDetails.style.display = 'none'; 
    } else {
      if (animeDetails) animeDetails.style.display = 'grid'; 
      return; 
    }
  }

  if (resultados.length > 0) {
    resultados.forEach(anime => {
      const animeCard = crearAnimeCard(anime);
      mainContainer.appendChild(animeCard);
    });
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

