import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Función para actualizar UI y gestionar caché
function updateUIForUser(user) {
  const btnLogin = document.getElementById('btn-login');
  const btnLoginImg = btnLogin.querySelector('img');
  const btnLoginSpan = btnLogin.querySelector('span');
  
  if (!btnLogin || !btnLoginImg || !btnLoginSpan) return;

  if (user) {
    // Obtener solo el primer nombre
    const nombres = (user.displayName || '').split(' ');
    const primerNombre = nombres[0] || '';

    // Actualizar UI
    btnLoginImg.src = user.photoURL || 'icons/user-solid.svg';
    btnLoginSpan.textContent = primerNombre;
    
    // Guardar en caché
    try {
      localStorage.setItem('cachedUserDisplayName', primerNombre);
      localStorage.setItem('cachedUserPhotoURL', user.photoURL || '');
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
    }
  } else {
    // Actualizar UI
    btnLoginImg.src = 'icons/user-solid.svg';
    btnLoginSpan.textContent = '';
    
    // Limpiar caché
    try {
      localStorage.removeItem('cachedUserDisplayName');
      localStorage.removeItem('cachedUserPhotoURL');
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
  }
}

// Login con Google
async function loginConGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const refUsuario = doc(db, 'usuarios', user.uid);
    const docSnap = await getDoc(refUsuario);

    if (!docSnap.exists()) {
      await setDoc(refUsuario, {
        nombre: user.displayName,
        email: user.email,
        creado: serverTimestamp()
      });
    }

    updateUIForUser(user);
    
    // Recargar la página actual
    window.location.reload();
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
    } else {
    }
  }
}

// Logout con modal
function showLogoutModal() {
  // Verificar si ya existe un modal abierto
  const existingModal = document.querySelector('.logout-modal');
  if (existingModal) {
    existingModal.classList.remove('show');
    setTimeout(() => existingModal.remove(), 300);
    return;
  }

  // Crear y configurar el modal
  const modal = document.createElement('div');
  modal.className = 'logout-modal';
  modal.innerHTML = `
    <button id="export-data">Exportar datos</button>
    <a href="#" id="config">Configuración</a>
    <button id='confirm-logout'>Cerrar sesión</button>
  `;
  
  // Insertar el modal en el DOM
  const loginButton = document.getElementById('btn-login');
  loginButton.appendChild(modal);
  
  // Mostrar con animación
  requestAnimationFrame(() => modal.classList.add('show'));
  
  // Función para cerrar el modal
  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 300);
  };
  
  // Cerrar al hacer scroll
  const handleScroll = () => closeModal();
  window.addEventListener('scroll', handleScroll, { once: true });
  
  // Cerrar al hacer clic fuera
  const handleClick = (e) => {
    if (!modal.contains(e.target) && !loginButton.contains(e.target)) {
      closeModal();
      document.removeEventListener('click', handleClick);
    }
  };
  
  // Usar setTimeout para evitar que se cierre inmediatamente
  setTimeout(() => document.addEventListener('click', handleClick), 0);
  
  // Eventos de los botones
  modal.querySelector('#confirm-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await logoutConGoogle();
    closeModal();
  });
  
  modal.querySelector('#config').addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
    // Aquí podrías agregar la lógica para ir a configuración
  });
  
  // Exportar datos
  const exportButton = modal.querySelector('#export-data');
  
  exportButton.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation(); 
    const originalText = exportButton.textContent;
    
    try {
      exportButton.textContent = 'Exportando...';
      exportButton.disabled = true;
      
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }
      
      const db = getFirestore();
      const userId = user.uid;
      
      // Función para obtener datos de una colección específica
      const getCollectionData = async (collectionName) => {
        try {
          const q = query(
            collection(db, 'usuarios', userId, collectionName)
          );
          const querySnapshot = await getDocs(q);
          // Solo devolvemos los datos del documento sin el ID
          return querySnapshot.docs.map(doc => doc.data());
        } catch (error) {
          console.error(`Error al obtener ${collectionName}:`, error);
          return [];
        }
      };
      
      // Obtener datos de todas las colecciones
      const [vistos, viendo, completados, favoritos] = await Promise.all([
        getCollectionData('visto'),
        getCollectionData('viendo'),
        getCollectionData('completados'),
        getCollectionData('favoritos')
      ]);
      
      // Crear objeto con todos los datos
      const userData = {
        usuario: {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        },
        animes: {
          vistos,
          viendo,
          completados,
          favoritos
        },
        fechaExportacion: new Date().toISOString()
      };
      
      // Crear y descargar archivo JSON
      const dataStr = JSON.stringify(userData, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileDefaultName = `animeflv-lite-${userId.slice(0, 8)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      // Mostrar mensaje de éxito
      exportButton.textContent = '¡Exportado!';
      setTimeout(() => {
        exportButton.textContent = originalText;
        exportButton.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Error al exportar datos:', error);
      exportButton.textContent = 'Error al exportar';
      setTimeout(() => {
        exportButton.textContent = originalText;
        exportButton.disabled = false;
      }, 2000);
    }
  });
}

async function logoutConGoogle() {
  try {
    await signOut(auth);
    updateUIForUser(null);
    // Recargar la página actual
    window.location.reload();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// --- Carga inicial desde caché ---
const cachedDisplayName = localStorage.getItem('cachedUserDisplayName');
const cachedPhotoURL = localStorage.getItem('cachedUserPhotoURL');

// Verificar sesión al cargar la página
auth.onAuthStateChanged((user) => {
  if (!user) {
    document.getElementById('btn-login').textContent = 'Login';
    document.getElementById('btn-login').innerHTML = '<img src="icons/user-solid.svg" alt="Foto de perfil"><span>Login</span>';
    // Limpiar caché si no hay sesión activa
    try {
      localStorage.removeItem('cachedUserDisplayName');
      localStorage.removeItem('cachedUserPhotoURL');
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
  }
});

if (cachedDisplayName || cachedPhotoURL) {
  updateUIForUser({
    displayName: cachedDisplayName,
    photoURL: cachedPhotoURL,
  });
}
// --- Fin carga inicial desde caché ---

// Estado real del usuario (verifica y actualiza si es necesario)
onAuthStateChanged(auth, (user) => {
  const currentUsername = document.getElementById('btn-login')?.getAttribute('data-username');
  if (!user && currentUsername) {
      updateUIForUser(null);
  } else if (user && (!currentUsername || currentUsername !== user.displayName)) {
      updateUIForUser(user);
  } else if (user) {
      try {
          localStorage.setItem('cachedUserDisplayName', user.displayName || '');
          localStorage.setItem('cachedUserPhotoURL', user.photoURL || '');
      } catch (e) {
      }
  }
  // Disparar evento personalizado para indicar que el estado de autenticación está listo
  document.dispatchEvent(new CustomEvent('authStateReady', { detail: { user } }));
});

// Configurar botón login/logout
const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
  btnLogin.addEventListener('click', () => {
    const user = auth.currentUser;
    if (user) {
      showLogoutModal();
    } else {
      loginConGoogle();
    }
  });
}

export { app, auth, db };
