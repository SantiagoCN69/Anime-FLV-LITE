import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

const THEME_CONFIG = {
  themes: ['dark', 'nocturno', 'sakura', 'cyberpunk', 'sunset', 'morado_medianoche'],
  defaultTheme: 'dark',
  saveDelay: 10000
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

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

  // Limpiar modal existente
  const modalExistente = loginButton.querySelector('.logout-modal');
  if (modalExistente) modalExistente.remove();

  // Los ajustes de la aplicación viven en la sección Preferencias.
  const modal = document.createElement('div');
  modal.className = 'logout-modal';
  modal.innerHTML = `
    <button id="theme-toggle">Tema</button>
    <button id="preferencias-btn">Preferencias</button>
    <button id="contacto-link">Contacto</button>
  `;
  
  if (user) {
    modal.innerHTML += `<button id='confirm-logout' class="modal-btn-b">Salir</button>`;
  } else {
    modal.innerHTML += `<button id='confirm-login' class="modal-btn-b">Iniciar</button>`;
  }
  
  loginButton.appendChild(modal);

  // Evitar que clics en el fondo del modal lo cierren por accidente
  modal.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // ==========================================
  // EVENTOS DEL MODAL
  // ==========================================
// --- Botón Cambiar Tema ---
  const themeBtn = modal.querySelector('#theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const current = localStorage.getItem('theme') || THEME_CONFIG.defaultTheme;
      const idx = THEME_CONFIG.themes.indexOf(current);
      const next = THEME_CONFIG.themes[(idx + 1) % THEME_CONFIG.themes.length];

      localStorage.setItem('theme', next);
      window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));

      if (auth && auth.currentUser) {
        setDoc(doc(db, 'usuarios', auth.currentUser.uid), {
          theme: next,
          lastUpdated: serverTimestamp()
        }, { merge: true }).catch(err => console.error("Error guardando tema:", err));
      }
    });
  }

  // --- Botones Login / Logout ---
  const loginButtonModal = modal.querySelector('#confirm-login');
  if (loginButtonModal) {
    loginButtonModal.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await loginConGoogle();
    });
  }

  const logoutButton = modal.querySelector('#confirm-logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await logoutConGoogle();
    });
  }

  // --- Botón Preferencias ---
  const preferenciasBtn = modal.querySelector('#preferencias-btn');
  if (preferenciasBtn) {
    preferenciasBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (document.getElementById('Preferencias')) {
        history.replaceState(null, '', '?Preferencias');
        window.dispatchEvent(new Event('searchchange'));
      } else {
        window.location.href = '/?Preferencias';
      }
    });
  }

  // --- Botón contacto ---
  const contactoBtn = modal.querySelector('#contacto-link');
  if (contactoBtn) {
    contactoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (document.getElementById('Contacto')) {
        history.replaceState(null, '', '?Contacto');
        window.dispatchEvent(new Event('searchchange'));
      } else {
        window.location.href = '/?Contacto';
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
    if (e.target.closest('.logout-modal')) {
      return; 
    }
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