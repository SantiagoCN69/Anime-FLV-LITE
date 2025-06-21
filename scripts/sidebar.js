
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');
/**
 * Inicializa la funcionalidad del sidebar
 * Configura todos los event listeners necesarios para el funcionamiento del sidebar
 * Incluye soporte para touch y mouse
 */
// Configuración inicial
const THRESHOLD = 20;
const MIN_WIDTH = 600;
const swipeThreshold = 50;
const verticalThreshold = 50;

// Estado global
let rafPending = false;

// Estado táctil
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let touchStartedOnRestrictedArea = false;

function inicializarSidebar() {
  // Verifica que los elementos necesarios existan
  if (!menuToggle || !sidebar) {
    console.error('Elementos del sidebar no encontrados');
    return;
  }

  // Event listener para mostrar el sidebar al mover el mouse cerca del borde izquierdo
  window.addEventListener('mousemove', (e) => onMouseMove(e, sidebar));
  
  // Oculta el sidebar cuando el mouse sale de él
  sidebar.addEventListener('mouseleave', () => onSidebarMouseLeave(sidebar));

  // Alternar el estado del sidebar al hacer clic en el botón de toggle
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    menuToggle.classList.toggle('active');
  });

  // Oculta el sidebar al hacer clic fuera de él
  document.addEventListener('click', (event) => {
    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickOnMenuToggle = menuToggle.contains(event.target);

    if (!isClickInsideSidebar && !isClickOnMenuToggle && sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
      menuToggle.classList.remove('active');
    }
  });

  // Manejo de scroll en el sidebar
  sidebar.addEventListener('touchstart', function(e) {
    this._startY = e.touches[0].pageY;
    this._startScroll = this.scrollTop;
  }, { passive: false });

  sidebar.addEventListener('touchmove', function(e) {
    const y = e.touches[0].pageY;
    const dy = this._startY - y;
    const atTop = this.scrollTop === 0;
    const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight;
    if ((atTop && dy < 0) || (atBottom && dy > 0)) {
      e.preventDefault();
    }
  }, { passive: false });

  // Configuración de gestos táctiles
  document.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
    
    // Verificar si el toque empezó en un área restringida
    const elementosExcluidos = [
      document.getElementById('noticias_container'),
      document.getElementById('capitulos'),
      document.getElementById('animes-relacionados'),
      document.getElementById('pagination'),
      document.getElementById('recomendaciones-favoritos'),
      document.getElementById('recomendaciones-personalizadas')
    ];
    
    touchStartedOnRestrictedArea = elementosExcluidos.some(elemento => {
      return elemento?.contains(event.target);
    });
  }, { passive: true });

  document.addEventListener('touchend', (event) => {
    touchEndX = event.changedTouches[0].screenX;
    touchEndY = event.changedTouches[0].screenY;
    handleSwipeGesture();
    touchStartedOnRestrictedArea = false;
  }, { passive: true });
}

// Inicializar todo cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  inicializarSidebar();
  cargarUltimosCapsVistos();
});

// Funciones de manejo de eventos
function onMouseMove(event) {
  if (sidebar.classList.contains('active')) return;
  if (window.innerWidth <= MIN_WIDTH) return;

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      if (event.clientX < THRESHOLD) {
        sidebar.classList.add('active');
        menuToggle.classList.add("active")
      }
      rafPending = false;
    });
  }
}

function onSidebarMouseLeave() {
  sidebar.classList.remove('active');
  menuToggle.classList.remove("active")
}

function handleSwipeGesture() {
  const swipeDistanceX = touchEndX - touchStartX;
  const swipeDistanceY = Math.abs(touchEndY - touchStartY);
  const isSwipeRight = swipeDistanceX > swipeThreshold;
  const isSwipeLeft = swipeDistanceX < -swipeThreshold;

  if (isSwipeRight && !sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold && !touchStartedOnRestrictedArea) {
    sidebar.classList.add('active');
    menuToggle.classList.add('active');
  } else if (isSwipeLeft && sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold) {
    sidebar.classList.remove('active');
    menuToggle.classList.remove('active');
  }
}

// Funciones para el componente de capítulos
function crearElementoSiguienteCapitulo({ portada, titulo, siguienteCapitulo, siguienteEpisodioUrl, animeId }) {
  const btn = document.createElement('div');
  btn.className = 'btn-siguiente-capitulo';

  const img = document.createElement('img');
  img.src = portada;
  img.alt = titulo;
  img.className = 'portada-anime';
  img.onerror = () => {
    img.src = 'path/to/default/image.png';
  };

  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  contenedorTexto.innerHTML = `
    <span class="texto-2-lineas">${titulo}</span>
    <span class="texto-episodio">Ep. ${siguienteCapitulo}</span>
  `;

  btn.append(img, contenedorTexto);
  btn.addEventListener('click', () => {
    window.location.href = `ver.html?animeId=${animeId}&url=${siguienteCapitulo}`;
  });

  return btn;
}




async function cargarUltimosCapsVistos() {
  const container = document.getElementById('ultimos-caps-viendo');
  if (!container) return;

  const renderizar = (datos) => {
    container.innerHTML = '';
    if (!datos?.length) {
      container.innerHTML = '<p>No tienes capítulos siguientes disponibles.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(data => {
      const elemento = crearElementoSiguienteCapitulo(data);
      if (elemento) fragment.appendChild(elemento);
    });
    container.appendChild(fragment);
  };



  const cacheKey = `ultimosCapsVistosCache_`;
  
  try {
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      const cachedData = JSON.parse(cache);
      if (Array.isArray(cachedData)) {
        renderizar(cachedData);
      } else {
        localStorage.removeItem(cacheKey);
      }
    } else {
      container.innerHTML = '<p>No hay datos en caché. Actualiza desde la página principal.</p>';
    }
  } catch (e) {
    console.error("Error al leer caché:", e);
    localStorage.removeItem(cacheKey);
    container.innerHTML = '<p>Error al cargar datos locales</p>';
  }
}