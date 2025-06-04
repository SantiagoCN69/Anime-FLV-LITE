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

//crear modal al cargar la página
document.addEventListener('DOMContentLoaded', () => {
const existingModal = document.querySelector('.logout-modal');
const modal = document.createElement('div');
  modal.className = 'logout-modal';
  modal.innerHTML = `
    <button id="export-data">Exportar datos</button>
    <button id="theme-toggle">Cambiar tema</button>
    <button id="config">Configuración</button>
    <button id='confirm-logout'>Cerrar sesión</button>
  `;
  
  // Insertar el modal en el DOM
  const loginButton = document.getElementById('btn-login');
  loginButton.appendChild(modal);
  
  // Asignar evento al botón de cerrar sesión
  const logoutButton = modal.querySelector('#confirm-logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await logoutConGoogle();
    });
  }

   // Exportar datos
   const exportButton = document.getElementById('export-data');
  
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
});


// Logout con modal
function showLogoutModal() {
  const modal = document.querySelector('.logout-modal');
  if (modal) {
    // Alternar la clase 'show' para mostrar/ocultar el modal
    const isVisible = modal.classList.contains('show');
    if (isVisible) {
      modal.classList.remove('show');
    } else {
      modal.classList.add('show');
    }
  }
  
  // Cerrar al hacer scroll y hacer clic fuera
  const handleScroll = () => modal.classList.remove('show');
  const btnLogin = document.getElementById('btn-login');
  window.addEventListener('scroll', handleScroll, { once: true });

  const handleClickOutside = (event) => {
    if (!modal.contains(event.target) && !btnLogin.contains(event.target)) {
      modal.classList.remove('show');
    }
  };

  document.addEventListener('click', handleClickOutside);
}

async function logoutConGoogle() {
  try {
    await signOut(auth);
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
  document.getElementById('btn-login').disabled = false;
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

//tema // Configuración de temas

const THEME_CONFIG = {
  themes: ['dark', 'light', 'nocturno'],
  defaultTheme: 'dark',
  saveDelay: 10000
};

// Manejador del cambio de tema
const themeToggle = () => {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  let saveTimeout;
  let isInitialized = false;

  // Cargar tema desde Firestore
  const loadThemeFromFirestore = async () => {
      if (!auth.currentUser) return null;
      try {
          const userDoc = await getDoc(doc(db, 'usuarios', auth.currentUser.uid));
          return userDoc.exists() ? userDoc.data().theme : null;
      } catch (error) {
          console.error('Error al cargar tema:', error);
          return null;
      }
  };

  // Obtener el siguiente tema en la secuencia
  const getNextTheme = (current) => {
      const idx = THEME_CONFIG.themes.indexOf(current);
      return THEME_CONFIG.themes[(idx + 1) % THEME_CONFIG.themes.length];
  };

  // Guardar tema en Firestore con debounce
  const saveThemeToFirestore = async (theme) => {
      if (!auth.currentUser) return;
      
      if (saveTimeout) clearTimeout(saveTimeout);
      
      saveTimeout = setTimeout(async () => {
          try {
              await setDoc(doc(db, 'usuarios', auth.currentUser.uid), {
                  theme: theme,
                  lastUpdated: serverTimestamp()
              }, { merge: true });
              console.log('Tema guardado en Firestore');
          } catch (error) {
              console.error('Error al guardar tema:', error);
          }
      }, THEME_CONFIG.saveDelay);
  };

  // Aplicar tema al documento
  const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      
      // Disparar eventos personalizados
      const themeEvent = new CustomEvent('themeChanged', { detail: { theme } });
      window.dispatchEvent(themeEvent);
  };

  // Inicializar tema
  const initTheme = async () => {
      if (isInitialized) return;
      
      let theme = localStorage.getItem('theme');
      const userTheme = auth.currentUser ? await loadThemeFromFirestore() : null;
      
      theme = userTheme || theme || THEME_CONFIG.defaultTheme;
      applyTheme(theme);
      
      // Guardar el tema si viene de Firestore
      if (userTheme && userTheme !== theme) {
          saveThemeToFirestore(theme);
      }
      
      isInitialized = true;
  };

  // Manejador de clic del botón
// Al cambiar el tema
const handleThemeToggle = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const current = localStorage.getItem('theme') || 'dark';
  const next = getNextTheme(current);
  
  localStorage.setItem('theme', next);
  window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: next } 
  }));
  
  if (auth.currentUser) saveThemeToFirestore(next);
};

  // Inicialización
  const init = () => {
      const initWhenReady = () => {
          if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initTheme);
          } else {
              initTheme();
          }
      };

      if (auth.currentUser !== null) {
          initWhenReady();
      } else {
          const authHandler = () => {
              initWhenReady();
              document.removeEventListener('authStateReady', authHandler);
          };
          document.addEventListener('authStateReady', authHandler, { once: true });
      }

      btn.addEventListener('click', handleThemeToggle);
  };

  init();
};

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', themeToggle);