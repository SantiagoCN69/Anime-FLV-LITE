(() => {
    const themes = {
        dark: {
            p: '#1e2230',       // Un poco más vivo para romper el tono plano
            b: '#0f1115',       // Fondo profundo y limpio
            t1: '#ffffff',
            t2: '#9ca3af',
            br: '#2a3142',      // Bordes sutiles pero visibles
            btn: '#a855f7',     // Púrpura eléctrico
            btn2: '#ec4899',    // Rosa neón para un gradiente moderno (reemplaza el anterior que era muy apagado)
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        nocturno: {
            p: '#0f172a',       // Slate 900 de Tailwind (azul noche perfecto)
            b: '#020617',       // Slate 950
            t1: '#f8fafc',
            t2: '#94a3b8',
            br: '#1e293b',
            btn: '#3b82f6',     // Azul brillante
            btn2: '#22d3ee',    // Cian para un degradado "deep sea" muy limpio
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        sakura: {
            p: '#251625',       // Berenjena oscuro para los paneles
            b: '#140b14',       // Fondo ultra oscuro con matiz lila
            t1: '#fdf2f8',       // Texto rosa blanquecino
            t2: '#f472b6',       // Rosa medio para secundario (muy legible)
            br: '#4c244c',       // Bordes integrados con la paleta
            btn: '#db2777',      // Rosa sakura fuerte
            btn2: '#fda4af',     // Rosa pastel para el brillo del degradado
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        cyberpunk: {
            p: '#0f0f1a',       // Negro cyber con sutil azul/morado
            b: '#05050a',       // Fondo casi puro
            t1: '#f3f4f6',       
            t2: '#00f5ff',       // El cian se mantiene para resaltar info secundaria
            br: '#1f1f38',       
            btn: '#00f5ff',      // Neón Cian
            btn2: '#ff007f',     // Neón Magenta/Fucsia (da el contraste clásico de Shibuya)
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        }
    };
    
    const applyTheme = t => {
        console.log('Aplicando tema:', t);
        const theme = themes[t] || themes.dark;
        for (const [k, v] of Object.entries(theme)) {
            document.documentElement.style.setProperty(`--${k}`, v);
        }
    };

    applyTheme(localStorage.getItem('theme') || 'dark');

    addEventListener('storage', e => e.key === 'theme' && applyTheme(e.newValue || 'dark'));
    addEventListener('themeChanged', e => applyTheme(e.detail?.theme || 'dark'));
})();