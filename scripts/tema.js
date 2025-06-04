// tema.js
(() => {
    const themes = {
        dark: {p: '#1F1F1F', b: '#121212', t1: '#fff', t2: '#ddd', br: '#444', btn: '#af6dff', f: 1, bgt: '255, 255, 255'},
        light: {p: '#f5f5f5', b: '#DDDDDD', t1: '#111', t2: '#555555', br: '#ccc', btn: '#999', f: 2, bgt: '0, 0, 0'},
        nocturno: {p: '#1B263B', b: '#0D1B2A', t1: '#ddd', t2: '#AAB0B6', br: '#415A77', btn: '#778DA9', f: 1, bgt: '255, 255, 255'}
    };

    const applyTheme = t => {
        const theme = themes[t] || themes.dark;
        for (const [k, v] of Object.entries(theme)) {
            document.documentElement.style.setProperty(`--${k}`, v);
        }
    };

    // Aplicar tema guardado o dark por defecto
    applyTheme(localStorage.getItem('theme') || 'dark');

    // Escuchar cambios
    addEventListener('storage', e => e.key === 'theme' && applyTheme(e.newValue || 'dark'));
})();