// Importaciones de Firebase y otras dependencias
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";
import { observerAnimeCards } from "./utils.js";


// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let userid = null;


(async () => {
    // Cargar caché inicial
    const cache = obtenerCacheAnimes();
    if (cache) {
        const contenedor = document.getElementById('recomendaciones-favoritos');
        if (contenedor) {
            const fragment = document.createDocumentFragment();
            cache.animes.forEach(anime => {
                const card = crearAnimeCard(anime);
                fragment.appendChild(card);
            });
            contenedor.innerHTML = '';
            contenedor.appendChild(fragment);
        }
    }

    // Manejo de estado de autenticación
    onAuthStateChanged(auth, (user) => {
        const botonGenerar = document.getElementById("generar-nuevas");
        if (user) {
            userid = user.uid;
            obtenerFavoritosUsuario();
            if (botonGenerar) {
                botonGenerar.disabled = false;
                botonGenerar.style.opacity = '1';
            }
        } else {
            userid = null;
            if (botonGenerar) {
                botonGenerar.disabled = true;
                botonGenerar.style.opacity = '0.5';
                botonGenerar.style.cursor = 'not-allowed';
                const texto = document.getElementById("textbtngenerarfav");
                texto.textContent = "Inicia sesión para generar";
            }
        }
    });

    observerAnimeCards();
})()

// Funciones para manejar el caché de animes

function guardarCacheAnimes(animes) {
    // Limpiar caché anterior
    limpiarCacheAnimes();
    
    // Guardar nuevos animes
    const cache = JSON.stringify({
        animes: animes.slice(0, 5),
        timestamp: Date.now()
    });
    localStorage.setItem('cache_animes', cache);
    
    // Actualizar UI
    const contenedor = document.getElementById('recomendaciones-favoritos');
    if (contenedor) {
        const fragment = document.createDocumentFragment();
        animes.slice(0, 5).forEach(anime => {
            const card = crearAnimeCard(anime);
            fragment.appendChild(card);
        });
        contenedor.innerHTML = '';
        contenedor.appendChild(fragment);
    }
}

function obtenerCacheAnimes() {
    const cache = localStorage.getItem('cache_animes');
    if (!cache) return null;
    return JSON.parse(cache);
}

function limpiarCacheAnimes() {
    localStorage.removeItem('cache_animes');
}

// Función para obtener los favoritos del usuario
async function obtenerFavoritosUsuario() {
    try {
        if (!userid) return [];

        // Obtener el documento de favoritos
        const favoritosRef = doc(db, `usuarios/${userid}/favoritos/lista`);
        const favoritosDoc = await getDoc(favoritosRef);
        if (!favoritosDoc.exists() || !favoritosDoc.data().animes || favoritosDoc.data().animes.length === 0) {
            return [];
        }

        // Obtener los títulos de los favoritos
        const titulosFavoritos = favoritosDoc.data().animes;
        
        // Si no hay favoritos, retornar array vacío
        if (!titulosFavoritos || titulosFavoritos.length === 0) {
            return [];
        }

        // Mezclar los favoritos y seleccionar los primeros 5
        const favoritosMezclados = titulosFavoritos
            .map(titulo => ({
                titulo,
                sort: Math.random()
            }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ titulo }) => ({
                titulo,
                id: titulo.toLowerCase().replace(/\s+/g, '-')
            }))
            .slice(0, 5);

        return favoritosMezclados;
    } catch (error) {
        console.error('Error al obtener favoritos:', error);
        return [];
    }
}

async function obtenerAnimesVistos() {
    try {
        if (!userid) return [];

        // Obtener el documento de estados
        const estadosRef = doc(db, `usuarios/${userid}/estados/visto`);
        const estadosDoc = await getDoc(estadosRef);
        
        // Si no existe el documento o no tiene animes, retornar array vacío
        if (!estadosDoc.exists() || !estadosDoc.data().animes || !Array.isArray(estadosDoc.data().animes)) {
            return [];
        }
        
        // Obtener los IDs de los animes vistos
        const ids = estadosDoc.data().animes;
        
        // Obtener los datos de cada anime
        const animesPromises = ids.map(async (id) => {
            try {
                const animeDoc = await getDoc(doc(db, 'datos-animes', id));
                if (animeDoc.exists()) {
                    return {
                        id: animeDoc.id,
                        ...animeDoc.data()
                    };
                }
                return null;
            } catch (error) {
                console.error(`Error al obtener anime ${id}:`, error);
                return null;
            }
        });
        
        // Esperar a que todas las promesas se resuelvan y filtrar nulos
        const animes = await Promise.all(animesPromises);
        return animes.filter(anime => anime !== null);
        
    } catch (error) {
        console.error('Error al obtener animes vistos:', error);
        return [];
    }
}


