// Importaciones de Firebase y otras dependencias
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";
import { observerAnimeCards } from "./utils.js";
import { fetchIAResponse, parseAnimeNamesFromResponse, resolveAnimeByName } from "./ai-recommendations.js";

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
    limpiarCacheAnimes();
    
    const cache = JSON.stringify({
        animes: animes.slice(0, 5),
        timestamp: Date.now()
    });
    localStorage.setItem('cache_animes', cache);
    
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

        const favoritosRef = doc(db, `usuarios/${userid}/favoritos/lista`);
        const favoritosDoc = await getDoc(favoritosRef);
        if (!favoritosDoc.exists() || !favoritosDoc.data().animes || favoritosDoc.data().animes.length === 0) {
            return [];
        }

        const titulosFavoritos = favoritosDoc.data().animes;
        
        if (!titulosFavoritos || titulosFavoritos.length === 0) {
            return [];
        }

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

        const estadosRef = doc(db, `usuarios/${userid}/estados/visto`);
        const estadosDoc = await getDoc(estadosRef);
        
        if (!estadosDoc.exists() || !estadosDoc.data().animes || !Array.isArray(estadosDoc.data().animes)) {
            return [];
        }
        
        const ids = estadosDoc.data().animes;
        
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
        
        const animes = await Promise.all(animesPromises);
        return animes.filter(anime => anime !== null);
        
    } catch (error) {
        console.error('Error al obtener animes vistos:', error);
        return [];
    }
}

// Lógica simplificada de las tarjetas (ahora siempre son enlaces)
function crearAnimeCard(anime) {
    const coverImage = anime.cover || anime.image || 'img/loading.png';
    let animeId = anime.id;
    if (!animeId && anime.url) {
        const urlParts = anime.url.replace(/\/$/, '').split('/');
        animeId = urlParts[urlParts.length - 1];
    }
    if (!animeId) {
        animeId = anime.title?.toLowerCase().replace(/\s+/g, '-');
    }
    const div = document.createElement('div');
    div.className = 'anime-card Recomendaciones-card';
    
    let ratingHtml = '';
    if (anime.rating) {
        ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
    }
    div.style.setProperty('--cover', `url(${coverImage})`);
    div.id = `anime-${animeId}`;
    div.innerHTML = `
        <div class="container-img">
            <img src="${coverImage}" class="cover" alt="${anime.title || 'Título del Anime'}">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="play">
            ${ratingHtml}
            <span class="estado">${anime.type || ''}</span>
        </div>
        <strong>${anime.title || 'Título del Anime'}</strong>
    `;
    
    // Al hacer clic, redirige al anime directamente
    div.addEventListener('click', () => {
        if (typeof aplicarViewTransition === "function") {
            aplicarViewTransition(animeId, ratingHtml);
        }
        window.location.href = `/anime?id=${animeId}`;
    });
        
    return div;
}

// Función para mostrar alertas flotantes
function mostrarPildora(mensaje, tipo = "default") {
  const pillAnterior = document.querySelector('.pildora');
  if (pillAnterior) pillAnterior.remove();

  const pill = document.createElement("div");
  pill.className = `pildora pildora-${tipo}`;
  pill.textContent = mensaje;

  document.body.appendChild(pill);

  pill.addEventListener('animationend', () => {
    pill.remove();
  }, { once: true });
}

