(() => {
const themes = {
dark: {
p: '#1c1f2b',        // Panel: superficies (cards, header, sidebar)
b: '#0b0d12',        // Background: fondo principal
t1: '#e6e6e6',       // Texto principal
t2: '#c084fc',       // Acento activo (tabs, botones activos)
br: '#2a2f3d',       // Bordes y separadores
btn: '#8b5cf6',      // Color principal de acción
btn2: '#ec4899',     // Color secundario (gradientes)
f: 1,                // Intensidad de efectos/filtros
bgt: '255, 255, 255',// Transparencias claras
bgti: '10, 12, 18'   // Transparencias oscuras
},

light_orange: {
p: '#ffffff',
b: '#f8fafc',
t1: '#1e293b',
t2: '#f97316',       // Más coherente como acento (antes era muy apagado)
br: '#e2e8f0',
btn: '#f97316',
btn2: '#fb923c',
f: 1,
bgt: '0, 0, 0',
bgti: '255, 255, 255'
},

nocturno: {
p: '#0f172a',
b: '#020617',
t1: '#f1f5f9',
t2: '#38bdf8',       // Más vivo para estados activos
br: '#1e293b',
btn: '#3b82f6',
btn2: '#22d3ee',
f: 1,
bgt: '255, 255, 255',
bgti: '2, 6, 23'
},

sakura: {
p: '#2a1a2a',
b: '#140b14',
t1: '#fdf2f8',
t2: '#f472b6',
br: '#4c244c',
btn: '#db2777',
btn2: '#f9a8d4',     // Más suave para mejor gradiente
f: 1,
bgt: '255, 255, 255',
bgti: '20, 11, 20'
},

cyberpunk: {
p: '#0f0f1a',
b: '#05050a',
t1: '#f3f4f6',
t2: '#22d3ee',       // Menos agresivo que el cyan puro
br: '#1f1f38',
btn: '#06b6d4',
btn2: '#ff007f',
f: 1,
bgt: '255, 255, 255',
bgti: '5, 5, 10'
},

sunset: {
p: '#2d1b1b',
b: '#1a0f0f',
t1: '#fff7ed',
t2: '#fb923c',
br: '#4a2c2c',
btn: '#f97316',
btn2: '#f59e0b',     // Mejora el contraste del gradiente
f: 1,
bgt: '255, 255, 255',
bgti: '26, 15, 15'
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