import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseconfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Función para actualizar UI y gestionar caché
function updateUIForUser(user) {
  const btnLogin = document.getElementById('btn-login');
  if (!btnLogin) return;

  if (user) {
    // Actualizar UI
    btnLogin.setAttribute('data-username', user.displayName);
    btnLogin.style.setProperty('--user-photo', `url('${user.photoURL || '../icons/user-solid.svg'}')`);
    btnLogin.classList.add('logged-in');
    
    // Guardar en caché
    try {
      localStorage.setItem('cachedUserDisplayName', user.displayName || '');
      localStorage.setItem('cachedUserPhotoURL', user.photoURL || '');
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
    }
  } else {
    // Actualizar UI
    btnLogin.style.setProperty('--user-photo', `url('../icons/user-solid.svg')`);
    btnLogin.removeAttribute('data-username');
    btnLogin.classList.remove('logged-in');
    
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
    console.log('Usuario autenticado:', user.displayName);
    
    // Recargar la página actual
    window.location.reload();
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('Inicio de sesión cancelado por el usuario');
    } else {
      console.error('Error de autenticación:', error);
    }
  }
}

// Logout con modal
function showLogoutModal() {
  const modal = document.createElement('div');
  modal.id = 'logout-modal';
  modal.classList.add('modal');
  modal.innerHTML = `
    <div class='modal-content'>
      <h2>Cerrar Sesión</h2>
      <p>¿Estás seguro de que deseas cerrar sesión?</p>
      <div class='modal-buttons'>
        <button id='confirm-logout'>Sí, cerrar sesión</button>
        <button id='cancel-logout'>Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  requestAnimationFrame(() => modal.classList.add('show'));
  document.body.classList.add('modal-open');

  const closeModal = () => {
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
    setTimeout(() => modal.remove(), 300);
  };

  // Cerrar modal al hacer scroll
  const handleScroll = () => closeModal();
  window.addEventListener('scroll', handleScroll, { once: true });

  document.getElementById('confirm-logout').addEventListener('click', async () => {
    await logoutConGoogle();
    closeModal();
  });

  document.getElementById('cancel-logout').addEventListener('click', closeModal);
}

async function logoutConGoogle() {
  try {
    await signOut(auth);
    updateUIForUser(null);
    console.log('Sesión cerrada');
    // Recargar la página actual
    window.location.reload();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// --- Carga inicial desde caché ---
const cachedDisplayName = localStorage.getItem('cachedUserDisplayName');
const cachedPhotoURL = localStorage.getItem('cachedUserPhotoURL');

if (cachedDisplayName || cachedPhotoURL) {
  console.log('Cargando usuario desde caché...');
  updateUIForUser({
    displayName: cachedDisplayName,
    photoURL: cachedPhotoURL,
  });
}
// --- Fin carga inicial desde caché ---

// Estado real del usuario (verifica y actualiza si es necesario)
onAuthStateChanged(auth, (user) => {
  console.log('Estado de autenticación verificado.');
  // Solo actualiza si el estado real difiere del cacheado o si no había caché
  const currentUsername = document.getElementById('btn-login')?.getAttribute('data-username');
  if (!user && currentUsername) { // Si no hay usuario real pero la UI muestra uno (del caché)
      updateUIForUser(null);
  } else if (user && (!currentUsername || currentUsername !== user.displayName)) { // Si hay usuario real y la UI no lo muestra o muestra uno diferente
      updateUIForUser(user);
  } else if (user) {
      // Si el usuario real coincide con el cacheado, aseguramos que el caché esté actualizado (por si acaso)
      try {
          localStorage.setItem('cachedUserDisplayName', user.displayName || '');
          localStorage.setItem('cachedUserPhotoURL', user.photoURL || '');
      } catch (e) {
          console.warn('No se pudo actualizar localStorage en onAuthStateChanged:', e);
      }
  }
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
