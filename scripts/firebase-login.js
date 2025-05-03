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

// Función para actualizar UI
function updateUIForUser(user) {
  const btnLogin = document.getElementById('btn-login');
  if (!btnLogin) return;

  if (user) {
    btnLogin.setAttribute('data-username', user.displayName);
    btnLogin.classList.add('logged-in');
  } else {
    btnLogin.style.setProperty('--user-photo', `url('../icons/user-solid.svg')`);
    btnLogin.removeAttribute('data-username');
    btnLogin.classList.remove('logged-in');
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
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// Estado inicial del usuario
onAuthStateChanged(auth, (user) => {
  updateUIForUser(user);
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
