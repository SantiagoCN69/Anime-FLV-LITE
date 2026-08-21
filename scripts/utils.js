//aplicar viewanme y eliminar a otras 
export function aplicarViewTransition(id, ratingHtml, clickedElement = null) {
  console.log("aplicando view transition");
  
  // Limpiar view transitions de otras tarjetas
  const cards = document.querySelectorAll('.anime-card.show a');
  cards.forEach(card => {
    const imgContainer = card.querySelector('.container-img');
    const strong = card.querySelector('strong');
    const rating = card.querySelector('.rating');
    [imgContainer, strong, rating].forEach(el => {
        if (el && el.style.viewTransitionName) {
            el.style.removeProperty('view-transition-name');
        }
    });
  });
  
  // Si se proporciona el elemento clickeado, aplicar solo a ese
  if (clickedElement) {
    const strong = clickedElement.querySelector('strong');
    const containerImg = clickedElement.querySelector('.container-img');
    const rating = clickedElement.querySelector('.rating');
    
    if (strong) strong.style.setProperty('view-transition-name', 'title-' + id);
    if (containerImg) containerImg.style.setProperty('view-transition-name', 'cover-' + id);
    if (rating && ratingHtml) rating.style.setProperty('view-transition-name', 'rating-' + id);
  } else {
    // Comportamiento original: aplicar a todos con el mismo ID
    if (ratingHtml) {
      document.querySelectorAll("#anime-" + id +'.rating').forEach(el => el.style.setProperty('view-transition-name', 'rating-' + id));
    }
    document.querySelectorAll('#anime-' + id + ' strong').forEach(el => el.style.setProperty('view-transition-name', 'title-' + id));
    document.querySelectorAll('#anime-' + id + ' .container-img').forEach(el => el.style.setProperty('view-transition-name', 'cover-' + id));
  }
}

// Manejar el scroll para el efecto del header
const header = document.querySelector('header');
const sidebar = document.querySelector('.sidebar');
const indexpagination = document.querySelector('#indexpagination');
const scrollOffset = 30;

const handleScroll = () => {
  if (window.scrollY > scrollOffset && !document.body.classList.contains('animaciones-off')) {
    header.classList.add('scrolled');
    sidebar.classList.add('scrolled');
    if (indexpagination) {
      indexpagination.classList.add('scrolled');
    }
  } else {
    header.classList.remove('scrolled');
    sidebar.classList.remove('scrolled');
    if (indexpagination) {
      indexpagination.classList.remove('scrolled');
    }
  }
};

// Aplicar el efecto al cargar la página
window.addEventListener('load', handleScroll);

// Escuchar el evento de scroll con throttling para mejor rendimiento en móvil
let ticking = false;
window.addEventListener('scroll', () => {
    if (ticking) return;

    ticking = true;

    requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
    });
}, { passive: true });


// Único observador global para todas las tarjetas de anime
const animeCardObserver = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const card = entry.target;

        card.classList.add("show");
        card.style.transitionDelay = "";

        obs.unobserve(card);
    }
}, {
    threshold: 0.05,
    rootMargin: "0px 0px -1% 0px"
});

export function observerAnimeCards() {
    if (document.body.classList.contains('animaciones-off')) {
        const cards = document.querySelectorAll(".anime-card");
        cards.forEach(card => {
            card.classList.add("show");
            card.style.transitionDelay = "";
        });
        return;
    }
    const cards = document.querySelectorAll(".anime-card");
    if (!cards.length) return;

    const container = cards[0].parentElement;
    const columns = Math.max(
        1,
        getComputedStyle(container).gridTemplateColumns.split(" ").length
    );

    cards.forEach((card, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        card.style.transitionDelay = `${(row + col) * 0.05}s`;
    });

    document.body.offsetHeight;

    requestAnimationFrame(() => {
        cards.forEach(card => animeCardObserver.observe(card));
    });
}


//INDICADOR funcion cambiar tema
document.addEventListener('authStateReady', function() {
  const btnLogin = document.getElementById('btn-login');
  // Verificar si hay un tema guardado
  if (!localStorage.getItem('theme')) {
    const theme = document.createElement('div');
    theme.classList.add('theme-indicator');
    btnLogin.appendChild(theme);
    btnLogin.addEventListener('click', () => {
      theme.remove();
      document.getElementById('theme-toggle').appendChild(theme);
    });
    document.getElementById('theme-toggle').addEventListener('click', () => {
      theme.remove();
    });
  }
});

//crear animecards
/**
 * Crea una tarjeta de anime universal compatible con todas las vistas.
 * @param {Object} anime - El objeto con los datos del anime.
 * @param {Object} opciones - Opciones de renderizado (isLink, episodioUrl, variant, etc).
 */
