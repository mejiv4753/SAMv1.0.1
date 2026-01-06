let qrGenerated = false;
let scheduledJobs = [];
let isConnected = false;
let connectionState = 'connecting'; // 'connecting', 'connected', 'disconnected'

// Estado de notificaciones
let notificacionesConfiguradas = false;


// =============================================
// DROPZONE PARA IMÁGENES
// =============================================

function initializeDropzone() {
    const dropzone = document.getElementById('imageDropzone');
    const fileInput = document.getElementById('fileInput');
    const imagePathInput = document.getElementById('imagen-path');
    const selectFileBtn = document.getElementById('seleccionarArchivoBtn');

    if (!dropzone || !fileInput || !imagePathInput || !selectFileBtn) {
        console.error("❌ Elementos del dropzone no encontrados");
        return;
    }

    // Click en el dropzone
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    // Click en el botón de seleccionar archivo
    selectFileBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar que active el click del dropzone
        fileInput.click();
    });

    // Cambio en el input file
    fileInput.addEventListener('change', handleFileSelect);

    // Eventos de drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    }

    function handleFile(file) {
        // Validar que sea una imagen
        if (!file.type.startsWith('image/')) {
            updateStatus('❌ Por favor selecciona un archivo de imagen válido');
            return;
        }

        // Actualizar el input de texto
        imagePathInput.value = file.path || file.name;
        dropzone.classList.add('has-file');

        // Mostrar preview si es posible
        showImagePreview(file);

        showToast(`Imagen seleccionada: ${file.name}`, "success");
    }

    function showImagePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Remover preview anterior si existe
            const existingPreview = dropzone.querySelector('.dropzone-preview');
            if (existingPreview) {
                existingPreview.remove();
            }

            // Crear nuevo preview
            const previewContainer = document.createElement('div');
            previewContainer.className = 'dropzone-preview';
            previewContainer.innerHTML = `
                <img src="${e.target.result}" alt="Vista previa" />
            `;

            const dropzoneContent = dropzone.querySelector('.dropzone-content');
            dropzoneContent.appendChild(previewContainer);
        };
        reader.readAsDataURL(file);
    }
}

//MODIFICACION PARA MOSTRAR ENVIOS PROGRAMADOS:
// =============================================
// FUNCIONES PARA ENVÍOS PROGRAMADOS (MODAL)
// =============================================

// Función para mostrar el modal de envíos programados
function mostrarEnviosProgramados() {
    const container = document.getElementById('enviosContainer');
    if (container) {
        container.style.display = 'flex';
        // Cargar la lista actualizada
        actualizarListaEnviosModal();
    }
}

// Función para cerrar el modal de envíos programados
function cancelarVerEnvios() {
    const container = document.getElementById('enviosContainer');
    if (container) {
        container.style.display = 'none';
    }
}

// Función para actualizar la lista en el modal (MISMO ESTILO QUE ANTES)
function actualizarListaEnviosModal() {
    const container = document.getElementById('envios-lista');
    if (!container) return;

    if (!Array.isArray(scheduledJobs) || scheduledJobs.length === 0) {
        container.innerHTML = `
            <div class="envios-vacio">
                <span class="material-symbols-outlined icon">event_busy</span>
                <p>No hay envíos programados</p>
                <p style="font-size: 14px; margin-top: 10px;">Programa tu primer envío usando el formulario principal</p>
            </div>
        `;
        return;
    }

    // Usar EXACTAMENTE el mismo HTML que tenías antes
    container.innerHTML = scheduledJobs.map((job, index) => {
        const fecha = job && job.fechaHora ? new Date(job.fechaHora) : null;
        const fechaStr = fecha ? fecha.toLocaleDateString() : "—";
        const horaStr = fecha ? fecha.toLocaleTimeString() : "—";
        const grupos = document.getElementById("grupo").value;

        const nombreImagen = job && job.imagen ? job.imagen.split(/[\\/]/).pop() : "—";
        const grupo = job && job.grupos ? job.grupos : "—";

        // Verificar si el envío ya pasó su fecha
        const ahora = new Date();
        const fechaEnvio = job && job.fechaHora ? new Date(job.fechaHora) : null;
        const esPasado = fechaEnvio && fechaEnvio < ahora;

        // Aplicar clase si ya pasó
        const clasePasado = esPasado ? 'envio-pasado' : '';

        return `
        <div class="envio-item ${clasePasado}" data-job-index="${index}">
            <div class="envio-content">
                <strong>Grupos: ${grupo}</strong><br>
                📅 Fecha: ${fechaStr}<br>
                ⏰ Hora: ${horaStr} (hora local)<br>
                🖼️ Archivo: ${nombreImagen}
            </div>
            <button class="delete-btn" onclick="eliminarEnvioModal(${index})" data-testid="button-delete-${index}">
                 <span class="material-symbols-outlined icon">delete_sweep</span>
            </button>
        </div>
        `;
    }).join("");
}

// Función para eliminar envío desde el modal
async function eliminarEnvioModal(index) {
    if (!confirm("¿Estás seguro de que quieres eliminar este envío programado?")) {
        return;
    }

    try {
        if (index < 0 || index >= scheduledJobs.length) {
            showToast("❌ Índice de envío inválido", "error");
            return;
        }

        const jobToDelete = scheduledJobs[index];
        const jobId = jobToDelete.jobId;

        if (window.electronAPI && window.electronAPI.cancelarJob) {
            const resultado = await window.electronAPI.cancelarJob(jobId);

            // Recargar la lista de jobs
            await cargarJobsProgramados();

            // Actualizar ambas listas
            actualizarListaJobs(); // Para la lista original si aún existe
            actualizarListaEnviosModal(); // Para el modal

            showToast(resultado, "success");
        } else {
            scheduledJobs.splice(index, 1);
            actualizarListaEnviosModal();
            showToast("Envío eliminado.", "success");
        }
    } catch (error) {
        console.error("Error eliminando envío:", error);
        showToast("❌ Error al eliminar el envío: " + error.message, "error");
    }
}

// =============================================
// FUNCIÓN DE SELECCIÓN DE ARCHIVO (compatibilidad)
// =============================================

