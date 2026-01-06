const path = require("path");
const { createWhatsAppClient, setupClientEvents, checkClientReady, findChatByGroupName } = require('./client');
const { checkActiveSession, cerrarSesion } = require('./auth');
const { debugLog } = require('../../utils/helpers');

class WhatsAppManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.client = null;
    this.isClientReady = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.isInitializing = false;
    this.qrGenerated = false;
    this.hasActiveSession = false;
    this.sessionPath = path.join(__dirname, '../../../../.wwebjs_auth', 'session-whatsapp-bot-persistente');
  }

  async initialize() {

    if (this.isInitializing && !this.forceReinitialize) {
      console.log("Ya se está inicializando, evitando duplicado.");
      return;
    }

    this.isInitializing = true;
    this.forceReinitialize = false; // Resetear flag

    console.log("Inicializando WhatsApp.");

    try {
      const hasSession = await checkActiveSession(this.sessionPath);

      if (hasSession) {
        console.log("Sesión activa encontrada, reconectando.");
        await this.initWhatsApp();
      } else {
        console.log("No hay sesión activa, iniciando flujo de QR.");
        await this.initWhatsApp();
      }
    } catch (error) {
      console.error("Error en inicialización:", error);
      this.attemptReconnection();
    } finally {
      this.isInitializing = false;
    }
  }

  async initWhatsApp() {
    console.log("Inicializando WhatsApp.");
    debugLog("Inicializando cliente WhatsApp");

    if (!this.client) {
      this.client = createWhatsAppClient();

      const callbacks = {
        onQr: (qr) => {
          console.log("QR generado");
          this.reconnectAttempts = 0;
          this.isAuthenticated = false;
          this.isClientReady = false;
          this.qrGenerated = true;

          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send("qr", qr);
            this.mainWindow.webContents.send("status", "📱 Escanea el código QR con WhatsApp");
          }
        },

        onAuthenticated: () => {
          console.log("Autenticación exitosa");
          this.reconnectAttempts = 0;
          this.isAuthenticated = true;
          if (this.mainWindow) this.mainWindow.webContents.send("show-toast", {
            message: "Sesión iniciada correctamente",
            type: "success"
          });
        },

        onReady: async () => {
          console.log("WhatsApp listo y conectado");
          this.isClientReady = true;
          this.reconnectAttempts = 0;
          this.qrGenerated = false;
          this.hasActiveSession = true;

          if (this.mainWindow) {
            // this.mainWindow.webContents.send("show-toast", "✅ WhatsApp conectado y listo");
            this.mainWindow.webContents.send("show-toast", {
              message: "WhatsApp conectado y listo",
              type: "success"
            });
            this.mainWindow.webContents.send("connected", true);
            this.mainWindow.webContents.send("hide-qr");
          }

          // Listar todos los chats disponibles para debug
          try {
            const chats = await this.client.getChats();
            debugLog("Chats disponibles:");
            chats.slice(0, 15).forEach(chat => {
              debugLog(`- ${chat.name || 'Sin nombre'} (ID: ${chat.id._serialized})`);
            });

            console.log(`Total de chats cargados: ${chats.length}`);
            if (chats.length > 0) {
              console.log("Chats cargados correctamente, listo para enviar mensajes");
              this.mainWindow.webContents.send("status", "✅ Ya se pueden programar envíos");
              this.mainWindow.webContents.send("show-toast", {
                message: "Ya puedes programar envíos",
                type: "success"
              });
            } else {
              console.log("No se cargaron chats, puede haber problemas");
            }
          } catch (error) {
            console.error("Error obteniendo chats:", error);
          }
        },

        onStateChange: (state) => {
          console.log("Estado cambiado:", state);
          this.isClientReady = state === "CONNECTED";
          debugLog(`Estado del cliente: ${state}`);
        },

        onAuthFailure: (msg) => {
          console.error("Fallo de autenticación:", msg);
          this.isClientReady = false;
          this.isAuthenticated = false;
          this.hasActiveSession = false;
          if (this.mainWindow) this.mainWindow.webContents.send("status", "Error de autenticación");
          this.attemptReconnection();
        },

        onError: (error) => {
          console.error("Error de WhatsApp:", error.message);
          this.isClientReady = false;
          if (this.mainWindow) this.mainWindow.webContents.send("status", "Error de conexión: " + error.message);
          this.attemptReconnection();
        },

        onDisconnected: (reason) => {
          console.log("Cliente desconectado:", reason);
          this.isClientReady = false;
          this.isAuthenticated = false;
          this.qrGenerated = false;
          this.hasActiveSession = false;

          if (this.mainWindow) {
            // this.mainWindow.webContents.send("status", "🔌 Sesión desconectada");
            this.mainWindow.webContents.send("show-toast", {
              message: "Sesión desconectada",
              type: warning
            });
            this.mainWindow.webContents.send("connected", false);
          }

          this.attemptReconnection();
        }
      };

      await setupClientEvents(this.client, this.mainWindow, callbacks);
    }

    try {
      await this.client.initialize();
      console.log("Cliente inicializado");
      debugLog("Cliente WhatsApp inicializado");
    } catch (error) {
      console.error("Error inicializando:", error);
      this.attemptReconnection();
    }
  }

  attemptReconnection() {
    // Resetear si se fuerza nuevo QR
    if (this.forceReinitialize) {
      this.reconnectAttempts = 0;
      return;
    }

    const { MAX_RECONNECT_ATTEMPTS } = require('../../utils/constants');

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("Máximo de intentos de reconexión alcanzado");
      if (this.mainWindow) {
        this.mainWindow.webContents.send("status", "Conexión fallida. Usa 'Nuevo QR' para reintentar.");
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(10000, this.reconnectAttempts * 2000);
    console.log(`Intentando reconexión #${this.reconnectAttempts} en ${delay / 1000}s`);

    if (this.mainWindow) {
      this.mainWindow.webContents.send("status", `Reconectando. Intento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    }

    this.reconnectTimeout = setTimeout(() => this.initWhatsApp(), delay);
  }

  async cerrarSesion(resultadosEnvios) {
    return await cerrarSesion(this.client, this.mainWindow, resultadosEnvios, this.sessionPath);
  }

  // async forzarNuevoQR(resultadosEnvios) {
  //   const fs = require("fs").promises;

  //   try {
  //     console.log("Forzando nuevo QR.");

  //     // 1. Cancelar cualquier reconexión programada
  //     if (this.reconnectTimeout) {
  //       clearTimeout(this.reconnectTimeout);
  //       this.reconnectTimeout = null;
  //     }

  //     // 2. Destruir cliente si existe
  //     if (this.client) {
  //       await this.client.destroy();
  //       this.client = null;
  //     }

  //     // 3. Resetear estado COMPLETO
  //     this.isClientReady = false;
  //     this.isAuthenticated = false;
  //     this.qrGenerated = false;
  //     this.hasActiveSession = false;
  //     this.isInitializing = false;
  //     this.reconnectAttempts = 0; // ← IMPORTANTE: Resetear intentos

  //     // 4. Resetear acumulación de resultados
  //     if (resultadosEnvios) {
  //       resultadosEnvios.activo = false;
  //       resultadosEnvios.loteId = null;
  //       resultadosEnvios.enviosExitosos = [];
  //       resultadosEnvios.enviosFallidos = [];
  //       resultadosEnvios.jobInfo = null;
  //       if (resultadosEnvios.timeoutResumen) {
  //         clearTimeout(resultadosEnvios.timeoutResumen);
  //         resultadosEnvios.timeoutResumen = null;
  //       }
  //     }

  //     // 5. Limpiar sesión
  //     try {
  //       await fs.rm(this.sessionPath, { recursive: true, force: true });
  //       console.log("Sesión limpiada para nuevo QR");
  //     } catch (error) {
  //       console.log("No se pudo limpiar sesión:", error.message);
  //     }

  //     // 6. Pequeño delay para asegurar limpieza, luego inicializar
  //     setTimeout(async () => {
  //       await this.initialize();
  //     }, 1000);

  //     return { success: true, message: "Solicitando nuevo QR." };
  //   } catch (error) {
  //     console.error("Error forzando nuevo QR:", error);
  //     return { success: false, message: "Error: " + error.message };
  //   }
  // }
  async forzarNuevoQR(resultadosEnvios) {
  const fs = require("fs").promises;

  try {
    console.log("Forzando nuevo QR.");

    // 1. Cancelar cualquier reconexión programada
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // 2. Destruir cliente si existe
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }

    // 3. Resetear estado COMPLETO
    this.isClientReady = false;
    this.isAuthenticated = false;
    this.qrGenerated = false;
    this.hasActiveSession = false;
    this.isInitializing = false;
    this.reconnectAttempts = 0;

    // 4. Resetear acumulación de resultados
    if (resultadosEnvios) {
      resultadosEnvios.activo = false;
      resultadosEnvios.loteId = null;
      resultadosEnvios.enviosExitosos = [];
      resultadosEnvios.enviosFallidos = [];
      resultadosEnvios.jobInfo = null;
      // ⭐ NOTA: Ya no manejamos timeoutResumen aquí
      // El JobExecutor maneja sus propios timeouts
    }

    // 5. Limpiar sesión
    try {
      await fs.rm(this.sessionPath, { recursive: true, force: true });
      console.log("Sesión limpiada para nuevo QR");
    } catch (error) {
      console.log("No se pudo limpiar sesión:", error.message);
    }

    // 6. Pequeño delay para asegurar limpieza, luego inicializar
    setTimeout(async () => {
      await this.initialize();
    }, 1000);

    return { success: true, message: "Solicitando nuevo QR." };
  } catch (error) {
    console.error("Error forzando nuevo QR:", error);
    return { success: false, message: "Error: " + error.message };
  }
}
  getClient() {
    return this.client;
  }

  getStatus() {
    return {
      isClientReady: this.isClientReady,
      isAuthenticated: this.isAuthenticated,
      qrGenerated: this.qrGenerated,
      hasActiveSession: this.hasActiveSession
    };
  }

  async checkClientReady() {
    return await checkClientReady(this.client);
  }

  async findChatByGroupName(grupo) {
    return await findChatByGroupName(this.client, grupo);
  }

  cleanup() {
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) {
        console.error("Error limpiando cliente:", e);
      }
    }
  }
}

module.exports = WhatsAppManager;