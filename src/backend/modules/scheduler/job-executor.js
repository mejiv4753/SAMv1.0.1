const fs = require("fs").promises;
const { MessageMedia } = require("whatsapp-web.js");
const { debugLog } = require('../../utils/helpers');

class JobExecutor {
  constructor(getClient, resultadosEnvios, NOTIFICATION_CONFIG, mainWindow) {
    this.getClient = getClient;
    this.resultadosEnvios = resultadosEnvios;
    this.NOTIFICATION_CONFIG = NOTIFICATION_CONFIG;
    this.mainWindow = mainWindow;
    this.isExecutingJobs = false;
    this.pendingJobs = [];
    this.lotesActivos = new Map();
    this.jobsPorLote = new Map();     // NUEVO: Para trackear jobs por lote
    this.timeoutsSeguridad = new Map(); // NUEVO: Para timeouts de seguridad
  }

  // iniciarAcumulacionResultados(loteId, jobInfo) {
  //   // Iniciar o reutilizar acumulación para este lote
  //   if (!this.lotesActivos.has(loteId)) {
  //     this.lotesActivos.set(loteId, {
  //       loteId: loteId,
  //       jobInfo: jobInfo,
  //       enviosExitosos: [],
  //       enviosFallidos: [],
  //       timeoutResumen: null,
  //       ultimoEnvio: Date.now()
  //     });

  //     console.log(`Iniciando acumulación para nuevo lote: ${loteId}`);
  //   } else {
  //     console.log(`Continuando acumulación para lote existente: ${loteId}`);
  //   }
  // }
  iniciarAcumulacionResultados(loteId, jobInfo, totalJobs = 0) {
    // Iniciar o reutilizar acumulación para este lote
    if (!this.lotesActivos.has(loteId)) {
      this.lotesActivos.set(loteId, {
        loteId: loteId,
        jobInfo: jobInfo,
        enviosExitosos: [],
        enviosFallidos: [],
        timeoutSeguridad: null,  // Renombrado para claridad
        ultimoEnvio: Date.now()
      });

      console.log(`Iniciando acumulación para nuevo lote: ${loteId}`);

      // PROGRAMAR TIMEOUT DE SEGURIDAD ÚNICO
      const tiempoSeguridad = this.calcularTimeoutSeguridad(totalJobs);

      const timeoutId = setTimeout(() => {
        console.log(`⏰ TIMEOUT DE SEGURIDAD disparado para lote: ${loteId}`);
        this.forzarResumenInmediato(loteId);
      }, tiempoSeguridad);

      this.timeoutsSeguridad.set(loteId, timeoutId);
      console.log(`Timeout de seguridad programado: ${tiempoSeguridad / 1000}s para lote ${loteId}`);
    } else {
      console.log(`Continuando acumulación para lote existente: ${loteId}`);
    }
  }

