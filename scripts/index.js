import { db, auth } from './firebase-login.js';
import {
  collection,
  doc,
  getDocs,
  getDoc // <-- Añadir getDoc aquí
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

function extraerIdDeLink(link) {
  if (!link) return '';
  const partes = link.split('/');
  let id = partes[partes.length - 1] || '';
  // Eliminar números al final del ID
  return id.replace(/(-\d+)$/, '');
}

// Función para redirigir a la página de un anime
function ver(id) {
  window.location.href = `anime.html?id=${id}`;
}
// Mostrar la sección correspondiente al hash en la URL
function mostrarSeccionDesdeHash() {
  const hash = window.location.hash;
  if (!hash) return;

  const id = decodeURIComponent(hash.substring(1));
  const seccion = document.getElementById(id);
  if (!seccion) return;

  // Ocultar y mostrar secciones
  document.querySelectorAll(".content-section").forEach(sec => 
    sec.classList.toggle("hidden", sec.id !== id)
  );

  // Actualizar menú activo
  document.querySelectorAll('.sidebar li').forEach(item => 
    item.classList.toggle('active-menu-item', item.getAttribute('data-target') === id)
  );

  // Actualizar altura
  actualizarAlturaMain();
}

// Ejecutar al cargar la página
window.addEventListener("DOMContentLoaded", () => {
  mostrarSeccionDesdeHash();
});

// Ejecutar cuando cambia el hash (por navegación interna)
window.addEventListener("hashchange", () => {
  mostrarSeccionDesdeHash();
});

window.handleHashChange = function () {
  let hash = window.location.hash.substring(1);

  // Si no hay hash, establecer Ultimos-Episodios por defecto
  if (!hash) {
    hash = 'Ultimos-Episodios';
    history.replaceState(null, '', '#' + hash);
  }

  // Ocultar todas las secciones
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));

  // Mostrar la sección correspondiente al hash
  const targetSection = document.getElementById(hash);
  if (targetSection) {
    targetSection.classList.remove('hidden');
    actualizarAlturaMain();

    // Activar ítem del sidebar
    const activeMenuItem = document.querySelector(`.sidebar li[data-target="${hash}"]`);
    if (activeMenuItem) {
      document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
      activeMenuItem.classList.add('active');
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  // Función de temporizador de cuenta regresiva
  function iniciarTemporizador() {
    const temporizador = document.querySelector('.temporizador');
    if (!temporizador) return;

    let tiempoRestante = 17;
    const intervalId = setInterval(() => {
      temporizador.textContent = `(${tiempoRestante}s)`;
      tiempoRestante--;

      if (tiempoRestante < 0) {
        clearInterval(intervalId);
        temporizador.textContent = '';
      }
    }, 1000);
  }

  // Iniciar temporizador al cargar la página
  iniciarTemporizador();

  // Cargar contenidos
  Promise.all([
    cargarFavoritos(),
    cargarViendo(),
    cargarPendientes(),
    cargarCompletados(),
    cargarUltimosCapsVistos(),
    cargarUltimosCapitulos()
  ])
  // Eventos de redimensionamiento y cambio de sección
  window.addEventListener('resize', actualizarAlturaMain);

  // Agregar eventos para actualizar altura al cambiar secciones
  const sidebarItems = document.querySelectorAll('.sidebar li');
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      // Ocultar todas las secciones
      document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
      
      // Mostrar la sección correspondiente
      const targetId = e.target.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.remove('hidden');
        
        // Actualizar la URL sin recargar la página
        history.pushState(null, '', `#${targetId}`);
      }
      
      // Actualizar altura
      actualizarAlturaMain();
    });
  });


});

// Actualizar altura de la variable CSS --altura-main
function actualizarAlturaMain() {
  // Priorizar la sección de contenido visible
  const contentSection = document.querySelector('.content-section:not(.hidden)') || 
                         document.querySelector('.content-section');

  if (!contentSection) return;

  // Usar requestAnimationFrame para optimizar el rendimiento
  requestAnimationFrame(() => {
    // Usar offsetHeight como medida más precisa y eficiente
    const alturaFinal = contentSection.offsetHeight;
    
    // Establecer la variable CSS
    document.documentElement.style.setProperty('--altura-main', `${alturaFinal}px`);
  });
}

