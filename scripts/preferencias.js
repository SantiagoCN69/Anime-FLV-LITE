import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { auth, db } from "./firebase-login.js";

const THEME_CONFIG = {
  themes: ['dark', 'nocturno', 'sakura', 'cyberpunk', 'sunset', 'morado_medianoche'],
  defaultTheme: 'dark'
};

const THEME_LABELS = {
  dark: 'Oscuro',
  nocturno: 'Nocturno',
  sakura: 'Sakura',
  cyberpunk: 'Cyberpunk',
  sunset: 'Sunset',
  morado_medianoche: 'Medianoche'
};

const provider = new GoogleAuthProvider();
let userCached = null;

console.log('[Preferencias] módulo cargado. readyState=', document.readyState);

const aplicarTema = (tema) => {
  console.log('[Preferencias] aplicarTema ->', tema);
  localStorage.setItem('theme', tema);
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: tema } }));
};

const actualizarBtnTema = () => {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  const current = localStorage.getItem('theme') || THEME_CONFIG.defaultTheme;
  btn.textContent = THEME_LABELS[current] || current;
};

const actualizarBtnSidebar = () => {
  const btn = document.getElementById('btn-sidebar-toggle');
  if (!btn) return;
  const collapsed = document.body.classList.contains('sidebar-collapsed');
  btn.textContent = collapsed ? 'Mostrar' : 'Ocultar';
};

const loginConGoogle = async () => {
  console.log('[Preferencias] login: usando auth de firebase-login.js');
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('[Preferencias] login OK', user.uid);

    const refUsuario = doc(db, 'usuarios', user.uid);
    const docSnap = await getDoc(refUsuario);

    if (!docSnap.exists()) {
      await setDoc(refUsuario, {
        nombre: user.displayName,
        email: user.email,
        creado: serverTimestamp()
      });
    }

    guardarCacheUsuario(user);
    window.location.reload();
  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error('[Preferencias] Error en login:', error);
    }
  }
};

const logoutConGoogle = async () => {
  console.log('[Preferencias] logout');
  try {
    limpiarCacheUsuario();
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error('[Preferencias] Error al cerrar sesión:', error);
  }
};

const guardarCacheUsuario = (user) => {
  try {
    localStorage.setItem('cachedUserDisplayName', user.displayName || '');
    localStorage.setItem('cachedUserPhotoURL', user.photoURL || '');
    localStorage.setItem('userID', user.uid);
  } catch (e) {
    console.warn('[Preferencias] Error guardando usuario:', e);
  }
};

const limpiarCacheUsuario = () => {
  try {
    localStorage.removeItem('cachedUserDisplayName');
    localStorage.removeItem('cachedUserPhotoURL');
    localStorage.removeItem('userID');
  } catch (e) {
    console.warn('[Preferencias] Error limpiando usuario:', e);
  }
};

const updateUIForUser = (user) => {
  const btnAuth = document.getElementById('btn-auth');
  const userInfo = document.getElementById('user-info');
  if (!btnAuth) {
    console.warn('[Preferencias] #btn-auth no encontrado');
    return;
  }

  if (user) {
    const primerNombre = (user.displayName || localStorage.getItem('cachedUserDisplayName') || '').split(' ')[0] || 'Usuario';
    if (userInfo) {
      const h3 = userInfo.querySelector('h3');
      const p = userInfo.querySelector('p');
      if (h3) h3.textContent = primerNombre;
      if (p) p.textContent = user.email || 'Sesión activa';
    }
    btnAuth.textContent = 'Cerrar sesión';
  } else {
    if (userInfo) {
      const h3 = userInfo.querySelector('h3');
      const p = userInfo.querySelector('p');
      if (h3) h3.textContent = 'Estado de sesión';
      if (p) p.textContent = 'Invitado';
    }
    btnAuth.textContent = 'Iniciar sesión';
  }
};