  // NUEVO MÉTODO: Calcular timeout de seguridad
  calcularTimeoutSeguridad(totalJobs) {
    // Fórmula: (10 segundos por job) + (30 segundos extra)
    const base = totalJobs * 6000; // 10 segundos por job
    const minimo = 60000; // Mínimo 60 segundos
    const extra = 10000; // 30 segundos extra

    return Math.max(base + extra, minimo);
  }
  async agregarResultadoYVerificar(envioExitoso, grupo, error = null,
    jobInfo = null, loteId = null, jobId = null) {
    if (!loteId) {
      console.error("loteId no proporcionado para acumulación");
      return;
    }

    const lote = this.lotesActivos.get(loteId);
    if (!lote) {
      console.error(`Lote no encontrado: ${loteId}`);
      return;
    }

    // AGREGAR RESULTADO (igual que antes)
    if (envioExitoso) {
      lote.enviosExitosos.push({
        grupo: grupo,
        tipo: "exitoso"
      });
      console.log(`Resultado agregado - Éxito: ${grupo} | Lote: ${loteId}`);
    } else {
      lote.enviosFallidos.push({
        grupo: grupo,
        error: error || "Error desconocido"
      });
      console.log(`Resultado agregado - Fallo: ${grupo} - ${error} | Lote: ${loteId}`);
    }

    lote.ultimoEnvio = Date.now();

    // ✅ NUEVA LÓGICA: VERIFICAR SI TODOS LOS JOBS ESTÁN PROCESADOS
    if (jobId && this.jobsPorLote.has(loteId)) {
      const jobsDelLote = this.jobsPorLote.get(loteId);

      // MARCAR ESTE JOB COMO PROCESADO
      jobsDelLote.delete(jobId);

      console.log(`📊 Job ${jobId} procesado. Pendientes en lote ${loteId}: ${jobsDelLote.size}`);

      // VERIFICAR SI TODOS LOS JOBS DEL LOTE FUERON PROCESADOS
      if (jobsDelLote.size === 0) {
        console.log(`✅ TODOS los jobs del lote ${loteId} completados! Enviando resumen inmediato.`);

        // CANCELAR TIMEOUT DE SEGURIDAD
        this.cancelarTimeoutSeguridad(loteId);

        // LIMPIAR TRACKING
        this.jobsPorLote.delete(loteId);

        // ENVIAR RESUMEN
        this.enviarResumenFinal(loteId);
      }
    }
  }

  // NUEVO MÉTODO: Cancelar timeout de seguridad
  cancelarTimeoutSeguridad(loteId) {
    if (this.timeoutsSeguridad.has(loteId)) {
      clearTimeout(this.timeoutsSeguridad.get(loteId));
      this.timeoutsSeguridad.delete(loteId);
      console.log(`🔄 Timeout de seguridad cancelado para lote ${loteId}`);
    }
  }
  // async agregarResultadoYVerificar(envioExitoso, grupo, error = null, jobInfo = null, loteId = null) {
  //   if (!loteId) {
  //     console.error("loteId no proporcionado para acumulación");
  //     return;
  //   }

  //   const lote = this.lotesActivos.get(loteId);
  //   if (!lote) {
  //     console.error(`Lote no encontrado: ${loteId}`);
  //     return;
  //   }

  //   if (envioExitoso) {
  //     lote.enviosExitosos.push({ 
  //       grupo: grupo,
  //       tipo: "exitoso"
  //     });
  //     console.log(`Resultado agregado - Éxito: ${grupo} | Lote: ${loteId}`);
  //   } else {
  //     lote.enviosFallidos.push({ 
  //       grupo: grupo, 
  //       error: error || "Error desconocido"
  //     });
  //     console.log(`Resultado agregado - Fallo: ${grupo} - ${error} | Lote: ${loteId}`);
  //   }

  //   lote.ultimoEnvio = Date.now();

  //   // Programar envío de resumen (con delay para acumular más resultados)
  //   if (lote.timeoutResumen) {
  //     clearTimeout(lote.timeoutResumen);
  //   }

  //   lote.timeoutResumen = setTimeout(() => {
  //     this.enviarResumenFinal(loteId);
  //   }, 5000); // Esperar 5 segundos después del último envío
  // }
  async enviarResumenFinal(loteId) {
    // CANCELAR TIMEOUT DE SEGURIDAD SI EXISTE
    this.cancelarTimeoutSeguridad(loteId);

    const lote = this.lotesActivos.get(loteId);
    if (!lote) {
      console.log(`No se encontró el lote para resumen: ${loteId}`);
      return;
    }

    const { enviosExitosos, enviosFallidos, jobInfo } = lote;
    const total = enviosExitosos.length + enviosFallidos.length;

    if (total > 0) {
      console.log(`\n========== RESUMEN FINAL ==========`);
      console.log(`Lote: ${loteId}`);
      console.log(`Total procesado: ${total}`);
      console.log(`Exitosos: ${enviosExitosos.length}`);
      console.log(`Fallidos: ${enviosFallidos.length}`);
      console.log(`=====================================\n`);

      // Enviar notificación de resumen
      const { enviarResumenEnvios } = require('../notifications/notification-manager');
      await enviarResumenEnvios(this.NOTIFICATION_CONFIG, enviosExitosos, enviosFallidos, jobInfo);
    } else {
      console.log(`Lote ${loteId} sin resultados para resumen`);
    }

    // Limpiar lote después de enviar resumen
    this.lotesActivos.delete(loteId);
    console.log(`Lote ${loteId} finalizado y limpiado`);
  }
  // async enviarResumenFinal(loteId) {
  //   const lote = this.lotesActivos.get(loteId);
  //   if (!lote) {
  //     console.log(`No se encontró el lote para resumen: ${loteId}`);
  //     return;
  //   }

