// const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

// function createWhatsAppClient() {
//   return new Client({
//     authStrategy: new LocalAuth({ clientId: "whatsapp-bot-persistente" }),
//     puppeteer: {
//       headless: true,
//       args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
//     },
//     restartOnAuthFail: true,
//   });
// }
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const path = require("path");
function createWhatsAppClient() {
  const { Client, LocalAuth } = require("whatsapp-web.js");
  const path = require("path");
  
  console.log("🔧 Creando cliente WhatsApp...");

  // =============================================
  // CONFIGURACIÓN BÁSICA
  // =============================================
  const puppeteerConfig = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox", 
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--disable-features=site-per-process",
      "--no-zygote",
      "--disable-software-rasterizer",
      "--disable-background-timer-throttling"
    ]
  };

  const authConfig = {
    clientId: "whatsapp-bot-persistente"
  };

  // =============================================
  // CONFIGURACIÓN ESPECÍFICA PARA TU RUTA
  // =============================================
  try {
    const electron = require('electron');
    const fs = require('fs');
    
    console.log("🔍 Electron detectado");
    
    if (electron.app.isPackaged) {
      console.log("🚀 MODO PRODUCCIÓN: Configurando para app empaquetada");

      // 1. RUTA DE AUTENTICACIÓN
      authConfig.dataPath = path.join(
        electron.app.getPath('userData'),
        'wwebjs_auth'
      );
      console.log(`📁 Sesión en: ${authConfig.dataPath}`);

      // 2. 🔥 RUTA EXACTA DE CHROME.EXE (YA LA SABEMOS)
      const chromePath = path.join(
        process.resourcesPath, 
        'chrome-win', 
        'chrome.exe'
      );
      
      console.log(`📍 Ruta configurada: ${chromePath}`);
      
      // Verificar si existe
      if (fs.existsSync(chromePath)) {
        puppeteerConfig.executablePath = chromePath;
        console.log(`✅ Chromium verificado: ${chromePath}`);
        
        // Verificar tamaño del archivo
        const stats = fs.statSync(chromePath);
        console.log(`📏 Tamaño de chrome.exe: ${(stats.size / (1024*1024)).toFixed(2)} MB`);
      } else {
        console.error(`❌ ERROR: chrome.exe NO encontrado en: ${chromePath}`);
        console.log("💡 Verifica que la carpeta chrome-win contiene:");
        console.log("   • chrome.exe");
        console.log("   • *.dll files");
        console.log("   • resources/ folder");
        
        // Listar contenido de la carpeta para debugging
        const chromeDir = path.join(process.resourcesPath, 'chrome-win');
        if (fs.existsSync(chromeDir)) {
          console.log("📂 Contenido de chrome-win:");
          try {
            const files = fs.readdirSync(chromeDir);
            files.slice(0, 10).forEach(file => console.log(`   • ${file}`));
          } catch (err) {
            console.log("   No se pudo listar contenido");
          }
        }
      }
    } else {
      console.log("✅ MODO DESARROLLO - Usando Chromium de Puppeteer");
    }
  } catch (error) {
    console.log("⚠️ Error detectando entorno:", error.message);
  }

  console.log("⚙️ Config Puppeteer:", {
    headless: puppeteerConfig.headless,
    executablePath: puppeteerConfig.executablePath || 'Por defecto',
    argsCount: puppeteerConfig.args.length
  });

  // =============================================
  // CREAR CLIENTE
  // =============================================
  const client = new Client({
    authStrategy: new LocalAuth(authConfig),
    puppeteer: puppeteerConfig,
    restartOnAuthFail: true,
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
  });

  console.log("🎉 Cliente WhatsApp creado");
  return client;
}

async function setupClientEvents(client, mainWindow, callbacks) {
  const {
    onQr,
    onAuthenticated,
    onReady,
    onStateChange,
    onAuthFailure,
    onError,
    onDisconnected
  } = callbacks;

  client.on("qr", (qr) => {
    console.log("QR generado");
    onQr(qr);
  });

  client.on("authenticated", () => {
    console.log("Autenticacion exitosa");
    onAuthenticated();
  });

  client.on("ready", () => {
    console.log("WhatsApp listo y conectado");
    onReady();
  });

  client.on("change_state", (state) => {
    console.log("Estado cambiado:", state);
    onStateChange(state);
  });

  client.on("auth_failure", (msg) => {
    console.error("Fallo de autenticacion:", msg);
    onAuthFailure(msg);
  });

  client.on("error", (error) => {
    console.error("Error de WhatsApp:", error.message);
    onError(error);
  });

  client.on("disconnected", (reason) => {
    console.log("🔌 Cliente desconectado:", reason);
    onDisconnected(reason);
  });
}

async function findChatByGroupName(client, grupo) {
  try {
    const chats = await client.getChats();

    // Buscar por nombre exacto (case insensitive)
    let chat = chats.find(c =>
      c.name && c.name.toLowerCase().trim() === grupo.toLowerCase().trim()
    );

    // Buscar por ID si el grupo parece ser un ID
    if (!chat && grupo.includes('@g.us')) {
      chat = chats.find(c => c.id._serialized === grupo);
    }

    if (chat) {
      console.log(`Chat encontrado: "${chat.name}" (${chat.id._serialized})`);
    } else {
      console.log(`Chat no encontrado: "${grupo}"`);
      console.log("Chats disponibles (primeros 10):");
      chats.slice(0, 10).forEach(c => {
        console.log(`- "${c.name || 'Sin nombre'}" (${c.id._serialized})`);
      });
    }

    return chat;
  } catch (error) {
    console.error("Error buscando chat:", error);
    return null;
  }
}

async function checkClientReady(client) {
  if (!client) {
    console.log("Cliente no inicializado");
    return false;
  }

  try {
    const state = await client.getState();
    const isConnected = state === 'CONNECTED';

    if (!isConnected) {
      console.log(`Estado del cliente: ${state}`);
    } else {
      console.log("Cliente verdaderamente CONNECTED");
    }

    return isConnected;
  } catch (error) {
    console.log("Error verificando estado del cliente:", error.message);
    return false;
  }
}

module.exports = {
  createWhatsAppClient,
  setupClientEvents,
  findChatByGroupName,
  checkClientReady
};