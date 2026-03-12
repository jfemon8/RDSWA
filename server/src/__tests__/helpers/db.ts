import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

let mongod: MongoMemoryServer | null = null;

export async function connectTestDB() {
  // If MONGODB_TEST_URI is set (e.g. CI with real MongoDB service), use it directly
  const testUri = process.env.MONGODB_TEST_URI;
  if (testUri) {
    process.env.MONGODB_URI = testUri;
    await mongoose.connect(testUri);
    return;
  }

  // Otherwise use MongoMemoryServer for local development
  mongod = await MongoMemoryServer.create({
    binary: {
      version: '6.0.19',
    },
    instance: {
      dbName: 'rdswa_test',
      ip: '127.0.0.1',
    },
  });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
}

export async function disconnectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) await mongod.stop();
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
