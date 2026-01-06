const path = require("path");
const fs = require("fs").promises;
const schedule = require("node-schedule");

async function checkActiveSession(sessionPath) {
  try {
    await fs.access(sessionPath);
    const sessionFiles = await fs.readdir(sessionPath);
    
    if (sessionFiles.length === 0) {
      console.log("Sesión vacía o corrupta");
      return false;
    }

    console.log("Sesion activa y válida encontrada");
    return true;
  } catch (error) {
    return false;
  }
}

async function cerrarSesion(client, mainWindow, resultadosEnvios, sessionPath) {
  console.log("Cerrando sesión de WhatsApp...");

  try {
    // Detener todos los jobs programados
    const jobs = schedule.scheduledJobs;
    Object.keys(jobs).forEach(jobName => {
      console.log(`Cancelando job: ${jobName}`);
      schedule.cancelJob(jobName);
    });

    // Resetear acumulación de resultados
    resultadosEnvios.activo = false;
    resultadosEnvios.loteId = null;
    resultadosEnvios.enviosExitosos = [];
    resultadosEnvios.enviosFallidos = [];
    resultadosEnvios.jobInfo = null;
    
    if (resultadosEnvios.timeoutResumen) {
      clearTimeout(resultadosEnvios.timeoutResumen);
      resultadosEnvios.timeoutResumen = null;
    }

    // Cerrar y destruir el cliente
    if (client) {
      try {
        await client.logout();
        await client.destroy();
        console.log("Cliente de WhatsApp cerrado correctamente");
      } catch (error) {
        console.log("Error al cerrar cliente:", error.message);
      }
    }

    // Limpiar sesiones almacenadas
    try {
      await fs.rm(sessionPath, { recursive: true, force: true });
      console.log("Sesiones anteriores eliminadas");
    } catch (error) {
      console.log("No se pudieron eliminar sesiones:", error.message);
    }

    // Notificar a la ventana
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("status", "🔒 Sesión cerrada correctamente");
      mainWindow.webContents.send("connected", false);
      mainWindow.webContents.send("show-qr");
    }

    console.log("Sesión cerrada completamente");
    return { success: true, message: "Sesión cerrada correctamente. Reiniciando conexión." };

  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    return { success: false, message: "Error: " + error.message };
  }
}

module.exports = {
  checkActiveSession,
  cerrarSesion
};