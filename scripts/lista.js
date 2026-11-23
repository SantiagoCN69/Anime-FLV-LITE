import { db } from './firebase-login.js';
import { doc } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';
import { cargarDatos } from './index.js';

const getUserID = () => localStorage.getItem('userID') || 'null';

// Cada pestaña reutiliza el mismo documento de Firestore y el mismo caché local
// que usaban las antiguas secciones: no se agrega ninguna lectura nueva.
const LISTAS = {
  viendo: {
    containerId: 'viendo',
    docRef: () => doc(db, 'usuarios', getUserID(), 'estados', 'viendo'),
    cargada: false,
    limite: 10,
    orden: 'recientes'
  },
  visto: {
    containerId: 'completados',
    docRef: () => doc(db, 'usuarios', getUserID(), 'estados', 'visto'),
    cargada: false,
    limite: 10,
    orden: 'recientes'
  },
  pendiente: {
    containerId: 'pendientes',
    docRef: () => doc(db, 'usuarios', getUserID(), 'estados', 'pendiente'),
    cargada: false,
    limite: 10,
    orden: 'recientes'
  },
  favoritos: {
    containerId: 'favoritos',
    docRef: () => doc(db, 'usuarios', getUserID(), 'favoritos', 'lista'),
    cargada: false,
    limite: 10,
    orden: 'recientes'
  }
};

const TAB_POR_DEFECTO = 'viendo';
const ORDENES_VALIDOS = new Set(['recientes', 'nombre-az', 'nombre-za']);

function cerrarOrdenes() {
  document.querySelectorAll('#Lista .lista-orden-section .filtro-opciones.active, #Lista .lista-orden-section .btn-filtro.active')
    .forEach(el => el.classList.remove('active'));
}

let tabActiva = TAB_POR_DEFECTO;

function obtenerTabDesdeURL() {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return LISTAS[tab] ? tab : null;
}

function actualizarIndicador() {
  const nav = document.getElementById('lista-nav');
  const indicator = nav?.querySelector('.lista-indicator');
  const tabActivaEl = nav?.querySelector(`.lista-tab[data-lista="${tabActiva}"]`);
  if (!nav || !indicator || !tabActivaEl) return;

  indicator.style.width = `${tabActivaEl.offsetWidth}px`;
  indicator.style.transform = `translateX(${tabActivaEl.offsetLeft}px)`;
  nav.classList.add('indicador-visible');
}

async function cargarLista(key) {
  const lista = LISTAS[key];
  if (!lista || lista.cargada) return;
  lista.cargada = true;

  const container = document.getElementById(lista.containerId);
  if (!container) return;

  await cargarDatos(container, lista.docRef(), lista.limite, 0, null, lista.orden);

  // Conserva cuántas tarjetas hay visibles para que un cambio de orden
  // recargue la misma cantidad en lugar de volver a la primera página.
  const total = container.querySelectorAll('.anime-card').length;
  if (total > lista.limite) lista.limite = total;
}

function activarTab(key, { actualizarUrl = true } = {}) {
  if (!LISTAS[key]) key = TAB_POR_DEFECTO;
  tabActiva = key;

  document.querySelectorAll('.lista-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.lista === key);
  });
  document.querySelectorAll('.lista-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === key);
  });

  // Sincroniza el control de orden (dropdown custom) con el estado de la lista
  const ordenSection = document.querySelector(`.lista-panel[data-panel="${key}"] .lista-orden-section`);
  if (ordenSection) {
    const op = ordenSection.querySelector(`.btn-filtro-opcion[data-orden="${LISTAS[key].orden}"]`);
    ordenSection.querySelectorAll('.btn-filtro-opcion').forEach(o => o.classList.toggle('active', o === op));
    const span = ordenSection.querySelector('.btn-filtro span');
    if (span && op) span.textContent = op.textContent.trim();
  }

  actualizarIndicador();
  cargarLista(key);

  if (actualizarUrl) {
    // Ojo: la URL usa "?Lista&tab=..." (sin '=') porque el router de la app
    // parsea el primer parámetro como id de sección.
    history.replaceState(null, '', `?Lista&tab=${key}`);
  }
}

function inicializar() {
  const tabs = document.querySelectorAll('.lista-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activarTab(tab.dataset.lista));
  });

  // Control de orden con el mismo patrón de dropdowns de la app
  // (.btn-filtro + .filtro-opciones, como en directorio/populares).
  document.querySelectorAll('#Lista .lista-orden-section').forEach(section => {
    const panel = section.closest('.lista-panel');
    const key = panel?.dataset.panel;
    const btn = section.querySelector('.btn-filtro');
    const opcionesBox = section.querySelector('.filtro-opciones');
    const opciones = section.querySelectorAll('.btn-filtro-opcion');
    if (!btn || !opcionesBox) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estabaAbierto = opcionesBox.classList.contains('active');
      cerrarOrdenes();
      if (!estabaAbierto) {
        btn.classList.add('active');
        opcionesBox.classList.add('active');
      }
    });

    opciones.forEach(op => {
      op.addEventListener('click', () => {
        const orden = ORDENES_VALIDOS.has(op.dataset.orden) ? op.dataset.orden : 'recientes';
        opciones.forEach(o => o.classList.remove('active'));
        op.classList.add('active');
        btn.querySelector('span').textContent = op.textContent.trim();
        cerrarOrdenes();

        if (!key || !LISTAS[key]) return;
        LISTAS[key].orden = orden;
        LISTAS[key].limite = 10;

        const container = document.getElementById(LISTAS[key].containerId);
        if (container) {
          cargarDatos(container, LISTAS[key].docRef(), 10, 0, null, orden);
        }
      });
    });
  });

  // Cierra cualquier dropdown de orden al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#Lista .lista-orden-section')) cerrarOrdenes();
  });

  window.addEventListener('resize', actualizarIndicador);

  // Los clicks del menú global y los redirects legacy llaman a
  // mostrarSeccionDesdesearch(), que emite 'seccionchange' (index.js).
  // 'searchchange' queda cubierto porque también pasa por esa función.
  window.addEventListener('seccionchange', () => {
    const seccion = decodeURIComponent(window.location.search.split(/[?&]/)[1] || '');
    if (seccion !== 'Lista') return;
    const tabUrl = obtenerTabDesdeURL();
    if (tabUrl && tabUrl !== tabActiva) {
      activarTab(tabUrl, { actualizarUrl: false });
    } else if (!tabUrl && tabActiva !== TAB_POR_DEFECTO) {
      // El menú global navega a "?Lista" sin tab: conservar la pestaña
      // activa en la URL para recargas y enlaces compartidos.
      history.replaceState(null, '', `?Lista&tab=${tabActiva}`);
    }
  });

  // Login/cambio de cuenta sin recargar: las listas se vuelven a pedir
  // con la identidad nueva (index.js actualiza su userID en el mismo evento).
  document.addEventListener('authStateReady', () => {
    Object.values(LISTAS).forEach(lista => { lista.cargada = false; });
    cargarLista(tabActiva);
  });

  activarTab(obtenerTabDesdeURL() || TAB_POR_DEFECTO, { actualizarUrl: false });

  // El indicador depende del ancho real de las pestañas (fuentes, zoom).
  requestAnimationFrame(actualizarIndicador);
  window.addEventListener('load', actualizarIndicador);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}