async function seleccionarArchivo() {
    try {
        const filePath = await window.electronAPI.selectFile();
        if (filePath) {
            document.getElementById("imagen-path").value = filePath;
            showToast("Archivo seleccionado: " + filePath, "succes");

            // Actualizar el dropzone visualmente
            const dropzone = document.getElementById('imageDropzone');
            if (dropzone) {
                dropzone.classList.add('has-file');

                // Mostrar preview básico (solo el nombre)
                const existingPreview = dropzone.querySelector('.dropzone-preview');
                if (existingPreview) {
                    existingPreview.remove();
                }

                const fileName = filePath.split(/[\\/]/).pop();
                const previewContainer = document.createElement('div');
                previewContainer.className = 'dropzone-preview';
                previewContainer.innerHTML = `
                    <p style="color: #10B981; font-weight: 600;">📁 ${fileName}</p>
                `;

                const dropzoneContent = dropzone.querySelector('.dropzone-content');
                if (dropzoneContent) {
                    dropzoneContent.appendChild(previewContainer);
                }
            }
        }
    } catch (error) {
        console.error("Error al seleccionar archivo:", error);
        updateStatus("❌ Error al seleccionar archivo.");
    }
}

//PRUEBA DE VALIDACION 
// =============================================
// VALIDACIÓN DE GRUPOS (Versión actualizada)
// =============================================

// 1. Función para alternar la visibilidad de los resultados
function toggleValidationResults() {
    const resultadosDiv = document.getElementById('validacionResultados');
    const header = resultadosDiv.querySelector('.validation-header');

    resultadosDiv.classList.toggle('collapsed');
    header.classList.toggle('collapsed');
}

