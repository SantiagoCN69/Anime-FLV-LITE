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


document.addEventListener('DOMContentLoaded', () => {
    mostrarGeneroEnBoton('todos');

    const caches = obtenerTodosLosCaches();
    const cacheFavoritos = caches.favoritos;
    if (cacheFavoritos) {
        const contenedorFavoritos = document.getElementById('recomendaciones-favoritos');
        if (contenedorFavoritos) {
            const fragment = document.createDocumentFragment();
            cacheFavoritos.animes.forEach(anime => {
                const card = crearAnimeCard(anime);
                fragment.appendChild(card);
            });
            contenedorFavoritos.innerHTML = '';
            contenedorFavoritos.appendChild(fragment);
        }
    }
    
    // Mostrar caché de género si existe
    const cacheGenero = caches.genero;
    if (cacheGenero) {
        const contenedorGenero = document.getElementById('recomendaciones-ia-genero');
        if (contenedorGenero) {
            const fragment = document.createDocumentFragment();
            cacheGenero.animes.forEach(anime => {
                const card = crearAnimeCard(anime, true);
                fragment.appendChild(card);
            });
            contenedorGenero.innerHTML = '';
            contenedorGenero.appendChild(fragment);
        }
    }

    // Manejo de clic en las cards de género
    const contenedorGenero = document.getElementById('recomendaciones-ia-genero');
    if (contenedorGenero) {
        contenedorGenero.addEventListener('click', (e) => {
            // Solo prevenir el clic si NO se hizo en un enlace
            if (!e.target.closest('.anime-link')) {
                e.preventDefault();
                return false;
            }
        });
    }

    // Manejo de opciones de género
    const opcionesGenero = document.querySelectorAll('.opcion');
    opcionesGenero.forEach(opcion => {
        opcion.addEventListener('click', (e) => {
            const genero = e.currentTarget.dataset.value;
            mostrarGeneroEnBoton(genero === 'cualquier-genero' ? 'todos' : genero);
            const opciones = document.getElementById('opciones-genero');
            opciones.classList.remove('active');
        });
    });

    // Manejo del botón de género
    const btnGenero = document.getElementById('btn-genero');
    btnGenero.addEventListener('click', () => {
        const opciones = document.getElementById('opciones-genero');
        opciones.classList.toggle('active');
    });

    // Manejo del botón generar-ia-por-genero
    document.getElementById('generar-ia-por-genero').addEventListener('click', mostrarRecomendacionesPorGenero);

    // Manejo de estado de autenticación
    onAuthStateChanged(auth, (user) => {
        const botonGenerar = document.getElementById("generar-nuevas");
        if (user) {
            userid = user.uid;
            console.log('Usuario autenticado:', userid);
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
});

// Funciones para manejar el caché de animes
function guardarCacheAnimes(animes, tipo = 'favoritos') {
    const cache = JSON.stringify({
        animes: animes.slice(0, 5),
        timestamp: Date.now(),
        tipo
    });
    localStorage.setItem(`cache_animes_${tipo}`, cache);
}

function obtenerCacheAnimes(tipo = 'favoritos') {
    const cache = localStorage.getItem(`cache_animes_${tipo}`);
    if (!cache) return null;
    return JSON.parse(cache);
}

function limpiarCacheAnimes(tipo = 'favoritos') {
    localStorage.removeItem(`cache_animes_${tipo}`);
}

// Función para obtener todos los cachés
function obtenerTodosLosCaches() {
    const caches = {};
    const tipos = ['favoritos', 'genero'];
    
    tipos.forEach(tipo => {
        const cache = obtenerCacheAnimes(tipo);
        if (cache) {
            caches[tipo] = cache;
        }
    });
    
    return caches;
}

const textobtngenero = document.getElementById("textbtngenerarporgenero");
// Función para obtener el género seleccionado
function obtenerGeneroSeleccionado() {
    const generoMostrado = document.getElementById('genero-text').textContent.toLowerCase();
    const generoReal = generoMostrado === 'todos' ? 'cualquier-genero' : generoMostrado;
    return { mostrado: generoMostrado, real: generoReal };
}

// Función para mostrar el género en el botón
function mostrarGeneroEnBoton(genero) {
    const generoText = document.getElementById('genero-text');
    generoText.textContent = genero.charAt(0).toUpperCase() + genero.slice(1);
}

// Función para mostrar recomendaciones por género
async function mostrarRecomendacionesPorGenero() {
    textobtngenero.textContent = "Cargando...";

    const genero = obtenerGeneroSeleccionado();
    if (genero === 'todos') {
        textobtngenero.textContent = "Por favor, selecciona un género";
        return;
    }

    const prompt = `Recomiéndame 5 animes del género ${genero} pero responde solo con los nombres separados por una "," cada uno y si hay espacios en el nombre cambia los espacios por "-" y si hay caracteres como ":" quítalos`;

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
        await mostrarRecomendadosEnContenedor(respuesta, 'recomendaciones-ia-genero', 'genero');
        textobtngenero.textContent = "Regenerar";
    } catch (error) {
        console.error('Error al enviar prompt:', error);
        textobtngenero.textContent = "Error al generar recomendaciones";
    }
}

// Función para mostrar recomendaciones en un contenedor específico
async function mostrarRecomendadosEnContenedor(respuesta, contenedorId, tipoCache) {
    const nombres = respuesta.split(',')
    .map(t => t.trim().replace(/-/g, ' ').replace(/:/g, '').replace(/\s+/g, ' '));

    const contenedor = document.getElementById(contenedorId);
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
                const card = crearAnimeCard(anime, tipoCache === 'genero');
                fragment.appendChild(card);
                
                // Guardar el anime en el array para el caché
                animesEncontrados.push({
                    id: anime.id,
                    title: anime.title,
                    cover: anime.cover,
                    rating: anime.rating,
                    type: anime.status
                });
            }
        } catch (err) {
            console.error('Error al buscar anime:', nombre, err);
        }
    }
    
    // Guardar en caché los animes encontrados
    if (animesEncontrados.length > 0) {
        guardarCacheAnimes(animesEncontrados, tipoCache);
    }
    
    contenedor.innerHTML = '';
    contenedor.appendChild(fragment);
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


