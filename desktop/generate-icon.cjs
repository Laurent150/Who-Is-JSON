// Development-only asset conversion. The application and installer need no sharp dependency.
// Run with WHO_SHARP_MODULE pointing to an installed sharp module, or install it outside this repo.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.WHO_SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
(async () => {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const frames = await Promise.all(sizes.map(size => sharp(path.join(root, 'public/fimi.svg')).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  frames.forEach((frame, i) => {
    const entry = 6 + i * 16;
    header[entry] = header[entry + 1] = sizes[i] % 256;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, ...frames]));
})().catch(error => { console.error(error); process.exitCode = 1; });