// 2. Función principal de validación
async function validarGrupos() {
    const input = document.getElementById('grupo');
    const resultadosDiv = document.getElementById('validacionResultados');
    const contenidoDiv = document.getElementById('validacionContenido');
    const header = resultadosDiv.querySelector('.validation-header');

    if (!input || !input.value.trim()) {
        showToast('Escribe al menos un grupo para validar', 'error');
        return;
    }

    // Mostrar resultados expandidos
    resultadosDiv.classList.remove('collapsed');
    header.classList.remove('collapsed');

    // Mostrar "validando..."
    contenidoDiv.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #6B7280;">
            <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">
                search
            </span>
            <p style="margin-top: 10px; font-size: 14px;">Validando grupos...</p>
        </div>
    `;

    resultadosDiv.style.display = 'block';

    try {
        // Llamar a la API
        const resultados = await window.electronAPI.validarGrupos(input.value);

        if (resultados.success) {
            mostrarResultadosValidacion(resultados);
        } else {
            mostrarErrorValidacion(resultados.message);
        }

        // Desplazar para mostrar resultados
        resultadosDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('Error validando grupos:', error);
        mostrarErrorValidacion(error.message);
    }
}

// 3. Función para mostrar error
function mostrarErrorValidacion(mensaje) {
    const contenidoDiv = document.getElementById('validacionContenido');

    contenidoDiv.innerHTML = `
        <div class="validation-summary error">
            <span class="material-symbols-outlined">error</span>
            <strong>Error en la validación:</strong> ${mensaje}
        </div>
    `;
}

// 4. Función para mostrar resultados (versión rediseñada)
function mostrarResultadosValidacion(resultados) {
    const contenidoDiv = document.getElementById('validacionContenido');

    let html = '';

    // Mostrar mensaje general
    const esExitoso = resultados.todosValidos;
    const tieneInvalidos = resultados.gruposInvalidos && resultados.gruposInvalidos.length > 0;

    let claseSummary, iconoSummary;

    if (esExitoso) {
        claseSummary = 'success';
        iconoSummary = 'check_circle';
    } else if (tieneInvalidos) {
        claseSummary = 'warning';
        iconoSummary = 'warning';
    } else {
        claseSummary = 'error';
        iconoSummary = 'error';
    }

    html += `
        <div class="validation-summary ${claseSummary}">
            <span class="material-symbols-outlined">${iconoSummary}</span>
            <strong>${resultados.message}</strong>
        </div>
    `;

    // Mostrar cada grupo
    resultados.resultados.forEach(grupo => {
        if (grupo.valido) {
            const tipoClase = grupo.esGrupo ? 'valid' : 'individual';
            const tipoTexto = grupo.esGrupo ? 'Grupo' : 'Chat individual';
            const iconoTipo = grupo.esGrupo ? 'groups' : 'person';

            html += `
                <div class="group-item ${tipoClase}">
                    <div class="group-header">
                        <div class="group-name">
                            <span class="material-symbols-outlined">${iconoTipo}</span>
                            ${grupo.nombreIngresado}
                        </div>
                        <span class="group-badge">
                            ${tipoTexto}
                        </span>
                    </div>
                    ${grupo.nombreReal !== grupo.nombreIngresado ?
                    `<div class="group-real-name">→ ${grupo.nombreReal}</div>` : ''}
                    <div class="group-meta">
                        <span class="material-symbols-outlined" style="font-size: 14px;">person</span>
                        ${grupo.esGrupo ? `${grupo.participantes} miembros` : '1 persona'}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="group-item invalid">
                    <div class="group-header">
                        <div class="group-name">
                            <span class="material-symbols-outlined">error</span>
                            ${grupo.nombreIngresado}
                        </div>
                        <span class="group-badge">
                            No encontrado
                        </span>
                    </div>
                    <div class="group-error">
                        <span class="material-symbols-outlined">info</span>
                        ${grupo.error || 'El grupo/chat no existe o no es accesible'}
                    </div>
                </div>
            `;
        }
    });

    // Mostrar estadísticas
    const validos = resultados.gruposValidos?.length || 0;
    const invalidos = resultados.gruposInvalidos?.length || 0;
    const total = resultados.total || 0;

    html += `
        <div class="validation-stats">
            <div class="stat-item">
                <span class="stat-value" style="color: #10b981;">${validos}</span>
                <span class="stat-label">Válidos</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="color: #ef4444;">${invalidos}</span>
                <span class="stat-label">Inválidos</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="color: #3b82f6;">${total}</span>
                <span class="stat-label">Total</span>
                <span class="stat-value" style="color: ${esExitoso ? '#10b981' : '#f59e0b'};"></span>
            </div>
        </div>
    `;

    contenidoDiv.innerHTML = html;
}

// 5. Configuración de eventos al cargar el DOM
document.addEventListener('DOMContentLoaded', function () {
    // Evento Enter en el input
    const inputGrupo = document.getElementById('grupo');
    if (inputGrupo) {
        inputGrupo.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                validarGrupos();
            }
        });
    }

    // Ocultar resultados inicialmente
    const resultadosDiv = document.getElementById('validacionResultados');
    if (resultadosDiv) {
        resultadosDiv.style.display = 'none';
    }

    console.log('Sistema de validación configurado con diseño mejorado');
});

// =============================================
// INDICADOR DE ESTADO DE CONEXIÓN CON GLOW
// =============================================

function updateConnectionStatus() {
    const connectionCard = document.getElementById('connectionCard');
    const statusText = document.getElementById('status-text');

    // Remover todas las clases de estado
    connectionCard.classList.remove('connecting', 'connected', 'disconnected');

    // Aplicar clase según el estado
    connectionCard.classList.add(connectionState);

    // Actualizar texto del estado
    switch (connectionState) {
        case 'connected':
            statusText.textContent = 'Conectado';
            statusText.style.color = '#10B981';
            break;
        case 'disconnected':
            statusText.textContent = 'Desconectado';
            statusText.style.color = '#EF4444';
            break;
        case 'connecting':
            statusText.textContent = 'Conectando...';
            statusText.style.color = '#F59E0B';
            break;
    }
}

// =============================================
// FUNCIONALIDADES DE LA BARRA LATERAL
// =============================================

// Inicializar barra lateral y tema
function initializeSidebar() {
    //console.log("🔄 Inicializando barra lateral...");

    // Toggle del tema
    const themeToggle = document.getElementById('toggle-theme-btn');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        updateThemeButton(); // Actualizar el botón según el tema actual
    }

    // Remover el toggle original del header si existe
    const oldToggle = document.getElementById('toggle-mode');
    if (oldToggle && oldToggle.parentNode) {
        const parent = oldToggle.closest('.mode-switch');
        if (parent) {
            parent.remove();
        }
    }

    // Ocultar el botón de menú en desktop (no es necesario con hover)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.style.display = 'none';
    }

    //console.log("✅ Sidebar inicializado con funcionalidad hover");
}
//SE ESTA AGREGANDO 



// Función para cambiar el tema
function toggleTheme() {
    const body = document.body;
    const isDarkMode = body.classList.contains('dark-mode');

    //console.log("🎨 Cambiando tema:", isDarkMode ? "oscuro -> claro" : "claro -> oscuro");

    if (isDarkMode) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
    }

    updateThemeButton();
}

// Actualizar el botón de tema según el estado actual
function updateThemeButton() {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    const isDarkMode = document.body.classList.contains('dark-mode');

    if (themeIcon && themeText) {
        if (isDarkMode) {
            themeIcon.textContent = 'light_mode';
            themeText.textContent = 'Modo Claro';
        } else {
            themeIcon.textContent = 'dark_mode';
            themeText.textContent = 'Modo Oscuro';
        }
    }
}

// Inicializar fecha/hora por defecto (hoy + próximo múltiplo de 5 min)
function initializeApp() {
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    document.getElementById('fecha').value = `${yyyy}-${mm}-${dd}`;

    const h = String(now.getHours()).padStart(2, '0');
    const m = String(Math.ceil(now.getMinutes() / 5) * 5).padStart(2, '0');
    document.getElementById('hora').value = `${h}:${m}`;

    // updateStatus("Iniciando conexión con WhatsApp...");
    showConnectionSpinner();
    cargarJobsProgramados();

    // Inicializar dropzone
    initializeDropzone();

    // Inicializar estado de conexión
    updateConnectionStatus();
}

function setupEventListeners() {
    if (window.electronAPI) {
        window.electronAPI.onConnected((connected) => {
            isConnected = connected;
            connectionState = connected ? 'connected' : 'disconnected';
            updateConnectionStatus();
            if (connected) {
                hideQRContainer();
            }
        });

        window.electronAPI.onHideQR(() => {
            hideQRContainer();
        });

        window.electronAPI.onShowToast((event, data) => {
            // data es el objeto {message, type}
            showToast(data.message, data.type);
        });
    }
}

function hideQRContainer() {
    const qrContainer = document.getElementById("qrContainer");
    if (qrContainer && isConnected) {
        qrContainer.innerHTML = `
        <div style="text-align:center; padding:20px; background:#e8f5e8; border-radius:10px;">
            <p style="color:#25D366; font-weight:bold;">✅ Conectado a WhatsApp</p>
            <p style="color:#666; font-size:14px;">La sesión se mantendrá activa entre reinicios</p>
        </div>
        `;
    }
}

async function programar() {
    try {
        const imagen = document.getElementById("imagen-path").value;
        const fecha = document.getElementById("fecha").value;
        const hora = document.getElementById("hora").value;
        const mensaje = document.getElementById("mensaje").value.trim();

        const grupoInput = document.getElementById("grupo").value;
        const grupos = grupoInput
            .split(",")                 // separar por comas
            .map(g => g.trim())         // quitar espacios
            .filter(g => g.length > 0); // eliminar vacíos

        if (!imagen || !fecha || !hora || grupos.length === 0) {
            updateStatus("❌ Por favor, completa todos los campos");
            return;
        }

        if (!hora.includes(':')) {
            updateStatus("❌ Formato de hora inválido");
            return;
        }

        showToast("Envío programado.", "success");
        const resultado = await window.electronAPI.programarEnvio({
            imagen,
            fecha,
            hora,
            grupos, // enviamos array
            mensaje: mensaje || "Buenos días, les envío la imagen correspondiente al día de hoy, saludos."
        });

        updateStatus(resultado);

        // Refrescar lista
        await cargarJobsProgramados();
    } catch (error) {
        console.error("Error en programar:", error);
        updateStatus("❌ Error: " + error.message);
    }
}

// Test de envío inmediato
async function testEnvioInmediato() {
    try {
        const imagen = document.getElementById("imagen-path").value;
        const grupo = document.getElementById("grupo").value;
        const mensaje = document.getElementById("mensaje").value.trim();

        if (!imagen || !grupo) {
            showToast("Para test, completa imagen y grupo", "error");
            return;
        }

        updateStatus("🧪 Probando envío inmediato.");
        const resultado = await window.electronAPI.testEnvioInmediato({
            imagen,
            grupo,
            mensaje: mensaje || "Buenos días, les envío la imagen correspondiente al día de hoy, saludos."
        });

        let toastType = 'info';
        if (resultado.includes('enviado') || resultado.includes('éxito') || resultado.includes('correctamente')) {
            toastType = 'success';
        } else if (resultado.includes('error') || resultado.includes('fallido') || resultado.includes('no se pudo')) {
            toastType = 'error';
        }

        showToast(resultado, toastType);
    } catch (error) {
        console.error("Error en test:", error);
        showToast("Error en test: " + error.message, "error");
    }
}
// Función para limpiar los logs del frontend
function limpiarLogs() {
    const estadoElement = document.getElementById('estado');
    if (estadoElement) {
        estadoElement.innerHTML = 'Logs limpiados<br>' + new Date().toLocaleString();
    }
}

function updateStatus(message, showToast = false) {
    const estado = document.getElementById("estado");
    if (estado) {
        estado.innerText += "\n" + message;
        estado.scrollTop = estado.scrollHeight;
    }

    // Solo mostrar toast si se solicita explícitamente
    if (showToast) {
        const type = message.includes('✅') ? 'success' :
            message.includes('❌') ? 'error' : 'info';
        showToast(message, type);
    }
}
function showConnectionSpinner() {
    const qrContainer = document.getElementById("qrContainer");
    const estado = document.getElementById("estado");

    if (qrContainer) {
        qrContainer.innerHTML = `
            <div class="connection-spinner">
                <div class="spinner"></div>
                <p>Iniciando conexión con WhatsApp...</p>
            </div>
        `;
    }

    if (estado) {
        estado.innerText = "";
    }

    // Actualizar estado visual
    connectionState = 'connecting';
    updateConnectionStatus();
}
function onConnectionSuccess() {
    const qrContainer = document.getElementById("qrContainer");

    // Ocultar spinner y mostrar estado conectado
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div style="text-align:center; padding:20px; background:#e8f5e8; border-radius:10px;">
                <p style="color:#25D366; font-weight:bold;">✅ WhatsApp Conectado</p>
                <p style="color:#666; font-size:14px;">Sesión iniciada correctamente</p>
            </div>
        `;
    }


    // Actualizar estado
    isConnected = true;
    connectionState = 'connected';
    updateConnectionStatus();
}
function generarQRImagen(qr) {
    const qrContainer = document.getElementById("qrContainer");

    // No mostrar mensaje en área de estado, solo el QR
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}&margin=10&color=000000&bgcolor=FFFFFF`;

    qrContainer.innerHTML = `
    <img src="${qrUrl}" 
         alt="QR Code de WhatsApp" 
         style="width:300px;height:300px;border:2px solid #25D366;border-radius:10px;display:block; margin:auto;"
         onload="showToast('¡QR listo! Escanea con WhatsApp', 'success')"
         onerror="showToast('Error cargando QR. Intenta recargar.', 'error')">
    `;
    qrGenerated = true;
}

// Eventos desde main
if (window.electronAPI) {
    window.electronAPI.onQR((qr) => generarQRImagen(qr));
    window.electronAPI.onStatus((msg) => updateStatus(msg));
}

async function forzarNuevoQR() {
    try {
        showToast("Generando nuevo código QR.", "info");

        // Mostrar spinner inmediatamente
        document.getElementById("qrContainer").innerHTML = `
      <div class="connection-spinner">
        <div class="spinner"></div>
        <p>Generando nuevo QR...</p>
      </div>
    `;

        const resultado = await window.electronAPI.forzarNuevoQR();

        if (resultado.success) {
            showToast("✅ " + resultado.message, "success");
        } else {
            showToast("❌ " + resultado.message, "error");
            // Restaurar estado anterior si falla
            cargarEstadoActualNotificaciones();
        }
    } catch (error) {
        console.error("Error forzando nuevo QR:", error);
        showToast("❌ Error forzando nuevo QR: " + error.message, "error");
    }
}

// Modifica la función cargarJobsProgramados para que también actualice el modal si está abierto
async function cargarJobsProgramados() {
    try {
        if (window.electronAPI) {
            const jobs = await window.electronAPI.obtenerJobsProgramados();
            scheduledJobs = Array.isArray(jobs) ? jobs : [];

            // Actualizar ambas vistas
            actualizarListaJobs(); // Para compatibilidad
            actualizarListaEnviosModal(); // Para el modal

            // Mostrar toast si hay cambios
            if (scheduledJobs.length > 0) {
                console.log(`✅ ${scheduledJobs.length} envíos programados cargados`);
            }
        }
    } catch (error) {
        console.error("Error cargando jobs:", error);
        showToast("❌ Error cargando envíos programados", "error");
    }
}

function actualizarListaJobs() {
    const container = document.getElementById("proximos-envios");
    if (!container) return;

    if (!Array.isArray(scheduledJobs) || scheduledJobs.length === 0) {
        container.innerHTML = "<p>No hay envíos programados</p>";
        return;
    }

    container.innerHTML = scheduledJobs.map((job, index) => {
        const fecha = job && job.fechaHora ? new Date(job.fechaHora) : null;
        const fechaStr = fecha ? fecha.toLocaleDateString() : "—";
        const horaStr = fecha ? fecha.toLocaleTimeString() : "—";
        const grupos = document.getElementById("grupo").value;

        const nombreImagen = job && job.imagen ? job.imagen.split(/[\\/]/).pop() : "—";
        const grupo = job && job.grupos ? job.grupos : "—";

        return `
        <div class="envio-item" data-job-index="${index}">
            <div class="envio-content">
                <strong>Grupos: ${grupo}</strong><br>
                📅 Fecha: ${fechaStr}<br>
                ⏰ Hora: ${horaStr} (hora local)<br>
                🖼️ Archivo: ${nombreImagen}
            </div>
            <button class="delete-btn" onclick="eliminarEnvio(${index})" data-testid="button-delete-${index}">
                <span class="material-symbols-outlined icon">delete</span>
            </button>
        </div>
        `;
    }).join("");
}
async function eliminarEnvio(index) {
    console.log("Eliminando envío programado:", index);

    if (confirm("¿Estás seguro de que quieres eliminar este envío programado?")) {
        try {
            // Verificar que el índice sea válido
            if (index < 0 || index >= scheduledJobs.length) {
                updateStatus("❌ Índice de envío inválido");
                return;
            }

            const jobToDelete = scheduledJobs[index];
            const jobId = jobToDelete.jobId;

            console.log(`Eliminando job con ID: ${jobId}`);

            // Usar el handler existente cancelar-job
            if (window.electronAPI && window.electronAPI.cancelarJob) {
                const resultado = await window.electronAPI.cancelarJob(jobId);
                console.log("Resultado cancelación:", resultado);

                // Recargar la lista de jobs
                await cargarJobsProgramados();
                updateStatus(resultado);
            } else {
                // Fallback: eliminar solo del frontend
                scheduledJobs.splice(index, 1);
                actualizarListaJobs();
                updateStatus("Envío eliminado.");
            }
        } catch (error) {
            console.error("Error eliminando envío:", error);
            updateStatus("Error al eliminar el envío: " + error.message);

            // Fallback: eliminar solo del frontend
            scheduledJobs.splice(index, 1);
            actualizarListaJobs();
        }
    }
}

// =============================================
// FUNCIONES DE NOTIFICACIONES
// =============================================

// Función para cerrar sesión
async function cerrarSesion() {
    if (!confirm("¿Estás seguro de que deseas cerrar sesión? Se limpiarán todas las sesiones previas y tendrás que escanear el QR nuevamente.")) {
        return;
    }

    try {
        updateStatus("🔒 Cerrando sesión...");

        if (window.electronAPI) {
            const resultado = await window.electronAPI.cerrarSesion();

            if (resultado.success) {
                updateStatus("✅ " + resultado.message);

                // Actualizar estado de conexión
                isConnected = false;
                connectionState = 'disconnected';
                updateConnectionStatus();

                // Limpiar lista de jobs programados
                scheduledJobs = [];
                actualizarListaJobs();

                // Mostrar container para nuevo QR
                document.getElementById("qrContainer").innerHTML =
                    '<div style="padding:50px;text-align:center;">Cerrando sesión y generando nuevo QR...</div>';
            } else {
                updateStatus("❌ " + resultado.message);
            }
        }
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        updateStatus("❌ Error al cerrar sesión: " + error.message);
    }
}

function showToast(message, type = 'info') {
    // Crear elemento toast si no existe
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    // Crear toast individual
    const toast = document.createElement('div');
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 300px;
    `;

    // Estilos según el tipo
    if (type === 'success') {
        toast.style.background = '#10B981';
    } else if (type === 'error') {
        toast.style.background = '#EF4444';
    } else {
        toast.style.background = '#3B82F6';
    }

    // Icono según tipo
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';

    toast.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">${icon}</span>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Auto-remover después de 4 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// =============================================
