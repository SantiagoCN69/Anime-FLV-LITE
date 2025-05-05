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
// Acepta un objeto con los datos necesarios.
function crearElementoSiguienteCapitulo(itemData) {
  const btn = document.createElement('div');
  btn.className = 'btn-siguiente-capitulo';
  
  const portada = document.createElement('img');
  portada.src = itemData.portada;
  portada.alt = itemData.titulo;
  portada.className = 'portada-anime';
  portada.onerror = () => {
    // Opcional: establecer una imagen por defecto si la portada no carga
    // portada.src = 'path/to/default/image.png'; 
  };
  
  const contenedorTexto = document.createElement('div');
  contenedorTexto.className = 'contenedor-texto-capitulo';

  const spanTitulo = document.createElement('span'); 
  spanTitulo.classList.add('texto-2-lineas');
  spanTitulo.textContent = itemData.titulo;

  const spanEpisodio = document.createElement('span');
  spanEpisodio.className = 'texto-episodio';
  spanEpisodio.textContent = `Ep. ${itemData.siguienteCapitulo}`;

  contenedorTexto.appendChild(spanTitulo);
  contenedorTexto.appendChild(spanEpisodio);
  
  btn.appendChild(portada);
  btn.appendChild(contenedorTexto);
  
  btn.addEventListener('click', () => {
    window.location.href = `ver.html?animeId=${itemData.animeId}&url=${encodeURIComponent(itemData.siguienteEpisodioUrl)}`;
  });

  return btn;
}

