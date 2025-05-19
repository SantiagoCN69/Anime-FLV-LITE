// Importaciones de Firebase y otras dependencias
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";


// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let userid = null;


document.addEventListener('DOMContentLoaded', async () => {
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
            console.log('Usuario no autenticado');
            if (botonGenerar) {
                botonGenerar.disabled = true;
                botonGenerar.style.opacity = '0.5';
                botonGenerar.style.cursor = 'not-allowed';
                const texto = document.getElementById("textbtngenerarfav");
                texto.textContent = "Inicia sesión para generar";
            }
        }
    });

 
    (async () => {
        try {
            fetch('https://backend-ia-anime.onrender.com/api/chat');
        } catch (error) {
            console.error('Error al iniciar backend:', error);
        }
    })();

});

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

// Función para obtener los favoritos del usuario (sin cambios)
async function obtenerFavoritosUsuario() {
    try {
        if (!userid) return [];

        const favoritosRef = collection(db, `usuarios/${userid}/favoritos`);
        const querySnapshot = await getDocs(favoritosRef);

        const favoritos = [];
        querySnapshot.forEach((doc) => {
            const favorito = {
                id: doc.id,
                ...doc.data()
            };
            favoritos.push(favorito);
        });

        return favoritos;
    } catch (error) {
        console.error('Error al obtener favoritos:', error);
        return [];
    }
}


function crearAnimeCard(anime, isLink = false) {
    const animeId = obtenerAnimeId(anime);
    const div = document.createElement('div');
    div.className = 'anime-card';
    
    // Mantener el estilo original usando innerHTML
    let ratingHtml = '';
    if (anime.rating) {
        ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
    }

        div.style.setProperty('--cover', `url(${anime.cover || 'img/loading.png'})`);
        if (isLink) {
            div.innerHTML = `
        <div class="container-img">
            <img src="${anime.cover || 'img/loading.png'}" class="cover" alt="${anime.title || 'Título del Anime'}">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="play">
            ${ratingHtml}
            <span class="estado">${anime.type}</span>
        </div>
        <strong>${anime.title || 'Título del Anime'}</strong>
        `;
        } else {
            div.innerHTML = `
        <div class="container-img">
            <img src="${anime.cover || 'img/loading.png'}" class="cover" alt="${anime.title || 'Título del Anime'}">
            <img src="./icons/añadir.svg" class="play-icon" alt="seleccionar">
            ${ratingHtml}
            <span class="estado">${anime.type}</span>
        </div>
        <strong>${anime.title || 'Título del Anime'}</strong>
        `;
        }
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

//IA 

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

    // Agregar a pendientes
    for (const animeId of window.seleccionados) {
      await setDoc(doc(collection(doc(db, "usuarios", user.uid), "pendiente"), animeId), {
        id: animeId,
        timestamp: Date.now()
      });
    }

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

// Función para limpiar estados previos de un anime específico
async function limpiarEstadosPrevios(animeId) {
  const user = auth.currentUser;
  if (!user) return;

  const estados = ['viendo', 'pendiente', 'visto'];
  for (const estado of estados) {
    const ref = doc(collection(doc(db, "usuarios", user.uid), estado), animeId);
    const snap = await getDoc(ref);
    if (snap.exists()) await deleteDoc(ref);
  }
}

document.getElementById("generar-nuevas").addEventListener("click", async () => {
    const texto = document.getElementById("textbtngenerarfav");
    texto.textContent = "Cargando...";
    const favoritos = await obtenerFavoritosUsuario();
    const cacheActual = obtenerCacheAnimes();

    if (favoritos.length === 0) {
        console.warn("No hay favoritos.");
        const texto = document.getElementById("textbtngenerarfav");
        texto.textContent = "No hay favoritos";
        return;
    }

    const nombresFavoritos = favoritos.map(f => f.nombre || f.titulo || f.id).join(', ');
    const animesCache = cacheActual?.animes || [];
    const nombresCache = animesCache.map(a => a.title || a.id).join(', ');

    const prompt = `Recomiéndame 5 animes parecidos a estos: ${nombresFavoritos}
    Pero asegúrate de que no sean los mismos que los siguientes: ${nombresCache}
    Responde solo con los nombres separados por una "," cada uno y si hay espacios en el nombre cambia los espacios por "-" y si hay caracteres como ":" quítalos`;

    enviarPrompt(prompt);
});

async function enviarPrompt(prompt) {
    try {
        const response = await fetch('https://backend-ia-anime.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt })
        });

        const data = await response.json();
        const respuesta = data.response || 'Error en la respuesta';

        console.log('Respuesta IA:', respuesta);
        window.ultimaRespuesta = respuesta;

        mostrarRelacionadosDesdeRespuesta(respuesta);
    } catch (error) {
        console.error('Error al enviar prompt:', error);
    }
}

