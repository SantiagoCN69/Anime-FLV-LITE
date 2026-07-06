import { mostrarSeccionDesdesearch } from './index.js';
import { observerAnimeCards } from './utils.js';

let paginaActual = 1;
let totalPaginas = 1;

const filtros = {
  orden: "", genero: "", letra: "", demografia: "", categoria: "",
  tipo: "", estado: "", fecha: "", temporada: "", orden_dir: ""
};

const $ = id => document.getElementById(id);

$('btn-fuente-directorio-JK')?.addEventListener('click', () => {
   history.replaceState(null, '', `?DirectorioFLV`);
   mostrarSeccionDesdesearch();
});

const actualizarBoton = (idBtn, texto) => {
  const span = $(idBtn)?.querySelector("span");
  if (span) span.textContent = texto;
};

const contarFiltrosActivos = () => Object.values(filtros).filter(v => v).length;

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
      actualizarContador();
    });
  });
};

const aplicarFiltros = async (pagina = 1) => {
  paginaActual = pagina;
  
  const cleanFilters = Object.fromEntries(Object.entries(filtros).filter(([_, v]) => v));
  // Por defecto si no hay filtros, cargará el directorio raíz.
  const params = new URLSearchParams({ source: "jkanime", ...cleanFilters, p: paginaActual }).toString();

  try {
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
  const menus = [
    ["btn-filtro", "filtro", "Orden"],
    ["btn-filtro-genero", "filtro-genero", "Genero"],
    ["btn-filtro-letra", "filtro-letra", "Letra"],
    ["btn-filtro-demografia", "filtro-demografia", "Demografia"],
    ["btn-filtro-categoria", "filtro-categoria", "Categoria"],
    ["btn-filtro-tipo", "filtro-tipo", "Tipo"],
    ["btn-filtro-estado", "filtro-estado", "Estado"],
    ["btn-filtro-ano", "filtro-ano", "Año"],
    ["btn-filtro-temporada", "filtro-temporada", "Temporada"],
    ["btn-filtro-orden", "filtro-orden", "Orden_dir"]
  ];

  menus.forEach(([btnId, menuId, filtroKey]) => {
    toggleMenu(btnId, menuId);
    bindOpciones(menuId, filtroKey, btnId);
  });

  $('btn-filtrar')?.addEventListener("click", () => aplicarFiltros(1));
  $('btn-aleatorio')?.addEventListener("click", () => {
    const randomPage = Math.floor(Math.random() * totalPaginas) + 1;
    aplicarFiltros(randomPage);
  });
  actualizarContador();
  
  // Petición inicial al cargar la página
  aplicarFiltros(1); 
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

    btn.onclick = () => aplicarFiltros(i);
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

const renderAnime = (animes) => {
  const c = $('contenedor-animes');
  if (!c) return;
  c.innerHTML = "";
  
  if (!animes || animes.length === 0) {
    c.innerHTML = "<p>No se encontraron resultados.</p>";
    return;
  }

  animes.forEach(a => {
    const div = document.createElement("div");
    div.className = "anime-card anime-card-jk";

    div.innerHTML = `
      <a href="${a.url}" target="_blank">
        <div class="container-img">
          <img class="cover" src="${a.image}" alt="${a.title}">
          <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
        </div>
          <div class="content">
        <h3>${a.title}</h3>
            <p id="card-synopsis">${a.synopsis || ""}</p>
          </div>
      </a>
    `;
    
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
      actualizarFiltrosSeleccionados();
      actualizarContador();
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
};

['layout1', 'layout2', 'layout3'].forEach(id => {
  const btn = $(id);
  if (btn) btn.onclick = () => setLayout(id);
});

// Inicializamos todo inmediatamente en lugar de esperar al DOMContentLoaded
initFiltros();