// Detectar ahorro de energía usando Battery API
async function detectarAhorroEnergia() {
    // Verificar si el usuario tiene activado el ahorro de batería automático
    const ahorroBateriaAuto = localStorage.getItem('ahorroBateriaAuto') !== 'false';

    if (!ahorroBateriaAuto) {
        console.log("Ahorro de batería automático desactivado por el usuario.");
        return;
    }

    // 1. Validar si el navegador soporta la API
    if (!('getBattery' in navigator)) {
        console.warn("La Battery API no es compatible con este navegador.");
        return false;
    }

    try {
        const battery = await navigator.getBattery();

        // Función para evaluar si se considera en "modo ahorro / batería baja"
        const verificarEstado = () => {
            const estaCargando = battery.charging;
            const nivelBateriasBajo = battery.level <= 0.20; // 20% o menos

            // Consideramos "ahorro" si la batería es baja y NO está enchufado
            const modoAhorroInfectado = nivelBateriasBajo && !estaCargando;

            if (modoAhorroInfectado) {
                console.log("Dispositivo con batería baja / posible ahorro activo.");
                document.body.classList.add('animaciones-off');
            } else {
                document.body.classList.remove('animaciones-off');
            }
        };

        // Ejecutar al iniciar
        verificarEstado();

        // Escuchar cambios en tiempo real (si el usuario conecta el cargador o baja el nivel)
        battery.addEventListener('chargingchange', verificarEstado);
        battery.addEventListener('levelchange', verificarEstado);

    } catch (error) {
        console.error("Error al obtener el estado de la batería:", error);
    }
}

detectarAhorroEnergia();