function crearAnimeCard(anime, isLink = false) {
    const animeId = anime.id;
    const div = document.createElement('div');
    div.className = 'anime-card lab-card';
    
    // Mantener el estilo original usando innerHTML
    let ratingHtml = '';
    if (anime.rating) {
        ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
    }
    div.style.setProperty('--cover', `url(${anime.cover || 'img/loading.png'})`);
    div.id="anime-${animeId}";
    div.innerHTML = `
        <div class="container-img">
            <img src="${anime.cover || 'img/loading.png'}" class="cover" alt="${anime.title || 'Título del Anime'}">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="play">
            ${ratingHtml}
            <span class="estado">${anime.type}</span>
        </div>
        <strong>${anime.title || 'Título del Anime'}</strong>
        `;
        div.addEventListener('click', () => {
            aplicarViewTransition(animeId, ratingHtml);
          });
        // Evento de clic según el tipo de tarjeta
        if (isLink) {

            div.addEventListener('click', () => {
                window.location.href = `anime.html?id=${animeId}`;
            });
        } else {
            div.addEventListener('click', () => {
                div.classList.toggle('active');
                if (div.classList.contains('active')) {
                    window.seleccionados = window.seleccionados || new Set();
                    window.seleccionados.add(animeId);
                } else {
                    window.seleccionados.delete(animeId);
                }
            });
        }
    return div;
}

// Función para agregar animes a pendientes
document.getElementById("agregar-a-pendientes").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    alert("Por favor, inicia sesión primero");
    return;
  }

  if (!window.seleccionados || window.seleccionados.size === 0) {
    alert("Por favor, selecciona al menos un anime");
    return;
  }

  try {
    // Limpiar estados previos de los animes seleccionados
    for (const animeId of window.seleccionados) {
      await limpiarEstadosPrevios(animeId);
    }

    // Obtener la referencia al documento de pendientes
    const pendientesRef = doc(collection(doc(db, "usuarios", user.uid), "estados"), "pendiente");
    const pendientesDoc = await getDoc(pendientesRef);
    
    // Obtener los IDs actuales o inicializar array vacío
    const animesActuales = pendientesDoc.exists() && Array.isArray(pendientesDoc.data().animes) 
      ? [...pendientesDoc.data().animes] 
      : [];
    
    // Agregar nuevos IDs (sin duplicados)
    const nuevosAnimes = [...new Set([...animesActuales, ...Array.from(window.seleccionados)])];
    
    // Actualizar el documento
    await setDoc(pendientesRef, { animes: nuevosAnimes }, { merge: true });

    // Limpiar selección
    window.seleccionados.clear();
    document.querySelectorAll('.anime-card.active').forEach(card => {
      card.classList.remove('active');
    });

    alert("Animes agregados a pendientes exitosamente!");
  } catch (error) {
    console.error("Error al agregar animes a pendientes:", error);
    alert("Error al agregar animes a pendientes. Por favor, intenta nuevamente.");
  }
});

async function limpiarEstadosPrevios(animeId) {
  const user = auth.currentUser;
  if (!user) return;

  const estados = ['viendo', 'pendiente', 'visto'];
  
  for (const estado of estados) {
    const estadoRef = doc(collection(doc(db, "usuarios", user.uid), "estados"), estado);
    const estadoDoc = await getDoc(estadoRef);
    
    if (estadoDoc.exists() && Array.isArray(estadoDoc.data().animes)) {
      // Filtrar el animeId del array
      const animesActualizados = estadoDoc.data().animes.filter(id => id !== animeId);
      
      // Actualizar solo si hay cambios
      if (animesActualizados.length !== estadoDoc.data().animes.length) {
        await setDoc(estadoRef, { animes: animesActualizados }, { merge: true });
      }
    }
  }
}

