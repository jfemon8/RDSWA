import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

let mongod: MongoMemoryServer | null = null;

export async function connectTestDB() {
  let uri = process.env.MONGODB_URI;

  if (!uri) {
    // Local dev: use in-memory MongoDB
    mongod = await MongoMemoryServer.create({
      binary: {
        version: '6.0.19',
      },
      instance: {
        dbName: 'rdswa_test',
      },
    });
    uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
  }

  await mongoose.connect(uri);
}

export async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
