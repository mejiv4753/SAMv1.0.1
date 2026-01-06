// =============================================
// IMPORTAR MÓDULOS
// =============================================
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

// Importar módulos propios
const WhatsAppManager = require('./src/backend/modules/whatsapp/whatsapp-manager');
const { setupIpcHandlers } = require('./src/backend/modules/ipc/ipc-handlers');
const JobExecutor = require('./src/backend/modules/scheduler/job-executor');

const { 
  MAX_RECONNECT_ATTEMPTS, 
  DEBUG, 
  NOTIFICATION_CONFIG, 
  RESULTADOS_ENVIOS 
} = require('./src/backend/utils/constants');
const { debugLog, debugTimezone, shuffleArray } = require('./src/backend/utils/helpers');

// =============================================
// VARIABLES GLOBALES
// =============================================
let mainWindow;
let whatsappManager;
let jobExecutor;

// Arrays compartidos
let pendingJobs = [];
let scheduledJobs = [];

// =============================================
// CONFIGURACIÓN DE VENTANA
// =============================================
// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 900,
//     height: 700,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       preload: path.join(__dirname, "preload.js"),
//     },
//   });

//   // Cargar el frontend desde la nueva ubicación
//   mainWindow.loadFile(path.join(__dirname, "src/frontend/index.html"));

//   // Revisar actualizaciones automáticamente
//   autoUpdater.checkForUpdatesAndNotify();
// }
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src/frontend/index.html"));

  // Revisar actualizaciones después de que la ventana cargue
  mainWindow.webContents.on('did-finish-load', () => {
    console.log("🚀 Ventana cargada, buscando actualizaciones...");
    
    // Esperar 3 segundos antes de buscar actualizaciones
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 3000);
  });
}

// =============================================
// CONFIGURACIÓN DE AUTO-UPDATER
// =============================================
// autoUpdater.on("update-available", () => {
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     mainWindow.webContents.send("update-available");
//   }
// });

// autoUpdater.on("update-downloaded", () => {
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     mainWindow.webContents.send("update-downloaded");
//   }
// });

// ipcMain.on("install-update", () => {
//   autoUpdater.quitAndInstall();
// });
// Configuración del auto-updater
autoUpdater.autoDownload = true; // ✅ Descargar automáticamente
autoUpdater.autoInstallOnAppQuit = true; // ✅ Instalar al cerrar
// =============================================
// EVENTOS DEL AUTO-UPDATER
// =============================================

// autoUpdater.on("checking-for-update", () => {
//   console.log("🔍 Buscando actualizaciones...");
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     mainWindow.webContents.send("status", "🔍 Buscando actualizaciones...");
//   }
// });
autoUpdater.on("checking-for-update", () => {
  console.log("🔍 Buscando actualizaciones...");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", {
      type: "checking",
      message: "Buscando actualizaciones..."
    });
  }
});

// autoUpdater.on("update-available", (info) => {
//   console.log("✅ Actualización disponible:", info.version);
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     mainWindow.webContents.send("update-available");
//     mainWindow.webContents.send("status", `📦 Nueva versión disponible: ${info.version}`);
//   }
// });
autoUpdater.on("update-available", (info) => {
  console.log("✅ Actualización disponible:", info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", {
      type: "available",
      message: `Nueva versión ${info.version} disponible`,
      version: info.version
    });
  }
});

// autoUpdater.on("update-not-available", (info) => {
//   console.log("✅ La aplicación está actualizada:", info.version);
// });
autoUpdater.on("update-not-available", (info) => {
  console.log("La aplicación está actualizada");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", {
      type: "updated",
      message: "Tienes la versión más reciente"
    });
  }
});


// autoUpdater.on("error", (err) => {
//   console.error("❌ Error en auto-updater:", err);
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     mainWindow.webContents.send("status", "❌ Error al buscar actualizaciones");
//   }
// });
autoUpdater.on("error", (err) => {
  console.error("Error en auto-updater:", err);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", {
      type: "error",
      message: `Error: ${err.message}`
    });
  }
});

// autoUpdater.on("download-progress", (progressObj) => {
//   let message = `⏬ Descargando: ${Math.round(progressObj.percent)}%`;
//   console.log(message);
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     mainWindow.webContents.send("status", message);
//   }
// });
autoUpdater.on("download-progress", (progressObj) => {
  console.log(`Descarga: ${progressObj.percent.toFixed(1)}%`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-progress", {
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  }
});

