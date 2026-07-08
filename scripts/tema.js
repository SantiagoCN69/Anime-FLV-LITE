(() => {
    const themes = {
        dark: {
            p: '#1e2230',       
            b: '#0f1115',       
            t1: '#ffffff',      
            t2: '#9ca3af',      
            br: '#2a3142',      
            btn: '#a855f7',     
            btn2: '#ec4899',    
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        light_orange: {
            p: '#ffffff',       
            b: '#fcfaf7',       
            t1: '#1e293b',      
            t2: '#64748b',      
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
            t1: '#f8fafc',      
            t2: '#94a3b8',      
            br: '#1e293b',      
            btn: '#3b82f6',     
            btn2: '#22d3ee',    
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        sakura: {
            p: '#251625',       
            b: '#140b14',       
            t1: '#fdf2f8',      
            t2: '#f472b6',      
            br: '#4c244c',       
            btn: '#db2777',     
            btn2: '#fda4af',    
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        cyberpunk: {
            p: '#0f0f1a',       
            b: '#05050a',       
            t1: '#f3f4f6',      
            t2: '#00f5ff',      
            br: '#1f1f38',      
            btn: '#00f5ff',     
            btn2: '#ff007f',    
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        forest: {
            p: '#1a2e1a',       
            b: '#0d1f0d',       
            t1: '#f0fdf4',      
            t2: '#86efac',      
            br: '#2d4a2d',      
            btn: '#22c55e',     
            btn2: '#4ade80',    
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        ocean: {
            p: '#164e63',       
            b: '#083344',       
            t1: '#ecfeff',      
            t2: '#67e8f9',      
            br: '#0e7490',      
            btn: '#06b6d4',     
            btn2: '#22d3ee',    
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        sunset: {
            p: '#2d1b1b',      
            b: '#1a0f0f',       
            t1: '#fff7ed',      
            t2: '#fdba74',      
            br: '#4a2c2c',      
            btn: '#f97316',     
            btn2: '#fb923c',    
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        }
    };
    
    const applyTheme = t => {
        try {
            const theme = themes[t] || themes.dark;
            if (!theme) throw new Error(`Theme ${t} not found`);
            
            console.log('[Theme] 🎨 Aplicando tema:', t);
            for (const [k, v] of Object.entries(theme)) {
                if (v !== undefined && v !== null) {
                    document.documentElement.style.setProperty(`--${k}`, v);
                }
            }
            console.log('[Theme] ✅ Tema aplicado exitosamente');
        } catch (err) {
            console.error('[Theme] ❌ Error:', err);
            console.log('[Theme] 🔄 Usando fallback (tema dark)');
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