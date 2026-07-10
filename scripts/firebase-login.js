import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Función para actualizar UI
function updateUIForUser(user) {
  const btnLogin = document.getElementById('btn-login');
  if (!btnLogin) return;
  
  if (user) {
    const nombres = (user.displayName || '').split(' ');
    const primerNombre = nombres[0] || '';
    
    btnLogin.innerHTML = `<img src="${user.photoURL || 'icons/user-solid.svg'}" alt="Foto de perfil"><span>${primerNombre}</span>`;
    btnLogin.classList.remove('nouser');
  } else {
    console.log('[Login] 👤 Usuario desconectado');
    btnLogin.innerHTML = '<span>Login</span>';
    btnLogin.classList.add('nouser');
  }
}

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
    try {
      localStorage.setItem('cachedUserDisplayName', user.displayName || '');
      localStorage.setItem('cachedUserPhotoURL', user.photoURL || '');
      localStorage.setItem('userID', user.uid);
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
    }

    updateUIForUser(user);
    window.location.reload();
  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error("Error en login:", error);
    }
  }
}

async function logoutConGoogle() {
  try {
    try {
      localStorage.removeItem('cachedUserDisplayName');
      localStorage.removeItem('cachedUserPhotoURL');
      localStorage.removeItem('userID');
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

function crearmodal(user = false) {
  const loginButton = document.getElementById('btn-login');
  if (!loginButton) return;

  const modalExistente = loginButton.querySelector('.logout-modal');
  if (modalExistente) modalExistente.remove();

  const modal = document.createElement('div');
  modal.className = 'logout-modal';
  modal.innerHTML = `
    <button id="export-data">Exportar datos</button>
    <button id="theme-toggle">Cambiar tema</button>
    <button id="config">Navegación</button>
  `;
  
  if (user) {
    modal.innerHTML += `<button id='confirm-logout' class="modal-btn-b">Cerrar sesión</button>`;
  } else {
    modal.innerHTML += `<button id='confirm-login' class="modal-btn-b">Login</button>`;
  }
  
  loginButton.appendChild(modal);
  
  const logoutButton = modal.querySelector('#confirm-logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => await logoutConGoogle());
  }
  
  const loginButtonModal = modal.querySelector('#confirm-login');
  if (loginButtonModal) {
    loginButtonModal.addEventListener('click', async () => await loginConGoogle());
  }

  const exportButton = modal.querySelector('#export-data');
  if (exportButton) {
    exportButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation(); 
      const originalText = exportButton.textContent;
      
      try {
        exportButton.textContent = 'Exportando...';
        exportButton.disabled = true;
        
        const currentUser = auth.currentUser; // Usar la instancia 'auth' ya importada arriba
        if (!currentUser) throw new Error('No hay usuario autenticado');
        
        const userId = currentUser.uid;
        
        const getCollectionData = async (collectionName) => {
          try {
            const q = query(collection(db, 'usuarios', userId, collectionName));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data());
          } catch (error) {
            console.error(`Error al obtener ${collectionName}:`, error);
            return [];
          }
        };
        
        const [vistos, viendo, completados, favoritos] = await Promise.all([
          getCollectionData('visto'),
          getCollectionData('viendo'),
          getCollectionData('completados'),
          getCollectionData('favoritos')
        ]);
        
        const userData = {
          usuario: {
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
          },
          animes: { vistos, viendo, completados, favoritos },
          fechaExportacion: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(userData, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        const exportFileDefaultName = `animeflv-lite-${userId.slice(0, 8)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
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
}

let userCached = null;
let isFirstLoad = true;

onAuthStateChanged(auth, (user) => {
  if (userCached?.uid === user?.uid && user !== null && !isFirstLoad) {
    console.log('[Auth] ✅ Usuario sin cambios, evitando re-render innecesario');
    return;
  }
  
  if (isFirstLoad) {
    isFirstLoad = false;
  } else {
    console.log('[Auth] Cambio de usuario detectado');
  }
  
  userCached = user;
  
  if (!user) {
    updateUIForUser(null);
    try {
      localStorage.removeItem('cachedUserDisplayName');
      localStorage.removeItem('cachedUserPhotoURL');
      localStorage.removeItem('userID');
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }
  } else {
    updateUIForUser(user);
    try {
      localStorage.setItem('cachedUserDisplayName', user.displayName || '');
      localStorage.setItem('cachedUserPhotoURL', user.photoURL || '');
      localStorage.setItem('userID', user.uid);
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
    }
  }
  
  crearmodal(user);
  document.dispatchEvent(new CustomEvent('authStateReady', { detail: { user } }));
  
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) btnLogin.disabled = false;
  
  themeToggle();
  if (!localStorage.getItem('theme')) {
    cargarTemaDesdeFirestore();
  }
});

const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
  const handleClickOutside = (event) => {
    const modal = document.querySelector('.logout-modal');
    if (modal && !modal.contains(event.target) && !btnLogin.contains(event.target)) {
      modal.classList.remove('show');
      document.removeEventListener('click', handleClickOutside);
    }
  };

  btnLogin.addEventListener('click', (e) => {
    const modal = document.querySelector('.logout-modal');
    if (!modal) return;

    const isShowing = modal.classList.toggle('show');

    if (isShowing) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
      
      window.addEventListener('scroll', () => {
        modal.classList.remove('show');
        document.removeEventListener('click', handleClickOutside);
      }, { once: true });
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  });
}

export { app, auth, db };

const THEME_CONFIG = {
  themes: ['dark', 'nocturno', 'sakura', 'cyberpunk'],
  defaultTheme: 'dark',
  saveDelay: 10000
};

const cargarTemaDesdeFirestore = async () => {
  if (!auth.currentUser) return;

  try {
    const docRef = doc(db, 'usuarios', auth.currentUser.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && docSnap.data().theme) {
      const tema = docSnap.data().theme;
      localStorage.setItem('theme', tema);
      window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: tema } }));
    }
  } catch (error) {
    console.error('Error al cargar tema desde Firestore:', error);
  }
};

const themeToggle = () => {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  let saveTimeout;

  const getNextTheme = (current) => {
    const idx = THEME_CONFIG.themes.indexOf(current);
    return THEME_CONFIG.themes[(idx + 1) % THEME_CONFIG.themes.length];
  };

  const saveThemeToFirestore = async (theme) => {
    if (!auth.currentUser) return;

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'usuarios', auth.currentUser.uid), {
          theme,
          lastUpdated: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error("Error guardando tema:", error);
      }
    }, THEME_CONFIG.saveDelay);
  };

  btn.replaceWith(btn.cloneNode(true));
  const newBtn = document.getElementById('theme-toggle');

  newBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const current = localStorage.getItem('theme') || THEME_CONFIG.defaultTheme;
    const next = getNextTheme(current);

    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));

    saveThemeToFirestore(next);
  });
};