document.getElementById("generar-nuevas").addEventListener("click", async () => {
    const texto = document.getElementById("textbtngenerarfav");
    
    texto.innerHTML = 'Generando recomendaciones... <span id="contador1">100s</span>';

    const contador = document.getElementById("contador1");
    
    let count = 100;
    const interval = setInterval(() => {
      count--;
      contador.textContent = count + 's';
    
      if (count === 0) {
        clearInterval(interval);
        if (typeof initLoading !== "undefined") initLoading.remove();
      }
    }, 220);
    
    const [favoritos, vistos] = await Promise.all([
        obtenerFavoritosUsuario(),
        obtenerAnimesVistos()
    ]);
    const cacheActual = obtenerCacheAnimes();

    if (favoritos.length === 0) {
        console.warn("No hay favoritos.");
        const texto = document.getElementById("textbtngenerarfav");
        texto.textContent = "No hay favoritos";
        return;
    }

    const nombresFavoritos = favoritos.map(f => f.nombre || f.titulo || f.id).join(', ');
    const animesCache = cacheActual?.animes || [];
    const nombresCache = animesCache.map(a => a.title || a.id);
    const nombresVistos = vistos.map(v => v.nombre || v.titulo || v.id);
    
    const titulosAExcluir = [...new Set([...nombresCache, ...nombresVistos])].join(', ');

    const prompt = `Recomiéndame 5 animes parecidos a estos: ${nombresFavoritos} Pero asegúrate de que no sean los mismos que los siguientes: ${titulosAExcluir} Responde solo con los nombres separados por una "," cada uno y si hay espacios en el nombre cambia los espacios por "-" y si hay caracteres como ":" quítalos`;
    enviarPrompt(prompt, "favoritos");
});

//generar personalizadas
const btnGenerarPersonalizadas = document.getElementById("generar-personalizadas")
btnGenerarPersonalizadas.addEventListener("click", async () => {
    const texto = document.getElementById("textbtngenerarpersonalizada");
    texto.innerHTML = 'Generando recomendaciones... <span id="contador1">100s</span>';

    const contador = document.getElementById("contador1");
    
    let count = 100;
    const interval = setInterval(() => {
      count--;
      contador.textContent = count + 's';
    
      if (count === 0) {
        clearInterval(interval);
        if (typeof initLoading !== "undefined") initLoading.remove();
      }
    }, 220);
    const busquedaPersonalizada = document.getElementById("busqueda-personalizada").value;
    const cacheActual = obtenerCacheAnimes();

    if (busquedaPersonalizada.length === 0) {
        console.warn("No hay busqueda personalizada.");
        texto.textContent = "No hay busqueda personalizada";
        return;
    }

    const animesCache2 = cacheActual?.animes || [];
    const nombresCache2 = animesCache2.map(a => a.title || a.id).join(', ');

    const prompt = `Dame 5 nombres de animes de acuerdo a la siguiente descripción: ${busquedaPersonalizada}
    Pero asegúrate de que no sean los mismos que los siguientes: ${nombresCache2}
    Responde solo con los nombres separados por una "," cada uno y si hay espacios en el nombre cambia los espacios por "-" y si hay caracteres como ":" quítalos`;

    enviarPrompt(prompt, "personalizadas");
});


async function enviarPrompt(prompt, seccion) {
    const seccionesValidas = ["favoritos", "personalizadas"];
    if (!seccionesValidas.includes(seccion)) {
        console.error('Sección no válida:', seccion);
        return;
    }

    try {
        const response = await fetch('https://backend-ia-anime.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt })
        });

        const data = await response.json();
        const respuesta = data.response || 'Error en la respuesta';

        window.ultimaRespuesta = respuesta;

        mostrarRelacionadosDesdeRespuesta(respuesta, seccion);
    } catch (error) {
        console.error('Error al enviar prompt:', error);
    }
}