  //   const { enviosExitosos, enviosFallidos, jobInfo } = lote;
  //   const total = enviosExitosos.length + enviosFallidos.length;

  //   if (total > 0) {
  //     console.log(`\n========== RESUMEN FINAL ==========`);
  //     console.log(`Lote: ${loteId}`);
  //     console.log(`Total procesado: ${total}`);
  //     console.log(`Exitosos: ${enviosExitosos.length}`);
  //     console.log(`Fallidos: ${enviosFallidos.length}`);
  //     console.log(`=====================================\n`);

  //     // Enviar notificación de resumen
  //     const { enviarResumenEnvios } = require('../notifications/notification-manager');
  //     await enviarResumenEnvios(this.NOTIFICATION_CONFIG, enviosExitosos, enviosFallidos, jobInfo);
  //   } else {
  //     console.log(`Lote ${loteId} sin resultados para resumen`);
  //   }

  //   // Limpiar lote después de enviar resumen
  //   this.lotesActivos.delete(loteId);
  //   console.log(`Lote ${loteId} finalizado y limpiado`);
  // }

  // Método para forzar el envío del resumen inmediatamente
  async forzarResumenInmediato(loteId) {
    if (loteId) {
      await this.enviarResumenFinal(loteId);
    } else {
      // Enviar resumen para todos los lotes activos
      for (const [activeLoteId, lote] of this.lotesActivos) {
        await this.enviarResumenFinal(activeLoteId);
      }
    }
  }

  // // MÉTODO NUEVO: Agregar múltiples jobs de un lote
  // addPendingJobs(jobs) {
  //   if (!Array.isArray(jobs)) {
  //     console.error("❌ addPendingJobs espera un array de jobs");
  //     return;
  //   }

  //   const loteId = jobs[0]?.loteId || 'default';
  //   let count = 0;

  //   jobs.forEach(job => {
  //     // Asegurarse de que el job tenga loteId
  //     if (!job.loteId) {
  //       job.loteId = loteId;
  //     }
  //     this.pendingJobs.push(job);
  //     count++;
  //     console.log(`Job agregado: ${job.jobId} | Lote: ${job.loteId} | Grupo: ${job.grupo}`);
  //   });

  //   console.log(`Total jobs agregados al lote ${loteId}: ${count}`);
  // }
  addPendingJobs(jobs) {
    if (!Array.isArray(jobs)) {
      console.error("❌ addPendingJobs espera un array de jobs");
      return;
    }

    const loteId = jobs[0]?.loteId || 'default';

    // 1. REGISTRAR JOBS EN EL TRACKING POR LOTE
    if (!this.jobsPorLote.has(loteId)) {
      this.jobsPorLote.set(loteId, new Set());
    }

    const jobsDelLote = this.jobsPorLote.get(loteId);
    let count = 0;

    // 2. AGREGAR CADA JOB
    jobs.forEach(job => {
      // Asegurar que el job tenga loteId
      if (!job.loteId) {
        job.loteId = loteId;
      }

      // Agregar a pendingJobs
      this.pendingJobs.push(job);

      // Registrar en tracking
      jobsDelLote.add(job.jobId);

      count++;
      console.log(`Job agregado: ${job.jobId} | Lote: ${job.loteId} | Grupo: ${job.grupo}`);
    });

    console.log(`Total jobs agregados al lote ${loteId}: ${count} (trackeados: ${jobsDelLote.size})`);
  }
  // MÉTODO EXISTENTE: Agregar job individual
  addPendingJob(job) {
    // Asegurarse de que el job tenga loteId
    if (!job.loteId) {
      job.loteId = `LOTE-${Date.now()}`;
    }
    this.pendingJobs.push(job);
    console.log(`Job agregado: ${job.jobId} | Lote: ${job.loteId} | Grupo: ${job.grupo}`);
  }

