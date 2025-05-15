// constantes botones filtro
const btnFiltroGenero = document.getElementById('btn-filtro-genero');
const btnFiltroAno = document.getElementById('btn-filtro-ano');
const btnFiltroTipo = document.getElementById('btn-filtro-tipo');
const btnFiltroEstado = document.getElementById('btn-filtro-estado');
const btnFiltroOrden = document.getElementById('btn-filtro-orden');

// constantes filtros
const filtroGenero = document.getElementById('filtro-genero');
const filtroAno = document.getElementById('filtro-ano');
const filtroTipo = document.getElementById('filtro-tipo');
const filtroEstado = document.getElementById('filtro-estado');
const filtroOrden = document.getElementById('filtro-orden');

const filtros = [
    { btn: btnFiltroGenero, filtro: filtroGenero },
    { btn: btnFiltroAno, filtro: filtroAno },
    { btn: btnFiltroTipo, filtro: filtroTipo },
    { btn: btnFiltroEstado, filtro: filtroEstado },
    { btn: btnFiltroOrden, filtro: filtroOrden }
];

// eventos botones filtro
filtros.forEach(({ btn, filtro }) => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        filtro.classList.toggle('active');
    });
});



//sidebar
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const swipeThreshold = 50;
const verticalThreshold = 50;

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

window.addEventListener('scroll', () => {
  if (window.innerWidth < 600) {
    if (sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
    }
  }
});

document.addEventListener('click', (event) => {
  const isClickInsideSidebar = sidebar.contains(event.target);
  const isClickOnMenuToggle = menuToggle.contains(event.target);

  if (!isClickInsideSidebar && !isClickOnMenuToggle && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
  }
});

document.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0].screenX;
  touchStartY = event.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', (event) => {
  touchEndX = event.changedTouches[0].screenX;
  touchEndY = event.changedTouches[0].screenY;
  handleSwipeGesture();
}, { passive: true });

function handleSwipeGesture() {
  const swipeDistanceX = touchEndX - touchStartX;
  const swipeDistanceY = Math.abs(touchEndY - touchStartY);
  const isSwipeRight = swipeDistanceX > swipeThreshold;
  const isSwipeLeft = swipeDistanceX < -swipeThreshold;

  if (isSwipeRight && !sidebar.classList.contains('active') && swipeDistanceY < verticalThreshold) {
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


import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { firebaseConfig } from "./firebaseconfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let userid = null;
onAuthStateChanged(auth, (user) => {
  if (user) {
    userid = user.uid;
  } else {
    userid = null;
  }
});

function crearElementoSiguienteCapitulo({ portada, titulo, siguienteCapitulo, animeId }) {
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
    window.location.href = `ver.html?animeId=${animeId}&url=${encodeURIComponent(siguienteCapitulo)}`;
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

window.addEventListener('DOMContentLoaded', cargarUltimosCapsVistos);
