import { mostrarSeccionDesdesearch } from './index.js';
import { observerAnimeCards, aplicarViewTransition } from './utils.js';

let paginaActual = 1;
let totalPaginas = 1;
const CACHE_KEY = "cache-directoriojk";

const filtros = {
  filtro: "", orden: "", genero: "", letra: "", demografia: "", categoria: "",
  tipo: "", estado: "", fecha: "", temporada: "", orden_dir: ""
};

const $ = id => document.getElementById(id);

const filtroMenus = [
  ["btn-filtro", "filtro", "filtro"],
  ["btn-filtro-genero", "filtro-genero", "genero"],
  ["btn-filtro-letra", "filtro-letra", "letra"],
  ["btn-filtro-demografia", "filtro-demografia", "demografia"],
  ["btn-filtro-categoria", "filtro-categoria", "categoria"],
  ["btn-filtro-tipo", "filtro-tipo", "tipo"],
  ["btn-filtro-estado", "filtro-estado", "estado"],
  ["btn-filtro-ano", "filtro-ano", "fecha"],
  ["btn-filtro-temporada", "filtro-temporada", "temporada"],
  ["btn-filtro-orden", "filtro-orden", "orden"]
];

const filtroKeys = filtroMenus.map(([_, __, key]) => key);

$('btn-fuente-directorio-JK')?.addEventListener('click', () => {
   history.replaceState(null, '', `?DirectorioFLV`);
   mostrarSeccionDesdesearch();
});

const actualizarBoton = (idBtn, texto) => {
  const span = $(idBtn)?.querySelector("span");
  if (span) span.textContent = texto;
};

const contarFiltrosActivos = () => Object.values(filtros).filter(v => v).length;

const limpiarTextoOpcion = texto => texto.replace(/\s+/g, " ").trim();

const getBtnTextoPorValor = (menuId, valor) => {
  const opcion = Array.from($(menuId)?.querySelectorAll(".btn-filtro-opcion") || [])
    .find(btn => (btn.id || "") === valor);

  return opcion ? limpiarTextoOpcion(opcion.textContent) : null;
};

const sincronizarBotonesConFiltros = () => {
  filtroMenus.forEach(([btnId, menuId, filtroKey]) => {
    const texto = getBtnTextoPorValor(menuId, filtros[filtroKey]);
    if (texto) actualizarBoton(btnId, texto);
  });
};

const getPaginaUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("p") || 1);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const urlTieneFiltros = () => {
  const params = new URLSearchParams(window.location.search);
  return filtroKeys.some(key => params.has(key) && params.get(key));
};

const cargarFiltrosDesdeUrl = () => {
  const params = new URLSearchParams(window.location.search);

  filtroKeys.forEach(key => {
    filtros[key] = params.get(key) || "";
  });

  sincronizarBotonesConFiltros();
  actualizarContador();
};

const actualizarUrlFiltros = (pagina = paginaActual, reemplazar = false) => {
  const params = new URLSearchParams();
  const pathname = window.location.pathname;
  const estaEnIndex = pathname.endsWith("index.html") || pathname === "/" || pathname === "";

  Object.entries(filtros).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  if (pagina > 1) params.set("p", pagina);

  const query = params.toString();
  const nuevaUrl = estaEnIndex
    ? (query ? `?DirectorioJK&${query}` : "?DirectorioJK")
    : (query ? `?${query}` : "?DirectorioJK");
  const metodo = reemplazar ? "replaceState" : "pushState";

  if (window.location.search !== nuevaUrl) {
    history[metodo]({}, "", nuevaUrl);
  }
};

const actualizarContador = () => {
  const btn = $('btn-filtrar');
  if (!btn) return;
  const total = contarFiltrosActivos();
  btn.textContent = total > 0 ? `FILTRAR (${total})` : "FILTRAR";
};

const toggleMenu = (btnId, menuId) => {
  const btn = $(btnId);
  const menu = $(menuId);
  if (!btn || !menu) return;

  btn.addEventListener("click", () => menu.classList.toggle("active"));
  document.addEventListener("click", e => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove("active");
    }
  });
};

