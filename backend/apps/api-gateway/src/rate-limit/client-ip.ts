import * as net from 'node:net';
import { Request } from 'express';

/**
 * Checks if a given IP address resides within a specific CIDR block.
 * Supports both IPv4 and IPv6 exact matches and IPv4 subnet checks.
 */
export function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const cleanIp = ip.replace(/^::ffff:/, '');
    const [range, bitsStr] = cidr.split('/');
    const cleanRange = range.replace(/^::ffff:/, '');
    const bits = bitsStr ? parseInt(bitsStr, 10) : net.isIP(cleanIp) === 6 ? 128 : 32;

    const isIPv6 = net.isIP(cleanIp) === 6;
    if (isIPv6 !== (net.isIP(cleanRange) === 6)) {
      return false; // Address type mismatch
    }

    if (!isIPv6) {
      // IPv4 subnet logic
      const ipBuf = cleanIp.split('.').map(Number);
      const rangeBuf = cleanRange.split('.').map(Number);
      if (ipBuf.length !== 4 || rangeBuf.length !== 4) return false;

      const ipVal = (ipBuf[0] << 24) + (ipBuf[1] << 16) + (ipBuf[2] << 8) + ipBuf[3];
      const rangeVal = (rangeBuf[0] << 24) + (rangeBuf[1] << 16) + (rangeBuf[2] << 8) + rangeBuf[3];

      const mask = bits === 0 ? 0 : ~0 << (32 - bits);
      return (ipVal & mask) === (rangeVal & mask);
    } else {
      // IPv6 exact or simple prefix match
      if (bits === 128) {
        return cleanIp === cleanRange;
      }
      return cleanIp.startsWith(cleanRange);
    }
  } catch {
    return false;
  }
}

/**
 * Resolves the real client IP based on trusted proxy settings.
 */
export function getClientIp(req: Request, trustedProxyCidrs: string[]): string {
  const remoteAddress = req.socket.remoteAddress || req.ip || 'unknown';
  const cleanRemote = remoteAddress.replace(/^::ffff:/, '');

  const isTrusted = trustedProxyCidrs.some((cidr) => {
    if (cidr.includes('/')) {
      return ipInCidr(cleanRemote, cidr);
    }
    return cleanRemote === cidr.replace(/^::ffff:/, '');
  });

  if (isTrusted) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const parts = forwarded.split(',');
      return parts[0]?.trim() || cleanRemote;
    }
  }

  return cleanRemote;
}
