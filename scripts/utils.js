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
  console.log('aplicando view transition');
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
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const cards = Array.from(document.querySelectorAll('.anime-card'));
                const index = cards.indexOf(entry.target);
                
                const row = Math.floor(index / 4);
                const col = index % 4;
                const delay = (row + col) * 0.03;
                
                entry.target.style.transitionDelay = `${delay}s`;
                entry.target.classList.add('show');
            }
        });
    }, { threshold: 0 });

    // Aplicar delays escalonados a tarjetas ya visibles
    const cards = document.querySelectorAll('.anime-card');
    cards.forEach((card, index) => {
        observer.observe(card);
        
        // Verificar si ya está visible
        const rect = card.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible) {
            const row = Math.floor(index / 4);
            const col = index % 4;
            const delay = (row + col) * 0.03;
            
            card.style.transitionDelay = `${delay}s`;
            requestAnimationFrame(() => {
                card.classList.add('show');
            });
        }
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