// FUNCIONES DE NOTIFICACIONES 
// =============================================

async function mostrarConfiguracionNotificaciones() {
    const container = document.getElementById('notificationsContainer');
    const estadoNotif = document.getElementById('estadoNotificaciones');

    container.style.display = 'flex';
    estadoNotif.innerHTML = '';
    estadoNotif.className = 'status-notificaciones';

    // Cargar configuración actual
    await cargarConfiguracionActual();
}

// Función para cargar la configuración actual
async function cargarConfiguracionActual() {
    try {
        if (window.electronAPI) {
            const estado = await window.electronAPI.obtenerEstadoNotificaciones();
            const currentConfigSection = document.getElementById('currentConfigSection');
            const currentConfigValue = document.getElementById('currentConfigValue');
            const saveButton = document.getElementById('saveButton');
            const modifyButton = document.getElementById('modifyButton');
            const grupoInput = document.getElementById('grupoNotificaciones');

            if (estado.enabled && estado.destino) {
                // Hay configuración existente - MOSTRAR "Modificar" y OCULTAR "Guardar"
                currentConfigSection.style.display = 'block';
                currentConfigValue.textContent = estado.destino.nombre;
                grupoInput.value = estado.destino.nombre;
                grupoInput.disabled = true;
                saveButton.style.display = 'none';
                modifyButton.style.display = 'flex'; // Mostrar botón Modificar
            } else {
                // No hay configuración - MOSTRAR "Guardar" y OCULTAR "Modificar"
                currentConfigSection.style.display = 'none';
                grupoInput.value = '';
                grupoInput.disabled = false;
                saveButton.style.display = 'flex'; // Mostrar botón Guardar
                modifyButton.style.display = 'none'; // Ocultar botón Modificar
            }
        }
    } catch (error) {
        console.error("Error cargando configuración actual:", error);
    }
}