// Cargar últimos capítulos vistos
async function cargarUltimosCapsVistos() {
  const ultimosCapsContainer = document.getElementById('ultimos-caps-viendo');
  if (!ultimosCapsContainer) return;

  // Función auxiliar para renderizar botones desde una lista de datos
  const renderizarBotones = (datos) => {
    ultimosCapsContainer.innerHTML = ''; // Limpiar antes de renderizar
    if (!datos || datos.length === 0) {
        ultimosCapsContainer.innerHTML = '<p>No tienes capítulos siguientes disponibles.</p>';
        return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(itemData => {
      const btn = crearElementoSiguienteCapitulo(itemData);
      if (btn) {
        fragment.appendChild(btn);
      }
    });
    ultimosCapsContainer.appendChild(fragment);
    actualizarAlturaMain(); // Actualizar altura después de renderizar
  };

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

  const cacheKey = `ultimosCapsVistosCache_${user.uid}`;
  let cachedData = null;

  // 1. Intentar cargar y mostrar desde localStorage
  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
      cachedData = JSON.parse(cachedDataString);
      if (Array.isArray(cachedData)) {
        console.log("Mostrando datos desde caché...");
        renderizarBotones(cachedData);
      } else {
        cachedData = null; // Datos inválidos en caché
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error al leer o parsear caché:", error);
    cachedData = null; // Asegurar que no se use caché corrupta
    localStorage.removeItem(cacheKey); // Limpiar caché corrupta
  }

  // 2. Cargar datos frescos desde Firestore
  try {
    const ref = collection(doc(db, "usuarios", user.uid), "caps-vistos");
    const snap = await getDocs(ref);
    
    let freshData = []; // Aquí guardaremos los datos frescos formateados

    if (!snap.empty) {
      freshData = (await Promise.all(snap.docs.map(async (docSnap) => {
        const capVistoData = { animeId: docSnap.id, ...docSnap.data() };
        
        try {
          const animeDocRef = doc(db, "datos-animes", capVistoData.animeId);
          const animeDocSnap = await getDoc(animeDocRef);

          if (!animeDocSnap.exists()) return null; // Omitir si no hay datos
          
          const animeDetails = animeDocSnap.data();

          if (!animeDetails.portada || !animeDetails.episodios || !animeDetails.titulo) return null; // Omitir si faltan datos

          const ultimoCapVisto = Math.max(...(capVistoData.episodiosVistos || []).map(Number), 0);
          const siguienteCapitulo = ultimoCapVisto + 1;
          
          const todosLosEpisodiosMapas = Object.values(animeDetails.episodios || {});
          const siguienteEpisodio = todosLosEpisodiosMapas.find(epMap => epMap.numero === siguienteCapitulo);

          if (siguienteEpisodio && siguienteEpisodio.url) { 
            // Devolver el objeto con los datos necesarios para el botón y caché
            return {
              animeId: capVistoData.animeId,
              portada: animeDetails.portada,
              titulo: animeDetails.titulo,
              siguienteCapitulo: siguienteCapitulo,
              siguienteEpisodioUrl: siguienteEpisodio.url
            };
          } else {
            return null; // No hay siguiente episodio válido
          }
        } catch (error) {
          console.error(`Error al procesar anime visto ${capVistoData.animeId}:`, error);
          return null; // Omitir en caso de error
        }
      }))).filter(item => item !== null); // Filtrar los resultados nulos
    }

    // 3. Comparar datos frescos con caché y actualizar si es necesario
    const freshDataString = JSON.stringify(freshData);
    const cachedDataString = JSON.stringify(cachedData); // Usar el stringify de la caché cargada antes

    if (freshDataString !== cachedDataString) {
      console.log("Datos de Firestore diferentes a la caché. Actualizando UI y caché...");
      renderizarBotones(freshData); // Renderizar con los datos frescos
      localStorage.setItem(cacheKey, freshDataString); // Actualizar caché
    } else {
        if (cachedData === null && freshData.length === 0) {
            // Si no había caché y no hay datos frescos, mostrar mensaje adecuado
            ultimosCapsContainer.innerHTML = '<p>No tienes capítulos siguientes disponibles.</p>';
            actualizarAlturaMain();
        } else if (cachedData === null && freshData.length > 0) {
            // Si no había caché pero sí hay datos frescos (primera carga, por ejemplo)
            console.log("Mostrando datos frescos (sin caché previa).");
            renderizarBotones(freshData);
            localStorage.setItem(cacheKey, freshDataString); // Guardar en caché por primera vez
        } else {
            console.log("Datos de Firestore coinciden con la caché. No se requiere actualización.");
        }
    }

  } catch (error) {
    console.error('Error general al cargar últimos capítulos vistos desde Firestore:', error);
    // No se modifica el contenedor aquí si la caché ya mostró algo
    // Si la caché falló y Firestore también, podría quedar vacío o con el error de caché.
    // Se podría añadir un mensaje de error genérico si cachedData es null aquí.
    if (cachedData === null) { // Solo mostrar error si no se pudo mostrar nada desde caché
        ultimosCapsContainer.innerHTML = '<p>Error al cargar últimos capítulos</p>';
        actualizarAlturaMain();
    }
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

// Función principal para cargar últimos capítulos generales desde la API
async function cargarUltimosCapitulos() {
  const mainContainer = document.getElementById('ultimos-episodios');
  if (!mainContainer) return;

  // Función auxiliar para renderizar tarjetas de anime
  const renderizarUltimosEpisodios = (datos) => {
    mainContainer.innerHTML = ''; // Limpiar antes de renderizar
    if (!datos || datos.length === 0) {
        mainContainer.innerHTML = '<p>No se encontraron últimos episodios.</p>';
        actualizarAlturaMain(); // Asegurar altura correcta incluso sin episodios
        return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(anime => {
      // Asegurarse de pasar un objeto válido a createAnimeCard
      const card = createAnimeCard(anime || {}); 
      if (card) {
        fragment.appendChild(card);
      }
    });
    mainContainer.appendChild(fragment);
    actualizarAlturaMain(); // Actualizar altura después de renderizar
  };

  const cacheKey = 'ultimosEpisodiosGeneralesCache';
  let cachedData = null;

  // 1. Intentar cargar y mostrar desde localStorage
  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
      cachedData = JSON.parse(cachedDataString);
      if (Array.isArray(cachedData)) {
        console.log("Mostrando últimos episodios desde caché...");
        renderizarUltimosEpisodios(cachedData);
      } else {
        cachedData = null;
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error al leer o parsear caché de últimos episodios:", error);
    cachedData = null;
    localStorage.removeItem(cacheKey);
  }

  // 2. Cargar datos frescos desde la API
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
    let freshDataRaw = [];
    const possibleKeys = ['latestEpisodes', 'animesEnEmision', 'ultimosAnimes', 'data', 'results', 'animes'];
    for (const key of possibleKeys) {
        if (Array.isArray(data[key])) {
            freshDataRaw = data[key];
            break;
        }
    }
    // Si no se encuentra en las claves esperadas, intentar buscar cualquier array en el primer nivel
    if (freshDataRaw.length === 0) {
        for (const key in data) {
            if (Array.isArray(data[key])) {
                freshDataRaw = data[key];
                break;
            }
        }
    }
     // Si data es directamente el array
     if (freshDataRaw.length === 0 && Array.isArray(data)) {
        freshDataRaw = data;
     }


    // Mapear/limpiar los datos frescos para asegurar formato consistente
    const freshData = freshDataRaw.map(item => ({ 
        // Intentar extraer ID de varias formas, incluyendo desde el link si es necesario
        id: item.id 
        || item.anime_id 
        || (item.url ? item.url.split('/').pop().replace(/-\d+$/, '') : 'id_desconocido_' + Math.random().toString(16).slice(2)),
        title: item.title || item.name || item.nombre || 'Anime sin título',
        cover: item.cover || item.image || item.poster || 'img/background.webp', // URL por defecto más genérica
        link: item.url || '' // Guardar el link original
    })).filter(item => item.title !== 'Anime sin título'); // Filtrar items sin título válido


    // 3. Comparar datos frescos con caché y actualizar si es necesario
    const freshDataString = JSON.stringify(freshData);
    const cachedDataString = JSON.stringify(cachedData);

    if (freshDataString !== cachedDataString) {
      console.log("Datos de API diferentes a la caché. Actualizando UI y caché...");
      renderizarUltimosEpisodios(freshData);
      // Solo guardar en caché si hay datos válidos
      if (freshData && freshData.length > 0) { 
          localStorage.setItem(cacheKey, freshDataString);
      } else {
          // Si los datos frescos están vacíos, limpiar la caché también
          localStorage.removeItem(cacheKey);
      }
    } else {
      // Si son iguales, pero no había caché (primera carga) y hay datos frescos
      if (cachedData === null && freshData && freshData.length > 0) {
          console.log("Mostrando datos frescos de API (sin caché previa).");
          renderizarUltimosEpisodios(freshData);
          localStorage.setItem(cacheKey, freshDataString); // Guardar caché por primera vez
      } 
      // Si no había caché y tampoco hay datos frescos
      else if (cachedData === null && (!freshData || freshData.length === 0)) {
           renderizarUltimosEpisodios([]); // Asegura mostrar mensaje "No se encontraron..."
      } 
      // Si son iguales y había caché, simplemente log
      else {
          console.log("Datos de API coinciden con la caché. No se requiere actualización.");
      }
    }

  } catch (error) {
    console.error('Error al cargar últimos capítulos desde API:', error);
    // Solo mostrar error en UI si no se pudo mostrar nada desde caché
    if (cachedData === null) { 
      mainContainer.innerHTML = '<p>Error al cargar últimos episodios.</p>';
      actualizarAlturaMain();
    }
    // Si ya se mostró desde caché, dejamos la UI como está para no perder información
  }
}

  // Cargar animes favoritos
async function cargarFavoritos() {
  const favsContainer = document.getElementById('favs');
  if (!favsContainer) return;

  // Función auxiliar para renderizar favoritos
  const renderizarFavoritos = (datos) => {
    favsContainer.innerHTML = ''; // Limpiar antes de renderizar
    if (!datos || datos.length === 0) {
        favsContainer.innerHTML = '<p>No tienes animes favoritos.</p>';
        actualizarAlturaMain();
        return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(anime => {
      // Usar los datos del objeto anime (id, titulo, portada)
      const div = document.createElement('div');
      div.className = 'anime-card';
      div.style.backgroundImage = `url(${anime.portada || 'img/background.webp'})`; // Usar portada o default
      div.innerHTML = `
        <img src="${anime.portada || 'img/background.webp'}" alt="${anime.titulo || 'Título no encontrado'}">
        <strong>${anime.titulo || 'Título no encontrado'}</strong>
      `;
      div.addEventListener('click', () => ver(anime.id));
      fragment.appendChild(div);
    });
    favsContainer.appendChild(fragment);
    actualizarAlturaMain();
  };

  // Esperar a que se complete la autenticación
  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Dejar de escuchar después de obtener el estado inicial
      resolve(user);
    });
  });

  if (!user) {
    favsContainer.innerHTML = '<p>Inicia sesión para ver tus favoritos</p>';
    actualizarAlturaMain(); // Asegurar altura
    return;
  }

  const userId = user.uid;
  const cacheKey = `favoritosCache_${userId}`;
  let cachedData = null;

  // 1. Intentar cargar y mostrar desde localStorage
  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
      cachedData = JSON.parse(cachedDataString);
      if (Array.isArray(cachedData)) {
        console.log("Mostrando favoritos desde caché...");
        renderizarFavoritos(cachedData);
      } else {
        cachedData = null;
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error al leer o parsear caché de favoritos:", error);
    cachedData = null;
    localStorage.removeItem(cacheKey);
  }

  // 2. Cargar datos frescos desde Firestore
  try {
    const ref = collection(doc(db, "usuarios", userId), "favoritos");
    const snap = await getDocs(ref);
    
    let freshData = []; // Array para guardar los datos frescos procesados

    if (!snap.empty) {
      const promises = [];
      for (const docSnap of snap.docs) {
        const animeId = docSnap.id;
        const detallePromise = getDoc(doc(db, "datos-animes", animeId))
          .then(animeDetalleSnap => {
            if (animeDetalleSnap.exists()) {
              const animeData = animeDetalleSnap.data();
              // Devolver solo los datos necesarios para la caché y renderizado
              return {
                id: animeId,
                titulo: animeData.titulo || 'Título no encontrado',
                portada: animeData.portada || 'img/background.webp'
              };
            } else {
              console.warn(`No se encontraron detalles para el anime favorito con ID: ${animeId}`);
              return null;
            }
          })
          .catch(error => {
            console.error(`Error al buscar detalles del anime favorito ${animeId}:`, error);
            return null;
          });
        promises.push(detallePromise);
      }
      
      const resultados = await Promise.all(promises);
      freshData = resultados.filter(item => item !== null); // Filtrar nulos
    }
    // Si snap estaba vacío, freshData permanecerá vacío, lo cual es correcto.

    // 3. Comparar datos frescos con caché y actualizar si es necesario
    const freshDataString = JSON.stringify(freshData);
    const cachedDataString = JSON.stringify(cachedData);

    if (freshDataString !== cachedDataString) {
      // Solo renderizar si los datos son diferentes O si no había caché
      if (cachedData === null || freshData.length !== (cachedData || []).length || freshDataString !== cachedDataString) {
        console.log("Datos de Firestore diferentes a la caché de favoritos o sin caché previa. Actualizando UI y caché...");
        renderizarFavoritos(freshData);
      }
      // Guardar o limpiar caché según los datos frescos
      if (freshData && freshData.length > 0) {
          localStorage.setItem(cacheKey, freshDataString);
      } else {
          localStorage.removeItem(cacheKey);
          // Si no había caché y tampoco hay datos frescos, asegurar mostrar mensaje.
          // Si snap estaba vacío, renderizar ya mostró el mensaje. Si no, lo mostramos ahora.
          if (cachedData === null && !snap.empty) {
              renderizarFavoritos([]); 
          }
      }
    } else {
      // Si son iguales y había caché, no es necesario re-renderizar ni actualizar caché.
      if (cachedData !== null) {
         console.log("Datos de Firestore coinciden con la caché de favoritos. No se requiere actualización.");
      } 
      // Si son iguales pero no había caché (primera carga) y hay datos frescos, 
      // ya se renderizó desde la caché (que estaba vacía) o se renderizará ahora.
      // Nos aseguramos de que esté renderizado y guardamos la caché.
      else if (cachedData === null && freshData && freshData.length > 0) {
          console.log("Mostrando datos frescos de Firestore (sin caché previa de favoritos).");
          // Puede que ya se haya renderizado si la caché estaba vacía, pero aseguramos.
          renderizarFavoritos(freshData); 
          localStorage.setItem(cacheKey, freshDataString);
      }
      // Si son iguales (vacíos) y no había caché, el mensaje de "no tienes favoritos" 
      // ya se mostró o se mostrará por renderizar un array vacío.
      else if (cachedData === null && (!freshData || freshData.length === 0)) {
          console.log("No hay favoritos en Firestore ni en caché.");
          // Asegurar que se muestra el mensaje correcto si no se hizo antes
          renderizarFavoritos([]); 
      }
    }

  } catch (error) {
    console.error('Error al cargar favoritos desde Firestore:', error);
    // Solo mostrar error en UI si no se pudo mostrar nada desde caché
    if (cachedData === null) { 
      favsContainer.innerHTML = '<p>Error al cargar favoritos.</p>';
      actualizarAlturaMain();
    }
    // Si ya se mostró desde caché, dejamos la UI como está.
  }
}