// Evento Generar Nuevas (Con el input extra añadido)
document.getElementById("generar-nuevas").addEventListener("click", async () => {
    const texto = document.getElementById("textbtngenerarfav");
    const inputFiltro = document.getElementById("filtro-extra");
    const filtroExtra = inputFiltro ? inputFiltro.value.trim() : "";
    
    texto.innerHTML = 'Generando... <span id="contador1">100s</span>';

    const contador = document.getElementById("contador1");

    // Limpiar contenedor y agregar 5 tarjetas de carga con animación
    const contenedorFavoritos = document.getElementById('recomendaciones-favoritos');
    if (contenedorFavoritos) {
        contenedorFavoritos.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const cardCarga = document.createElement('div');
            cardCarga.className = 'anime-card show carga generando Recomendaciones-card';
            cardCarga.innerHTML = `
                <div class="container-img"></div>
                <strong></strong>
            `;
            contenedorFavoritos.appendChild(cardCarga);
        }
    }
    
    let count = 100;
    const interval = setInterval(() => {
      count--;
      if(contador) contador.textContent = count + 's';
    
      if (count <= 0) {
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
        texto.textContent = "No hay favoritos";
        clearInterval(interval);
        return;
    }

    const nombresFavoritos = favoritos.map(f => f.nombre || f.titulo || f.id).join(', ');
    const animesCache = cacheActual?.animes || [];
    const nombresCache = animesCache.map(a => a.title || a.id);
    const nombresVistos = vistos.map(v => v.nombre || v.titulo || v.id);

    const titulosAExcluir = [...new Set([...nombresCache, ...nombresVistos])].join(', ');

    // Construir el prompt incluyendo las especificaciones extras si existen
    let prompt = `Recomiéndame 5 animes parecidos a estos: ${nombresFavoritos} Pero asegúrate de que no sean los mismos que los siguientes: ${titulosAExcluir} `;

    if (filtroExtra) {
        prompt += `Además, ten muy en cuenta estas especificaciones extras para la recomendación: ${filtroExtra}. `;
    }

    prompt += `Responde solo con los nombres separados por una "," cada uno y si hay espacios en el nombre cambia los espacios por "-" y si hay caracteres como ":" quítalos. no me respondas nada mas. se conciso con la lista`;

    // Esperamos a que la IA responda para luego limpiar
    await enviarPrompt(prompt, "favoritos");

    // Limpiar el contador y el input de especificaciones extra
    clearInterval(interval);
    if (inputFiltro) {
        inputFiltro.value = "";
    }
});


// Agregar evento para detectar Enter en el input de búsqueda personalizada
const inputBusqueda = document.getElementById("busqueda-personalizada");
if(inputBusqueda) {
    inputBusqueda.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("generar-personalizadas").click();
        }
    });
}

// Generar personalizadas
const btnGenerarPersonalizadas = document.getElementById("generar-personalizadas");
if (btnGenerarPersonalizadas) {
    btnGenerarPersonalizadas.addEventListener("click", async () => {
        const texto = document.getElementById("textbtngenerarpersonalizada");
        texto.innerHTML = 'Generando... <span id="contador2">100s</span>';

        const contador = document.getElementById("contador2");

        // Limpiar contenedor y agregar 5 tarjetas de carga con animación
        const contenedorPersonalizadas = document.getElementById('recomendaciones-personalizadas');
        if (contenedorPersonalizadas) {
            contenedorPersonalizadas.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const cardCarga = document.createElement('div');
                cardCarga.className = 'anime-card show carga generando Recomendaciones-card';
                cardCarga.innerHTML = `
                    <div class="container-img"></div>
                    <strong></strong>
                `;
                contenedorPersonalizadas.appendChild(cardCarga);
            }
        }

        let count = 100;
        const interval = setInterval(() => {
          count--;
          if(contador) contador.textContent = count + 's';
        
          if (count <= 0) {
            clearInterval(interval);
            if (typeof initLoading !== "undefined") initLoading.remove();
          }
        }, 220);
        const busquedaPersonalizada = document.getElementById("busqueda-personalizada").value;
        const cacheActual = obtenerCacheAnimes();

        if (busquedaPersonalizada.length === 0) {
            console.warn("No hay busqueda personalizada.");
            texto.textContent = "No hay busqueda personalizada";
            clearInterval(interval);
            return;
        }

        const animesCache2 = cacheActual?.animes || [];
        const nombresCache2 = animesCache2.map(a => a.title || a.id).join(', ');

        const prompt = `Dame 5 nombres de animes de acuerdo a la siguiente descripción: ${busquedaPersonalizada}
        Pero asegúrate de que no sean los mismos que los siguientes: ${nombresCache2},
        Contetame solo y unicamente solo con los nombres separados por una "," cada uno y si hay espacios en el nombre cambia los espacios por "-" y si hay caracteres como ":" quítalos. no me respondas nada mas. se conciso con la lista y siempre separa por la coma `;

        await enviarPrompt(prompt, "personalizadas");
        clearInterval(interval);
    });
}

