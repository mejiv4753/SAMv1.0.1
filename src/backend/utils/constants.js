const MAX_RECONNECT_ATTEMPTS = 5;
const DEBUG = true;

const NOTIFICATION_CONFIG = {
  chatNotificaciones: null,
  enabled: false,
  destino: null
};

const RESULTADOS_ENVIOS = {
  activo: false,
  loteId: null,
  enviosExitosos: [],
  enviosFallidos: [],
  jobInfo: null,
  timeoutResumen: null
};

const TIMEZONE_OFFSET = new Date().getTimezoneOffset() / 60;

module.exports = {
  MAX_RECONNECT_ATTEMPTS,
  DEBUG,
  NOTIFICATION_CONFIG,
  RESULTADOS_ENVIOS,
  TIMEZONE_OFFSET
};