  // async executePendingJobs() {
  //   if (this.isExecutingJobs) {
  //     debugLog("Ejecución de jobs ya en progreso, omitiendo...");
  //     return;
  //   }

  //   if (this.pendingJobs.length === 0) {
  //     debugLog("No hay jobs pendientes");
  //     return;
  //   }

  //   this.isExecutingJobs = true;
  //   console.log(`\nEjecutando ${this.pendingJobs.length} jobs pendientes a las ${new Date().toLocaleString('es-MX', { 
  //     timeZone: 'America/Mexico_City',
  //     hour12: true 
  //   })}`);

  //   try {
  //     const client = this.getClient();
  //     if (!client) {
  //       console.log("Cliente no disponible");
  //       this.isExecutingJobs = false;
  //       return;
  //     }

  //     const { checkClientReady, findChatByGroupName } = require('../whatsapp/client');
  //     const clientReady = await checkClientReady(client);

  //     console.log(`Estado del cliente: ${clientReady ? 'CONECTADO' : 'DESCONECTADO'}`);

  //     if (!clientReady) {
  //       console.log("Cliente no listo, reintentando en 10s");
  //       this.isExecutingJobs = false;
  //       return;
  //     }

  //     // Agrupar jobs por loteId para procesamiento organizado
  //     const jobsPorLote = {};
  //     this.pendingJobs.forEach(job => {
  //       const loteId = job.loteId || 'default';
  //       if (!jobsPorLote[loteId]) {
  //         jobsPorLote[loteId] = [];
  //       }
  //       jobsPorLote[loteId].push(job);
  //     });

  //     // Procesar jobs por lote
  //     for (const [loteId, jobsDelLote] of Object.entries(jobsPorLote)) {
  //       console.log(`\nProcesando lote: ${loteId} (${jobsDelLote.length} jobs)`);

  //       // Iniciar acumulación para este lote si no existe
  //       if (jobsDelLote.length > 0 && !this.lotesActivos.has(loteId)) {
  //         const primerJob = jobsDelLote[0];
  //         this.iniciarAcumulacionResultados(loteId, { 
  //           imagen: primerJob.imagen, 
  //           mensaje: primerJob.mensaje 
  //         });
  //       }

  //       for (const job of jobsDelLote) {
  //         const { imagen, grupo, jobId, mensaje } = job;
  //         job.attempts = job.attempts || 0;

  //         try {
  //           console.log(`\nProcesando job: ${jobId} (intento ${job.attempts + 1})`);
  //           console.log(`Lote: ${loteId}`);
  //           console.log(`Grupo: ${grupo}`);

  //           // Verificar que el archivo existe
  //           await fs.access(imagen);
  //           debugLog(`Archivo verificado: ${imagen}`);

  //           // Buscar el chat
  //           const chat = await findChatByGroupName(client, grupo);

  //           if (!chat) {
  //             console.error(`Chat no encontrado: "${grupo}"`);
  //              if (this.mainWindow) this.mainWindow.webContents.send("status", `No se encontro: ${grupo}`);

  //             // Agregar a resultados acumulados con loteId
  //             await this.agregarResultadoYVerificar(false, grupo, "Chat no encontrado", { imagen, mensaje }, loteId);

  //             // Eliminar job de pendingJobs
  //             const index = this.pendingJobs.findIndex(j => j.jobId === jobId);
  //             if (index !== -1) this.pendingJobs.splice(index, 1);
  //             continue;
  //           }

  //           console.log(`Chat encontrado: "${chat.name || 'Sin nombre'}"`);

