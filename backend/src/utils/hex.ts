/**
 * Convert string to hex for Flare FDC attestationType and sourceId
 * Pads to 32 bytes (64 hex chars)
 */
export function toHex(data: string): string {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += data.charCodeAt(i).toString(16);
  }
  return "0x" + result.padEnd(64, "0");
}

/**
 * Convert string to UTF-8 hex (for ABI encoding)
 */
export function stringToUtf8Hex(str: string): string {
  return '0x' + Buffer.from(str, 'utf8').toString('hex');
}
