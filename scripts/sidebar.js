// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
const SIDEBAR_CONFIG = {
  THRESHOLD: 3,
  MIN_WIDTH: 600,
  SWIPE_THRESHOLD: 50,
  VERTICAL_THRESHOLD: 50
};

// ============================================================================
// MÓDULO SIDEBAR
// ============================================================================
/**
 * Inicializa el comportamiento del sidebar encapsulando su propio estado.
 * @param {string} sidebarSelector - Selector CSS para el sidebar (ej. '.sidebar')
 * @param {string} toggleId - ID del botón del menú (sin el '#')
 */
function inicializarSidebar(sidebarSelector = '.sidebar', toggleId = 'menu-toggle') {
  const sidebar = document.querySelector(sidebarSelector);
  const menuToggle = document.getElementById(toggleId);

  if (!sidebar || !menuToggle) {
    console.error(`Error: Elementos no encontrados. Verifica que exista un elemento con el selector '${sidebarSelector}' y un ID '${toggleId}'.`);
    return;
  }

  // Estado encapsulado (Closure). Evita colisiones globales y problemas de "shadowing".
  let rafPending = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let touchStartedOnRestrictedArea = false;

  // Set para búsquedas en O(1) de los elementos excluidos del gesto swipe
  const idsRestringidos = new Set([
    'noticias_container', 'capitulos', 'animes-relacionados',
    'anime-grid-sin-resultados', 'controles', 
    'sugerencias-sin-resultados', 'anime-grid-ia-busqueda'
  ]);

  // Manejadores de eventos internos
  const handleMouseMove = (event) => {
    if (sidebar.classList.contains('active') || window.innerWidth <= SIDEBAR_CONFIG.MIN_WIDTH) return;

    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        if (event.clientX < SIDEBAR_CONFIG.THRESHOLD) {
          sidebar.classList.add('active');
          menuToggle.classList.add('active');
        }
        rafPending = false;
      });
    }
  };

  const handleSwipeGesture = () => {
    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = Math.abs(touchEndY - touchStartY);
    const isSwipeRight = swipeDistanceX > SIDEBAR_CONFIG.SWIPE_THRESHOLD;
    const isSwipeLeft = swipeDistanceX < -SIDEBAR_CONFIG.SWIPE_THRESHOLD;
    const isValidVertical = swipeDistanceY < SIDEBAR_CONFIG.VERTICAL_THRESHOLD;

    if (isSwipeRight && !sidebar.classList.contains('active') && isValidVertical && !touchStartedOnRestrictedArea) {
      sidebar.classList.add('active');
      menuToggle.classList.add('active');
    } else if (isSwipeLeft && sidebar.classList.contains('active') && isValidVertical) {
      sidebar.classList.remove('active');
      menuToggle.classList.remove('active');
    }
  };

  // Asignación de Listeners
  window.addEventListener('mousemove', handleMouseMove);
  
  sidebar.addEventListener('mouseleave', () => {
    sidebar.classList.remove('active');
    menuToggle.classList.remove('active');
  });

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    menuToggle.classList.toggle('active');
  });

  document.addEventListener('click', (event) => {
    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickOnMenuToggle = menuToggle.contains(event.target);

    if (!isClickInsideSidebar && !isClickOnMenuToggle && sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
      menuToggle.classList.remove('active');
    }
  });

  document.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
    
    let currentElement = event.target;
    touchStartedOnRestrictedArea = false;
    
    // Subir por el árbol DOM para verificar si el toque inició en un área restringida
    while (currentElement && currentElement !== document) {
      if (currentElement.id && idsRestringidos.has(currentElement.id)) {
        touchStartedOnRestrictedArea = true;
        break;
      }
      currentElement = currentElement.parentNode;
    }
  }, { passive: true });

  document.addEventListener('touchend', (event) => {
    touchEndX = event.changedTouches[0].screenX;
    touchEndY = event.changedTouches[0].screenY;
    handleSwipeGesture();
    touchStartedOnRestrictedArea = false;
  }, { passive: true });
}

// ============================================================================
// MÓDULO DE CAPÍTULOS
// ============================================================================
/**
 * Crea un elemento DOM para el siguiente capítulo.
 * Utiliza textContent en lugar de innerHTML para prevenir vulnerabilidades XSS.
 */
function crearElementoSiguienteCapitulo({ portada, titulo, siguienteCapitulo, id, totalCapitulos }) {
  const btn = document.createElement('a');
  btn.className = 'btn-siguiente-capitulo';
  btn.href = `/ver?id=${id}&episode=${siguienteCapitulo}`;

  const img = document.createElement('img');
  img.src = portada;
  img.alt = titulo; 
  img.className = 'portada-anime';
  img.onerror = () => {
    img.src = 'path/to/default/image.png'; // Nota: Ajusta esta ruta a tu imagen por defecto real
  };

  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  // Inyección segura de datos dinámicos
  const spanTitulo = document.createElement('span');
  spanTitulo.className = 'texto-2-lineas';
  spanTitulo.textContent = titulo;

  const spanEpisodio = document.createElement('span');
  spanEpisodio.className = 'texto-episodio';
  spanEpisodio.textContent = `Ver episodio ${siguienteCapitulo} / ${totalCapitulos || 'X'}`;

  contenedorTexto.append(spanTitulo, spanEpisodio);
  btn.append(img, contenedorTexto);

  return btn;
}

/**
 * Carga y renderiza los últimos capítulos vistos desde el almacenamiento local.
 */
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

  const userID = localStorage.getItem('userID') || 'null';
  const cacheKey = `ultimosCapsVistosCache_${userID}`;
  
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
    console.error('Error al leer caché:', e);
    localStorage.removeItem(cacheKey);
    container.innerHTML = '<p>Error al cargar datos locales</p>';
  }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Se llama a la función asegurando que mapea con los atributos exactos de tu HTML
  inicializarSidebar('.sidebar', 'menu-toggle'); 
  cargarUltimosCapsVistos();
});