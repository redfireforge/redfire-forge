#!/usr/bin/env node

/**
 * RedfireForge Webhook & Schedule Server
 * 
 * A lightweight companion server for the Tauri desktop app that provides:
 * - Webhook HTTP endpoints for triggering workflows
 * - Cron-based schedule triggers for automated workflows
 * 
 * This server runs locally on port 3001 and stores data in AppData
 * alongside the existing workflow files.
 */

import { app } from './webhook-server.js';
import { getAppDataPath } from './file-storage.js';
import { initScheduler, stopScheduler } from './cron-scheduler.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '127.0.0.1'; // Localhost only by default

let server: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  RedfireForge Webhook & Schedule Server');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  AppData: ${getAppDataPath()}`);
    console.log(`  Starting server on http://${HOST}:${PORT}`);
    console.log('───────────────────────────────────────────────────────────');

    server = app.listen(PORT, HOST, async () => {
      console.log(`✅ Server listening on http://${HOST}:${PORT}`);
      console.log(`  Health check: http://${HOST}:${PORT}/health`);
      console.log(`  Webhook format: http://${HOST}:${PORT}/webhooks/:workflowId/:triggerId`);
      console.log('───────────────────────────────────────────────────────────');
      
      // Initialize cron scheduler after server starts
      await initScheduler();
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  Press Ctrl+C to stop');
      console.log('═══════════════════════════════════════════════════════════\n');
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error(`   Try stopping the other process or use a different port:`);
        console.error(`   PORT=3002 node dist-server/index.js`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

async function stopServer() {
  if (server) {
    console.log('\n───────────────────────────────────────────────────────────');
    console.log('  Shutting down server...');
    
    // Stop scheduler first
    stopScheduler();
    
    await new Promise<void>((resolve) => {
      server!.close(() => {
        console.log('✅ Server stopped');
        console.log('═══════════════════════════════════════════════════════════\n');
        resolve();
      });
    });
  }
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT (Ctrl+C)');
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM');
  await stopServer();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
