// === Utilidades ===
function normalizarTexto(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '');
}


function mostrarMensajeError(container, mensaje) {
  container.innerHTML = `<span class=\"no-results\">${mensaje}</span>`;
}

function limpiarVistaAnimePage() {
  if (animeDetails) animeDetails.style.display = 'grid';
  if (mainContainer) mainContainer.innerHTML = "";
  if (mainContainer) mainContainer.style.display = 'none';
  if (disqusThread) disqusThread.style.display = 'block';
  if (relacionados) relacionados.style.display = 'flex';
  const verAnime = document.getElementById('main-ver');
  if (verAnime) verAnime.style.display = 'flex';
  if (mainLab) mainLab.style.display = 'flex';
}

function limpiarVistaIndexPage(loadingSpan, contadorSpan, seccionResultados, resultadosContainer) {
  if (loadingSpan) loadingSpan.style.display = 'none';
  if (contadorSpan) contadorSpan.textContent = '';
  if (seccionResultados) seccionResultados.classList.add('hidden');
  if (resultadosContainer) resultadosContainer.innerHTML = '';
  handleHashChange();
}

// === Variables de página ===
const isAnimePage = location.pathname.includes('anime');
const isVerPage = location.pathname.includes('ver');
const isDirectorioPage = location.pathname.includes('directorio');
const isLabPage = location.pathname.includes('lab');
const isIndexPage = location.pathname === '/' || location.pathname.endsWith('index.html');
const mainContainer = document.getElementById('main');
const animeDetails = document.querySelector('.anime-details');
const verAnime = document.getElementById('main-ver');
const mainLab = document.getElementById('main-lab');
const sidebar = document.querySelector('.sidebar');
const disqusThread = document.getElementById('disqus_thread');
const relacionados = document.getElementById('relacionados');

// === UI: eventos de búsqueda ===
document.getElementById('btn-search').addEventListener('click', () => {
  document.querySelector('header').classList.add('search-active');
  document.getElementById('busqueda').focus();
  sidebar.classList.remove('active');
});

document.getElementById('btn-close-search').addEventListener('click', () => {
  document.querySelector('header').classList.remove('search-active');
  const input = document.getElementById('busqueda');
  input.value = "";
  input.dispatchEvent(new Event('input'));
});

// === Función para crear tarjeta de anime ===
function crearAnimeCard(anime) {
  const animeId = anime.id;
  const div = document.createElement('div');
  let ratingHtml = '';
  if (anime.rating) {
    ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
  }
  div.className = 'anime-card';
  div.style.setProperty('--cover', `url(${anime.cover})`);
  div.innerHTML = `
  <div class="container-img">
    <img src="${anime.cover}" class="cover" alt="${anime.title || anime.name}">
    <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
    ${ratingHtml}
    <span class="estado">${anime.type}</span>
  </div>
  <strong>${anime.title || anime.name}</strong>
`;

  div.addEventListener('click', () => ver(animeId));
  return div;
}

// === Mostrar resultados ===
function mostrarResultados(data) {
  const resultados = data.data || data;

  if (isIndexPage) {
    const resultadosContainer = document.getElementById('resultados-busqueda');
    const seccionResultados = document.getElementById('Busqueda-Resultados');
    document.querySelectorAll('.content-section').forEach(sec => {
      if (!sec.classList.contains('hidden')) sec.classList.add('hidden');
    });
    resultadosContainer.innerHTML = '';

    if (resultados.length > 0) {
      seccionResultados.classList.remove('hidden');
      resultados.forEach(anime => resultadosContainer.appendChild(crearAnimeCard(anime)));
    } else {
      seccionResultados.classList.remove('hidden');
      mostrarMensajeError(resultadosContainer, 'No hay resultados');
    }
    return;
  }

  if (!mainContainer) return;
  mainContainer.innerHTML = '';
  if (mainContainer) mainContainer.style.display = 'grid';

  if (isAnimePage || isVerPage || isDirectorioPage || isLabPage) {
    if (animeDetails) animeDetails.style.display = resultados.length > 0 ? 'none' : 'grid';
    if (disqusThread) disqusThread.style.display = resultados.length > 0 ? 'none' : 'block';
    if (relacionados) relacionados.style.display = resultados.length > 0 ? 'none' : 'flex';
    if (mainLab) mainLab.style.display = resultados.length > 0 ? 'none' : 'flex';
    if (verAnime) verAnime.style.display = resultados.length > 0 ? 'none' : 'flex';
    if (resultados.length === 0) return;
  }

  resultados.forEach(anime => mainContainer.appendChild(crearAnimeCard(anime)));
}

// === Redirección ===
function ver(id) {
  location.href = `anime.html?id=${id}`;
}

// === Búsqueda en tiempo real ===
const busquedaInput = document.getElementById('busqueda');
let busquedaTimer, busquedaCountdownInterval, initialDelayTimer;
let fetchCallMade = false;

