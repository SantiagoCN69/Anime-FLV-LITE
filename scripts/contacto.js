// 1. Inyectar dinámicamente la librería de Formspree en el HTML
const scriptFormspree = document.createElement('script');
scriptFormspree.src = 'https://unpkg.com/@formspree/ajax@1';
scriptFormspree.defer = true;

scriptFormspree.onload = () => {
    // Esto se ejecuta solo cuando la librería de Formspree ha cargado por completo
    window.formspree = window.formspree || function () { 
        (formspree.q = formspree.q || []).push(arguments); 
    };

    formspree('initForm', {
        formElement: '#contactoForm',
        formId: 'mkjwvlrl',
        onSuccess: function() {
            const form = document.getElementById('contactoForm');
            const charCount = document.getElementById('charCount');
            
            if (form) form.reset();
            if (charCount) charCount.textContent = '0';
        }
    });
};

document.head.appendChild(scriptFormspree);


// 2. Lógica de pestañas (Tabs)
const tabBtns = document.querySelectorAll('.tab-btn');
const tipoSelect = document.getElementById('tipo');

if (tabBtns.length > 0 && tipoSelect) {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tab = btn.dataset.tab;
            if (tab === 'sugerencia') {
                tipoSelect.value = 'sugerencia';
            } else if (tab === 'reporte') {
                tipoSelect.value = 'reporte-enlace';
            } else {
                tipoSelect.value = 'otro';
            }
        });
    });
}


// 3. Contador de caracteres
const mensaje = document.getElementById('mensaje');
const charCount = document.getElementById('charCount');
const maxLength = 500;

if (mensaje && charCount) {
    mensaje.addEventListener('input', () => {
        const currentLength = mensaje.value.length;
        charCount.textContent = currentLength;
        
        if (currentLength > maxLength) {
            mensaje.value = mensaje.value.substring(0, maxLength);
            charCount.textContent = maxLength;
        }
        
        if (currentLength >= maxLength * 0.9) {
            charCount.style.color = 'var(--btn2)';
        } else {
            charCount.style.color = 'currentColor';
        }
    });
}


// 4. Checkbox anónimo
const anonimoCheckbox = document.getElementById('anonimo');
const emailInput = document.getElementById('email');

if (anonimoCheckbox && emailInput) {
    anonimoCheckbox.addEventListener('change', () => {
        if (anonimoCheckbox.checked) {
            emailInput.value = '';
            emailInput.disabled = true;
            emailInput.style.opacity = '0.5';
        } else {
            emailInput.disabled = false;
            emailInput.style.opacity = '1';
        }
    });
}