const bindOpciones = (menuId, filtroKey, btnId) => {
  $(menuId)?.querySelectorAll(".btn-filtro-opcion").forEach(btn => {
    btn.addEventListener("click", () => {
      filtros[filtroKey] = btn.id || "";
      actualizarBoton(btnId, btn.textContent.trim());
      $(menuId).classList.remove("active");
      paginaActual = 1;
      actualizarContador();
      actualizarUrlFiltros(1, true);
    });
  });
};

const aplicarFiltros = async (pagina = 1, usarCache = false) => {
  paginaActual = pagina;
  actualizarUrlFiltros(pagina, usarCache);

  const cleanFilters = Object.fromEntries(
    Object.entries(filtros).filter(([_, v]) => v)
  );

  const params = new URLSearchParams({
    source: "jkanime",
    ...cleanFilters,
    p: paginaActual
  }).toString();

  if (usarCache) {
    console.log("Leyendo cache...");

    let cache = null;

    try {
      const raw = localStorage.getItem(CACHE_KEY);

      if (raw) {
        cache = JSON.parse(raw);

        console.log("Cache encontrado");

        totalPaginas = Number(cache.PaginasTotales || 1);

        renderAnime(cache.animes);
        renderPagination();
        actualizarPaginaUI();
        actualizarFiltrosSeleccionados();

        console.log("Cache renderizado");
      } else {
        console.log("No existe cache");
      }
    } catch (e) {
      console.log("Error leyendo cache", e);
    }

    try {
      console.log("Consultando API...");

      const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/browse?${params}`);
      const data = await res.json();

      if (cache && JSON.stringify(cache) === JSON.stringify(data)) {
        console.log("API igual al cache");
        return;
      }

      console.log("API más reciente");

      totalPaginas = Number(data.PaginasTotales || 1);

      renderAnime(data.animes);
      renderPagination();
      actualizarPaginaUI();
      actualizarFiltrosSeleccionados();

      localStorage.setItem(CACHE_KEY, JSON.stringify(data));

      console.log("Cache actualizado");
    } catch (err) {
      console.error(err);
    }

    return;
  }

  try {
    console.log("Consultando API... ", params);
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/browse?${params}`);
    const data = await res.json();

    totalPaginas = Number(data.PaginasTotales || 1);

    renderAnime(data.animes);
    renderPagination();
    actualizarPaginaUI();
    actualizarFiltrosSeleccionados();
  } catch (err) {
    console.error("Error al obtener datos:", err);
  }
};

const initFiltros = () => {
  filtroMenus.forEach(([btnId, menuId, filtroKey]) => {
    toggleMenu(btnId, menuId);
    bindOpciones(menuId, filtroKey, btnId);
  });

  $('btn-filtrar')?.addEventListener("click", () => aplicarFiltros(1));
  $('btn-aleatorio')?.addEventListener("click", () => {
    const randomPage = Math.floor(Math.random() * totalPaginas) + 1;
    aplicarFiltros(randomPage);
  });
  actualizarContador();
  cargarFiltrosDesdeUrl();
  const paginaInicial = getPaginaUrl();
  
  // Petición inicial al cargar la página
  aplicarFiltros(paginaInicial, !urlTieneFiltros() && paginaInicial === 1); 
};

const actualizarPaginaUI = () => {
  const span = $('Num-pag');
  if (span) span.textContent = `Página: ${paginaActual} / ${totalPaginas}`;
};

const renderPagination = () => {
  const c = $('pagination-directorio');
  if (!c) return;
  c.innerHTML = "";

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = "page-button";

    if (i === paginaActual) {
      btn.classList.add("active");
    }

    btn.onclick = () => {
      paginaActual = i;
      aplicarFiltros(i);
      renderPagination(); 
    };

    c.appendChild(btn);
  }

