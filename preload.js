
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Invokes
  selectFile: () => ipcRenderer.invoke("select-file"),
  programarEnvio: (payload) => ipcRenderer.invoke("programar-envio", payload),
  testEnvioInmediato: (payload) => ipcRenderer.invoke("test-envio-inmediato", payload),
  obtenerJobsProgramados: () => ipcRenderer.invoke("obtener-jobs-programados"),
  checkConnection: () => ipcRenderer.invoke("check-connection"),
  cerrarSesion: () => ipcRenderer.invoke('cerrar-sesion'),
  forzarNuevoQR: () => ipcRenderer.invoke('forzar-nuevo-qr'),
  // Events
  onQR: (callback) => ipcRenderer.on("qr", (_e, data) => callback(data)),
  onStatus: (callback) => ipcRenderer.on("status", (_e, data) => callback(data)),
  onConnected: (callback) => ipcRenderer.on("connected", (_e, data) => callback(data)),
  onHideQR: (callback) => ipcRenderer.on("hide-qr", () => callback()),

  //Update
  onUpdateStatus: (callback) => ipcRenderer.on("update-status", (_e, data) => callback(data)),
  onUpdateProgress: (callback) => ipcRenderer.on("update-progress", (_e, data) => callback(data)),

  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on("update-downloaded", callback),
  installUpdate: () => ipcRenderer.send("install-update"),

  // Notificaciones
  configurarNotificaciones: (grupo) => ipcRenderer.invoke('configurar-notificaciones', grupo),
  obtenerEstadoNotificaciones: () => ipcRenderer.invoke('obtener-estado-notificaciones'),

  cancelarJob: (jobId) => ipcRenderer.invoke("cancelar-job", jobId),
  onShowToast: (callback) => ipcRenderer.on('show-toast', callback),
  validarGrupos: (textoGrupos) => ipcRenderer.invoke('validar-grupos', textoGrupos),

  // Generar semana completa
  generarNumerosSemana: () => ipcRenderer.invoke('generar-numeros-semana'),

  // Generar día específico
  generarNumerosDia: (diaNombre) => ipcRenderer.invoke('generar-numeros-dia', diaNombre),

  // Obtener estado actual
  obtenerEstadoNumeros: () => ipcRenderer.invoke('obtener-estado-numeros'),

  // Establecer ruta
  establecerRutaNumeros: (ruta) => ipcRenderer.invoke('establecer-ruta-numeros', ruta),

  // Seleccionar carpeta (diálogo)
  seleccionarCarpetaNumeros: () => ipcRenderer.invoke('seleccionar-carpeta-numeros'),

  // Generar y guardar imágenes
  guardarImagenesNumeros: () => ipcRenderer.invoke('guardar-imagenes-numeros'),

  // Reiniciar generador
  reiniciarGeneradorNumeros: () => ipcRenderer.invoke('reiniciar-generador-numeros'),

  // Abrir carpeta (opcional)
  abrirCarpeta: (ruta) => ipcRenderer.invoke('abrir-carpeta', ruta),


});