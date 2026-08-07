import { observerAnimeCards, aplicarViewTransition } from './utils.js';
import { mostrarSeccionDesdesearch } from './index.js';

// --- CONSTANTES GLOBALES ---
const API_BASE_URL = 'https://backend-animeflv-lite.onrender.com/api/browse?source=animeav1';
const CACHE_KEY = 'animes_cache_directorio';
const URL_PARAMS = new URLSearchParams(window.location.search);

// Mapeos de valores
const MAPA_TIPOS = { 'tv': 'tv-anime', 'movie': 'pelicula', 'special': 'especial', 'ova': 'ova' };
const MAPA_ESTADOS = { '1': 'emision', '2': 'finalizado', '3': 'proximamente' };
const MAPA_ORDEN = { 'default': '', 'updated': 'updated', 'added': 'added', 'title': 'title', 'rating': 'score' };

// Invertir mapeos para la carga desde URL
const INVERTIR_MAPA = (mapa) => Object.entries(mapa).reduce((acc, [key, val]) => ({ ...acc, [val]: key }), {});
const MAPA_TIPOS_INV = INVERTIR_MAPA(MAPA_TIPOS);
const MAPA_ESTADOS_INV = INVERTIR_MAPA(MAPA_ESTADOS);
const MAPA_ORDEN_INV = INVERTIR_MAPA(MAPA_ORDEN);

// --- ESTADO GLOBAL ---
let currentPage = URL_PARAMS.has('page') ? parseInt(URL_PARAMS.get('page')) : 1;
let totalPages = 1;

// --- ELEMENTOS DEL DOM ---
const DOM = {
    resultados: document.getElementById('resultados-av1'),
    paginacion: document.getElementById('pagination-directorio-av1'),
    filtrosContainer: document.getElementById('filtros-av1'),
    btnFiltrosMobile: document.getElementById('btnfiltrosav1'),
    btnFiltrar: document.getElementById('btn-filtrar-av1'),
    btnFuenteDirectorio: document.getElementById('btn-fuente-directorio-av1'),
    contador: document.getElementById('contador-av1'),
    initLoading: document.getElementById('init-loading-av1'),
    slider: {
        min: document.getElementById('ano-min'),
        max: document.getElementById('ano-max'),
        valMin: document.getElementById('ano-min-val'),
        valMax: document.getElementById('ano-max-val')
    }
};

// --- CONFIGURACIÓN DE FILTROS ---
const FILTROS_CONFIG = [
    { id: 'genero', selector: '#filtro-genero-av1', isRadio: false },
    { id: 'anos', selector: '#filtro-anos-av1', isRadio: false },
    { id: 'tipo', selector: '#filtro-tipo-av1', isRadio: false },
    { id: 'estado', selector: '#filtro-estado-av1', isRadio: false },
    { id: 'orden', selector: '#filtro-orden-av1', isRadio: true }
];

// --- UTILIDADES Y HELPERS ---
const valorFiltroav1 = (btn) => btn.id.replace(/-av1$/, '');

// Timer inicial
let count = 100;
const timerInterval = setInterval(() => {
    count--;
    if (DOM.contador) DOM.contador.textContent = `${count}s`;
    if (count === 0) {
        DOM.initLoading?.remove();
        clearInterval(timerInterval);
    }
}, 230);

// --- RENDERIZADO DEL DOM ---
function crearAnimeCardResultados(anime) {
    const coverImage = anime.cover || anime.image || 'img/loading.png';
    const div = document.createElement('div');
    div.className = 'anime-card';
    div.style.setProperty('--cover', `url(${coverImage})`);
    
    const urlPart = anime.url 
        ? anime.url.replace(/\/$/, '').split('/').pop() 
        : (anime.id || anime.title?.toLowerCase().replace(/\s+/g, '-'));

    div.innerHTML = `
        <a href="anime.html?id=${urlPart}" id="anime-${urlPart}">
        <div class="container-img">
            <img src="${coverImage}" class="cover" alt="${anime.title}">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="ver">
            <span class="estado">${anime.type || ''}</span>
        </div>
        <strong>${anime.title}</strong>
        </a>`;
    
    div.addEventListener('click', () => aplicarViewTransition(urlPart));
    return div;
}

