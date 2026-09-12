(() => {
const themes = {

nocturno: {
p: '#0f172a',
b: '#020617',
t1: '#f1f5f9',
t2: '#38bdf8',       // Más vivo para estados activos
br: '#2e3a59',
btn: '#3b82f6',
btn2: '#95f1ff',
bgt: '255, 255, 255',
bgti: '2, 6, 23'
},

sakura: {
p: '#1b0f14',
b: '#000000',
t1: '#fdf2f8',
t2: '#f472b6',
br: '#4c244c',
btn: '#d21e6e',
btn2: '#ff7a7a',     // Más suave para mejor gradiente
bgt: '255, 255, 255',
bgti: '20, 11, 20'
},

sunset: {
p: '#2d1b1b',
b: '#1a0f0f',
t1: '#fff7ed',
t2: '#fb923c',
br: '#4a2c2c',
btn: '#f97316',
btn2: '#f59e0b',     // Mejora el contraste del gradiente
bgt: '255, 255, 255',
bgti: '26, 15, 15'
},

morado_medianoche: {
p: '#181323',       // Superficie
b: '#0D0A16',       // Fondo
t1: '#F8FAFC',      // Texto principal
t2: '#C084FC',      // Acento
br: '#2D2340',      // Bordes (derivado del panel)
btn: '#A855F7',     // Primario
btn2: '#EC4899',    // Secundario
bgt: '255, 255, 255',
bgti: '13, 10, 22'  // RGB del fondo #0D0A16
}
};

    
    const applyTheme = t => {
        try {
            const theme = themes[t] || themes.dark;
            if (!theme) throw new Error(`Theme ${t} not found`);
            
            for (const [k, v] of Object.entries(theme)) {
                if (v !== undefined && v !== null) {
                    document.documentElement.style.setProperty(`--${k}`, v);
                }
            }
        } catch (err) {
            console.error('[Theme] ❌ Error:', err);
            const fallbackTheme = themes.dark;
            for (const [k, v] of Object.entries(fallbackTheme)) {
                document.documentElement.style.setProperty(`--${k}`, v);
            }
        }
    };

    applyTheme(localStorage.getItem('theme') || 'dark');

    addEventListener('storage', e => e.key === 'theme' && applyTheme(e.newValue || 'dark'));
    addEventListener('themeChanged', e => applyTheme(e.detail?.theme || 'dark'));
})();