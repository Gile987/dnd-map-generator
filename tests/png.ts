import { readFile } from 'node:fs/promises';

export const PNG = {
  async read(path: string): Promise<{ width: number; height: number }> {
    const data = await readFile(path);
    if (data.subarray(1, 4).toString() !== 'PNG') throw new Error('Download is not a PNG.');
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  },
};
