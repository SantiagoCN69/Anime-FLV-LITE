import { db, auth } from './firebase-login.js';
import {
  collection,
  doc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";


document.addEventListener('DOMContentLoaded', () => {
  cargarFavoritos();
  cargarViendo();
  cargarPendientes();
  cargarCompletados();
});

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

// Redirige a la página de anime
function ver(id) {
  location.href = `anime.html?id=${id}`;
}

// Extrae el id de un link tipo '/anime/dragon-ball-z' => 'dragon-ball-z'

