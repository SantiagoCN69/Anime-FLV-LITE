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
            obtenerFavoritosUsuario().then(favoritos => {
                if (favoritos && favoritos.length > 0) {
                    generarRecomendacionesIA(favoritos);
                } else {
                    console.log('No hay favoritos para generar recomendaciones.');
                }
            });
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
            console.log('Objeto favorito:', favorito);
            favoritos.push(favorito);
        });

        console.log('Favoritos del usuario:', favoritos);
        return favoritos;
    } catch (error) {
        console.error('Error al obtener favoritos:', error);
        return [];
    }
}
