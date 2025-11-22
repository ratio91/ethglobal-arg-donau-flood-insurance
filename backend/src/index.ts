import { app, monitorAndSubmit, checkPendingAndSettle } from './app';
import { config } from './config';
import { monitorAndClaimPolicies } from './insurer';

console.log('🚀 Starting Flood Insurance Backend...');

/**
 * Combined monitoring cycle - runs both monitor and settle
 */
async function runMonitoringCycle() {
  console.log('\n\n🔁 ========== MONITORING CYCLE START ==========');
  console.log(`⏰ ${new Date().toISOString()}`);

  await monitorAndSubmit();
  await checkPendingAndSettle();

  console.log('\n🔁 ========== MONITORING CYCLE END ==========\n');
}

/**
 * Start server and monitoring loop
 */
app.listen(config.server.port, () => {
  console.log('\n✅ ========== SERVER READY ==========');
  console.log(`🚀 Backend running on port ${config.server.port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${config.server.port}/webhook`);
  console.log(`🏥 Health check: http://localhost:${config.server.port}/health`);
  console.log(`🔍 Submissions: http://localhost:${config.server.port}/submissions`);
  console.log(`🔧 Manual triggers:`);
  console.log(`   POST http://localhost:${config.server.port}/trigger/monitor`);
  console.log(`   POST http://localhost:${config.server.port}/trigger/settle`);
  console.log(`🔁 Monitoring interval: ${config.server.monitorInterval}ms (${config.server.monitorInterval / 1000}s)`);
  console.log('=====================================\n');

  // Run monitoring loop every configured interval
  setInterval(runMonitoringCycle, config.server.monitorInterval);

  // Run once immediately on startup (after 5 seconds)
  console.log('⏰ First monitoring cycle will run in 5 seconds...\n');
  setTimeout(runMonitoringCycle, 5000);

  // Start insurer monitor if enabled
  if (config.insurer.autoClaimEnabled) {
    console.log('🏦 Starting automatic insurer...');
    monitorAndClaimPolicies();
  } else {
    console.log('⏸️  Automatic insurer disabled (AUTO_CLAIM_ENABLED=false)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
