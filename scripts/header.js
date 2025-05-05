import { db, auth } from './firebase-login.js';
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

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
    div.style.backgroundImage = `url(${anime.cover})`;
    div.innerHTML = `
      <img src="${anime.cover}" alt="${anime.title || anime.name}">
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
    cargarFavoritos();
    cargarViendo();
    cargarPendientes();
    cargarCompletados();
  });

  function cargarUltimosCapitulos() {
    fetch('https://backend-animeflv-lite.onrender.com/api/latest')
      .then(res => res.json())
      .then(mostrarResultados)
      .catch(err => console.error("Error al cargar capítulos:", err));
  }

  // Cargar animes favoritos
  async function cargarFavoritos() {
    const favsContainer = document.getElementById('favs');
    if (!favsContainer) return;

    // Esperar a que se complete la autenticación
    await new Promise(resolve => {
      onAuthStateChanged(auth, (user) => {
        resolve(user);
      });
    });

    try {
      const user = auth.currentUser;
      if (!user) {
        favsContainer.innerHTML = '<p>Inicia sesión para ver tus favoritos</p>';
        return;
      }

      const ref = collection(doc(db, "usuarios", user.uid), "favoritos");
      const snap = await getDocs(ref);
      
      if (snap.empty) {
        favsContainer.innerHTML = '<p>No tienes animes favoritos</p>';
        return;
      }

      favsContainer.innerHTML = ''; // Limpiar contenedor
      
      for (const docSnap of snap.docs) {
        const anime = { id: docSnap.id, ...docSnap.data() };
        
        // Buscar detalles completos del anime
        try {
          const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${anime.id}`);
          const animeData = await res.json();

          const div = document.createElement('div');
          div.className = 'anime-card';
          div.style.backgroundImage = `url(${animeData.cover})`;
          div.innerHTML = `
            <img src="${animeData.cover}" alt="${animeData.title}">
            <strong>${animeData.title}</strong>
          `;
          div.addEventListener('click', () => ver(anime.id));
          favsContainer.appendChild(div);
        } catch (error) {
          console.error(`Error al cargar detalles de anime ${anime.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error al cargar favoritos:', error);
      favsContainer.innerHTML = '<p>Error al cargar favoritos</p>';
    }
  }

  // Cargar animes en curso
  async function cargarViendo() {
    const viendoContainer = document.getElementById('viendo');
    if (!viendoContainer) return;

    // Esperar a que se complete la autenticación
    await new Promise(resolve => {
      onAuthStateChanged(auth, (user) => {
        resolve(user);
      });
    });

    try {
      const user = auth.currentUser;
      if (!user) {
        viendoContainer.innerHTML = '<p>Inicia sesión para ver tus animes en curso</p>';
        return;
      }

      const ref = collection(doc(db, "usuarios", user.uid), "viendo");
      const snap = await getDocs(ref);
      
      if (snap.empty) {
        viendoContainer.innerHTML = '<p>No tienes animes en curso</p>';
        return;
      }

      viendoContainer.innerHTML = ''; // Limpiar contenedor
      
      for (const docSnap of snap.docs) {
        const anime = { id: docSnap.id, ...docSnap.data() };
        
        // Buscar detalles completos del anime
        try {
          const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${anime.id}`);
          const animeData = await res.json();

          const div = document.createElement('div');
          div.className = 'anime-card';
          div.style.backgroundImage = `url(${animeData.cover})`;
          div.innerHTML = `
            <img src="${animeData.cover}" alt="${animeData.title}">
            <strong>${animeData.title}</strong>
          `;
          div.addEventListener('click', () => ver(anime.id));
          viendoContainer.appendChild(div);
        } catch (error) {
          console.error(`Error al cargar detalles de anime ${anime.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error al cargar animes en curso:', error);
      viendoContainer.innerHTML = '<p>Error al cargar animes en curso</p>';
    }
  }
}

  // Cargar animes pendientes
  async function cargarPendientes() {
    const pendientesContainer = document.getElementById('pendientes');
    if (!pendientesContainer) return;

    // Esperar a que se complete la autenticación
    await new Promise(resolve => {
      onAuthStateChanged(auth, (user) => {
        resolve(user);
      });
    });

    try {
      const user = auth.currentUser;
      if (!user) {
        pendientesContainer.innerHTML = '<p>Inicia sesión para ver tus animes pendientes</p>';
        return;
      }

      const ref = collection(doc(db, "usuarios", user.uid), "pendiente");
      const snap = await getDocs(ref);
      
      if (snap.empty) {
        pendientesContainer.innerHTML = '<p>No tienes animes pendientes</p>';
        return;
      }

      pendientesContainer.innerHTML = ''; // Limpiar contenedor
      
      for (const docSnap of snap.docs) {
        const anime = { id: docSnap.id, ...docSnap.data() };
        
        // Buscar detalles completos del anime
        try {
          const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${anime.id}`);
          const animeData = await res.json();

          const div = document.createElement('div');
          div.className = 'anime-card';
          div.style.backgroundImage = `url(${animeData.cover})`;
          div.innerHTML = `
            <img src="${animeData.cover}" alt="${animeData.title}">
            <strong>${animeData.title}</strong>
          `;
          div.addEventListener('click', () => ver(anime.id));
          pendientesContainer.appendChild(div);
        } catch (error) {
          console.error(`Error al cargar detalles de anime ${anime.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error al cargar animes pendientes:', error);
      pendientesContainer.innerHTML = '<p>Error al cargar animes pendientes</p>';
    }
  }

  // Cargar animes completados
  async function cargarCompletados() {
    const completadosContainer = document.getElementById('completados');
    if (!completadosContainer) return;

    // Esperar a que se complete la autenticación
    await new Promise(resolve => {
      onAuthStateChanged(auth, (user) => {
        resolve(user);
      });
    });

    try {
      const user = auth.currentUser;
      if (!user) {
        completadosContainer.innerHTML = '<p>Inicia sesión para ver tus animes completados</p>';
        return;
      }

      const ref = collection(doc(db, "usuarios", user.uid), "visto");
      const snap = await getDocs(ref);
      
      if (snap.empty) {
        completadosContainer.innerHTML = '<p>No tienes animes completados</p>';
        return;
      }

      completadosContainer.innerHTML = ''; // Limpiar contenedor
      
      for (const docSnap of snap.docs) {
        const anime = { id: docSnap.id, ...docSnap.data() };
        
        // Buscar detalles completos del anime
        try {
          const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${anime.id}`);
          const animeData = await res.json();

          const div = document.createElement('div');
          div.className = 'anime-card';
          div.style.backgroundImage = `url(${animeData.cover})`;
          div.innerHTML = `
            <img src="${animeData.cover}" alt="${animeData.title}">
            <strong>${animeData.title}</strong>
          `;
          div.addEventListener('click', () => ver(anime.id));
          completadosContainer.appendChild(div);
        } catch (error) {
          console.error(`Error al cargar detalles de anime ${anime.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error al cargar animes completados:', error);
      completadosContainer.innerHTML = '<p>Error al cargar animes completados</p>';
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

  // Marcar el primer elemento del menú como activo al cargar
  const menuItems = document.querySelectorAll(".sidebar li");
  const sections = document.querySelectorAll(".content-section");
  const firstMenuItem = menuItems[0];
  const firstSectionId = firstMenuItem.getAttribute("data-target");

  // Marcar primer elemento como activo
  firstMenuItem.classList.add("active-menu-item");

  // Mostrar primera sección
  sections.forEach(sec => {
    sec.classList.add("hidden");
  });
  document.getElementById(firstSectionId).classList.remove("hidden");
});

//sidebar
const menuItems = document.querySelectorAll(".sidebar li");
const sections = document.querySelectorAll(".content-section");

menuItems.forEach(item => {
  item.addEventListener("click", () => {
    const targetId = item.getAttribute("data-target");

    // Quitar clase active de todos los elementos del menú
    menuItems.forEach(menuItem => {
      menuItem.classList.remove("active-menu-item");
    });

    // Agregar clase active al elemento clickeado
    item.classList.add("active-menu-item");

    // Ocultar todas las secciones
    sections.forEach(sec => {
      sec.classList.add("hidden");
    });

    // Mostrar sección seleccionada
    document.getElementById(targetId).classList.remove("hidden");
  });
});