document.getElementById("btn-genero").addEventListener("click", function() {
    document.getElementById("btn-genero").classList.toggle("active")
})


function crearAnimeCard(anime, esGenero = false) {
    const animeId = obtenerAnimeId(anime);
    const div = document.createElement('div');
    div.className = 'anime-card';
    
    // Mantener el estilo original usando innerHTML
    let ratingHtml = '';
    if (anime.rating) {
        ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
    }
    
    // Si es una card de género, agregar el enlace
    if (esGenero) {
        div.innerHTML = `
        <a href="anime.html?id=${anime.id}" class="anime-link">
            <div class="container-img">
                <img src="${anime.cover || 'img/loading.png'}" class="cover" alt="${anime.title || 'Título del Anime'}">
                <img src="./icons/añadir.svg" class="play-icon" alt="seleccionar">
                ${ratingHtml}
                <span class="estado">${anime.type}</span>
            </div>
            <strong>${anime.title || 'Título del Anime'}</strong>
        </a>
        `;
        
        // Evitar que la card sea seleccionable
        div.style.pointerEvents = 'none';
        div.querySelector('.anime-link').style.pointerEvents = 'auto';
        
        // Agregar el fondo con la imagen de portada
        div.style.setProperty('--cover', `url(${anime.cover || 'img/loading.png'})`);
    } else {
        // Mantener el comportamiento original para las cards de favoritos
        
        div.style.setProperty('--cover', `url(${anime.cover || 'img/loading.png'})`);
        div.innerHTML = `
        <div class="container-img">
            <img src="${anime.cover || 'img/loading.png'}" class="cover" alt="${anime.title || 'Título del Anime'}">
            <img src="./icons/añadir.svg" class="play-icon" alt="seleccionar">
            ${ratingHtml}
            <span class="estado">${anime.type}</span>
        </div>
        <strong>${anime.title || 'Título del Anime'}</strong>
        `;
        
        // Evento de clic para las cards de favoritos
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

    if (favoritos.length === 0) {
        console.warn("No hay favoritos.");
        const texto = document.getElementById("textbtngenerarfav");
        texto.textContent = "No hay favoritos";
        return;
    }

    const nombres = favoritos.map(f => f.nombre || f.titulo || f.id).join(', ');
    const prompt = `Recomiéndame 5 animes parecidos a estos pero responde solo con los nombres separados por una "," cada uno y si hay espacios en el nombre cambia los espacios por "-" y si hay caracteres como ":" quítalos : ${nombres}`;

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
                    type: anime.status
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
