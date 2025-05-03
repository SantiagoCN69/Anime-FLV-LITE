import { firebaseConfig } from './firebaseconfig.js';


// Cargar scripts de Firebase
const scriptApp = document.createElement('script');
scriptApp.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js';
scriptApp.onload = () => {
  const scriptAuth = document.createElement('script');
  scriptAuth.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js';
  scriptAuth.onload = () => {
    const scriptFirestore = document.createElement('script');
    scriptFirestore.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js';
    scriptFirestore.onload = () => {
      initFirebase();
    };
    document.head.appendChild(scriptFirestore);
  };
  document.head.appendChild(scriptAuth);
};
document.head.appendChild(scriptApp);
  
  // Inicializar Firebase
  function initFirebase() {
    // Inicializar la aplicación
    firebase.initializeApp(firebaseConfig);
    
    // Configurar proveedor de Google
    const provider = new firebase.auth.GoogleAuthProvider();
  
    // Función para manejar el estado de autenticación
    function updateUIForUser(user) {
      const btnLogin = document.getElementById('btn-login');
      if (btnLogin) {
        if (user) {
          btnLogin.setAttribute('data-username', user.displayName);
          btnLogin.classList.add('logged-in');
        } else {
          // Usuario no autenticado
          btnLogin.style.setProperty('--user-photo', `url('../icons/user-solid.svg')`);
          btnLogin.removeAttribute('data-username');
          btnLogin.classList.remove('logged-in');
        }
      }
    }
  
    // Función de login
    function loginConGoogle() {
      firebase.auth().signInWithPopup(provider)
        .then((result) => {
          const user = result.user;
          const db = firebase.firestore();
          const refUsuario = db.collection('usuarios').doc(user.uid);
  
          refUsuario.get().then((doc) => {
            if (!doc.exists) {
              refUsuario.set({
                nombre: user.displayName,
                email: user.email,
                foto: user.photoURL,
                creado: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            
            // Actualizar UI
            updateUIForUser(user);
            console.log('Usuario autenticado:', user.displayName);
          });
        })
        .catch((error) => {
          // Manejar específicamente el cierre de popup
          if (error.code === 'auth/popup-closed-by-user') {
            console.log('Inicio de sesión cancelado por el usuario');
          } else {
            console.error('Error de autenticación:', error);
          }
        });
    }
  
    // Función de logout
    function showLogoutModal() {
      // Crear la modal
      const modal = document.createElement('div');
      modal.id = 'logout-modal';
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
      modal.classList.add('modal');
      document.body.appendChild(modal);

      // Mostrar modal
      document.body.classList.add('modal-open');
      setTimeout(() => modal.classList.add('show'), 10);

      // Eventos de botones
      document.getElementById('confirm-logout').addEventListener('click', () => {
        logoutConGoogle();
        document.body.classList.remove('modal-open');
        modal.remove();
        style.remove();
      });

      document.getElementById('cancel-logout').addEventListener('click', () => {
        document.body.classList.remove('modal-open');
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
        style.remove();
      });
    }

    function logoutConGoogle() {
      firebase.auth().signOut()
        .then(() => {
          // Actualizar UI para usuario no autenticado
          updateUIForUser(null);
          console.log('Sesión cerrada');
        })
        .catch((error) => {
          console.error('Error al cerrar sesión:', error);
        });
    }
  
    // Manejar cambios en el estado de autenticación
    firebase.auth().onAuthStateChanged((user) => {
      updateUIForUser(user);
    });
  
    // Añadir evento de clic al botón de login
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        const user = firebase.auth().currentUser;
        if (user) {
          // Si ya hay un usuario, mostrar modal de confirmación
          showLogoutModal();
        } else {
          // Si no hay usuario, iniciar sesión
          loginConGoogle();
        }
      });
    }
  }
  
  // Esperar a que los scripts de Firebase estén cargados
  document.addEventListener('DOMContentLoaded', () => {
    // Verificar que los objetos globales de Firebase estén disponibles
    if (window.firebase && window.firebase.initializeApp) {
      initFirebase();
    } else {
      console.error('Firebase scripts no cargados correctamente');
    }
  });