(() => {
    const themes = {
        dark: {
            p: '#1e2230',       // Panel azul-gris profundo, moderno y elegante
            b: '#0f1115',       // Fondo casi negro con matiz azulado
            t1: '#ffffff',      // Texto blanco puro para máxima legibilidad
            t2: '#9ca3af',      // Gris medio para texto secundario
            br: '#2a3142',      // Bordes sutiles que se integran con el panel
            btn: '#a855f7',     // Púrpura eléctrico - color principal
            btn2: '#ec4899',    // Rosa neón para gradientes vibrantes
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        light_orange: {
            p: '#ffffff',       // Paneles blancos puros y limpios
            b: '#fcfaf7',       // Fondo crema muy suave (blanco roto)
            t1: '#1e293b',      // Texto gris oscuro (Slate 800) - menos agresivo que negro
            t2: '#64748b',      // Texto secundario gris medio (Slate 500)
            br: '#e2e8f0',      // Bordes sutiles (Slate 200)
            btn: '#f97316',     // Naranja vibrante estilo Tailwind
            btn2: '#fb923c',    // Naranja pastel para gradientes suaves
            f: 1,
            bgt: '0, 0, 0',     // Invertido para temas claros
            bgti: '255, 255, 255'
        },

        nocturno: {
            p: '#0f172a',       // Slate 900 - azul noche profundo
            b: '#020617',       // Slate 950 - fondo casi negro azulado
            t1: '#f8fafc',      // Blanco azulado muy suave
            t2: '#94a3b8',      // Gris azulado para texto secundario
            br: '#1e293b',      // Bordes azul oscuro que se funden
            btn: '#3b82f6',     // Azul brillante (Tailwind blue-500)
            btn2: '#22d3ee',    // Cian para gradientes "deep sea"
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        sakura: {
            p: '#251625',       // Berenjena oscuro con matiz lila
            b: '#140b14',       // Fondo ultra oscuro casi negro con tinte rosa
            t1: '#fdf2f8',      // Rosa blanquecino muy suave
            t2: '#f472b6',      // Rosa medio para secundario (alta legibilidad)
            br: '#4c244c',       // Bordes que integran la paleta sakura
            btn: '#db2777',     // Rosa sakura fuerte y vibrante
            btn2: '#fda4af',    // Rosa pastel para gradientes suaves
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        cyberpunk: {
            p: '#0f0f1a',       // Negro con sutil matiz azul/morado
            b: '#05050a',       // Fondo casi negro puro
            t1: '#f3f4f6',      // Blanco grisáceo para reducir fatiga visual
            t2: '#00f5ff',      // Cian neón para destacar información secundaria
            br: '#1f1f38',      // Bordes azul oscuro con tinte morado
            btn: '#00f5ff',     // Cian neón - color principal
            btn2: '#ff007f',    // Magenta neón para gradientes Shibuya
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        forest: {
            p: '#1a2e1a',       // Verde bosque profundo para paneles
            b: '#0d1f0d',       // Fondo verde muy oscuro
            t1: '#f0fdf4',      // Blanco verdoso muy suave
            t2: '#86efac',      // Verde claro para texto secundario
            br: '#2d4a2d',      // Bordes verde oscuro integrados
            btn: '#22c55e',     // Verde esmeralda brillante
            btn2: '#4ade80',    // Verde lima para gradientes naturales
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        ocean: {
            p: '#164e63',       // Azul océano profundo
            b: '#083344',       // Fondo azul muy oscuro
            t1: '#ecfeff',      // Blanco azulado muy claro
            t2: '#67e8f9',      // Cian claro para secundario
            br: '#0e7490',      // Bordes azul océano
            btn: '#06b6d4',     // Cian brillante
            btn2: '#22d3ee',    // Cian más claro para gradientes
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        sunset: {
            p: '#2d1b1b',       // Marrón rojizo oscuro
            b: '#1a0f0f',       // Fondo casi negro con tinte rojo
            t1: '#fff7ed',      // Blanco naranja muy suave
            t2: '#fdba74',      // Naranja medio para secundario
            br: '#4a2c2c',      // Bordes rojizos oscuros
            btn: '#f97316',     // Naranja vibrante
            btn2: '#fb923c',    // Naranja pastel para gradientes cálidos
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