// Función auxiliar para crear el elemento DOM del botón "Siguiente Capítulo"
function crearElementoSiguienteCapitulo(animeDetails, capVistoData, siguienteCapitulo, siguienteEpisodio) {
  const btn = document.createElement('div');
  btn.className = 'btn-siguiente-capitulo';
  
  const portada = document.createElement('img');
  portada.src = animeDetails.portada;
  portada.alt = animeDetails.titulo;
  portada.className = 'portada-anime';
  portada.onerror = () => {
    console.warn(`No se pudo cargar la portada para ${animeDetails.titulo} (${capVistoData.animeId}) desde ${animeDetails.portada}`);
  };
  
  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  const spanTitulo = document.createElement('span'); 
  spanTitulo.classList.add('texto-2-lineas');
  spanTitulo.textContent = animeDetails.titulo;

  const spanEpisodio = document.createElement('span');
  spanEpisodio.className = 'texto-episodio';
  spanEpisodio.textContent = `Ep. ${siguienteCapitulo}`;

  contenedorTexto.appendChild(spanTitulo);
  contenedorTexto.appendChild(spanEpisodio);
  
  btn.appendChild(portada);
  btn.appendChild(contenedorTexto);
  
  btn.addEventListener('click', () => {
    window.location.href = `ver.html?animeId=${capVistoData.animeId}&url=${encodeURIComponent(siguienteEpisodio.url)}`;
  });

  return btn;
}

