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
                entry.target.classList.add('show');
            }
        });
    }, { threshold: 0 });

    document.querySelectorAll('.anime-card').forEach(el => observer.observe(el));
}

// MENSAJE FOOTER DINAMICO
const footer = document.querySelector('footer');
const footerMessage = document.createElement('p');

const mensajes = [
  'Este proyecto es una iniciativa completamente independiente, desarrollada con fines educativos y de entretenimiento.',
  'Toda la información es obtenida desde AnimeFLV, respetando siempre la fuente original.',
  'Todos los derechos sobre el contenido mostrado pertenecen a sus respectivos creadores y propietarios legales.',
  '⚠️ Los servidores pueden entrar en hibernación tras cierto tiempo de inactividad, lo que podría causar una breve demora al volver a acceder.',
  "🔁 Tu progreso se sincroniza automáticamente entre dispositivos cuando inicias sesión",
  '🔄 El contenido de la página se almacena temporalmente en caché, lo que mejora significativamente el rendimiento tras la primera carga.',
  "⭐ Marca tus animes favoritos para acceder a ellos fácilmente y recibir sugerencias personalizadas",
  '🧠 Algunas funciones de la plataforma están potenciadas por inteligencia artificial, y se actualizan constantemente para ofrecer mejores resultados.',
  '🚀 Esta plataforma ha sido optimizada para ofrecer una experiencia fluida, tanto en computadoras como en dispositivos móviles.',
  '📡 La aplicación realiza conexiones seguras y eficientes con los servidores de anime, garantizando estabilidad y rapidez en el acceso al contenido.',
  ' 🕒 La primera carga de la página puede tardar unos segundos debido al proceso de arranque inicial de los servidores.',
  '🔐 El sistema utiliza conexión segura HTTPS y autenticación con Firebase para proteger tus datos y asegurar tu experiencia.',
  '📁 El contenido se carga de forma dinámica para brindar una experiencia de navegación más rápida, fluida y sin interrupciones.',
  ' 🎥 El sistema de streaming está optimizado para evitar anuncios invasivos, ventanas emergentes o redirecciones molestas.',
];

// Función para obtener un mensaje aleatorio
function obtenerMensajeAleatorio() {
  const indice = Math.floor(Math.random() * mensajes.length);
  return mensajes[indice];
}

// Mostrar mensaje inicial
footerMessage.textContent = obtenerMensajeAleatorio();
footer.appendChild(footerMessage);


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
