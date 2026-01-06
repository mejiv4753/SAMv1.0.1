const { debugLog } = require('../../utils/helpers');

async function configurarChatNotificaciones(client, NOTIFICATION_CONFIG, nombreOGrupoId) {
  try {
    if (!client) {
      console.log("Cliente no listo para configurar notificaciones");
      return { success: false, message: "Cliente no conectado" };
    }

    const { findChatByGroupName } = require('../whatsapp/client');
    const chat = await findChatByGroupName(client, nombreOGrupoId);
    
    if (chat) {
      NOTIFICATION_CONFIG.chatNotificaciones = chat;
      NOTIFICATION_CONFIG.destino = {
        nombre: chat.name || "Usuario",
        id: chat.id._serialized,
        tipo: chat.isGroup ? "grupo" : "usuario"
      };
      NOTIFICATION_CONFIG.enabled = true;

      console.log(`Chat de notificaciones configurado: ${NOTIFICATION_CONFIG.destino.nombre} (${NOTIFICATION_CONFIG.destino.tipo})`);

      return {
        success: true,
        message: `Notificaciones configuradas para: ${NOTIFICATION_CONFIG.destino.nombre}`
      };
    } else {
      console.log(`No se pudo encontrar el chat: ${nombreOGrupoId}`);
      return { success: false, message: `No se encontró el chat: ${nombreOGrupoId}` };
    }
  } catch (error) {
    console.error("Error configurando chat de notificaciones:", error);
    return { success: false, message: error.message };
  }
}

async function enviarNotificacion(NOTIFICATION_CONFIG, mensaje, esError = false) {
  if (!NOTIFICATION_CONFIG.enabled || !NOTIFICATION_CONFIG.chatNotificaciones) {
    debugLog("Notificaciones desactivadas, mensaje no enviado: " + mensaje);
    return false;
  }

  try {
    const emoji = esError ? "❌" : "✅";
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour12: true
    });

    const mensajeCompleto = `${emoji} *SAM Notificaciones* ${emoji}\n` +
      `🕒 Activado: ${timestamp}\n` +
      `📝 ${mensaje}`;

    await NOTIFICATION_CONFIG.chatNotificaciones.sendMessage(mensajeCompleto);
    console.log(`Notificación enviada a ${NOTIFICATION_CONFIG.destino.nombre}`);
    return true;
  } catch (error) {
    console.error("Error enviando notificación:", error);
    return false;
  }
}

async function enviarResumenEnvios(NOTIFICATION_CONFIG, enviosExitosos, enviosFallidos, jobInfo = null) {
  if (!NOTIFICATION_CONFIG.enabled) {
    debugLog("Notificaciones desactivadas, resumen no enviado");
    return;
  }

  try {
    const total = enviosExitosos.length + enviosFallidos.length;

    let mensaje = `📊 *RESUMEN DE ENVÍOS*\n\n`;

    if (jobInfo) {
      mensaje += `📅 Ejecutado: ${new Date().toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        hour12: true
      })}\n`;
      
      if (jobInfo.imagen) {
        const nombreImagen = jobInfo.imagen.split(/[\\/]/).pop();
        mensaje += `🖼️ Imagen: ${nombreImagen}\n`;
      }
      
      if (jobInfo.mensaje && jobInfo.mensaje.trim() !== '') {
        mensaje += `Mensaje: ${jobInfo.mensaje.substring(0, 50)}${jobInfo.mensaje.length > 50 ? '...' : ''}\n`;
      }
      
      mensaje += `\n`;
    }

    mensaje += `✅ *Exitosos:* ${enviosExitosos.length}\n`;
    mensaje += `❌ *Fallidos:* ${enviosFallidos.length}\n`;
    mensaje += `📦 *Total:* ${total}\n`;

    // Mostrar grupos exitosos (solo si hay)
    if (enviosExitosos.length > 0) {
      mensaje += `\n*✅ Grupos exitosos:*\n`;
      enviosExitosos.forEach((exito, index) => {
        const grupoNombre = typeof exito === 'object' ? exito.grupo : exito;
        mensaje += `  ${index + 1}. ${grupoNombre}\n`;
      });
    }

    // Mostrar grupos fallidos (solo si hay)
    if (enviosFallidos.length > 0) {
      mensaje += `\n*❌ Grupos con error:*\n`;
      enviosFallidos.forEach((fallo, index) => {
        const grupoNombre = typeof fallo === 'object' ? fallo.grupo : fallo;
        const errorMsg = fallo.error || 'Error desconocido';
        mensaje += `  ${index + 1}. ${grupoNombre}\n     💬 ${errorMsg}\n`;
      });

      mensaje += `\n⚠️*Acciones recomendadas:*\n`;
      mensaje += `• Verificar nombres de grupos\n`;
      mensaje += `• Revisar conexión a Internet\n`;
      mensaje += `• Reintentar envíos fallidos\n`;
    } else if (total > 0) {
      mensaje += `\n🎉 *¡Todos los envíos fueron exitosos!*`;
    } else {
      mensaje = `📭 No hay envíos programados para ejecutar.`;
    }

    await enviarNotificacion(NOTIFICATION_CONFIG, mensaje);
  } catch (error) {
    console.error("Error enviando resumen:", error);
  }
}

function obtenerEstadoNotificaciones(NOTIFICATION_CONFIG) {
  return {
    enabled: NOTIFICATION_CONFIG.enabled,
    destino: NOTIFICATION_CONFIG.destino,
    chatConfigurado: !!NOTIFICATION_CONFIG.chatNotificaciones
  };
}

module.exports = {
  configurarChatNotificaciones,
  enviarNotificacion,
  enviarResumenEnvios,
  obtenerEstadoNotificaciones
};