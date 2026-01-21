// Simple script to generate PNG icons using pure Node.js
// Creates minimal valid PNG files for electron-builder

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a simple PNG with a solid color
function createPNG(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk (image data)
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
      rawData[offset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xffffffff;
  const table = makeCRCTable();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return crc ^ 0xffffffff;
}

function makeCRCTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

// Generate icons
const iconsDir = path.join(__dirname, '..', 'resources', 'icons');
const trayIconsDir = path.join(__dirname, '..', 'resources', 'tray-icons');

// Ensure directories exist
if (!fs.existsSync(trayIconsDir)) {
  fs.mkdirSync(trayIconsDir, { recursive: true });
}

// App icon (256x256) - blue - this is required by electron-builder
const appIcon = createPNG(256, 256, 74, 144, 226);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), appIcon);
console.log('Created icon.png (256x256)');

// Tray icons (16x16) - these are for runtime use only
const trayOn = createPNG(16, 16, 76, 175, 80); // green
fs.writeFileSync(path.join(trayIconsDir, 'tray-on.png'), trayOn);
console.log('Created tray-on.png (16x16)');

const trayOff = createPNG(16, 16, 158, 158, 158); // gray
fs.writeFileSync(path.join(trayIconsDir, 'tray-off.png'), trayOff);
console.log('Created tray-off.png (16x16)');

// macOS template icons (16x16)
fs.writeFileSync(path.join(trayIconsDir, 'tray-onTemplate.png'), trayOn);
fs.writeFileSync(path.join(trayIconsDir, 'tray-offTemplate.png'), trayOff);
console.log('Created macOS template icons');

// Create 2x versions for macOS (32x32)
const trayOn2x = createPNG(32, 32, 76, 175, 80);
const trayOff2x = createPNG(32, 32, 158, 158, 158);
fs.writeFileSync(path.join(trayIconsDir, 'tray-onTemplate@2x.png'), trayOn2x);
fs.writeFileSync(path.join(trayIconsDir, 'tray-offTemplate@2x.png'), trayOff2x);
console.log('Created macOS 2x template icons');

console.log('Done! All icons generated.');