  //           // Enviar la imagen
  //           const media = await MessageMedia.fromFilePath(imagen);
  //           await chat.sendMessage(media, {
  //             caption: mensaje || 'Buenos días, les envío la imagen correspondiente al día de hoy, saludos.'
  //           });
  //           console.log(`Imagen enviada a ${grupo}`);
  //            if (this.mainWindow) this.mainWindow.webContents.send("status", `✅ Imagen enviada a ${grupo}`);

  //           // Agregar a resultados acumulados (ÉXITO) con loteId
  //           await this.agregarResultadoYVerificar(true, grupo, null, { imagen, mensaje }, loteId);

  //           // Eliminar job de pendingJobs
  //           const index = this.pendingJobs.findIndex(j => j.jobId === jobId);
  //           if (index !== -1) this.pendingJobs.splice(index, 1);

  //         } catch (error) {
  //           job.attempts++;
  //           console.error(`Error enviando mensaje ${jobId} (intento ${job.attempts}):`, error.message);

  //           // Agregar a resultados acumulados (FALLO) con loteId
  //           await this.agregarResultadoYVerificar(false, grupo, error.message, { imagen, mensaje }, loteId);

  //           if (job.attempts >= 3) {
  //             console.log(`Mensaje ${jobId} falló 3 veces, se eliminará de pendientes`);
  //             const index = this.pendingJobs.findIndex(j => j.jobId === jobId);
  //             if (index !== -1) this.pendingJobs.splice(index, 1);
  //           }
  //         }
  //       }
  //     }

