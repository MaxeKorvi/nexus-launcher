'use strict';

const os = require('os');

function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus() || [];
  const cpuModel = (cpus[0] && cpus[0].model ? cpus[0].model.trim() : 'Процессор не определён');
  const cpuThreads = cpus.length || 4;

  // Real RAM in Megabytes and Gigabytes
  const totalRamMb = Math.floor(totalMem / (1024 * 1024));
  const freeRamMb = Math.floor(freeMem / (1024 * 1024));

  // Determine standard installed physical RAM (accounting for hardware-reserved memory)
  let installedRamGb = Math.round(totalRamMb / 1024);
  if (totalRamMb <= 3000) installedRamGb = 2;
  else if (totalRamMb <= 5500) installedRamGb = 4;
  else if (totalRamMb <= 7500) installedRamGb = 6;
  else if (totalRamMb <= 11000) installedRamGb = 8;
  else if (totalRamMb <= 15000) installedRamGb = 12;
  else if (totalRamMb <= 22000) installedRamGb = 16;
  else if (totalRamMb <= 29000) installedRamGb = 24;
  else if (totalRamMb <= 44000) installedRamGb = 32;
  else if (totalRamMb <= 88000) installedRamGb = 64;

  const totalRamGb = installedRamGb;

  // Calculate recommended RAM for Minecraft based on total RAM
  let recommendedRamMb = 4096;
  if (installedRamGb <= 4) recommendedRamMb = 2048;
  else if (installedRamGb === 6) recommendedRamMb = 3072;
  else if (installedRamGb === 8) recommendedRamMb = 4096;
  else if (installedRamGb === 12) recommendedRamMb = 5120;
  else if (installedRamGb === 16) recommendedRamMb = 6144;
  else if (installedRamGb >= 32) recommendedRamMb = 8192;

  const recommendedThreads = Math.min(32, Math.max(2, cpuThreads));

  return {
    totalRamMb,
    freeRamMb,
    totalRamGb,
    installedRamGb,
    recommendedRamMb,
    recommendedThreads,
    cpuModel,
    cpuThreads,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname()
  };
}

module.exports = {
  getSystemInfo
};