busquedaInput.addEventListener('input', () => {
  clearTimeout(busquedaTimer);
  clearTimeout(initialDelayTimer);
  if (isIndexPage && busquedaCountdownInterval) clearInterval(busquedaCountdownInterval);
  fetchCallMade = true;

  const valor = busquedaInput.value.trim();
  const loadingSpan = document.getElementById('init-loading-servidores-busqueda');
  const contadorSpan = document.getElementById('contador-busqueda');
  const seccionResultados = document.getElementById('Busqueda-Resultados');
  const resultadosContainer = document.getElementById('resultados-busqueda');

  if (!valor) {
    isIndexPage
      ? limpiarVistaIndexPage(loadingSpan, contadorSpan, seccionResultados, resultadosContainer)
      : limpiarVistaAnimePage();
    return;
  }

  if (isIndexPage) {
    document.querySelectorAll('.content-section').forEach(sec => {
      if (sec.id !== 'Busqueda-Resultados' && !sec.classList.contains('hidden'))
        sec.classList.add('hidden');
    });
    seccionResultados.classList.remove('hidden');
    resultadosContainer.innerHTML = '';
  }

  busquedaTimer = setTimeout(() => {
    fetchCallMade = false;
    const queryNormalizada = normalizarTexto(valor);
    let countdown = 22;

    initialDelayTimer = setTimeout(() => {
      if (!fetchCallMade && isIndexPage) {
        loadingSpan.style.display = 'block';
        contadorSpan.textContent = countdown + 's';
        busquedaCountdownInterval = setInterval(() => {
          countdown--;
          contadorSpan.textContent = countdown + 's';
          if (countdown <= 0) {
            clearInterval(busquedaCountdownInterval);
            if (!fetchCallMade && resultadosContainer.innerHTML.trim() === '') {
              loadingSpan.style.display = 'none';
              seccionResultados.classList.remove('hidden');
              mostrarMensajeError(resultadosContainer, 'El servidor tarda demasiado en responder. Intenta de nuevo.');
            }
          }
        }, 1000);
      }
    }, 1000);

    fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${valor}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then(resData => {
        fetchCallMade = true;
        clearTimeout(initialDelayTimer);
        clearInterval(busquedaCountdownInterval);
        if (isIndexPage) loadingSpan.style.display = 'none';

        const filtrados = (resData.data || []).filter(anime =>
          normalizarTexto(anime.title).includes(queryNormalizada)
        );
        mostrarResultados(filtrados);
      })
      .catch(err => {
        fetchCallMade = true;
        clearTimeout(initialDelayTimer);
        clearInterval(busquedaCountdownInterval);
        console.error('Error al buscar anime:', err);
        if (isIndexPage) {
          loadingSpan.style.display = 'none';
          seccionResultados.classList.remove('hidden');
          mostrarMensajeError(resultadosContainer, 'Error al buscar. Intenta de nuevo más tarde.');
        } else if (mainContainer) {
          mostrarMensajeError(mainContainer, 'Error al buscar. Intenta de nuevo más tarde.');
        }
      });
  }, 300);
});

// MENSAJE FOOTER DINAMICO
const footer = document.querySelector('footer');
const footerMessage = document.createElement('p');

const mensajes = [
  'Este proyecto es una iniciativa completamente independiente, desarrollada con fines educativos y de entretenimiento.',
  'Toda la información es obtenida desde AnimeFLV, respetando siempre la fuente original.',
  'Todos los derechos sobre el contenido mostrado pertenecen a sus respectivos creadores y propietarios legales.',
  '⚠️ Los servidores pueden entrar en hibernación tras cierto tiempo de inactividad, lo que podría causar una breve demora al volver a acceder.',
  "🔁 Tu progreso se sincroniza automáticamente entre dispositivos cuando inicias sesión",
  '🔄 El contenido de la página se almacena temporalmente en caché, lo que mejora significativamente el rendimiento tras la primera carga.',
  "⭐ Marca tus animes favoritos para acceder a ellos fácilmente",
  '🧠 Algunas funciones de la plataforma están potenciadas por inteligencia artificial, y se actualizan constantemente para ofrecer mejores resultados.',
  '🚀 Esta plataforma ha sido optimizada para ofrecer una experiencia fluida, tanto en computadoras como en dispositivos móviles.',
  '📡 La aplicación realiza conexiones seguras y eficientes con los servidores de anime, garantizando estabilidad y rapidez en el acceso al contenido.',
  ' 🕒 La primera carga de la página puede tardar unos segundos debido al proceso de arranque inicial de los servidores.',
  '🔐 El sistema utiliza conexión segura HTTPS y autenticación con Firebase para proteger tus datos y asegurar tu experiencia.',
  '📁 El contenido se carga de forma dinámica para brindar una experiencia de navegación más rápida, fluida y sin interrupciones.',
  ' 🎥 El sistema de streaming está optimizado para evitar anuncios invasivos, ventanas emergentes o redirecciones molestas.',
];

// Función para obtener un mensaje aleatorio
function obtenerMensajeAleatorio() {
  const indice = Math.floor(Math.random() * mensajes.length);
  return mensajes[indice];
}

// Mostrar mensaje inicial
footerMessage.textContent = obtenerMensajeAleatorio();
footer.appendChild(footerMessage);
