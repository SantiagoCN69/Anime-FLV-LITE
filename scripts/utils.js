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

 // Único observador global reutilizable
const animeCardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
      if (entry.isIntersecting) {
          entry.target.classList.add("show");
          animeCardObserver.unobserve(entry.target); // Dejar de observar inmediatamente
      }
  });
}, {
  threshold: 0.05,
  rootMargin: "0px 0px 50px 0px" // Carga ligeramente antes de entrar
});

export function observerAnimeCards() {
  // Si las animaciones están desactivadas, CSS se encarga (no requiere JS)
  if (document.body.classList.contains('animaciones-off')) return;

  // Solo seleccionar tarjetas que NO han sido procesadas aún
  const pendingCards = document.querySelectorAll(".anime-card:not(.show):not([data-observed])");

  pendingCards.forEach((card) => {
      card.dataset.observed = "true";
      animeCardObserver.observe(card);
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
    if (!id && anime.cover) {
        // Extraer nombre del archivo del cover como fallback
        id = anime.cover.replace(/\/$/, '').split('/').pop().replace(/\.[^/.]+$/, '');
    }
    if (!id) {
        id = titleText.toLowerCase().trim().replace(/[\s\W-]+/g, '-'); // Fallback Slug
    }

    // Imagen (Soporta tu API, Jikan API y fallback)
    const coverImage = anime.cover || anime.image || anime.portada || anime.images?.webp?.image_url || 'img/loading.png';
    const rating = (anime.score || anime.rating)?.toString().split(/\s+/)[0];
    const type = anime.type;
    const capitulo = anime.Capitulo || anime.last_episode;
    const estado = anime.estado || anime.status;

    // 2. CONSTRUCCIÓN DE ELEMENTOS HTML
    let chapterHtml = capitulo ? `<span class="chapter">EP ${capitulo}</span>` : '';
    let typeHtml = (type && type.toLowerCase() !== 'desconocido') 
    ? `<span class="type">${type}</span>` 
    : '';
    
    // Lógica inteligente para el estado y los colores de los círculos
    let estadoHtml = '';
    if (estado) {
      const estNormalizado = estado.toLowerCase().split(/\s+/)[0];

        let icon = 'circle-solid.svg'; // Finalizado o default
        let textoEstado = "Finalizado";

        if (estNormalizado.includes('emisión') || estNormalizado.includes('emision') || estNormalizado.includes('currently') || estNormalizado.includes('en')) {
            icon = 'circle-solid-blue.svg';
            textoEstado = 'En emisión';
        } else if (estNormalizado.includes('estrenar') || estNormalizado.includes('proximamente') || estNormalizado.includes('por')) {
            icon = 'circle-solid-yellow.svg';
            textoEstado = 'Próximamente';
        }

        estadoHtml = `<span class="estado"><img src="../icons/${icon}" alt="${textoEstado}">${textoEstado}</span>`;
    } else if (config.episodioUrl && !estado) {
        estadoHtml = `<span class="estado">Capítulo ${config.episodioUrl}</span>`;
    }

    // Lógica para la calificación
    let ratingHtml = '';
    if (rating) {
        // Redondea a 1 decimal (ej: 8.55 -> 8.6)
        const formattedRating = Math.round(rating * 10) / 10;
        
        const displayRating = anime.score ? `${formattedRating}/10` : formattedRating;
        ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${formattedRating}">${displayRating}</span>`;
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
    card.className = `anime-card ${config.variant === 'schedule' ? 'anime-card-schedule' : ''} ${config.variant === 'jk' ? 'anime-card-jk' : ''}`.trim();
    
    if (anime.day) card.dataset.day = anime.day;

    // Enlace de destino
    card.href = config.episodioUrl ? `/ver?id=${id}&episode=${config.episodioUrl}` : `/anime?id=${id}`;
    
    // Estructura interna
    card.innerHTML = `
        <div class="container-img">
            <img src="${coverImage}" class="cover" alt="${titleText}" loading="lazy">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="play">
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
