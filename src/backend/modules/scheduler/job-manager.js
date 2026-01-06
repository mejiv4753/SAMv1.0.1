const schedule = require('node-schedule');

function listScheduledJobs() {
  const jobs = schedule.scheduledJobs;
  console.log(`Jobs programados: ${Object.keys(jobs).length}`);

  Object.keys(jobs).forEach(jobName => {
    const job = jobs[jobName];
    const nextInvocation = job.nextInvocation();
    console.log(`- ${jobName}: ${nextInvocation ? nextInvocation.toLocaleString() : 'NO PROGRAMADO'}`);
  });

  if (Object.keys(jobs).length === 0) {
    console.log("No hay jobs programados");
  }
}

function createJob(jobId, fechaHoraCompleta, jobFunction) {
  return schedule.scheduleJob(jobId, fechaHoraCompleta, jobFunction);
}

function cancelAllJobs() {
  const jobs = schedule.scheduledJobs;
  Object.keys(jobs).forEach(jobName => {
    console.log(`Cancelando job: ${jobName}`);
    schedule.cancelJob(jobName);
  });
}

module.exports = {
  listScheduledJobs,
  createJob,
  cancelAllJobs
};