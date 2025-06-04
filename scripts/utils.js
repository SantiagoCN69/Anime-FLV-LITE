// utils.js
export function observerAnimeCards() {
    console.log('observerAnimeCards');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
            }
        });
    }, { threshold: 0 });

    document.querySelectorAll('.anime-card').forEach(el => observer.observe(el));
}