// Importaciones de Firebase y otras dependencias
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";


// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let userid = null;


document.addEventListener('DOMContentLoaded', () => {

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

        console.log('Favoritos del usuario:', favoritos);
        return favoritos;
    } catch (error) {
        console.error('Error al obtener favoritos:', error);
        return [];
    }
}


document.getElementById("btn-genero").addEventListener("click", function() {
    document.getElementById("btn-genero").classList.toggle("active")
})


function crearAnimeCard(anime) {
    const animeId = obtenerAnimeId(anime);
    const div = document.createElement('div');
    let ratingHtml = '';
    if (anime.rating) {
      ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${anime.rating}">${anime.rating}</span>`;
    }
    div.className = 'anime-card';
    div.style.setProperty('--cover', `url(${anime.cover})`);
    div.innerHTML = `
    <div class="container-img">
      <img src="${anime.cover}" class="cover" alt="${anime.title || anime.name}">
      <img src="./icons/añadir.svg" class="play-icon" alt="seleccionar">
      ${ratingHtml}
      <span class="estado">${anime.type}</span>
    </div>
    <strong>${anime.title || anime.name}</strong>
  `;
  
    // Almacenar el ID del anime en una variable global
    div.addEventListener('click', () => {
      div.classList.toggle('active');
      if (div.classList.contains('active')) {
        window.seleccionados = window.seleccionados || new Set();
        window.seleccionados.add(animeId);
      } else {
        window.seleccionados.delete(animeId);
      }
    });
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

    for (const nombre of nombres) {
        if (!nombre) continue; 
        try {
            const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/search?q=${encodeURIComponent(nombre)}`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            const data = await res.json();
            const anime = data.data?.[0];
            if (anime) {
                const card = crearAnimeCard(anime);
                fragment.appendChild(card);
            }
        } catch (err) {
            console.error('Error al buscar anime:', nombre, err);
        }
    }
    
    contenedor.innerHTML = '';
    contenedor.appendChild(fragment);
    const texto = document.getElementById("textbtngenerarfav");
    texto.textContent = "Regenerar";
}
