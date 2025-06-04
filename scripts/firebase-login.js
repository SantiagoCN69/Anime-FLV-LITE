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

//tema 
// Manejo del botón de cambio de tema
const themeToggle = () => {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    let saveTimeout;
    const THEMES = ['dark', 'light', 'nocturno'];
    const SAVE_DELAY = 10000;
    
    // Cargar tema desde Firestore si no hay en caché
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
    
    const getNextTheme = (current) => {
        const idx = THEMES.indexOf(current);
        return THEMES[(idx + 1) % THEMES.length];
    };
    
    const saveThemeToFirestore = async (theme) => {
        if (!auth.currentUser) return;
        try {
            await setDoc(doc(db, 'usuarios', auth.currentUser.uid), {
                theme: theme,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            console.log('Tema guardado en Firestore');
        } catch (error) {
            console.error('Error al guardar tema:', error);
        }
    };
    
    // Inicializar tema al cargar
    const initTheme = async () => {
        console.log('Iniciando tema...');
        let theme = localStorage.getItem('theme');
        
        console.log('Tema en localStorage:', theme);
        console.log('Usuario actual:', auth.currentUser ? 'Autenticado' : 'No autenticado');
        
        // Si no hay tema en caché y hay usuario autenticado, intentar cargar de Firestore
        if (!theme && auth.currentUser) {
            console.log('Intentando cargar tema desde Firestore...');
            try {
                const firestoreTheme = await loadThemeFromFirestore();
                console.log('Tema desde Firestore:', firestoreTheme);
                
                if (firestoreTheme) {
                    theme = firestoreTheme;
                    localStorage.setItem('theme', theme);
                    console.log('Tema actualizado desde Firestore:', theme);
                } else {
                    console.log('No se encontró tema en Firestore');
                }
            } catch (error) {
                console.error('Error al cargar tema de Firestore:', error);
            }
        }
        
        // Aplicar tema por defecto si no hay ninguno
        if (!theme) {
            theme = 'dark';
            localStorage.setItem('theme', theme);
            console.log('Usando tema por defecto:', theme);
        }
        
        // Aplicar el tema
        console.log('Aplicando tema:', theme);
        document.documentElement.setAttribute('data-theme', theme);
        
        // Disparar eventos para notificar a otros componentes
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: theme } 
        }));
        
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'theme',
            newValue: theme,
            oldValue: null,
            storageArea: localStorage
        }));
    };
    
    // Inicializar tema cuando el estado de autenticación esté listo
    const initThemeAfterAuth = () => {
        console.log('Verificando estado de autenticación para tema...');
        
        const initWhenReady = () => {
            console.log('Autenticación lista, verificando usuario...');
            if (auth.currentUser) {
                console.log('Usuario autenticado, inicializando tema...');
                initTheme();
            } else {
                console.log('No hay usuario autenticado, usando tema por defecto');
                initTheme(); // Inicializar igualmente con tema por defecto
            }
        };
        
        // Si el DOM no está listo, esperar a que lo esté
        if (document.readyState === 'loading') {
            console.log('Esperando a que el DOM esté listo...');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('DOM listo, verificando autenticación...');
                if (auth.currentUser !== null) {
                    initWhenReady();
                } else {
                    document.addEventListener('authStateReady', initWhenReady, { once: true });
                }
            });
        } else {
            console.log('DOM ya está listo, verificando autenticación...');
            if (auth.currentUser !== null) {
                initWhenReady();
            } else {
                document.addEventListener('authStateReady', initWhenReady, { once: true });
            }
        }
    };
    
    // Iniciar el proceso
    initThemeAfterAuth();

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const current = localStorage.getItem('theme') || 'dark';
        const next = getNextTheme(current);
        
        localStorage.setItem('theme', next);
        
        // Cancelar el timeout anterior si existe
        if (saveTimeout) clearTimeout(saveTimeout);
        
        // Programar el guardado para dentro de 30 segundos
        saveTimeout = setTimeout(() => {
            saveThemeToFirestore(next);
        }, SAVE_DELAY);
        
        // Disparar eventos de cambio de tema
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'theme',
            newValue: next,
            oldValue: current,
            storageArea: localStorage
        }));
    };
};

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', themeToggle);