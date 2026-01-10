import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  atomicWriteFile,
  atomicWriteFileSync,
  cleanupStaleTempFiles,
} = require('./atomicWrite.cjs') as {
  atomicWriteFile: (path: string, data: string) => Promise<void>;
  atomicWriteFileSync: (path: string, data: string) => void;
  cleanupStaleTempFiles: () => void;
};

export { atomicWriteFile, atomicWriteFileSync, cleanupStaleTempFiles };