// 👇 Esta función busca y renderiza cada anime sugerido
async function mostrarRelacionadosDesdeRespuesta(respuesta) {
    const nombres = respuesta.split(',')
    .map(t => t.trim().replace(/-/g, ' ').replace(/:/g, '').replace(/\s+/g, ' '));

    const contenedor = document.getElementById('recomendaciones-favoritos');
    const section = document.getElementById('relacionados');

    if (!contenedor || nombres.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'flex';
    
    const fragment = document.createDocumentFragment();
    const animesEncontrados = [];

    for (const nombre of nombres) {
        if (!nombre) continue; 
        try {
            const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(nombre)}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            const data = await res.json();
            const anime = data.data?.[0];
            if (anime) {
                // Guardar datos en Firestore
                const animeData = {
                    titulo: anime.title || '',
                    portada: anime.cover || '',
                    descripcion: anime.synopsis || '',
                    generos: anime.genres || [],
                    rating: anime.rating || null,
                    estado: anime.status || null,
                    episodios: anime.episodes?.map(ep => ({ number: ep.number, url: ep.url })) || [],
                    relacionados: anime.related?.map(ep => ({ title: ep.title, relation: ep.relation })) || [],
                    fechaGuardado: serverTimestamp()
                };
                
                await setDoc(doc(db, 'datos-animes', anime.id), animeData, { merge: true });
                
                // Crear y agregar la card
                const card = crearAnimeCard(anime);
                fragment.appendChild(card);
                
                // Guardar el anime en el array para el caché
                animesEncontrados.push({
                    id: anime.id,
                    title: anime.title,
                    cover: anime.cover,
                    rating: anime.rating,
                    type: anime.type
                });
            }
        } catch (err) {
            console.error('Error al buscar anime:', nombre, err);
        }
    }
    
    // Guardar en caché los animes encontrados
    if (animesEncontrados.length > 0) {
        guardarCacheAnimes(animesEncontrados, 'favoritos');
    }
    
    contenedor.innerHTML = '';
    contenedor.appendChild(fragment);
    const texto = document.getElementById("textbtngenerarfav");
    texto.textContent = "Regenerar";
}

//generar personalizadas

document.getElementById("generar-personalizadas").addEventListener("click", async () => {
    const texto = document.getElementById("textbtngenerarpersonalizada");
    texto.textContent = "Cargando...";
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

    enviarPromptPersonalizado(prompt);
});

async function enviarPromptPersonalizado(prompt) {
    try {
        const response = await fetch('https://backend-ia-anime.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt })
        });

        const data = await response.json();
        const respuesta = data.response || 'Error en la respuesta';

        console.log('Respuesta IA:', respuesta);
        window.ultimaRespuesta = respuesta;

        mostrarRelacionadosDesdeRespuesta2(respuesta);
    } catch (error) {
        console.error('Error al enviar prompt:', error);
    }
}
async function mostrarRelacionadosDesdeRespuesta2(respuesta) {
    const nombres = respuesta.split(',')
    .map(t => t.trim().replace(/-/g, ' ').replace(/:/g, '').replace(/\s+/g, ' '));

    const contenedor = document.getElementById('recomendaciones-personalizadas');
    const section = document.getElementById('personalizadas');

    if (!contenedor || nombres.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'flex';
    
    const fragment = document.createDocumentFragment();

    for (const nombre of nombres) {
        if (!nombre) continue; 
        try {
            const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(nombre)}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            const data = await res.json();
            const anime = data.data?.[0];
            if (anime) {
                // Crear y agregar la card
                const card = crearAnimeCard(anime, true);
                fragment.appendChild(card);
            }
        } catch (err) {
            console.error('Error al buscar anime:', nombre, err);
        }
    }
    contenedor.innerHTML = '';
    contenedor.appendChild(fragment);
    const texto = document.getElementById("textbtngenerarpersonalizada");
    texto.textContent = "Regenerar";
}