function renderizarResultados(animes) {
    DOM.resultados.innerHTML = '';
    if (!animes || animes.length === 0) {
        DOM.resultados.innerHTML = '<span class="span-carga">No se encontraron resultados</span>';
        return;
    }
    animes.forEach(anime => DOM.resultados.appendChild(crearAnimeCardResultados(anime)));
    observerAnimeCards();
}

// --- PAGINACIÓN ---
function updatePagination({ PaginasTotales, animes }) {
    totalPages = parseInt(PaginasTotales) || 1;
    DOM.paginacion.innerHTML = '';  
    
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.className = `page-button ${i === currentPage ? 'active' : ''}`;
        button.textContent = i;
        button.addEventListener('click', () => cambiarPagina(i));
        DOM.paginacion.appendChild(button);
    }
    centrarPaginacion();
}

function centrarPaginacion() {
    const botonActual = DOM.paginacion.querySelectorAll('button')[currentPage - 1];
    if (botonActual) {
        const scrollLeft = botonActual.offsetLeft - (DOM.paginacion.offsetWidth / 2) + (botonActual.offsetWidth / 2);
        DOM.paginacion.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
}

async function cambiarPagina(page) {
    currentPage = page;
    DOM.resultados.innerHTML = `<span class="span-carga">Cargando servidores...</span>`;
    
    try {
        console.log('Cambiando página a:', page);
        
        // Construir query string limpio sin DirectorioAV1
        const params = new URLSearchParams(window.location.search);
        params.delete('DirectorioAV1');
        params.set('page', page);
        
        const queryString = params.toString();
        console.log('API_BASE_URL:', API_BASE_URL);
        console.log('Query string limpia:', queryString);
        console.log('URL completa:', `${API_BASE_URL}&${queryString}`);
        
        const data = await fetchData(`${API_BASE_URL}&${queryString}`);
        renderizarResultados(data.animes);
        updatePagination(data);
        
        // Actualizar URL en el navegador
        history.pushState({}, '', `?DirectorioAV1&${queryString}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('Error al cambiar de página:', error);
    }
}

// --- LÓGICA DE FETCH Y BÚSQUEDA ---
async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error en la red');
    return response.json();
}

function actualizarLinkBusqueda() {
    const params = new URLSearchParams();

    // Letra
    const letraActiva = document.querySelector('.btn-letra.active');
    if (letraActiva) params.append('letter', letraActiva.dataset.letra);

    // Años
    if (DOM.slider.min && DOM.slider.max) {
        let minYear = parseInt(DOM.slider.min.value);
        let maxYear = parseInt(DOM.slider.max.value);
        if (minYear > maxYear) [minYear, maxYear] = [maxYear, minYear];
        
        if (minYear !== 1990 || maxYear !== 2025) {
            params.append('minYear', minYear);
            params.append('maxYear', maxYear);
        }
    }

    // Filtros genéricos activos
    const obtenerActivos = (selector, mapa) => 
        Array.from(document.querySelectorAll(`${selector} .btn-filtro-opcion.active`))
             .map(btn => mapa ? (mapa[valorFiltroav1(btn)] || valorFiltroav1(btn)) : valorFiltroav1(btn));

    obtenerActivos('#filtro-genero-av1').forEach(g => params.append('genre', g));
    obtenerActivos('#filtro-tipo-av1', MAPA_TIPOS).forEach(t => params.append('category', t));
    obtenerActivos('#filtro-estado-av1', MAPA_ESTADOS).forEach(e => params.append('status', e));
    
    const ordenActivo = obtenerActivos('#filtro-orden-av1', MAPA_ORDEN)[0];
    if (ordenActivo) params.append('order', ordenActivo);

    // Agregar page si es mayor a 1
    if (currentPage > 1) {
        params.append('page', currentPage);
    }

    return {
        apiUrl: `${API_BASE_URL}&${params.toString()}`,
        browserUrl: params.toString()
    };
}

// Le pasamos un parámetro que por defecto sea true
async function ejecutarBusqueda(resetPage = true) {
    // Si viene de un evento del DOM (click), resetPage será un objeto Event. 
    // Lo convertimos a booleano de forma segura.
    const debeResetear = typeof resetPage === 'boolean' ? resetPage : true;

    if (debeResetear) {
        currentPage = 1; // Volvemos a la página 1 al filtrar
    }

    const { apiUrl, browserUrl } = actualizarLinkBusqueda();
    DOM.resultados.innerHTML = '<span class="span-carga">Cargando...</span>';
    
    try {
        const data = await fetchData(apiUrl);
        
        if (browserUrl) history.pushState({}, '', `?DirectorioAV1&${browserUrl}`);
        else history.pushState({}, '', `?DirectorioAV1`);
        
        renderizarResultados(data.animes);
        updatePagination(data); // Se actualizará correctamente basándose en currentPage
        window.scrollTo({ top: 0, behavior: 'smooth' });
        DOM.filtrosContainer.classList.remove('mobile-active');
    } catch (error) {
        console.error('Error al ejecutar búsqueda:', error);
        DOM.resultados.innerHTML = '<p>Error al cargar los animes</p>';
    }
}

// --- EVENTOS E INICIALIZACIÓN ---
function bindFilterEvents() {
    // Slider Años
    const actualizarTextosSlider = () => {
        let min = parseInt(DOM.slider.min.value), max = parseInt(DOM.slider.max.value);
        if (min > max) [min, max] = [max, min];
        DOM.slider.valMin.textContent = min;
        DOM.slider.valMax.textContent = max;
    };
    
    if (DOM.slider.min && DOM.slider.max) {
        DOM.slider.min.addEventListener('input', actualizarTextosSlider);
        DOM.slider.max.addEventListener('input', actualizarTextosSlider);
    }

    // Botones de filtro generales (DRY)
    FILTROS_CONFIG.forEach(({ id, selector, isRadio }) => {
        const btnFiltroMain = document.getElementById(`btn-filtro-${id}-av1`);
        const opciones = document.querySelectorAll(`${selector} .btn-filtro-opcion`);
        const subFiltro = document.getElementById(`filtro-${id}-av1`);

        // Menús desplegables
        btnFiltroMain?.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-filtro, .filtro-opciones').forEach(el => {
                if (el !== btnFiltroMain && el !== subFiltro) el.classList.remove('active');
            });
            btnFiltroMain.classList.toggle('active');
            subFiltro.classList.toggle('active');
        });

        // Opciones internas
        opciones.forEach(btn => {
            btn.addEventListener('click', () => {
                if (isRadio) opciones.forEach(b => b.classList.remove('active'));
                btn.classList.toggle('active');
                
                const activos = Array.from(opciones).filter(b => b.classList.contains('active'));
                const span = btnFiltroMain.querySelector('span');
                if (span) span.textContent = isRadio ? btn.textContent : (activos.length > 0 ? `(${activos.length})` : 'Todos');
                
                actualizarLinkBusqueda();
            });
        });
    });

    // Letras
    document.querySelectorAll('.btn-letra').forEach(btn => {
        btn.addEventListener('click', () => {
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.btn-letra').forEach(b => b.classList.remove('active'));
            if (!isActive) btn.classList.add('active');
            ejecutarBusqueda();
        });
    });

    DOM.btnFiltrar?.addEventListener('click', ejecutarBusqueda);
    DOM.btnFiltrosMobile?.addEventListener('click', () => DOM.filtrosContainer.classList.toggle('mobile-active'));
    
    DOM.btnFuenteDirectorio?.addEventListener('click', () => {
        history.replaceState(null, '', `?DirectorioJK`);
        mostrarSeccionDesdesearch();
    });

    // Scroll Horizontal
    ['#filtro-letras-av1', '#pagination-directorio-av1'].forEach(selector => {
        const el = document.querySelector(selector);
        el?.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    });
}

async function cargarAnimesConCache() {
    localStorage.removeItem("animes_cache");
    const hasFilters = ['letter', 'genre', 'minYear', 'maxYear', 'category', 'status', 'order', 'page'].some(f => URL_PARAMS.has(f));
    
if (hasFilters) {
        inicializarFiltrosDesdeURL(); 
        
        if (URL_PARAMS.has('page')) {
            currentPage = parseInt(URL_PARAMS.get('page'));
        }
        
        // Le pasamos false para que respete el currentPage de la URL
        await ejecutarBusqueda(false); 
        return;
    }

    const cachedData = localStorage.getItem(CACHE_KEY);
    DOM.resultados.innerHTML = '<span class="span-carga">Cargando...</span>';

    try {
        if (cachedData) {
            const { data: cachedAnimes, page, PaginasTotales } = JSON.parse(cachedData);
            if (page === currentPage) {
                renderizarResultados(cachedAnimes);
                updatePagination({ PaginasTotales, animes: cachedAnimes });

                const dataAPI = await fetchData(`${API_BASE_URL}&order=default&page=${currentPage}`);
                if (dataAPI.animes?.[0]?.title !== cachedAnimes[0]?.title) {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: dataAPI.animes, page: currentPage, PaginasTotales: dataAPI.PaginasTotales }));
                    renderizarResultados(dataAPI.animes);
                    updatePagination(dataAPI);
                }
            }
        } else {
            const dataAPI = await fetchData(`${API_BASE_URL}&order=default`);
            renderizarResultados(dataAPI.animes);
            updatePagination(dataAPI);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: dataAPI.animes, page: currentPage, PaginasTotales: dataAPI.PaginasTotales }));
        }
    } catch (error) {
        console.error('Error al inicializar la app:', error);
    }
}

// Cerrar filtros al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-filtro') && !e.target.closest('.filtro-opciones')) {
        document.querySelectorAll('.btn-filtro, .filtro-opciones').forEach(el => el.classList.remove('active'));
    }
});
document.querySelectorAll('.filtro-opciones').forEach(f => f.addEventListener('click', e => e.stopPropagation()));

// Inicialización
bindFilterEvents();
function inicializarFiltrosDesdeURL() {
    // 1. Page
    const page = URL_PARAMS.get('page');
    if (page) {
        currentPage = parseInt(page);
    }

    // 2. Letras
    const letter = URL_PARAMS.get('letter');
    if (letter) {
        const btnLetra = document.querySelector(`.btn-letra[data-letra="${letter}"]`);
        if (btnLetra) btnLetra.classList.add('active');
    }

    // 3. Años (Sliders)
    const minYear = URL_PARAMS.get('minYear');
    const maxYear = URL_PARAMS.get('maxYear');
    if (minYear && DOM.slider.min) DOM.slider.min.value = minYear;
    if (maxYear && DOM.slider.max) DOM.slider.max.value = maxYear;
    if (minYear || maxYear) {
        DOM.slider.valMin.textContent = DOM.slider.min.value;
        DOM.slider.valMax.textContent = DOM.slider.max.value;
    }

    // 4. Helper para activar opciones de selectores múltiples
    const activarBotonesURL = (paramName, selector, mapaInverso, idMainBtn) => {
        const values = URL_PARAMS.getAll(paramName);
        if (values.length > 0) {
            // Formatear los IDs a como están en el HTML
            values.forEach(val => {
                // Reemplazar espacios por guiones para géneros (ej: "Slice of Life" -> "Slice-of-Life")
                if (paramName === 'genre') val = val.replace(/\s+/g, '-');
                
                const btnId = mapaInverso ? (mapaInverso[val] || val) : val;
                const btn = document.getElementById(`${btnId}-av1`);
                if (btn) btn.classList.add('active');
            });
            
            // Actualizar el texto del botón principal "(2)", "(3)", o el nombre del orden
            const mainBtn = document.getElementById(idMainBtn);
            const activos = document.querySelectorAll(`${selector} .btn-filtro-opcion.active`);
            if (mainBtn && mainBtn.querySelector('span') && activos.length > 0) {
                mainBtn.querySelector('span').textContent = paramName === 'order' ? activos[0].textContent : `(${activos.length})`;
            }
        }
    };

    activarBotonesURL('genre', '#filtro-genero-av1', null, 'btn-filtro-genero-av1');
    activarBotonesURL('category', '#filtro-tipo-av1', MAPA_TIPOS_INV, 'btn-filtro-tipo-av1');
    activarBotonesURL('status', '#filtro-estado-av1', MAPA_ESTADOS_INV, 'btn-filtro-estado-av1');
    activarBotonesURL('order', '#filtro-orden-av1', MAPA_ORDEN_INV, 'btn-filtro-orden-av1');
}
cargarAnimesConCache();