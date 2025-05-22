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
  });

  // Oculta el sidebar al hacer scroll en dispositivos móviles
  window.addEventListener('scroll', () => {
    if (window.innerWidth < 600) {
      if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
      }
    }
  });

  // Oculta el sidebar al hacer clic fuera de él
  document.addEventListener('click', (event) => {
    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickOnMenuToggle = menuToggle.contains(event.target);

    if (!isClickInsideSidebar && !isClickOnMenuToggle && sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
    }
  });

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
      }
      rafPending = false;
    });
  }
}

function onSidebarMouseLeave() {
  sidebar.classList.remove('active');
}

function handleSwipeGesture() {
  const swipeDistanceX = touchEndX - touchStartX;
  const swipeDistanceY = Math.abs(touchEndY - touchStartY);
  const isSwipeRight = swipeDistanceX > swipeThreshold;
  const isSwipeLeft = swipeDistanceX < -swipeThreshold;

  if (isSwipeRight && !sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold && !touchStartedOnRestrictedArea) {
    if (window.innerWidth <= 600) {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        function checkScrollAndOpen() {
          if (window.scrollY === 0) {
            sidebar.classList.add('active');
          } else {
            requestAnimationFrame(checkScrollAndOpen);
          }
        }
        requestAnimationFrame(checkScrollAndOpen);
      } else {
        sidebar.classList.add('active');
      }
    } else {
      sidebar.classList.add('active');
    }
  } else if (isSwipeLeft && sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold) {
    sidebar.classList.remove('active');
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


import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let userid = null;
onAuthStateChanged(auth, (user) => {
  if (user) {
    userid = user.uid;
  } else {
    userid = null;
  }
});

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
    datos.forEach(data => fragment.appendChild(crearElementoSiguienteCapitulo(data)));
    container.appendChild(fragment);
  };

  const user = await new Promise(resolve => onAuthStateChanged(auth, resolve));
  if (!user) {
    container.innerHTML = '<p>Inicia sesión para ver tus últimos capítulos</p>';
    return;
  }

  const cacheKey = `ultimosCapsVistosCache_${user.uid}`;
  let cachedData = null;

  try {
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      cachedData = JSON.parse(cache);
      if (Array.isArray(cachedData)) renderizar(cachedData);
      else localStorage.removeItem(cacheKey);
    }
  } catch (e) {
    console.error("Error al leer caché:", e);
    localStorage.removeItem(cacheKey);
  }

  try {
    const ref = collection(doc(db, "usuarios", user.uid), "caps-vistos");
    const snap = await getDocs(ref);

    if (snap.empty) return;

    const capVistos = snap.docs.map(docSnap => ({
      animeId: docSnap.id,
      ...docSnap.data()
    })).sort((a, b) => new Date(b.fechaAgregado?.toDate?.() || 0) - new Date(a.fechaAgregado?.toDate?.() || 0))
      .slice(0, 10);

    const animeRefs = capVistos.map(cap => doc(db, "datos-animes", cap.animeId));
    const animeDocs = await Promise.all(animeRefs.map(getDoc));

    const animeMap = {};
    animeDocs.forEach((docSnap, i) => {
      if (docSnap.exists()) animeMap[capVistos[i].animeId] = docSnap.data();
    });

    const freshData = capVistos.map(cap => {
      const anime = animeMap[cap.animeId];
      if (!anime?.portada || !anime?.titulo || !anime?.episodios) return null;

      const sigCapNum = Math.max(...(cap.episodiosVistos || []).map(Number), 0) + 1;
      const sigCap = Object.values(anime.episodios).find(ep => ep.number === sigCapNum);
      if (!sigCap?.url) return null;

      return {
        animeId: cap.animeId,
        portada: anime.portada,
        titulo: anime.titulo,
        siguienteCapitulo: sigCapNum,
        siguienteEpisodioUrl: sigCap.url
      };
    }).filter(Boolean);

    const freshStr = JSON.stringify(freshData);
    const cacheStr = JSON.stringify(cachedData);

    if (freshStr !== cacheStr) {
      renderizar(freshData);
      localStorage.setItem(cacheKey, freshStr);
    }
  } catch (error) {
    console.error('Error al cargar datos desde Firestore:', error);
    if (cachedData === null) container.innerHTML = '<p>Error al cargar últimos capítulos</p>';
  }
}