// Cargar animes en curso
async function cargarViendo() {
  const viendoContainer = document.getElementById('viendo');
  if (!viendoContainer) return;

  // Función auxiliar para renderizar animes en curso
  const renderizarViendo = (datos) => {
    viendoContainer.innerHTML = ''; // Limpiar antes de renderizar
    if (!datos || datos.length === 0) {
      viendoContainer.innerHTML = '<p>No tienes animes en curso.</p>';
      actualizarAlturaMain();
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(anime => {
      const div = document.createElement('div');
      div.className = 'anime-card';
      div.style.backgroundImage = `url(${anime.portada || 'img/background.webp'})`;
      div.innerHTML = `
        <img src="${anime.portada || 'img/background.webp'}" alt="${anime.titulo || 'Título no encontrado'}">
        <strong>${anime.titulo || 'Título no encontrado'}</strong>
      `;
      div.addEventListener('click', () => ver(anime.id));
      fragment.appendChild(div);
    });
    viendoContainer.appendChild(fragment);
    actualizarAlturaMain();
  };

  // Esperar a que se complete la autenticación
  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Dejar de escuchar después de obtener el estado inicial
      resolve(user);
    });
  });

  if (!user) {
    viendoContainer.innerHTML = '<p>Inicia sesión para ver tus animes en curso</p>';
    actualizarAlturaMain();
    return;
  }

  const userId = user.uid;
  const cacheKey = `viendoCache_${userId}`;
  let cachedData = null;

  // 1. Intentar cargar y mostrar desde localStorage
  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
      cachedData = JSON.parse(cachedDataString);
      if (Array.isArray(cachedData)) {
        console.log("Mostrando 'Viendo' desde caché...");
        renderizarViendo(cachedData);
      } else {
        cachedData = null;
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error al leer o parsear caché de 'Viendo':", error);
    cachedData = null;
    localStorage.removeItem(cacheKey);
  }

  // 2. Cargar datos frescos desde Firestore
  try {
    const ref = collection(doc(db, "usuarios", userId), "viendo");
    const snap = await getDocs(ref);
    
    let freshData = []; // Array para guardar los datos frescos procesados

    if (!snap.empty) {
      const promises = [];
      for (const docSnap of snap.docs) {
        const animeId = docSnap.id;
        // Crear una promesa para buscar los detalles en 'datos-animes'
        const detallePromise = getDoc(doc(db, "datos-animes", animeId))
          .then(animeDetalleSnap => {
            if (animeDetalleSnap.exists()) {
              const animeData = animeDetalleSnap.data();
              return {
                id: animeId,
                titulo: animeData.titulo || 'Título no encontrado',
                portada: animeData.portada || 'img/background.webp'
              };
            } else {
              console.warn(`No se encontraron detalles para el anime en curso con ID: ${animeId}`);
              return null;
            }
          })
          .catch(error => {
            console.error(`Error al buscar detalles del anime en curso ${animeId}:`, error);
            return null;
          });
        promises.push(detallePromise);
      }
      
      const resultados = await Promise.all(promises);
      freshData = resultados.filter(item => item !== null); // Filtrar nulos
    }

    // 3. Comparar datos frescos con caché y actualizar si es necesario
    const freshDataString = JSON.stringify(freshData);
    const cachedDataString = JSON.stringify(cachedData);

    if (freshDataString !== cachedDataString) {
      // Solo renderizar si los datos son diferentes O si no había caché
      if (cachedData === null || freshData.length !== (cachedData || []).length || freshDataString !== cachedDataString) {
        console.log("Datos de Firestore diferentes a la caché de 'Viendo' o sin caché previa. Actualizando UI y caché...");
        renderizarViendo(freshData);
      }
      // Guardar o limpiar caché según los datos frescos
      if (freshData && freshData.length > 0) {
          localStorage.setItem(cacheKey, freshDataString);
      } else {
          localStorage.removeItem(cacheKey);
          // Si no había caché y tampoco hay datos frescos, asegurar mostrar mensaje.
          if (cachedData === null && !snap.empty) {
              renderizarViendo([]); 
          }
      }
    } else {
      // Si son iguales y había caché, no es necesario re-renderizar ni actualizar caché.
      if (cachedData !== null) {
         console.log("Datos de Firestore coinciden con la caché de 'Viendo'. No se requiere actualización.");
      } 
      // Manejar caso donde no había caché pero los datos frescos sí existen (primera carga)
      else if (cachedData === null && freshData && freshData.length > 0) {
          console.log("Mostrando datos frescos de Firestore (sin caché previa de 'Viendo').");
          renderizarViendo(freshData); 
          localStorage.setItem(cacheKey, freshDataString);
      }
      // Manejar caso donde no hay datos ni en caché ni en Firestore
      else if (cachedData === null && (!freshData || freshData.length === 0)) {
          console.log("No hay animes 'Viendo' en Firestore ni en caché.");
          renderizarViendo([]); // Asegurar mensaje de "no tienes..."
      }
    }

  } catch (error) {
    console.error('Error al cargar animes en curso desde Firestore:', error);
    // Solo mostrar error en UI si no se pudo mostrar nada desde caché
    if (cachedData === null) { 
      viendoContainer.innerHTML = '<p>Error al cargar animes en curso.</p>';
      actualizarAlturaMain();
    }
  }
}


  // Cargar animes pendientes