// Función para habilitar modificación
function habilitarModificacion() {
    const grupoInput = document.getElementById('grupoNotificaciones');
    const saveButton = document.getElementById('saveButton');
    const modifyButton = document.getElementById('modifyButton');

    grupoInput.disabled = false;
    grupoInput.focus();
    saveButton.style.display = 'flex'; // Mostrar Guardar
    modifyButton.style.display = 'none'; // Ocultar Modificar
}

// Función para guardar la configuración
async function guardarConfiguracionNotificaciones() {
    const grupo = document.getElementById('grupoNotificaciones').value.trim();
    const estadoNotif = document.getElementById('estadoNotificaciones');

    if (!grupo) {
        estadoNotif.innerHTML = 'Por favor ingresa un nombre de grupo';
        estadoNotif.className = 'status-notificaciones error';
        return;
    }

    try {
        estadoNotif.innerHTML = 'Configurando notificaciones...';
        estadoNotif.className = 'status-notificaciones info';

        if (window.electronAPI) {
            const resultado = await window.electronAPI.configurarNotificaciones(grupo);

            if (resultado.success) {
                estadoNotif.innerHTML = `${resultado.message}`;
                estadoNotif.className = 'status-notificaciones success';
                notificacionesConfiguradas = true;

                // Recargar configuración actual
                setTimeout(() => {
                    cargarConfiguracionActual();
                    cargarEstadoActualNotificaciones();
                }, 1500);
            } else {
                estadoNotif.innerHTML = `${resultado.message}`;
                estadoNotif.className = 'status-notificaciones error';
            }
        }
    } catch (error) {
        console.error("Error configurando notificaciones:", error);
        estadoNotif.innerHTML = `❌ Error: ${error.message}`;
        estadoNotif.className = 'status-notificaciones error';
    }
}

// Función para cancelar la configuración
function cancelarConfiguracionNotificaciones() {
    document.getElementById('notificationsContainer').style.display = 'none';
    // Resetear el formulario
    document.getElementById('grupoNotificaciones').value = '';
    document.getElementById('estadoNotificaciones').innerHTML = '';
}

// Función para cargar el estado actual de las notificaciones
async function cargarEstadoActualNotificaciones() {
    try {
        if (window.electronAPI) {
            const estado = await window.electronAPI.obtenerEstadoNotificaciones();
            const container = document.getElementById('estado-actual-notificaciones');

            if (estado.enabled && estado.destino) {
                container.innerHTML = `
    <div class="config-badge">
        <span class="material-symbols-outlined">notifications_active</span>
        <div class="config-info">
            <span class="config-label">NOTIFICACIONES ACTIVAS</span>
            <span class="config-value">Para: ${estado.destino.nombre}</span>
        </div>
    </div>
    `;
            } else {
                container.innerHTML = `
    <div class="config-badge" style="border-left-color: #F59E0B;">
        <span class="material-symbols-outlined" style="color: #F59E0B;">notifications_off</span>
        <div class="config-info">
            <span class="config-label">NOTIFICACIONES DESACTIVADAS</span>
        </div>
    </div>
    `;
            }
        }
    } catch (error) {
        console.error("Error cargando estado de notificaciones:", error);
        const container = document.getElementById('estado-actual-notificaciones');
        if (container) {
            container.innerHTML = `<div style="color: red;">❌ Error cargando estado</div>`;
        }
    }
}