// autoUpdater.on("update-downloaded", (info) => {
//   console.log("✅ Actualización descargada:", info.version);
//   if (mainWindow && !mainWindow.isDestroyed()) {
//     mainWindow.webContents.send("update-downloaded");
//     mainWindow.webContents.send("status", "✅ Actualización lista para instalar");
//   }
// });
autoUpdater.on("update-downloaded", (info) => {
  console.log("Actualización descargada:", info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", {
      type: "downloaded",
      message: "Actualización lista para instalar",
      version: info.version
    });
  }
});

// Handler para instalar actualización
ipcMain.on("install-update", () => {
  console.log("Instalando actualización y reiniciando...");
  autoUpdater.quitAndInstall(false, true);
});

// =============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =============================================
function initializeApp() {
    console.log("=== INICIANDO APLICACIÓN ===");
  
  // LOGS DE DIAGNÓSTICO (TEMPORAL)
  console.log("Información del entorno:");
  console.log("  • Directorio actual:", __dirname);
  console.log("  • Ruta recursos:", process.resourcesPath);
  console.log("  • Modo desarrollo:", process.env.NODE_ENV === 'development');
  
  try {
    const { app } = require('electron');
    console.log("  • App empaquetada:", app.isPackaged);
    console.log("  • Ruta ejecutable:", app.getPath('exe'));
    console.log("  • Ruta userData:", app.getPath('userData'));
  } catch (error) {
    console.log("  • ❌ No se pudo cargar electron.app");
  }
  
  console.log("========================================");
  console.log("App lista");
  debugTimezone();
  
  // Inicializar gestores
  setupManagers();
  
  // Configurar handlers IPC
  setupIpc();
  
  // Configurar tareas periódicas
  setupPeriodicTasks();

  // Pequeño delay para que la ventana se cargue completamente
  setTimeout(() => {
    whatsappManager.initialize();
  }, 1000);
}

// function setupManagers() {
//   // Inicializar gestor de WhatsApp
//   whatsappManager = new WhatsAppManager(mainWindow);
  
//   // Inicializar ejecutor de jobs
//   jobExecutor = new JobExecutor(
//     () => whatsappManager.getClient(),
//     RESULTADOS_ENVIOS,
//     NOTIFICATION_CONFIG
    
//   );
//   jobExecutor.setPendingJobs(pendingJobs);
// }
// main.js - MODIFICAR setupManagers
function setupManagers() {
  whatsappManager = new WhatsAppManager(mainWindow);
  
  
  jobExecutor = new JobExecutor(
    () => whatsappManager.getClient(),
    RESULTADOS_ENVIOS,
    NOTIFICATION_CONFIG,
    mainWindow // ✅ PASAR mainWindow AQUÍ
  );
  jobExecutor.setPendingJobs(pendingJobs);
}

function setupIpc() {
  setupIpcHandlers(ipcMain, dialog, {
    mainWindow: mainWindow,
    whatsappManager: whatsappManager,
    jobExecutor: jobExecutor,
    scheduledJobs: scheduledJobs,
    NOTIFICATION_CONFIG: NOTIFICATION_CONFIG,
    shuffleArray: shuffleArray
  });
}

function setupPeriodicTasks() {
  // Revisar trabajos pendientes cada 10s
  setInterval(() => {
    if (jobExecutor.getPendingJobs().length > 0) {
      console.log(`⏳ Jobs pendientes: ${jobExecutor.getPendingJobs().length}`);
      jobExecutor.getPendingJobs().forEach(job => {
        console.log(`   - ${job.jobId} (intentos: ${job.attempts})`);
      });
      jobExecutor.executePendingJobs();
    }
  }, 10000);

  // Verificar jobs programados cada minuto
  setInterval(() => {
    const { listScheduledJobs } = require('./src/backend/modules/scheduler/job-manager');
    listScheduledJobs();
  }, 60000);
}

// =============================================
// MANEJADORES DE EVENTOS DE ELECTRON
// =============================================
app.whenReady().then(() => {
  createWindow();
  initializeApp();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Limpiar recursos antes de salir
    if (whatsappManager) {
      whatsappManager.cleanup();
    }
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    initializeApp();
  }
});

// =============================================
// DETECCIÓN DE ZONA HORARIA (INFO)
// =============================================
const TIMEZONE_OFFSET = new Date().getTimezoneOffset() / 60;
console.log(`Zona horaria detectada: GMT${TIMEZONE_OFFSET > 0 ? '-' : '+'}${Math.abs(TIMEZONE_OFFSET)}`);