async function cargarPendientes() {
  const pendientesContainer = document.getElementById('pendientes');
  if (!pendientesContainer) return;

  // Función auxiliar para renderizar animes pendientes
  const renderizarPendientes = (datos) => {
    pendientesContainer.innerHTML = ''; // Limpiar antes de renderizar
    if (!datos || datos.length === 0) {
      pendientesContainer.innerHTML = '<p>No tienes animes pendientes.</p>';
      actualizarAlturaMain();
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(anime => {
      const div = document.createElement('div');
      div.className = 'anime-card';
      div.style.backgroundImage = `url(${anime.portada || 'img/background.webp'})`;
      div.innerHTML = `
        <img src="${anime.portada || 'img/background.webp'}" alt="${anime.titulo || 'Título no encontrado'}">
        <strong>${anime.titulo || 'Título no encontrado'}</strong>
      `;
      div.addEventListener('click', () => ver(anime.id));
      fragment.appendChild(div);
    });
    pendientesContainer.appendChild(fragment);
    actualizarAlturaMain();
  };

  // Esperar a que se complete la autenticación
  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Dejar de escuchar después de obtener el estado inicial
      resolve(user);
    });
  });

  if (!user) {
    pendientesContainer.innerHTML = '<p>Inicia sesión para ver tus animes pendientes</p>';
    actualizarAlturaMain();
    return;
  }

  const userId = user.uid;
  const cacheKey = `pendientesCache_${userId}`;
  let cachedData = null;

  // 1. Intentar cargar y mostrar desde localStorage
  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
      cachedData = JSON.parse(cachedDataString);
      if (Array.isArray(cachedData)) {
        console.log("Mostrando 'Pendientes' desde caché...");
        renderizarPendientes(cachedData);
      } else {
        cachedData = null;
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error al leer o parsear caché de 'Pendientes':", error);
    cachedData = null;
    localStorage.removeItem(cacheKey);
  }

  // 2. Cargar datos frescos desde Firestore
  try {
    const ref = collection(doc(db, "usuarios", userId), "pendiente");
    const snap = await getDocs(ref);
    
    let freshData = []; // Array para guardar los datos frescos procesados

    if (!snap.empty) {
      const promises = [];
      for (const docSnap of snap.docs) {
        const animeId = docSnap.id;
        // Crear una promesa para buscar los detalles en 'datos-animes'
        const detallePromise = getDoc(doc(db, "datos-animes", animeId))
          .then(animeDetalleSnap => {
            if (animeDetalleSnap.exists()) {
              const animeData = animeDetalleSnap.data();
              return {
                id: animeId,
                titulo: animeData.titulo || 'Título no encontrado',
                portada: animeData.portada || 'img/background.webp'
              };
            } else {
              console.warn(`No se encontraron detalles para el anime pendiente con ID: ${animeId}`);
              return null;
            }
          })
          .catch(error => {
            console.error(`Error al buscar detalles del anime pendiente ${animeId}:`, error);
            return null;
          });
        promises.push(detallePromise);
      }
      
      const resultados = await Promise.all(promises);
      freshData = resultados.filter(item => item !== null); // Filtrar nulos
    }

    // 3. Comparar datos frescos con caché y actualizar si es necesario
    const freshDataString = JSON.stringify(freshData);
    const cachedDataString = JSON.stringify(cachedData);

    if (freshDataString !== cachedDataString) {
      // Solo renderizar si los datos son diferentes O si no había caché
      if (cachedData === null || freshData.length !== (cachedData || []).length || freshDataString !== cachedDataString) {
        console.log("Datos de Firestore diferentes a la caché de 'Pendientes' o sin caché previa. Actualizando UI y caché...");
        renderizarPendientes(freshData);
      }
      // Guardar o limpiar caché según los datos frescos
      if (freshData && freshData.length > 0) {
          localStorage.setItem(cacheKey, freshDataString);
      } else {
          localStorage.removeItem(cacheKey);
          // Si no había caché y tampoco hay datos frescos, asegurar mostrar mensaje.
          if (cachedData === null && !snap.empty) {
              renderizarPendientes([]); 
          }
      }
    } else {
      // Si son iguales y había caché, no es necesario re-renderizar ni actualizar caché.
      if (cachedData !== null) {
         console.log("Datos de Firestore coinciden con la caché de 'Pendientes'. No se requiere actualización.");
      } 
      // Manejar caso donde no había caché pero los datos frescos sí existen (primera carga)
      else if (cachedData === null && freshData && freshData.length > 0) {
          console.log("Mostrando datos frescos de Firestore (sin caché previa de 'Pendientes').");
          renderizarPendientes(freshData); 
          localStorage.setItem(cacheKey, freshDataString);
      }
      // Manejar caso donde no hay datos ni en caché ni en Firestore
      else if (cachedData === null && (!freshData || freshData.length === 0)) {
          console.log("No hay animes 'Pendientes' en Firestore ni en caché.");
          renderizarPendientes([]); // Asegurar mensaje de "no tienes..."
      }
    }

  } catch (error) {
    console.error('Error al cargar animes pendientes desde Firestore:', error);
    // Solo mostrar error en UI si no se pudo mostrar nada desde caché
    if (cachedData === null) { 
      pendientesContainer.innerHTML = '<p>Error al cargar animes pendientes.</p>';
      actualizarAlturaMain();
    }
  }
}

  // Cargar animes completados