// Función para modificar la configuración de notificaciones
function modificarConfiguracionNotificaciones() {
    const grupo = document.getElementById('grupoNotificaciones').value.trim();

    if (!grupo) {
        document.getElementById('estadoNotificaciones').innerHTML =
            '<span style="color: red;">❌ Por favor ingresa un nombre de grupo</span>';
        return;
    }

    // Reutilizamos la misma función de guardar
    guardarConfiguracionNotificaciones();
}
// =============================================
// INICIALIZACIÓN PRINCIPAL
// =============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log("🚀 Inicializando aplicación...");
    initializeApp();
    setupEventListeners();
    initializeSidebar(); // Inicializar barra lateral después del DOM
    cargarEstadoActualNotificaciones(); // Cargar estado de notificaciones

    // Refresco periódico de jobs
    setInterval(cargarJobsProgramados, 30000);
});

// Notificación de nueva versión disponible
if (window.electronAPI) {
    window.electronAPI.onUpdateAvailable(() => {
        alert("Nueva versión disponible. Se descargará automáticamente.");
    });

    // Cuando la actualización termina de descargar
    window.electronAPI.onUpdateDownloaded(() => {
        const confirmInstall = confirm("✅ Actualización descargada. ¿Deseas reiniciar para instalarla?");
        if (confirmInstall) {
            window.electronAPI.installUpdate();
        }
    });
}
// =============================================
// GENERADOR DE NÚMEROS (VERSIÓN MEJORADA)
// =============================================

// Variables globales para el generador
let numerosGenerados = false;
let numerosEstado = null;

// Función para mostrar el modal
function mostrarGeneradorNumeros() {
    const container = document.getElementById('numbersContainer');
    if (container) {
        container.style.display = 'flex';
        cargarEstadoNumeros();
    }
}

// Función para cerrar el modal
function cancelarGeneradorNumeros() {
    const container = document.getElementById('numbersContainer');
    if (container) {
        container.style.display = 'none';
        //limpiarEstadoNumeros();
        //limpiarNumerosGenerados();
    }
}

// Función para cargar el estado actual
async function cargarEstadoNumeros() {
    try {
        const estado = await window.electronAPI.obtenerEstadoNumeros();
        numerosEstado = estado;

        // Actualizar ruta de guardado
        const rutaInput = document.getElementById('rutaGuardado');
        if (rutaInput && estado.rutaGuardado) {
            rutaInput.value = estado.rutaGuardado;
        }

        // Actualizar estadísticas
        actualizarEstadisticas(estado.estadisticas);

        // Actualizar grid de la semana
        actualizarWeekNumbersGrid(estado.semana);

        // Habilitar/deshabilitar botón de confirmar
        const btnConfirmar = document.getElementById('btnConfirmNumbers');
        if (btnConfirmar) {
            const tieneNumeros = Object.values(estado.semana).some(dia => dia.generado);
            const tieneRuta = estado.rutaGuardado;
            btnConfirmar.disabled = !(tieneNumeros && tieneRuta);
        }

    } catch (error) {
        console.error('Error cargando estado de números:', error);
        //mostrarEstadoNumeros('❌ Error cargando estado', 'error');
    }
}

// Función para actualizar el grid de la semana (MEJORADA)
function actualizarWeekNumbersGrid(semana) {
    const grid = document.getElementById('weekNumbersGrid');
    if (!grid) return;

    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // Generar las cards
    const cards = dias.map((dia, index) => {
        const datosDia = semana[dia] || { numeros: [], generado: false };
        const tieneNumeros = datosDia.generado && datosDia.numeros.length === 3;

        // Agregar clase especial para centrar la última fila
        const esPrimeraFila = index < 4;
        const esUltimaFila = index >= 4;

        return `
        <div class="day-numbers-card ${tieneNumeros ? 'generated' : ''}" style="${esUltimaFila ? 'grid-column: ' + (index - 3) + ' / span 1;' : ''}">
            ${tieneNumeros ? '<div class="check-indicator"><span class="material-symbols-outlined">check_circle</span></div>' : ''}
            
            <div class="day-numbers-header">
                <span class="day-name">${dia}</span>

            </div>
            
            ${tieneNumeros ?
                `<div class="numbers-display-grid">
                    ${datosDia.numeros.map(num =>
                    `<div class="number-circle">${num}</div>`
                ).join('')}
                </div>`
                :
                `<div class="empty-numbers">
                    <span class="empty-symbol">#</span>
                    <p>Sin números</p>
                </div>`
            }
            
            <button class="day-generate-btn-round" onclick="generarDiaNumeros('${dia}')" title="${tieneNumeros ? 'Regenerar' : 'Generar'}">
                <span class="material-symbols-outlined">
                    ${tieneNumeros ? 'refresh' : 'add'}
                </span>
            </button>
        </div>
        `;
    });

    // Centrar última fila usando grid wrapper
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
            ${cards.slice(0, 4).join('')}
        </div>
        <div style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; justify-content: center;">
            <div style="grid-column: 1 / 2;">${cards[4]}</div> 
            <div style="grid-column: 2 / 3;">${cards[5]}</div>  
            <div style="grid-column: 3 / 4;">${cards[6]}</div>  
        </div>
    `;
}

// Función para actualizar estadísticas
function actualizarEstadisticas(estadisticas) {
    const statsContainer = document.getElementById('numbersStats');
    if (!statsContainer || !estadisticas) return;

    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${estadisticas.totalUsados}</span>
            <span class="stat-label">Números Usados</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${estadisticas.disponibles}</span>
            <span class="stat-label">Disponibles</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${estadisticas.porcentaje}%</span>
            <span class="stat-label">Porcentaje</span>
        </div>
    `;
}

