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


export function observerAnimeCards() {
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

    const observer = new IntersectionObserver((entries, obs) => {
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

    requestAnimationFrame(() => {
        cards.forEach(card => observer.observe(card));
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
