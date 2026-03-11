import path from 'path';
import os from 'os';

// Set test environment variables before any module loads
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
process.env.CLIENT_URL = 'http://localhost:5173';
// Set a placeholder so env validation passes — connectTestDB will override with MongoMemoryServer URI
process.env.MONGODB_URI = 'PLACEHOLDER_FOR_TEST';

// Point mongodb-memory-server to pre-downloaded binary
const mongodPath = path.join(os.homedir(), '.cache', 'mongodb-binaries', 'mongod-x64-6.0.19', 'mongod.exe');
process.env.MONGOMS_SYSTEM_BINARY = mongodPath;