  //   } catch (error) {
  //     console.error("Error general en executePendingJobs:", error);
  //   } finally {
  //     this.isExecutingJobs = false;
  //     console.log(`\nFinalizada ejecución de jobs pendientes\n`);
  //   }
  // }
  async executePendingJobs() {
    if (this.isExecutingJobs) {
      debugLog("Ejecución de jobs ya en progreso, omitiendo...");
      return;
    }

    if (this.pendingJobs.length === 0) {
      debugLog("No hay jobs pendientes");
      return;
    }

    this.isExecutingJobs = true;
    console.log(`\nEjecutando ${this.pendingJobs.length} jobs pendientes a las ${new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour12: true
    })}`);

    try {
      const client = this.getClient();
      if (!client) {
        console.log("Cliente no disponible");
        this.isExecutingJobs = false;
        return;
      }

      const { checkClientReady, findChatByGroupName } = require('../whatsapp/client');
      const clientReady = await checkClientReady(client);

      console.log(`Estado del cliente: ${clientReady ? 'CONECTADO' : 'DESCONECTADO'}`);

      if (!clientReady) {
        console.log("Cliente no listo, reintentando en 10s");
        this.isExecutingJobs = false;
        return;
      }

      // Agrupar jobs por loteId para procesamiento organizado
      const jobsPorLote = {};
      this.pendingJobs.forEach(job => {
        const loteId = job.loteId || 'default';
        if (!jobsPorLote[loteId]) {
          jobsPorLote[loteId] = [];
        }
        jobsPorLote[loteId].push(job);
      });

      // Procesar jobs por lote
      for (const [loteId, jobsDelLote] of Object.entries(jobsPorLote)) {
        console.log(`\nProcesando lote: ${loteId} (${jobsDelLote.length} jobs)`);

        // Iniciar acumulación para este lote si no existe
        if (jobsDelLote.length > 0 && !this.lotesActivos.has(loteId)) {
          const primerJob = jobsDelLote[0];
          // ✅ MODIFICAR: Pasar el total de jobs como tercer parámetro
          this.iniciarAcumulacionResultados(loteId, {
            imagen: primerJob.imagen,
            mensaje: primerJob.mensaje
          }, jobsDelLote.length); // ← AGREGAR ESTE TERCER PARÁMETRO
        }

        for (const job of jobsDelLote) {
          const { imagen, grupo, jobId, mensaje } = job;
          job.attempts = job.attempts || 0;

          try {
            console.log(`\nProcesando job: ${jobId} (intento ${job.attempts + 1})`);
            console.log(`Lote: ${loteId}`);
            console.log(`Grupo: ${grupo}`);

            // Verificar que el archivo existe
            await fs.access(imagen);
            debugLog(`Archivo verificado: ${imagen}`);

            // Buscar el chat
            const chat = await findChatByGroupName(client, grupo);

            if (!chat) {
              console.error(`Chat no encontrado: "${grupo}"`);
              if (this.mainWindow) this.mainWindow.webContents.send("status", `No se encontro: ${grupo}`);

              // ✅ MODIFICADO: Agregar jobId como último parámetro
              await this.agregarResultadoYVerificar(false, grupo, "Chat no encontrado",
                { imagen, mensaje }, loteId, jobId); // ← AGREGAR jobId AL FINAL

              // Eliminar job de pendingJobs
              const index = this.pendingJobs.findIndex(j => j.jobId === jobId);
              if (index !== -1) this.pendingJobs.splice(index, 1);
              continue;
            }

            console.log(`Chat encontrado: "${chat.name || 'Sin nombre'}"`);

            // Enviar la imagen
            const media = await MessageMedia.fromFilePath(imagen);
            await chat.sendMessage(media, {
              caption: mensaje || 'Buenos días, les envío la imagen correspondiente al día de hoy, saludos.'
            });
            console.log(`Imagen enviada a ${grupo}`);
            if (this.mainWindow) this.mainWindow.webContents.send("status", `✅ Imagen enviada a ${grupo}`);

            // ✅ MODIFICADO: Agregar jobId como último parámetro
            await this.agregarResultadoYVerificar(true, grupo, null,
              { imagen, mensaje }, loteId, jobId); // ← AGREGAR jobId AL FINAL

            // Eliminar job de pendingJobs
            const index = this.pendingJobs.findIndex(j => j.jobId === jobId);
            if (index !== -1) this.pendingJobs.splice(index, 1);

          } catch (error) {
            job.attempts++;
            console.error(`Error enviando mensaje ${jobId} (intento ${job.attempts}):`, error.message);

            // ✅ MODIFICADO: Agregar jobId como último parámetro
            await this.agregarResultadoYVerificar(false, grupo, error.message,
              { imagen, mensaje }, loteId, jobId); // ← AGREGAR jobId AL FINAL

            if (job.attempts >= 3) {
              console.log(`Mensaje ${jobId} falló 3 veces, se eliminará de pendientes`);
              const index = this.pendingJobs.findIndex(j => j.jobId === jobId);
              if (index !== -1) this.pendingJobs.splice(index, 1);
            }
          }
        }
      }

    } catch (error) {
      console.error("Error general en executePendingJobs:", error);
    } finally {
      this.isExecutingJobs = false;
      console.log(`\nFinalizada ejecución de jobs pendientes\n`);
    }
  }
  getPendingJobs() {
    return this.pendingJobs;
  }

  setPendingJobs(jobs) {
    this.pendingJobs = jobs;
  }

  getEstadisticas() {
    const jobsPorLote = {};
    this.pendingJobs.forEach(job => {
      const loteId = job.loteId || 'default';
      if (!jobsPorLote[loteId]) {
        jobsPorLote[loteId] = 0;
      }
      jobsPorLote[loteId]++;
    });

    return {
      totalJobs: this.pendingJobs.length,
      jobsPorLote: jobsPorLote,
      lotesActivos: Array.from(this.lotesActivos.keys()),
      ejecutando: this.isExecutingJobs
    };
  }

  limpiarLotesAntiguos() {
    const ahora = Date.now();
    const UNA_HORA = 60 * 60 * 1000;

    for (const [loteId, lote] of this.lotesActivos) {
      if (ahora - lote.ultimoEnvio > UNA_HORA) {
        console.log(`Limpiando lote antiguo: ${loteId}`);
        this.lotesActivos.delete(loteId);
      }
    }
  }
}

module.exports = JobExecutor;