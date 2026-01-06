function debugLog(message, DEBUG) {
  if (DEBUG) {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function debugTimezone() {
  const now = new Date();
  console.log(`Hora del sistema: ${now.toString()}`);
  console.log(`Zona horaria: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Offset: ${now.getTimezoneOffset()} minutos (${now.getTimezoneOffset() / 60} horas)`);
}

function debugFechaProgramacion(fecha, hora) {
  console.log('\n=== DEBUG FECHA ===');
  console.log('Input:', fecha, hora);

  const directo = new Date(`${fecha}T${hora}`);
  console.log('Directo:', directo.toString());
  
  const [year, month, day] = fecha.split('-');
  const [hours, minutes] = hora.split(':');
  const conComponentes = new Date(year, month - 1, day, hours, minutes);
  console.log('Con componentes:', conComponentes.toString());

  console.log('Hora actual:', new Date().toString());
  console.log('==================\n');
}

module.exports = {
  debugLog,
  shuffleArray,
  debugTimezone,
  debugFechaProgramacion
};