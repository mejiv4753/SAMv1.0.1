const fs = require("fs").promises;
const schedule = require("node-schedule");
const { createCanvas } = require('canvas'); // Añadir canvas
const path = require('path'); 

function setupIpcHandlers(ipcMain, dialog, {
  mainWindow,
  whatsappManager,
  jobExecutor,
  scheduledJobs,
  NOTIFICATION_CONFIG,
  shuffleArray
}) {

  const { configurarChatNotificaciones, obtenerEstadoNotificaciones, enviarNotificacion } = require('../notifications/notification-manager');
  const { createJob } = require('../scheduler/job-manager');
  const { debugFechaProgramacion } = require('../../utils/helpers');


  // =============================================
  // CLASE NUMBER GENERATOR (INTEGRADA DIRECTAMENTE)
  // =============================================
  class NumberGenerator {
    constructor() {
      this.numerosUsados = new Set();
      this.numerosPorDia = new Map();
      this.rutaGuardado = null;
      this.diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      this.mesAño = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      this.semanaActual = this.obtenerSemanaActual();
    }

    obtenerSemanaActual() {
      const ahora = new Date();
      const inicioAno = new Date(ahora.getFullYear(), 0, 1);
      const dias = Math.floor((ahora - inicioAno) / (24 * 60 * 60 * 1000));
      return Math.floor(dias / 7);
    }

    setRutaGuardado(ruta) {
      this.rutaGuardado = ruta;
      return ruta;
    }

    verificarRutaGuardado() {
      if (!this.rutaGuardado) {
        throw new Error('Primero selecciona una ruta para guardar las imágenes');
      }
      return this.rutaGuardado;
    }

    generarParaDia(diaNombre) {
      if (this.numerosPorDia.has(diaNombre)) {
        const numeros = Array.from(this.numerosPorDia.get(diaNombre));
        return {
          success: true,
          numeros,
          generado: true,
          mensaje: 'Números recuperados'
        };
      }

      const numerosDisponibles = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(num => !this.numerosUsados.has(num));

      if (numerosDisponibles.length < 3) {
        return {
          success: false,
          numeros: [],
          generado: false,
          mensaje: `No hay suficientes números disponibles (${numerosDisponibles.length}/90)`
        };
      }

      const mezclados = this.mezclarArray(numerosDisponibles);
      const seleccionados = mezclados.slice(0, 3).sort((a, b) => a - b);

      this.numerosPorDia.set(diaNombre, new Set(seleccionados));
      seleccionados.forEach(num => this.numerosUsados.add(num));

      return {
        success: true,
        numeros: seleccionados,
        generado: true,
        mensaje: 'Números generados exitosamente'
      };
    }

    generarSemanaCompleta() {
      if (this.obtenerSemanaActual() !== this.semanaActual) {
        this.numerosUsados.clear();
        this.numerosPorDia.clear();
        this.semanaActual = this.obtenerSemanaActual();
      }

      const semana = {};
      const errores = [];

      for (const dia of this.diasSemana) {
        if (this.numerosPorDia.has(dia)) {
          const numerosAnteriores = this.numerosPorDia.get(dia);
          numerosAnteriores.forEach(num => this.numerosUsados.delete(num));
          this.numerosPorDia.delete(dia);
        }

        const resultado = this.generarParaDia(dia);

        if (resultado.success) {
          semana[dia] = {
            numeros: resultado.numeros,
            generado: resultado.generado
          };
        } else {
          semana[dia] = {
            numeros: [],
            generado: false
          };
          errores.push(`${dia}: ${resultado.mensaje}`);
        }
      }

      return {
        success: errores.length === 0,
        semana,
        errores,
        totalNumerosUsados: this.numerosUsados.size,
        estadisticas: this.obtenerEstadisticas()
      };
    }

    obtenerEstadisticas() {
      return {
        totalUsados: this.numerosUsados.size,
        disponibles: 90 - this.numerosUsados.size,
        porcentaje: ((this.numerosUsados.size / 90) * 100).toFixed(1)
      };
    }

    obtenerEstadoActual() {
      const semana = {};

      for (const dia of this.diasSemana) {
        const numeros = this.numerosPorDia.has(dia)
          ? Array.from(this.numerosPorDia.get(dia))
          : [];

        semana[dia] = {
          numeros,
          generado: numeros.length > 0
        };
      }

      return {
        semana,
        rutaGuardado: this.rutaGuardado,
        estadisticas: this.obtenerEstadisticas(),
        semanaActual: this.semanaActual
      };
    }

    async generarImagenes() {
      try {
        const ruta = this.verificarRutaGuardado();
        await fs.mkdir(ruta, { recursive: true });

        const imagenesGeneradas = [];

        for (const [dia, numerosSet] of this.numerosPorDia.entries()) {
          const numeros = Array.from(numerosSet);

          if (numeros.length === 3) {
            // Calcular fecha para este día específico
            const indiceDia = this.diasSemana.indexOf(dia);
            const fechaBase = new Date();
            fechaBase.setDate(fechaBase.getDate() + (indiceDia + 1));
            
            // Formatear fecha como DD-MM-AA para el nombre del archivo
            const diaNum = fechaBase.getDate().toString().padStart(2, '0');
            const mesNum = (fechaBase.getMonth() + 1).toString().padStart(2, '0');
            const añoNum = fechaBase.getFullYear().toString().slice(-2);
            const nombreArchivo = `${diaNum}-${mesNum}-${añoNum}.png`; // Ej: 14-12-25.png
            
            const rutaCompleta = path.join(ruta, nombreArchivo);

            await this.generarImagenDia(dia, numeros, rutaCompleta);
            imagenesGeneradas.push({
              dia,
              fecha: `${diaNum}-${mesNum}-${añoNum}`,
              archivo: nombreArchivo,
              ruta: rutaCompleta,
              numeros
            });
          }
        }

        return {
          success: true,
          imagenes: imagenesGeneradas,
          rutaBase: ruta,
          mensaje: `${imagenesGeneradas.length} imágenes generadas exitosamente`
        };

      } catch (error) {
        return {
          success: false,
          error: error.message,
          mensaje: `Error generando imágenes: ${error.message}`
        };
      }
    }
    
    async generarImagenDia(dia, numeros, rutaSalida) {
      // Dimensiones ajustadas para el formato de tabla
      const canvas = createCanvas(800, 200);
      const ctx = canvas.getContext('2d');
      const mesNow = new Date();
      const mesActual = this.mesAño[mesNow.getMonth()];

      // --- Configuración ---
      const width = 800;
      const height = 200;
      const headerHeight = 60;
      const rowHeight = 70;
      const cols = 4;
      const colWidth = width / cols;

      // Colores (formato de tabla similar al ejemplo)
      const colorHeader = "#0b1e2b";    // Azul Oscuro
      const colorSubHeader = "#fbc02d"; // Amarillo/Naranja
      const colorRow = "#ffff00";       // Amarillo Brillante
      const colorBorder = "#ffffff";    // Blanco
      const colorTextHeader = "#ffffff"; // Texto blanco
      const colorTextData = "#000000";   // Texto negro

      // Fuentes
      const fontHeader = "bold 32px Arial, sans-serif";
      const fontSubHeader = "24px Arial, sans-serif";
      const fontRow = "bold 36px Arial, sans-serif";

      // Limpiar canvas
      ctx.clearRect(0, 0, width, height);

      // --- Dibujado ---

      // 1. Encabezado (Mes)
      ctx.fillStyle = colorHeader;
      ctx.fillRect(0, 0, width, headerHeight);

      ctx.fillStyle = colorTextHeader;
      ctx.font = fontHeader;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`MES: ${mesActual}`, width / 2, headerHeight / 2);

      // 2. Fondo Subtítulos
      ctx.fillStyle = colorSubHeader;
      ctx.fillRect(0, headerHeight, width, rowHeight);

      // 3. Fondo Datos
      ctx.fillStyle = colorRow;
      ctx.fillRect(0, headerHeight + rowHeight, width, rowHeight);

      // 4. Columnas y Texto
      // Calcular fecha incrementada según el día de la semana
      // Lunes: +1 día, Martes: +2 días, Miércoles: +3 días, etc.
      const indiceDia = this.diasSemana.indexOf(dia);
      
      // Crear fecha base (hoy) y sumar días según el día de la semana
      const fechaBase = new Date();
      fechaBase.setDate(fechaBase.getDate() + (indiceDia + 1)); // +1 porque Lunes debe ser mañana
      
      // Formatear fecha como DD-MM-AA
      const diaNum = fechaBase.getDate().toString().padStart(2, '0');
      const mesNum = (fechaBase.getMonth() + 1).toString().padStart(2, '0');
      const añoNum = fechaBase.getFullYear().toString().slice(-2);
      const fechaFormato = `${diaNum}-${mesNum}-${añoNum}`; // Ej: 14-12-25 para Lunes

      const columns = [
        { title: "DÍA/CLAVE", value: fechaFormato },
        { title: "TAXIS", value: numeros[0]?.toString() || "0" },
        { title: "CORTESÍAS", value: numeros[1]?.toString() || "0" },
        { title: "EXTRA", value: numeros[2]?.toString() || "0" }
      ];

      ctx.lineWidth = 2;
      ctx.strokeStyle = colorBorder;

      // Dibujar líneas verticales y texto
      columns.forEach((col, i) => {
        const x = i * colWidth;

        // Líneas verticales
        ctx.beginPath();
        ctx.moveTo(x, headerHeight);
        ctx.lineTo(x, headerHeight + rowHeight * 2);
        ctx.stroke();

        // Texto subtítulos (fila amarilla/naranja)
        ctx.fillStyle = "#000000";
        ctx.font = fontSubHeader;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(col.title, x + colWidth / 2, headerHeight + rowHeight / 2);

        // Texto datos (fila amarilla brillante)
        ctx.fillStyle = colorTextData;
        ctx.font = fontRow;
        ctx.fillText(col.value, x + colWidth / 2, headerHeight + rowHeight + rowHeight / 2);
      });

      // Línea horizontal final
      ctx.beginPath();
      ctx.moveTo(0, headerHeight + rowHeight * 2);
      ctx.lineTo(width, headerHeight + rowHeight * 2);
      ctx.stroke();

      // Guardar
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(rutaSalida, buffer);
    }
    reiniciarGenerador() {
      this.numerosUsados.clear();
      this.numerosPorDia.clear();

      return {
        success: true,
        mensaje: 'Generador reiniciado exitosamente',
        estadisticas: this.obtenerEstadisticas()
      };
    }

    mezclarArray(array) {
      const nuevoArray = [...array];
      for (let i = nuevoArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nuevoArray[i], nuevoArray[j]] = [nuevoArray[j], nuevoArray[i]];
      }
      return nuevoArray;
    }
  }

  // Inicializar el generador
  const numberGenerator = new NumberGenerator();



  // Handler para cerrar sesión
  ipcMain.handle("cerrar-sesion", async () => {
    return await whatsappManager.cerrarSesion(jobExecutor.resultadosEnvios);
  });

  // Handler para configurar notificaciones
  ipcMain.handle("configurar-notificaciones", async (event, grupoNotificaciones) => {
    try {
      const resultado = await configurarChatNotificaciones(whatsappManager.getClient(), NOTIFICATION_CONFIG, grupoNotificaciones);

      if (resultado.success && NOTIFICATION_CONFIG.enabled) {
        await enviarNotificacion(NOTIFICATION_CONFIG, "Sistema de notificaciones activado. Recibirás actualizaciones sobre los envíos programados.");
      }

      return resultado;
    } catch (error) {
      console.error("Error configurando notificaciones:", error);
      return { success: false, message: "Error: " + error.message };
    }
  });
  // =============================================
  // HANDLERS PARA GENERADOR DE NÚMEROS (AGREGAR AL FINAL)
  // =============================================

  // Necesitas path para las rutas
  const path = require('path');

  // Handler para obtener estado de números
  ipcMain.handle('obtener-estado-numeros', () => {
    console.log('Handler: obtener-estado-numeros llamado');
    return numberGenerator.obtenerEstadoActual();
  });

  // Handler para seleccionar carpeta
  ipcMain.handle('seleccionar-carpeta-numeros', async () => {
    console.log('Handler: seleccionar-carpeta-numeros llamado');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, ruta: result.filePaths[0] };
    }
    return { success: false, ruta: null };
  });

  // Handler para generar semana
  ipcMain.handle('generar-numeros-semana', () => {
    console.log('Handler: generar-numeros-semana llamado');
    return numberGenerator.generarSemanaCompleta();
  });

  // Handler para generar día específico
  ipcMain.handle('generar-numeros-dia', (event, diaNombre) => {
    console.log(`Handler: generar-numeros-dia llamado para ${diaNombre}`);
    return numberGenerator.generarParaDia(diaNombre);
  });

  // Handler para establecer ruta
  ipcMain.handle('establecer-ruta-numeros', (event, ruta) => {
    console.log(`Handler: establecer-ruta-numeros llamado con ruta: ${ruta}`);
    return numberGenerator.setRutaGuardado(ruta);
  });

  // Handler para generar imágenes
  ipcMain.handle('guardar-imagenes-numeros', () => {
    console.log('Handler: guardar-imagenes-numeros llamado');
    return numberGenerator.generarImagenes();
  });

  // Handler para reiniciar
  ipcMain.handle('reiniciar-generador-numeros', () => {
    console.log('Handler: reiniciar-generador-numeros llamado');
    return numberGenerator.reiniciarGenerador();
  });

  // Handler para abrir carpeta
  const { shell } = require('electron');
  ipcMain.handle('abrir-carpeta', async (event, ruta) => {
    console.log(`Handler: abrir-carpeta llamado para ruta: ${ruta}`);
    try {
      await shell.openPath(ruta);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });



  // Handler para obtener estado de notificaciones
  ipcMain.handle("obtener-estado-notificaciones", async () => {
    return obtenerEstadoNotificaciones(NOTIFICATION_CONFIG);
  });

  // Handler para seleccionar archivo
  ipcMain.handle("select-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Imágenes", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // Handler para programar envío
  ipcMain.handle("programar-envio", async (event, { imagen, fecha, hora, grupos, mensaje }) => {
    try {
      // Verificar que el archivo existe
      await fs.access(imagen);

      // Crear fecha/hora local
      const [year, month, day] = fecha.split("-");
      const [hours, minutes] = hora.split(":");
      const fechaHoraCompleta = new Date(year, month - 1, day, hours, minutes, 0, 0);

      if (isNaN(fechaHoraCompleta.getTime())) return "❌ Fecha u hora inválida";

      const ahora = new Date();
      if (fechaHoraCompleta < ahora) return "❌ La fecha y hora deben ser futuras";

      const loteId = `LOTE-${Date.now()}`; // MISMO loteId para todos los jobs de este envío

      const jobFunction = async () => {
        console.log(`\nJob ejecutándose: ${loteId} - Hora: ${new Date().toLocaleString()}`);
        console.log(`Grupos a enviar: ${grupos.length}`);

        // Iniciar acumulación de resultados para este lote
        jobExecutor.iniciarAcumulacionResultados(loteId, {
          imagen,
          mensaje,
          fechaHora: new Date()
        }, grupos.length);

        // Mezclar los grupos justo antes de enviar
        const gruposAleatorios = shuffleArray([...grupos]);

        // Crear array de jobs para este lote
        const jobsDelLote = gruposAleatorios.map((grupo, index) => {
          const jobId = `${loteId}-JOB-${index + 1}`; // Job ID único para cada grupo
          return {
            imagen,
            grupo,
            jobId,
            mensaje,
            attempts: 0,
            loteId: loteId // MISMO loteId para todos
          };
        });

        console.log(`Agregando ${jobsDelLote.length} jobs al lote: ${loteId}`);

        // Agregar todos los jobs del lote de una vez
        jobExecutor.addPendingJobs(jobsDelLote);

        // Ejecutar jobs pendientes
        jobExecutor.executePendingJobs();

        // Programar envío de resumen final por si acaso (timeout de seguridad)
        setTimeout(() => {
          console.log(`Timeout de seguridad - Forzando resumen para lote: ${loteId}`);
          jobExecutor.forzarResumenInmediato(loteId);
        }, (grupos.length * 10000) + 15000); // 10 seg por grupo + 15 seg extra
      };

      // Programar job para la fecha indicada
      const job = createJob(loteId, fechaHoraCompleta, jobFunction);

      // Guardar job programado
      scheduledJobs.push({
        jobId: loteId,
        grupos: [...grupos],
        imagen,
        mensaje,
        fechaHora: fechaHoraCompleta,
        nextInvocation: job.nextInvocation()
      });

      return `Programado para enviar a ${grupos.length} grupos a partir de ${fechaHoraCompleta.toLocaleTimeString()} (Lote: ${loteId})`;
    } catch (error) {
      console.error("Error programando envíos:", error);
      return "❌ Error: " + error.message;
    }
  });

  //PREUBA DE VALIDACIÓN
  // Handler para validar grupos - REEMPLAZA EL ACTUAL
  ipcMain.handle('validar-grupos', async (event, textoGrupos) => {
    console.log('🔍 [VALIDACIÓN] Validando grupos:', textoGrupos);

    try {
      // 1. Usar el parámetro whatsappManager 
      if (!whatsappManager) {
        console.error('whatsappManager es:', whatsappManager);
        throw new Error('WhatsApp Manager no está inicializado en los handlers');
      }

      // 2. Verificar que WhatsApp esté conectado
      if (!whatsappManager.client) {
        throw new Error('WhatsApp no está conectado. Conecta primero WhatsApp.');
      }

      // 3. Separar grupos por comas
      const gruposArray = textoGrupos
        .split(',')
        .map(g => g.trim())
        .filter(g => g.length > 0);

      if (gruposArray.length === 0) {
        return {
          success: false,
          message: 'No hay grupos para validar',
          resultados: []
        };
      }

      // 4. Validar cada grupo
      const resultados = [];

      for (const nombreGrupo of gruposArray) {
        try {
          console.log(`🔍 Validando: "${nombreGrupo}"`);

          // Usar tu función existente findChatByGroupName
          const chat = await whatsappManager.findChatByGroupName(nombreGrupo);

          if (chat) {
            // Chat encontrado
            resultados.push({
              nombreIngresado: nombreGrupo,
              valido: true,
              nombreReal: chat.name || 'Sin nombre',
              id: chat.id._serialized,
              esGrupo: chat.isGroup || false,
              participantes: chat.isGroup ? (chat.participants?.length || 0) : 1,
              mensaje: `Encontrado: "${chat.name || 'Chat sin nombre'}"`
            });
          } else {
            // Chat NO encontrado
            resultados.push({
              nombreIngresado: nombreGrupo,
              valido: false,
              error: 'Chat/grupo no encontrado',
              mensaje: `No encontrado: "${nombreGrupo}"`
            });
          }
        } catch (error) {
          resultados.push({
            nombreIngresado: nombreGrupo,
            valido: false,
            error: error.message,
            mensaje: `Error: ${error.message}`
          });
        }
      }

      // 5. Calcular resumen
      const todosValidos = resultados.every(r => r.valido);
      const gruposInvalidos = resultados.filter(r => !r.valido);

      return {
        success: true,
        todosValidos,
        resultados,
        gruposValidos: resultados.filter(r => r.valido),
        gruposInvalidos,
        total: resultados.length,
        message: todosValidos
          ? `Hay ${resultados.length} grupos válidos`
          : `${gruposInvalidos.length} de ${resultados.length} grupos tienen problemas`
      };

    } catch (error) {
      console.error('Error en validación de grupos:', error);
      return {
        success: false,
        error: error.message,
        message: `Error de validación: ${error.message}`,
        resultados: []
      };
    }
  });

  // Handler para forzar nuevo QR
  ipcMain.handle("forzar-nuevo-qr", async () => {
    return await whatsappManager.forzarNuevoQR(jobExecutor.resultadosEnvios);
  });

  // Handler para test de envío inmediato
  ipcMain.handle("test-envio-inmediato", async (event, { imagen, grupo, mensaje }) => {
    try {
      await fs.access(imagen);
      const loteId = `TEST-${Date.now()}`;
      const jobId = `${loteId}-JOB-1`;

      console.log(`TEST: Envío inmediato a ${grupo}`);

      // Iniciar acumulación para el test
      jobExecutor.iniciarAcumulacionResultados(loteId, {
        imagen,
        mensaje,
        fechaHora: new Date()
      });

      jobExecutor.addPendingJob({
        imagen,
        grupo,
        jobId,
        mensaje,
        attempts: 0,
        loteId: loteId
      });

      jobExecutor.executePendingJobs();

      // Programar resumen para el test
      setTimeout(() => {
        jobExecutor.forzarResumenInmediato(loteId);
      }, 10000);

      return `🧪 TEST: Enviando inmediatamente a ${grupo}`;
    } catch (error) {
      return `❌ TEST Error: ${error.message}`;
    }
  });

  // Handler para test de envío inmediato a múltiples grupos
  ipcMain.handle("test-envio-inmediato-multiple", async (event, { imagen, grupos, mensaje }) => {
    try {
      await fs.access(imagen);
      const loteId = `TEST-MULTI-${Date.now()}`;

      console.log(`TEST: Envío inmediato a ${grupos.length} grupos`);

      // Iniciar acumulación para el test
      jobExecutor.iniciarAcumulacionResultados(loteId, {
        imagen,
        mensaje,
        fechaHora: new Date()
      });

      // Crear jobs para todos los grupos
      const jobsDelLote = grupos.map((grupo, index) => {
        const jobId = `${loteId}-JOB-${index + 1}`;
        return {
          imagen,
          grupo,
          jobId,
          mensaje,
          attempts: 0,
          loteId: loteId
        };
      });

      jobExecutor.addPendingJobs(jobsDelLote);
      jobExecutor.executePendingJobs();

      // Programar resumen para el test
      setTimeout(() => {
        jobExecutor.forzarResumenInmediato(loteId);
      }, (grupos.length * 5000) + 10000);

      return `🧪 TEST: Enviando inmediatamente a ${grupos.length} grupos`;
    } catch (error) {
      return `❌ TEST Error: ${error.message}`;
    }
  });

  // Handler para obtener jobs programados
  ipcMain.handle("obtener-jobs-programados", async () => {
    return scheduledJobs;
  });

  // Handler para cancelar job programado - YA EXISTE, así que déjalo como está
  ipcMain.handle("cancelar-job", async (event, jobId) => {
    try {
      // Buscar y cancelar el job
      const jobIndex = scheduledJobs.findIndex(job => job.jobId === jobId);
      if (jobIndex !== -1) {
        // Cancelar el job de node-schedule
        const job = schedule.scheduledJobs[jobId];
        if (job) {
          job.cancel();
          console.log(`Job ${jobId} cancelado en node-schedule`);
        } else {
          console.log(`Job ${jobId} no encontrado en node-schedule, puede que ya se haya ejecutado`);
        }

        // Remover de la lista
        scheduledJobs.splice(jobIndex, 1);

        return `Envío programado eliminado correctamente`;
      } else {
        return `❌ No se encontró el envío programado`;
      }
    } catch (error) {
      console.error("Error cancelando job:", error);
      return `❌ Error eliminando envío: ${error.message}`;
    }
  });

  // Handler para verificar conexión
  ipcMain.handle("check-connection", async () => {
    return await whatsappManager.checkClientReady();
  });

  // Handler para obtener estadísticas de jobs
  ipcMain.handle("obtener-estadisticas-jobs", async () => {
    return jobExecutor.getEstadisticas();
  });

}


module.exports = { setupIpcHandlers };