// Función para seleccionar carpeta
async function seleccionarCarpetaGuardado() {
    try {
        const resultado = await window.electronAPI.seleccionarCarpetaNumeros();

        if (resultado.success && resultado.ruta) {
            // Establecer ruta en el backend
            const rutaGuardado = await window.electronAPI.establecerRutaNumeros(resultado.ruta);

            // Actualizar input
            const rutaInput = document.getElementById('rutaGuardado');
            if (rutaInput) {
                rutaInput.value = rutaGuardado;
            }

            // Habilitar botón de confirmar si ya hay números
            const btnConfirmar = document.getElementById('btnConfirmNumbers');
            if (btnConfirmar && numerosEstado) {
                const tieneNumeros = Object.values(numerosEstado.semana).some(dia => dia.generado);
                btnConfirmar.disabled = !tieneNumeros;
            }
            showToast('Carpeta seleccionada correctamente', 'success');

        } else {
            showToast('No se seleccionó ninguna carpeta', 'error');
        }
    } catch (error) {
        console.error('Error seleccionando carpeta:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Función para generar semana completa
async function generarSemanaNumeros() {
    try {
        //showToast('Generando números para toda la semana.', 'info');

        const resultado = await window.electronAPI.generarNumerosSemana();

        if (resultado.success) {
            numerosGenerados = true;
            numerosEstado = resultado;

            // Actualizar UI
            actualizarWeekNumbersGrid(resultado.semana);
            actualizarEstadisticas(resultado.estadisticas);

            // Habilitar botón de confirmar si hay ruta
            const btnConfirmar = document.getElementById('btnConfirmNumbers');
            const rutaInput = document.getElementById('rutaGuardado');
            if (btnConfirmar && rutaInput) {
                btnConfirmar.disabled = !rutaInput.value;
            }

            showToast('Semana generada exitosamente', 'success');
        } else {
            showToast(`Error: ${resultado.errores?.join(', ')}`, 'error');
        }

    } catch (error) {
        console.error('Error generando semana:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Función para generar día específico
async function generarDiaNumeros(diaNombre) {
    try {
        const resultado = await window.electronAPI.generarNumerosDia(diaNombre);

        if (resultado.success) {
            // Recargar estado completo
            await cargarEstadoNumeros();
            showToast(`${diaNombre} generado correctamente`, 'success');
        } else {
            showToast(resultado.mensaje, 'error');
        }

    } catch (error) {
        console.error(`Error generando números para ${diaNombre}:`, error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Función para confirmar y guardar imágenes
async function confirmarYGuardarNumeros() {
    try {
        const rutaInput = document.getElementById('rutaGuardado');
        if (!rutaInput || !rutaInput.value) {
            showToast('Primero selecciona una ruta para guardar', 'error');
            return;
        }

        showToast('Generando imágenes. Esto puede tomar unos segundos.', 'info');
        const resultado = await window.electronAPI.guardarImagenesNumeros();

        if (resultado.success) {
            showToast('Imágenes generadas exitosamente', 'success');

            // Opcional: abrir carpeta
            if (confirm('¿Deseas abrir la carpeta con las imágenes generadas?')) {
                await window.electronAPI.abrirCarpeta(resultado.rutaBase);
            }

            // Limpiar estado después de guardar
            setTimeout(() => {
                limpiarEstadoNumeros();
                cancelarGeneradorNumeros();
            }, 3000);

        } else {
            showToast(resultado.mensaje, 'error');
        }

    } catch (error) {
        console.error('Error guardando imágenes:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// =============================================
// SISTEMA MEJORADO DE ACTUALIZACIONES
// =============================================

let updateModal = null;
let currentUpdateState = null;
let shouldShowUpdateModal = false; // Control para mostrar/ocultar

// Inicializar el modal
function initializeUpdateModal() {
  updateModal = document.getElementById('updateModal');
  if (!updateModal) return;

  // Configurar botones
  document.getElementById('closeUpdateModal').addEventListener('click', hideUpdateModal);
  document.getElementById('laterBtn').addEventListener('click', hideUpdateModal);
  document.getElementById('actionBtn').addEventListener('click', handleUpdateAction);
  document.getElementById('installBtn').addEventListener('click', () => {
    window.electronAPI.installUpdate();
  });

  // Cerrar al hacer clic fuera
  updateModal.addEventListener('click', (e) => {
    if (e.target === updateModal) {
      hideUpdateModal();
    }
  });
}

// Mostrar modal (SOLO si shouldShowUpdateModal es true)
function showUpdateModal(state = {}) {
  if (!updateModal) initializeUpdateModal();
  
  currentUpdateState = state;
  
  // SOLO mostrar para estos estados
  const showStates = ['available', 'downloaded', 'error', 'downloading'];
  shouldShowUpdateModal = showStates.includes(state.type);
  
  if (!shouldShowUpdateModal) {
    hideUpdateModal();
    return;
  }
  
  // Configurar según el estado
  switch(state.type) {
    case 'checking':
      // NO mostrar modal para checking
      return;
      
    case 'available':
      setUpdateModal('¡Nueva versión disponible!', 
                    `Versión ${state.version} está lista para descargar. ¿Deseas actualizar ahora?`,
                    'new_releases', 'available');
      hideProgress();
      hideInstallButton();
      showLaterButton();
      setActionButton('Descargar actualización', false, false);
      showVersionInfo(state.version);
      break;
      
    case 'downloaded':
      setUpdateModal('Actualización lista', 
                    'La nueva versión se ha descargado correctamente. Se instalará al reiniciar la aplicación.',
                    'check_circle', 'downloaded');
      hideProgress();
      hideLaterButton();
      showInstallButton();
      setActionButton('Reiniciar más tarde', false, false);
      break;
      
    case 'error':
      setUpdateModal('Error en actualización', 
                    state.message || 'Hubo un problema al buscar actualizaciones.',
                    'error', 'error');
      hideProgress();
      hideInstallButton();
      hideLaterButton();
      setActionButton('Reintentar', false, false);
      break;
      
    case 'updated':
      // NO mostrar modal, solo toast
      showToast('Ya tienes la versión más reciente', 'success');
      return;
  }
  
  updateModal.style.display = 'flex';
}

// Ocultar modal
function hideUpdateModal() {
  if (updateModal) {
    updateModal.style.display = 'none';
  }
}

// Configurar modal
function setUpdateModal(title, message, icon, stateClass) {
  document.getElementById('updateTitle').textContent = title;
  document.getElementById('updateMessage').textContent = message;
  document.getElementById('updateIcon').textContent = icon;
  
  // Remover todas las clases de estado
  updateModal.classList.remove('checking', 'available', 'downloading', 'downloaded', 'error', 'updated');
  // Agregar nueva clase
  updateModal.classList.add(stateClass);
}

// Configurar barra de progreso
function showUpdateProgress(progress) {
  // Cambiar estado a downloading si no está ya
  if (!updateModal.classList.contains('downloading')) {
    updateModal.classList.add('downloading');
    document.getElementById('updateIcon').textContent = 'download';
    document.getElementById('updateTitle').textContent = 'Descargando actualización';
    document.getElementById('updateMessage').textContent = `Descargando versión ${currentUpdateState?.version || 'nueva'}...`;
  }
  
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const speedText = document.getElementById('speedText');
  const transferredText = document.getElementById('transferredText');
  const totalText = document.getElementById('totalText');
  
  if (!progressContainer || !progressFill) return;
  
  // Mostrar contenedor
  progressContainer.style.display = 'block';
  
  // Actualizar porcentaje
  const percent = Math.round(progress.percent);
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
  
  // Calcular velocidad
  const speedMB = (progress.bytesPerSecond / 1024 / 1024).toFixed(1);
  speedText.textContent = `${speedMB} MB/s`;
  
  // Calcular tamaños
  const transferredMB = (progress.transferred / 1024 / 1024).toFixed(1);
  const totalMB = (progress.total / 1024 / 1024).toFixed(1);
  
  transferredText.textContent = `${transferredMB} MB`;
  totalText.textContent = `${totalMB} MB`;
  
  // Actualizar texto del botón
  setActionButton(`Descargando... ${percent}%`, true, true);
}

// Ocultar progreso
function hideProgress() {
  const progressContainer = document.getElementById('progressContainer');
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }
}

// Mostrar info de versión
function showVersionInfo(version) {
  const versionInfo = document.getElementById('versionInfo');
  const newVersion = document.getElementById('newVersion');
  
  if (versionInfo && newVersion) {
    newVersion.textContent = version;
    versionInfo.style.display = 'flex';
  }
}

// Configurar botón de acción
function setActionButton(text, disabled = false, loading = false) {
  const actionBtn = document.getElementById('actionBtn');
  const actionText = document.getElementById('actionText');
  const actionIcon = document.getElementById('actionIcon');
  
  if (actionBtn && actionText && actionIcon) {
    actionText.textContent = text;
    actionBtn.disabled = disabled;
    
    if (loading) {
      actionIcon.textContent = 'refresh';
      actionIcon.classList.add('spin');
    } else {
      actionIcon.textContent = text.includes('Descargar') ? 'download' : 'refresh';
      actionIcon.classList.remove('spin');
    }
  }
}

// Mostrar botón "Más tarde"
function showLaterButton() {
  const laterBtn = document.getElementById('laterBtn');
  if (laterBtn) laterBtn.style.display = 'flex';
}

// Ocultar botón "Más tarde"
function hideLaterButton() {
  const laterBtn = document.getElementById('laterBtn');
  if (laterBtn) laterBtn.style.display = 'none';
}

// Mostrar botón "Instalar"
function showInstallButton() {
  const installBtn = document.getElementById('installBtn');
  const actionBtn = document.getElementById('actionBtn');
  
  if (installBtn && actionBtn) {
    installBtn.style.display = 'flex';
    actionBtn.style.display = 'none';
  }
}

// Ocultar botón "Instalar"
function hideInstallButton() {
  const installBtn = document.getElementById('installBtn');
  const actionBtn = document.getElementById('actionBtn');
  
  if (installBtn && actionBtn) {
    installBtn.style.display = 'none';
    actionBtn.style.display = 'flex';
  }
}

// Manejar acción del botón principal
function handleUpdateAction() {
  if (!currentUpdateState) return;
  
  switch(currentUpdateState.type) {
    case 'available':
      // El auto-updater ya descarga automáticamente
      // Solo mostramos el progreso
      setActionButton('Descargando...', true, true);
      showToast('Iniciando descarga de la actualización...', 'info');
      break;
      
    case 'error':
      // Reintentar
      window.electronAPI.installUpdate();
      setActionButton('Reintentando...', true, true);
      break;
      
    default:
      hideUpdateModal();
  }
}

// Inicializar cuando el DOM cargue
document.addEventListener('DOMContentLoaded', function() {
  initializeUpdateModal();
  
  // Configurar listeners de actualizaciones
  if (window.electronAPI) {
    // Sistema nuevo - SOLO mostrar para estados importantes
    window.electronAPI.onUpdateStatus((data) => {
      console.log('Estado de actualización:', data.type);
      
      // Mostrar toast para estados no críticos
      if (data.type === 'checking') {
        showToast('Buscando actualizaciones...', 'info');
      } else if (data.type === 'updated') {
        showToast('Ya tienes la versión más reciente', 'success');
      }
      
      // Mostrar modal solo para estados importantes
      showUpdateModal(data);
    });
    
    window.electronAPI.onUpdateProgress((progress) => {
      // Asegurarnos de que el modal esté visible para downloading
      if (!shouldShowUpdateModal) {
        showUpdateModal({
          type: 'downloading',
          version: currentUpdateState?.version || 'nueva'
        });
      }
      
      showUpdateProgress(progress);
    });
    
    // Mantener compatibilidad con sistema antiguo
    window.electronAPI.onUpdateAvailable(() => {
      showUpdateModal({
        type: 'available',
        message: 'Se ha encontrado una nueva versión de la aplicación.',
        version: 'Nueva'
      });
    });
    
    window.electronAPI.onUpdateDownloaded(() => {
      showUpdateModal({
        type: 'downloaded',
        message: 'La actualización se ha descargado y está lista para instalar.',
        version: 'Nueva'
      });
    });
  }
  
  // Buscar actualizaciones silenciosamente al iniciar
  setTimeout(() => {
    console.log('Búsqueda silenciosa de actualizaciones...');
    // Esto activará los eventos pero no mostrará modales a menos que haya actualización
  }, 5000); // 5 segundos después de cargar
});
// Detectar si estamos en dark mode y aplicar clase al modal
function applyDarkModeToUpdateModal() {
  const isDarkMode = document.body.classList.contains('dark-mode');
  const updateModal = document.getElementById('updateModal');
  
  if (updateModal) {
    if (isDarkMode) {
      updateModal.classList.add('dark-mode');
    } else {
      updateModal.classList.remove('dark-mode');
    }
  }
}

// Llamar cuando cambie el tema
document.addEventListener('DOMContentLoaded', function() {
  applyDarkModeToUpdateModal();
  
  // Observar cambios en el tema
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'class') {
        applyDarkModeToUpdateModal();
      }
    });
  });
  
  observer.observe(document.body, { attributes: true });
});

// Agregar al inicializador principal
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        const btnConfirmar = document.getElementById('btnConfirmNumbers');
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
        }
    }, 1000);
});