async function mostrarRelacionadosDesdeRespuesta(respuesta, seccion) {
    const config = {
        favoritos: {
            contenedorId: 'recomendaciones-favoritos',
            sectionId: 'relacionados',
            textoBtnId: 'textbtngenerarfav',
            guardarEnCache: true
        },
        personalizadas: {
            contenedorId: 'recomendaciones-personalizadas',
            sectionId: 'personalizadas',
            textoBtnId: 'textbtngenerarpersonalizada',
            guardarEnCache: false
        }
    };

    const { contenedorId, sectionId, textoBtnId, guardarEnCache } = config[seccion] || {};
    if (!contenedorId) return;

    const nombres = respuesta.split(',')
        .map(t => t.trim().replace(/-/g, ' ').replace(/:/g, '').replace(/\s+/g, ' '))
        .filter(Boolean);

    const contenedor = document.getElementById(contenedorId);
    const section = document.getElementById(sectionId);

    if (!contenedor || !nombres.length) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'flex';
    
    const fragment = document.createDocumentFragment();
    const animesEncontrados = [];
    const buscarAnime = async (nombre) => {
        try {
            const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(nombre)}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            const data = await res.json();
            const animes = data.data || [];

            if (!animes.length) return null;

            let animeSeleccionado = animes.find(a => 
                a.title.toLowerCase() === nombre.toLowerCase()
            );

            if (!animeSeleccionado) {
                const animesCandidatos = animes.filter(a => 
                    a.title.toLowerCase().includes(nombre.toLowerCase())
                );

                if (animesCandidatos.length) {
                    animesCandidatos.sort((a, b) => a.title.length - b.title.length);
                    animeSeleccionado = animesCandidatos[0];
                } else {
                    animeSeleccionado = animes[0];
                }
            }

            return animeSeleccionado;
        } catch (err) {
            console.error('Error al buscar anime:', nombre, err);
            return null;
        }
    };

    for (const nombre of nombres) {
        const anime = await buscarAnime(nombre);
        if (!anime) continue;
        if (guardarEnCache) {
            const animeData = {
                titulo: anime.title || '',
                portada: anime.cover || '',
                descripcion: anime.synopsis || '',
                rating: anime.rating || null,
                episodios: anime.episodes?.map(ep => ({ 
                    number: ep.number, 
                    url: ep.url 
                })) || [],
            };
            
            await setDoc(doc(db, 'datos-animes', anime.id), animeData, { merge: true });
            animesEncontrados.push({
                id: anime.id,
                title: anime.title,
                cover: anime.cover,
                rating: anime.rating,
                type: anime.type
            });
        }

        const card = crearAnimeCard(anime, !guardarEnCache);
        fragment.appendChild(card);
    }
    if (guardarEnCache && animesEncontrados.length > 0) {
        guardarCacheAnimes(animesEncontrados, 'favoritos');
    }

    contenedor.innerHTML = '';
    contenedor.appendChild(fragment);
    observerAnimeCards();
    const textoBtn = document.getElementById(textoBtnId);
    if (textoBtn) textoBtn.textContent = "Regenerar";
}
/*text random en input */
const textos = [
    "Terror cortico pero que asuste de verdad.",
    "Romance que haga llorar.",
    "Comedia absurda para reír sin parar.",
    "erotico de otro nivel",
    "Viajes en el tiempo con plot twist.",
    "Drama escolar que rompa el kokoro.",
    "Fantasía épica con magia y espadas.",
    "Acción sin descanso y buena animación.",
    "Cosas tiernas con animalitos kawaii.",
    "Peleas épicas estilo shonen.",
    "Sobrenatural con romance.",
    "Historia trágica que duela y marque.",
    "Música buena con temática de bandas.",
    "Filosofía o existencialismo que haga pensar.",
    "Misterio con buen desarrollo.",
    "Slice of life relajante para ver con café.",
    "Samuráis o época histórica emocionante.",
    "Ciencia ficción intensa y futurista.",
    "Ninjas o espías con estilo.",
    "Visuales hermosos, como una obra de arte.",
    "Villanos tan buenos que casi los apoyes."
];    
      
const random = Math.floor(Math.random() * textos.length);
document.getElementById("busqueda-personalizada").value = textos[random];

document.getElementById("text-random").addEventListener("click", () => {
    const random = Math.floor(Math.random() * textos.length);
    document.getElementById("busqueda-personalizada").value = textos[random];
});

btnGenerarPersonalizadas.click()