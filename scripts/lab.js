// Importaciones de Firebase y otras dependencias
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";


// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let userid = null;


document.addEventListener('DOMContentLoaded', () => {

    // Manejo de estado de autenticación
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userid = user.uid;
            console.log('Usuario autenticado:', userid);
            obtenerFavoritosUsuario()
        } else {
            userid = null;
            console.log('Usuario no autenticado');
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
      <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
      ${ratingHtml}
      <span class="estado">${anime.type}</span>
    </div>
    <strong>${anime.title || anime.name}</strong>
  `;
  
    div.addEventListener('click', () => ver(animeId));
    return div;
  }

//IA 

document.getElementById("generar-nuevas").addEventListener("click", async () => {
    const favoritos = await obtenerFavoritosUsuario();

    if (favoritos.length === 0) {
        console.warn("No hay favoritos.");
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
                const card = crearAnimeCard(anime); // usa tu función existente
                fragment.appendChild(card);
            }
        } catch (err) {
            console.error('Error al buscar anime:', nombre, err);
        }
    }
    
    contenedor.innerHTML = '';
    contenedor.appendChild(fragment);
}