async function cargarCompletados() {
  const completadosContainer = document.getElementById('completados');
  if (!completadosContainer) return;

  // Función auxiliar para renderizar animes completados
  const renderizarCompletados = (datos) => {
    completadosContainer.innerHTML = ''; // Limpiar antes de renderizar
    if (!datos || datos.length === 0) {
      completadosContainer.innerHTML = '<p>No tienes animes completados.</p>';
      actualizarAlturaMain();
      return;
    }
    const fragment = document.createDocumentFragment();
    datos.forEach(anime => {
      const div = document.createElement('div');
      div.className = 'anime-card';
      div.style.backgroundImage = `url(${anime.portada || 'img/background.webp'})`;
      div.innerHTML = `
        <img src="${anime.portada || 'img/background.webp'}" alt="${anime.titulo || 'Título no encontrado'}">
        <strong>${anime.titulo || 'Título no encontrado'}</strong>
      `;
      div.addEventListener('click', () => ver(anime.id));
      fragment.appendChild(div);
    });
    completadosContainer.appendChild(fragment);
    actualizarAlturaMain();
  };

  // Esperar a que se complete la autenticación
  const user = await new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Dejar de escuchar después de obtener el estado inicial
      resolve(user);
    });
  });

  if (!user) {
    completadosContainer.innerHTML = '<p>Inicia sesión para ver tus animes completados</p>';
    actualizarAlturaMain();
    return;
  }

  const userId = user.uid;
  const cacheKey = `completadosCache_${userId}`;
  let cachedData = null;

  // 1. Intentar cargar y mostrar desde localStorage
  try {
    const cachedDataString = localStorage.getItem(cacheKey);
    if (cachedDataString) {
      cachedData = JSON.parse(cachedDataString);
      if (Array.isArray(cachedData)) {
        console.log("Mostrando 'Completados' desde caché...");
        renderizarCompletados(cachedData);
      } else {
        cachedData = null;
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.error("Error al leer o parsear caché de 'Completados':", error);
    cachedData = null;
    localStorage.removeItem(cacheKey);
  }

  // 2. Cargar datos frescos desde Firestore
  try {
    const ref = collection(doc(db, "usuarios", userId), "visto"); // Colección 'visto'
    const snap = await getDocs(ref);
    
    let freshData = []; // Array para guardar los datos frescos procesados

    if (!snap.empty) {
      const promises = [];
      for (const docSnap of snap.docs) {
        const animeId = docSnap.id;
        // Crear una promesa para buscar los detalles en 'datos-animes'
        const detallePromise = getDoc(doc(db, "datos-animes", animeId))
          .then(animeDetalleSnap => {
            if (animeDetalleSnap.exists()) {
              const animeData = animeDetalleSnap.data();
              return {
                id: animeId,
                titulo: animeData.titulo || 'Título no encontrado',
                portada: animeData.portada || 'img/background.webp'
              };
            } else {
              console.warn(`No se encontraron detalles para el anime completado con ID: ${animeId}`);
              return null;
            }
          })
          .catch(error => {
            console.error(`Error al buscar detalles del anime completado ${animeId}:`, error);
            return null;
          });
        promises.push(detallePromise);
      }
      
      const resultados = await Promise.all(promises);
      freshData = resultados.filter(item => item !== null); // Filtrar nulos
    }

    // 3. Comparar datos frescos con caché y actualizar si es necesario
    const freshDataString = JSON.stringify(freshData);
    const cachedDataString = JSON.stringify(cachedData);

    if (freshDataString !== cachedDataString) {
      // Solo renderizar si los datos son diferentes O si no había caché
      if (cachedData === null || freshData.length !== (cachedData || []).length || freshDataString !== cachedDataString) {
        console.log("Datos de Firestore diferentes a la caché de 'Completados' o sin caché previa. Actualizando UI y caché...");
        renderizarCompletados(freshData);
      }
      // Guardar o limpiar caché según los datos frescos
      if (freshData && freshData.length > 0) {
          localStorage.setItem(cacheKey, freshDataString);
      } else {
          localStorage.removeItem(cacheKey);
          // Si no había caché y tampoco hay datos frescos, asegurar mostrar mensaje.
          if (cachedData === null && !snap.empty) {
              renderizarCompletados([]); 
          }
      }
    } else {
       // Si son iguales y había caché, no es necesario re-renderizar ni actualizar caché.
       if (cachedData !== null) {
          console.log("Datos de Firestore coinciden con la caché de 'Completados'. No se requiere actualización.");
       } 
       // Manejar caso donde no había caché pero los datos frescos sí existen (primera carga)
       else if (cachedData === null && freshData && freshData.length > 0) {
           console.log("Mostrando datos frescos de Firestore (sin caché previa de 'Completados').");
           renderizarCompletados(freshData); 
           localStorage.setItem(cacheKey, freshDataString);
       }
       // Manejar caso donde no hay datos ni en caché ni en Firestore
       else if (cachedData === null && (!freshData || freshData.length === 0)) {
           console.log("No hay animes 'Completados' en Firestore ni en caché.");
           renderizarCompletados([]); // Asegurar mensaje de "no tienes..."
       }
    }

  } catch (error) {
    console.error('Error al cargar animes completados desde Firestore:', error);
    // Solo mostrar error en UI si no se pudo mostrar nada desde caché
    if (cachedData === null) { 
      completadosContainer.innerHTML = '<p>Error al cargar animes completados.</p>';
      actualizarAlturaMain();
    }
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
