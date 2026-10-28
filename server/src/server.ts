import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { releaseExpiredBookingHolds } from './jobs/holdCleanup.job';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const server = http.createServer(app);
  const cleanupTimer = setInterval(() => {
    releaseExpiredBookingHolds().catch(() => {});
  }, 60 * 1000);

  server.listen(env.SERVER_PORT, () => {
    console.log(`[HotelPro Server] Running on port ${env.SERVER_PORT}`);
  });

  const shutdown = async () => {
    clearInterval(cleanupTimer);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
