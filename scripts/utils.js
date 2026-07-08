//aplicar viewanme y eliminar a otras 
export function aplicarViewTransition(id, ratingHtml) {
if (ratingHtml){
  document.querySelectorAll("#anime-" + id +'.rating').forEach(el => el.style.setProperty('view-transition-name', 'rating' + id));
  }

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
  
  document.querySelectorAll('#anime-' + id + ' strong').forEach(el => el.style.setProperty('view-transition-name', 'title' + id));
  document.querySelectorAll('#anime-' + id + ' .container-img').forEach(el => el.style.setProperty('view-transition-name', id));
}

// Manejar el scroll para el efecto del header
const header = document.querySelector('header');
const scrollOffset = 30;

const handleScroll = () => {
  if (window.scrollY > scrollOffset) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
};

// Aplicar el efecto al cargar la página
window.addEventListener('load', handleScroll);

// Escuchar el evento de scroll
window.addEventListener('scroll', handleScroll);


// utils.js
export function observerAnimeCards() {
    const cards = document.querySelectorAll(".anime-card");
    if (!cards.length) return;

    const container = cards[0].parentElement;

    let cachedColumns = 1;
    const updateColumns = () => {
      const gridStyle = getComputedStyle(container).gridTemplateColumns;
      cachedColumns = Math.max(1, gridStyle.split(" ").length);
      console.log('[Observer] 📊 Columnas grid actualizadas:', cachedColumns);
    };
    
    updateColumns();
    const resizeObserver = new ResizeObserver(() => updateColumns());
    resizeObserver.observe(container);
    console.log('[Observer] ✅ ResizeObserver activo para optimizar grid');

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const card = entry.target;

            requestAnimationFrame(() => {
                card.classList.add("show");

                // Evita que el delay afecte futuros hovers
                const onEnd = (e) => {
                    if (e.propertyName !== "opacity" && e.propertyName !== "transform") return;

                    card.style.transitionDelay = "0s";
                    card.removeEventListener("transitionend", onEnd);
                };

                card.addEventListener("transitionend", onEnd);
            });

            obs.unobserve(card);
        });
    }, {
        threshold: 0.05,
        rootMargin: "0px 0px -10% 0px"
    });

    cards.forEach((card, index) => {
        const row = Math.floor(index / cachedColumns);
        const col = index % cachedColumns;

        card.style.transitionDelay = `${(row + col) * 0.03}s`;
        observer.observe(card);
    });
}

// INDICADOR sidebar scroll
document.addEventListener('DOMContentLoaded', () => {
const sidebar = document.querySelector('.sidebar');
if (!localStorage.key("indicador") && window.innerWidth < 600 && localStorage.key('userID')) {
const indicator = document.createElement('div');
indicator.classList.add('scroll-indicator');
sidebar.appendChild(indicator);

sidebar.addEventListener('scroll', () => {
  indicator.style.opacity = '0';
  localStorage.setItem('indicador', 'true');
});
}
});
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