async function enviarPrompt(prompt, seccion) {
    const seccionesValidas = ["favoritos", "personalizadas"];
    if (!seccionesValidas.includes(seccion)) {
        console.error('Sección no válida:', seccion);
        return;
    }

    try {
        const respuesta = await fetchIAResponse(prompt);
        window.ultimaRespuesta = respuesta;
        console.log(respuesta);
        await mostrarRelacionadosDesdeRespuesta(respuesta, seccion);
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

    const nombres = parseAnimeNamesFromResponse(respuesta);

    const contenedor = document.getElementById(contenedorId);
    const section = document.getElementById(sectionId);

    if (!contenedor || !nombres.length) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'flex';
    
    const fragment = document.createDocumentFragment();
    const animesEncontrados = [];

    for (const nombre of nombres) {
        const anime = await resolveAnimeByName(nombre);
        if (!anime) continue;
        
        if (guardarEnCache) {
            const animeData = {
                titulo: anime.title || '',
                portada: anime.cover || anime.portada || anime.banner || anime.image,
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
                cover: anime.cover || anime.portada || anime.banner || anime.image,
                rating: anime.rating,
                type: anime.type
            });
        }

        // Ya no le pasamos el boolean de "isLink" porque ahora siempre son links
        const card = crearAnimeCard(anime);
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
    "Villanos tan buenos que casi los apoyes.",
    "Deportes con competencias intensas.",
    "Mecha con batallas robóticas épicas.",
    "Isekai con mundo único y creativo.",
    "Thriller psicológico que mantenga en vilo.",
    "Aventuras con amigos y camaradería.",
    "Gore y horror extremo.",
    "Ciberpunk con tecnología avanzada.",
    "Steampunk con máquinas de vapor.",
    "Post-apocalíptico con supervivencia.",
    "Superpoderes con batallas épicas.",
    "Videojuegos con mundo virtual.",
    "Cocina y comida deliciosa.",
    "Idols y música pop.",
    "Detectives resolviendo casos complejos.",
    "Zombies y apocalipsis.",
    "Vampiros y criaturas sobrenaturales.",
    "Magia oscura y hechicería.",
    "Comedia romántica ligera.",
    "Drama familiar emotivo.",
    "Guerra y estrategia militar.",
    "Piratas y aventuras en el mar.",
    "Espacio exterior y exploración galáctica.",
    "Torneos y competiciones.",
    "Reencarnación en otro mundo.",
    "Sistema de niveles y habilidades.",
    "Artes marciales y combate.",
    "Horror cósmico y Lovecraft.",
    "Cyberdeportes y competencias futuristas.",
    "Misterio escolar y detectives juveniles.",
    "Fantasía oscura y madura."
];

const contenedorSugerencias = document.getElementById('sugerencias-busquedas');
if (contenedorSugerencias) {
    const mezclados = textos.sort(() => Math.random() - 0.5).slice(0, 5);
    mezclados.forEach(texto => {
        const span = document.createElement('span');
        span.className = 'sugerencia-aleatoria';
        span.textContent = texto;
        span.addEventListener('click', () => {
            document.getElementById('busqueda-personalizada').value = texto;
            document.getElementById('generar-personalizadas').click();
        });
        contenedorSugerencias.appendChild(span);
    });
}

const random = Math.floor(Math.random() * textos.length);
const inputPersonalizado = document.getElementById("busqueda-personalizada");
if(inputPersonalizado) {
    inputPersonalizado.value = textos[random];
}

const btnRandom = document.getElementById("text-random");
if (btnRandom) {
    btnRandom.addEventListener("click", () => {
        const random = Math.floor(Math.random() * textos.length);
        document.getElementById("busqueda-personalizada").value = textos[random];
        document.getElementById("generar-personalizadas").click();
    });
}

// Scroll horizontal
const contenedores = document.querySelectorAll(".grid-animes.Recomendaciones");
contenedores.forEach((contenedor) => {
    contenedor.addEventListener('wheel', (evento) => {
        if (evento.deltaY !== 0) {
            evento.preventDefault();
            contenedor.scrollLeft += evento.deltaY; 
        }
    });
});