export function crearAnimeCard(anime, opciones = {}) {
    // Valores por defecto de las opciones
    const config = {
        isLink: true,             // Si es false, desactiva el click
        episodioUrl: null,        // Para redirigir a un episodio específico (ej: /ver?id=...)
        variant: 'default',       // 'default', 'schedule' (horarios), 'jk' (con sinopsis)
        onClick: null,            // Función extra a ejecutar al hacer click
        ...opciones
    };

    // 1. NORMALIZACIÓN DE DATOS (Maneja las diferencias entre tus APIs)
    const titleText = anime.title || anime.titulo || anime.name || 'Título desconocido';
    let title = `<strong>${titleText}</strong>`;
    
    // Extraer ID (de tu API, de la URL o creando un slug)
    let id = anime.id;
    if (!id && anime.url) {
        id = anime.url.replace(/\/$/, '').split('/').pop();
    }
    if (!id) {
        id = titleText.toLowerCase().trim().replace(/[\s\W-]+/g, '-'); // Fallback Slug
    }

    // Imagen (Soporta tu API, Jikan API y fallback)
    const coverImage = anime.cover || anime.image || anime.portada || anime.images?.webp?.image_url || 'img/loading.png';
    const rating = (anime.rating || anime.score)?.toString().split(/\s+/)[0];
    const type = anime.type;
    const capitulo = anime.Capitulo || anime.last_episode;
    const estado = anime.estado || anime.status;

    // 2. CONSTRUCCIÓN DE ELEMENTOS HTML
    let chapterHtml = capitulo ? `<span class="chapter">Capítulo ${capitulo}</span>` : '';
    let typeHtml = type ? `<span class="type supder">${type}</span>` : '';
    
    // Lógica inteligente para el estado y los colores de los círculos
    let estadoHtml = '';
    if (estado) {
        const estNormalizado = estado.toLowerCase();
        let icon = 'circle-solid.svg'; // Finalizado o default
        let textoEstado = estado;

        if (estNormalizado.includes('emisión') || estNormalizado.includes('emision') || estNormalizado.includes('airing')) {
            icon = 'circle-solid-blue.svg';
            textoEstado = 'En emisión';
        } else if (estNormalizado.includes('estrenar') || estNormalizado.includes('proximamente')) {
            icon = 'circle-solid-yellow.svg';
            textoEstado = 'Próximamente';
        } else if (!config.isLink) {
            textoEstado = 'Próximamente'; // Lógica de tu funcion 2
        }

        estadoHtml = `<span class="estado"><img src="../icons/${icon}" alt="${textoEstado}">${textoEstado}</span>`;
    } else if (config.episodioUrl && !estado) {
        estadoHtml = `<span class="estado">Capítulo ${config.episodioUrl}</span>`;
    }

    // Lógica para la calificación
    let ratingHtml = '';
    if (rating) {
        const displayRating = anime.score ? `${rating}/10` : rating;
        ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${rating}">${displayRating}</span>`;
    }

    // Lógica especial para horarios (Schedule) y JK
    let extraTopHtml = '';
    let extraBottomHtml = '';
    if (config.variant === 'schedule') {
        const timeText = anime.time_ago || 'Sin última hora de emisión';
        extraTopHtml = `<div class="content" data-time_ago="${timeText}">`;
        extraBottomHtml = `</div>`;
    } else if (config.variant === 'jk') {
      extraBottomHtml = `<div class="content">
      ${title}
      <p id="card-synopsis">${anime.synopsis || ""}</p>
      </div>`;
      title = "";
    }

    // 3. CREACIÓN DEL NODO DOM
    const card = document.createElement('a');
    
    // Asignar clases dinámicas
    card.className = `anime-card ${config.variant === 'schedule' ? 'anime-card-schedule hover-touch' : ''} ${config.variant === 'jk' ? 'anime-card-jk' : ''}`.trim();
    card.style.setProperty('--cover', `url(${coverImage})`);
    card.dataset.id = id;
    if (anime.day) card.dataset.day = anime.day;
    if (title) card.dataset.title = title.toLowerCase();

    // Enlace de destino
    const href = config.episodioUrl ? `/ver?id=${id}&episode=${config.episodioUrl}` : `/anime?id=${id}`;
    card.href = config.isLink ? href : '#';
    card.id = `anime-${id}`;
    
    if (!config.isLink) card.style.pointerEvents = 'none';
    
    // Estructura interna
    card.innerHTML = `
        <div class="container-img">
            <img src="${coverImage}" class="cover" alt="${titleText}" loading="lazy">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="play" onerror="this.style.display='none'">
            ${chapterHtml}
            ${estadoHtml}
            ${ratingHtml}
            ${typeHtml}
        </div>
        ${extraTopHtml}
        ${title}
        ${extraBottomHtml}
    `;

    // 4. EVENTOS Y VIEW TRANSITIONS
    card.addEventListener('click', () => {
        // Ejecutar funciones globales si existen en tu proyecto
        if (typeof aplicarViewTransition === 'function') aplicarViewTransition(id, ratingHtml, card);
        if (config.onClick) config.onClick(anime);
    });

    return card;
}