// Cargar últimos capítulos vistos
async function cargarUltimosCapsVistos() {
  const ultimosCapsContainer = document.getElementById('ultimos-caps-viendo');
  if (!ultimosCapsContainer) return;

  // Esperar a que se complete la autenticación
  const user = await new Promise(resolve => {
    onAuthStateChanged(auth, (user) => {
      resolve(user);
    });
  });

  if (!user) {
    ultimosCapsContainer.innerHTML = '<p>Inicia sesión para ver tus últimos capítulos</p>';
    return;
  }

  try {
    const ref = collection(doc(db, "usuarios", user.uid), "caps-vistos");
    const snap = await getDocs(ref);
    
    if (snap.empty) {
      ultimosCapsContainer.innerHTML = '<p>No tienes capítulos vistos</p>';
      return;
    }

    ultimosCapsContainer.innerHTML = '';
    
    const ultimosCaps = await Promise.all(snap.docs.map(async (docSnap) => {
      // Datos del usuario sobre este anime (qué episodios vio)
      const capVistoData = { animeId: docSnap.id, ...docSnap.data() };
      
      try {
        // 1. Obtener detalles del anime desde la colección 'datos-anime'
        const animeDocRef = doc(db, "datos-animes", capVistoData.animeId); // <-- Corregido a plural
        const animeDocSnap = await getDoc(animeDocRef); // Necesitarás importar getDoc

        if (!animeDocSnap.exists()) {
          console.warn(`No se encontraron datos en Firestore para el anime ID: ${capVistoData.animeId}`);
          return undefined; // Omitir si no hay datos del anime
        }

        const animeDetails = animeDocSnap.data();

        // Verificar si tenemos la información necesaria en animeDetails
        if (!animeDetails.portada || !animeDetails.episodios || !animeDetails.titulo) {
            console.warn(`Datos incompletos para anime ${capVistoData.animeId} en 'datos-anime'. Omitiendo.`);
            return undefined; // Omitir este anime si faltan datos clave
        }

        // 2. Calcular el siguiente episodio basado en lo que el usuario vio
        const ultimoCapVisto = Math.max(...capVistoData.episodiosVistos.map(Number));
        const siguienteCapitulo = ultimoCapVisto + 1;
        
        // 3. Buscar el siguiente episodio en los valores del mapa 'episodios'
        const todosLosEpisodiosMapas = Object.values(animeDetails.episodios || {}); // Obtener los mapas internos
        const siguienteEpisodio = todosLosEpisodiosMapas.find(epMap => epMap.numero === siguienteCapitulo); // Buscar por epMap.numero

        // 4. Crear el botón si se encuentra el siguiente episodio
        if (siguienteEpisodio && siguienteEpisodio.url) { 
          // Llamar a la función auxiliar para crear el botón
          return crearElementoSiguienteCapitulo(animeDetails, capVistoData, siguienteCapitulo, siguienteEpisodio);
        } else {
            console.log(`No se encontró siguiente episodio (${siguienteCapitulo}) o URL para ${animeDetails.titulo} (${capVistoData.animeId})`);
            return undefined; 
        }
      } catch (error) {
        // Capturar errores al obtener/procesar datos de Firestore para este anime específico
        console.error(`Error al procesar anime visto ${capVistoData.animeId}:`, error);
        return undefined; // Omitir en caso de error
      }
    }));

    // Filtrar elementos no nulos (botones creados)
    const ultimosCapsValidos = ultimosCaps.filter(cap => cap !== undefined);
    
    // Usar DocumentFragment para añadir los botones de forma eficiente
    const fragment = document.createDocumentFragment(); 
    ultimosCapsValidos.forEach(cap => fragment.appendChild(cap)); 

    // Añadir el fragmento completo al contenedor una sola vez
    ultimosCapsContainer.appendChild(fragment); 

    // Actualizar altura inmediatamente después de cargar los capítulos
    actualizarAlturaMain();

  } catch (error) {
    console.error('Error al cargar últimos capítulos vistos:', error);
    ultimosCapsContainer.innerHTML = '<p>Error al cargar últimos capítulos</p>';
    // Actualizar altura en caso de error
    actualizarAlturaMain();
  }
}

  // Función para crear tarjeta de anime
  function createAnimeCard(anime) {
    const cover = anime.cover || anime.image || anime.poster || 'URL_POR_DEFECTO';
    const title = anime.title || anime.name || anime.nombre || 'Anime sin nombre';
    const link = anime.link || anime.url || '';
    const animeId = anime.id || anime.anime_id || '';

    const div = document.createElement('div');
    div.className = 'anime-card';
    div.style.backgroundImage = `url(${cover})`;
    div.innerHTML = `
      <img src="${cover}" alt="${title}">
      <strong>${title}</strong>
    `;
    
    div.addEventListener('click', () => {
      console.log('Datos del anime clickeado:', {
        title,
        link,
        animeId
      });

      // Intentar múltiples formas de obtener el ID
      if (animeId) {
        console.log('Navegando con ID directo:', animeId);
        ver(animeId);
      } else {
        const extractedId = extraerIdDeLink(link);
        console.log('ID extraído del enlace:', extractedId);
        
        if (extractedId) {
          ver(extractedId);
        } else {
          console.error('No se pudo extraer ID para:', title, 'Link:', link);
          alert(`No se pudo encontrar el ID para: ${title}`);
        }
      }
    });

    return div;
  }

  // Función principal para cargar últimos capítulos
  async function cargarUltimosCapitulos() {
    const mainContainer = document.getElementById('ultimos-episodios');
    if (!mainContainer) return;

    try {
      const res = await fetch('https://backend-animeflv-lite.onrender.com/api/latest', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Error de red: ${res.status}`);
      }
      
      const data = await res.json();

      // Encontrar array de animes de forma dinámica
      const animesArray = Array.isArray(data) ? data :
        Array.isArray(data.data) ? data.data :
        Array.isArray(data.results) ? data.results :
        (data.animes && Array.isArray(data.animes)) ? data.animes : [];

      // Limpiar contenedor
      mainContainer.innerHTML = '';

      // Filtrar y renderizar animes válidos
      const validAnimes = animesArray.filter(anime => anime);
      
      if (validAnimes.length === 0) {
        mainContainer.innerHTML = '<p>No hay episodios recientes</p>';
        return;
      }

      // Ocultar elementos de cargando servidores
      const cargandoServidores = document.querySelectorAll('.cargando-servidores');
      cargandoServidores.forEach(elemento => {
        elemento.style.display = 'none';
      });

      // Crear fragmento para mejor rendimiento
      const fragment = document.createDocumentFragment();
      validAnimes.forEach(anime => {
        const animeCard = createAnimeCard(anime);
        fragment.appendChild(animeCard);
      });

      mainContainer.appendChild(fragment);

    } catch (err) {
      console.error('Error al cargar últimos episodios:', err);
      mainContainer.innerHTML = `<p>Error: ${err.message}</p>`;
    }
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

      viendoContainer.innerHTML = ''; 
      
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

      pendientesContainer.innerHTML = ''; 
      
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

      completadosContainer.innerHTML = ''; 
      
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
    
    // Si el sidebar se abre y no está en la parte superior, hacer scroll
    if (sidebar.classList.contains("active") && window.scrollY > 0) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
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

  // Soporte para cerrar sidebar con gesto de deslizamiento
  let touchStartX = 0;
  let touchEndX = 0;

  sidebar.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, false);

  sidebar.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, false);

  function handleSwipe() {
    // Si el sidebar está activo y el deslizamiento es hacia la izquierda
    if (sidebar.classList.contains('active') && touchEndX < touchStartX) {
      const swipeDistance = touchStartX - touchEndX;
      // Si el deslizamiento es significativo (más de 50 píxeles)
      if (swipeDistance > 50) {
        sidebar.classList.remove('active');
      }
    }
  }

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