const exportarDatos = async (btnElement) => {
  console.log('[Preferencias] exportar datos. user=', auth.currentUser?.uid || null);
  if (!auth.currentUser) {
    alert('Debes iniciar sesión para exportar tus datos.');
    return;
  }

  const originalText = btnElement.textContent;
  btnElement.textContent = 'Exportando...';
  btnElement.disabled = true;

  try {
    const userId = auth.currentUser.uid;
    const userRef = doc(db, 'usuarios', userId);

    const serializarValor = (value) => {
      if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
      }
      return value;
    };

    const getAnimesDeDoc = async (docRef) => {
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return [];
        return snap.data().animes || [];
      } catch (error) {
        console.warn('[Preferencias] error leyendo', docRef.path, error);
        return [];
      }
    };

    const [perfilSnap, pendiente, viendo, visto, favoritos] = await Promise.all([
      getDoc(userRef),
      getAnimesDeDoc(doc(db, 'usuarios', userId, 'estados', 'pendiente')),
      getAnimesDeDoc(doc(db, 'usuarios', userId, 'estados', 'viendo')),
      getAnimesDeDoc(doc(db, 'usuarios', userId, 'estados', 'visto')),
      getAnimesDeDoc(doc(db, 'usuarios', userId, 'favoritos', 'lista'))
    ]);

    const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
    console.log('[Preferencias] export counts', {
      pendiente: pendiente.length,
      viendo: viendo.length,
      visto: visto.length,
      favoritos: favoritos.length
    });

    const userData = {
      usuario: {
        uid: userId,
        email: perfil.email || auth.currentUser.email,
        displayName: perfil.nombre || auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
        theme: perfil.theme || localStorage.getItem('theme') || null,
        creado: serializarValor(perfil.creado) || null,
        lastUpdated: serializarValor(perfil.lastUpdated) || null
      },
      animes: {
        pendiente,
        viendo,
        visto,
        favoritos
      },
      fechaExportacion: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `anime-data-${userId.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    console.log('[Preferencias] export OK');
    btnElement.textContent = '¡Listo!';
  } catch (error) {
    console.error('[Preferencias] Error al exportar datos:', error);
    btnElement.textContent = 'Error';
  } finally {
    setTimeout(() => {
      btnElement.textContent = originalText;
      btnElement.disabled = false;
    }, 2000);
  }
};

function initPreferencias() {
  if (window.__preferenciasInit) {
    console.log('[Preferencias] ya inicializado, skip');
    return;
  }
  window.__preferenciasInit = true;
  console.log('[Preferencias] init controles');

  const cachedName = localStorage.getItem('cachedUserDisplayName');
  if (cachedName) {
    updateUIForUser({
      displayName: cachedName,
      email: 'Sesión activa'
    });
  }

  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    actualizarBtnTema();
    btnThemeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      const current = localStorage.getItem('theme') || THEME_CONFIG.defaultTheme;
      const idx = THEME_CONFIG.themes.indexOf(current);
      const next = THEME_CONFIG.themes[(idx + 1) % THEME_CONFIG.themes.length];
      console.log('[Preferencias] click tema', current, '->', next);
      aplicarTema(next);
      actualizarBtnTema();

      if (auth.currentUser) {
        setDoc(doc(db, 'usuarios', auth.currentUser.uid), {
          theme: next,
          lastUpdated: serverTimestamp()
        }, { merge: true }).catch(err => console.error('[Preferencias] Error guardando tema:', err));
      }
    });
  } else {
    console.warn('[Preferencias] #btn-theme-toggle no encontrado');
  }

  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  if (btnSidebarToggle) {
    actualizarBtnSidebar();
    btnSidebarToggle.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.toggle('sidebar-collapsed');
      const newState = document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebarCollapsed', newState);
      actualizarBtnSidebar();
      console.log('[Preferencias] sidebarCollapsed =', newState);
    });
  } else {
    console.warn('[Preferencias] #btn-sidebar-toggle no encontrado');
  }

  const aplicarAnimaciones = (activas) => {
    document.body.classList.toggle('animaciones-off', !activas);
    localStorage.setItem('animaciones', String(activas));
    console.log('[Preferencias] animaciones =', activas, 'clase animaciones-off =', !activas);
  };

  const toggleAnimaciones = document.getElementById('toggle-animaciones');
  if (toggleAnimaciones) {
    const animacionesOn = localStorage.getItem('animaciones') !== 'false';
    toggleAnimaciones.checked = animacionesOn;
    aplicarAnimaciones(animacionesOn);
    toggleAnimaciones.addEventListener('change', () => {
      aplicarAnimaciones(toggleAnimaciones.checked);
      location.reload();
    });
  }

  const selectCV = document.getElementById('select-cv');
  if (selectCV) {
    const currentCV = localStorage.getItem('continuar_viendo_pos') || 'cv-ambas';
    selectCV.value = currentCV;
    document.body.classList.remove('cv-main', 'cv-sidebar', 'cv-ambas');
    document.body.classList.add(currentCV);
    selectCV.addEventListener('change', (e) => {
      const nextCV = e.target.value;
      localStorage.setItem('continuar_viendo_pos', nextCV);
      document.body.classList.remove('cv-main', 'cv-sidebar', 'cv-ambas');
      document.body.classList.add(nextCV);
      console.log('[Preferencias] continuar_viendo_pos =', nextCV);
    });
  }

  const selectNav = document.getElementById('select-nav');
  if (selectNav) {
    const currentNav = localStorage.getItem('indexpaginationPosition') || 'floating';
    selectNav.value = currentNav;
    selectNav.addEventListener('change', (e) => {
      const nextNav = e.target.value;
      localStorage.setItem('indexpaginationPosition', nextNav);
      const indexpagination = document.getElementById('indexpagination');
      if (indexpagination) {
        indexpagination.classList.remove('top', 'bottom', 'floating', 'fixed');
        indexpagination.classList.add(nextNav);
      }
      console.log('[Preferencias] indexpaginationPosition =', nextNav);
    });
  }

  const toggleAdblock = document.getElementById('toggle-adblock');
  if (toggleAdblock) {
    const adblockOn = localStorage.getItem('bloquearAnuncios') !== 'false';
    toggleAdblock.checked = adblockOn;
    toggleAdblock.addEventListener('change', () => {
      localStorage.setItem('bloquearAnuncios', String(toggleAdblock.checked));
      console.log('[Preferencias] bloquearAnuncios =', toggleAdblock.checked);
    });
  }

  const selectServers = document.getElementById('select-servers');
  if (selectServers) {
    const currentServer = localStorage.getItem('serverPreference') || 'sub';
    selectServers.value = currentServer === 'dob' ? 'dob' : 'sub';
    selectServers.addEventListener('change', (e) => {
      localStorage.setItem('serverPreference', e.target.value);
      console.log('[Preferencias] serverPreference =', e.target.value);
    });
  }

  const btnExport = document.getElementById('btn-export-data');
  if (btnExport) {
    btnExport.addEventListener('click', (e) => {
      e.preventDefault();
      exportarDatos(btnExport);
    });
  }

  const btnClearCache = document.getElementById('btn-clear-cache');
  if (btnClearCache) {
    btnClearCache.addEventListener('click', async (e) => {
      e.preventDefault();
      const originalText = btnClearCache.textContent;
      btnClearCache.textContent = 'Limpiando...';
      btnClearCache.disabled = true;
      console.log('[Preferencias] limpiar caché');

      try {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        btnClearCache.textContent = '¡Listo!';
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        console.error('[Preferencias] Error limpiando caché:', error);
        btnClearCache.textContent = 'Error';
        setTimeout(() => {
          btnClearCache.textContent = originalText;
          btnClearCache.disabled = false;
        }, 2000);
      }
    });
  }

  const btnAuth = document.getElementById('btn-auth');
  if (btnAuth) {
    btnAuth.addEventListener('click', (e) => {
      e.preventDefault();
      const loggedIn = !!(auth.currentUser || userCached);
      console.log('[Preferencias] click auth. loggedIn=', loggedIn, 'auth.currentUser=', !!auth.currentUser);
      if (loggedIn) {
        logoutConGoogle();
      } else {
        loginConGoogle();
      }
    });
  }
}

initPreferencias();

const cargarTemaDesdeFirestore = async () => {
  if (!auth.currentUser) return;
  try {
    const docRef = doc(db, 'usuarios', auth.currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().theme) {
      aplicarTema(docSnap.data().theme);
      actualizarBtnTema();
    }
  } catch (error) {
    console.error('[Preferencias] Error al cargar tema desde Firestore:', error);
  }
};

auth.onAuthStateChanged((user) => {
  console.log('[Preferencias] authState', user ? user.uid : null);
  userCached = user;
  if (!user) {
    updateUIForUser(null);
  } else {
    updateUIForUser(user);
    guardarCacheUsuario(user);
    if (!localStorage.getItem('theme')) {
      cargarTemaDesdeFirestore();
    }
  }
});
