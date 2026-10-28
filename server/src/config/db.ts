import mongoose from 'mongoose';
import { setServers } from 'node:dns';
import { env } from './env';

export async function connectDatabase(
  uri: string = env.MONGODB_URI
): Promise<void> {
  mongoose.set('strictQuery', true);

  // Use Google DNS during local development.
  if (process.env.NODE_ENV === 'development') {
    setServers(['8.8.8.8']);
  }

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 8000
  });

  if (!env.isTest) {
    console.log(
      '[HotelPro DB] Connected to MongoDB (' +
      mongoose.connection.name +
      ')'
    );
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}