requestAnimationFrame(() => {
  const active = c.querySelector(".page-button.active");
  if (!active) return;

  const left =
    active.getBoundingClientRect().left -
    c.getBoundingClientRect().left +
    c.scrollLeft -
    (c.clientWidth - active.offsetWidth) / 2;

  c.scrollTo({
    left,
    behavior: "smooth"
  });
});
};

function slug(str) {
  const clean = str
    .toLowerCase()
    .trim()
    .replace(/[:'".,!?]/g, '')
    .replace(/\s+/g, '-');
  return `${clean}`;
}

const renderAnime = (animes) => {
  const c = $('contenedor-animes');
  if (!c) return;
  c.innerHTML = "";
  
  if (!animes || animes.length === 0) {
    c.innerHTML = "<p>No se encontraron resultados.</p>";
    return;
  }

  animes.forEach(a => {
    console.log(a);
    let estadoHtml = '';
    if (a.estado === "Por estrenar") {
      estadoHtml = `<span class="estado"><img src="../icons/circle-solid-yellow.svg" alt="${a.estado}">${a.estado}</span>`;
    }
    else if (a.estado === "En emision") {
      estadoHtml = `<span class="estado"><img src="../icons/circle-solid-blue.svg" alt="${a.estado}">${a.estado}</span>`;
    }
    else {
      estadoHtml = `<span class="estado"><img src="../icons/circle-solid.svg" alt="${a.estado}">${a.estado}</span>`;
    }
    const div = document.createElement("div");
    div.className = "anime-card anime-card-jk";

      div.innerHTML = `
        <a href="/anime.html?id=${slug(a.title)}">
        <div class="container-img">
          <img class="cover" src="${a.image}" alt="${a.title}">
          <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
          ${estadoHtml}
        </div>
          <div class="content">
            <h3>${a.title}</h3>
            <p id="card-synopsis">${a.synopsis || ""}</p>
          </div>
        </a>
      `;
    div.addEventListener('click', () => {
      const h3 = div.querySelector('h3');
      const containerImg = div.querySelector('.container-img');
      
      if (h3) h3.style.setProperty('view-transition-name', 'title' + slug(a.title));
      if (containerImg) containerImg.style.setProperty('view-transition-name', slug(a.title));
    });
    c.appendChild(div);
  });
  
  observerAnimeCards(c);
};

const actualizarFiltrosSeleccionados = () => {
  const c = $('filtrosseleccionados');
  if (!c) return;
  
  const filtrosActivos = Object.entries(filtros).filter(([_, v]) => v);
  
  if (filtrosActivos.length === 0) {
    c.textContent = "Sin filtros seleccionados";
    return;
  }
  
  c.innerHTML = "";
  
  filtrosActivos.forEach(([key, value]) => {
    const tag = document.createElement("span");
    tag.className = "filtro-activo";
    tag.textContent = `${key}: ${value}`;
    
    const btnClose = document.createElement("button");
    btnClose.textContent = "×";
    btnClose.onclick = () => {
      filtros[key] = "";
      sincronizarBotonesConFiltros();
      actualizarFiltrosSeleccionados();
      actualizarContador();
      actualizarUrlFiltros(1, true);
      aplicarFiltros(1);
    };
    
    tag.appendChild(btnClose);
    c.appendChild(tag);
  });
};

const setLayout = type => {
  const c = $('contenedor-animes');
  if (!c) return;
  c.classList.remove("layout1", "layout2", "layout3");
  c.classList.add(type);

  localStorage.setItem('layout-activo', type);

  ['layout1', 'layout2', 'layout3'].forEach(id => {
    const btn = $(id);
    if (btn) {
      btn.classList.remove("active");
      if (id === type) btn.classList.add("active");
    }
  });


};

['layout1', 'layout2', 'layout3'].forEach(id => {
  const btn = $(id);
  if (btn) btn.onclick = () => setLayout(id);
});

const savedLayout = localStorage.getItem('layout-activo') || 'layout1';
setLayout(savedLayout);

// Inicializamos todo inmediatamente en lugar de esperar al DOMContentLoaded
initFiltros();
