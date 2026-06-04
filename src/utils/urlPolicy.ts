import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface PublicResolvedAddress {
    address: string;
    family: 4 | 6;
}

export interface PublicHttpUrlResolution {
    url: URL;
    hostname: string;
    addresses: PublicResolvedAddress[];
}

const IPV4_BLOCKED_RANGES: Array<[bigint, bigint]> = [
    [0x00000000n, 0xff000000n], // 0.0.0.0/8
    [0x0a000000n, 0xff000000n], // 10.0.0.0/8
    [0x64400000n, 0xffc00000n], // 100.64.0.0/10
    [0x7f000000n, 0xff000000n], // 127.0.0.0/8
    [0xa9fe0000n, 0xffff0000n], // 169.254.0.0/16
    [0xac100000n, 0xfff00000n], // 172.16.0.0/12
    [0xc0000000n, 0xffffff00n], // 192.0.0.0/24
    [0xc0000200n, 0xffffff00n], // 192.0.2.0/24
    [0xc0586300n, 0xffffff00n], // 192.88.99.0/24
    [0xc0a80000n, 0xffff0000n], // 192.168.0.0/16
    [0xc6120000n, 0xfffe0000n], // 198.18.0.0/15
    [0xc6336400n, 0xffffff00n], // 198.51.100.0/24
    [0xcb007100n, 0xffffff00n], // 203.0.113.0/24
    [0xe0000000n, 0xf0000000n], // 224.0.0.0/4
    [0xf0000000n, 0xf0000000n], // 240.0.0.0/4
];

const IPV6_BLOCKED_RANGES: Array<[bigint, bigint]> = [
    [0n, (1n << 128n) - 1n], // ::/128
    [1n, (1n << 128n) - 1n], // ::1/128
    [0xffffn << 32n, ((1n << 96n) - 1n) << 32n], // ::ffff:0:0/96
    [0x0064_ff9b_0000_0000_0000_0000_0000_0000n, prefixMask(96)], // 64:ff9b::/96
    [0x0100_0000_0000_0000_0000_0000_0000_0000n, prefixMask(64)], // 100::/64
    [0x2001_0000_0000_0000_0000_0000_0000_0000n, prefixMask(23)], // 2001::/23
    [0x2002_0000_0000_0000_0000_0000_0000_0000n, prefixMask(16)], // 2002::/16
    [0xfc00_0000_0000_0000_0000_0000_0000_0000n, prefixMask(7)], // fc00::/7
    [0xfe80_0000_0000_0000_0000_0000_0000_0000n, prefixMask(10)], // fe80::/10
    [0xff00_0000_0000_0000_0000_0000_0000_0000n, prefixMask(8)], // ff00::/8
];

export class UrlPolicyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UrlPolicyError';
    }
}

export async function assertPublicHttpUrl(url: string): Promise<URL> {
    return (await resolvePublicHttpUrl(url)).url;
}

export async function resolvePublicHttpUrl(
    url: string
): Promise<PublicHttpUrlResolution> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new UrlPolicyError(`Invalid URL: ${url}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new UrlPolicyError(
            `URL scheme is not allowed: ${parsed.protocol}`
        );
    }

    if (parsed.username || parsed.password) {
        throw new UrlPolicyError('URL credentials are not allowed');
    }

    const hostname = normalizeHostname(parsed.hostname);
    const hostIpVersion = isIP(hostname);
    if (hostIpVersion !== 0) {
        const family = ipVersionToFamily(hostIpVersion);
        assertPublicIp(hostname, family);
        return {
            url: parsed,
            hostname,
            addresses: [{ address: hostname, family }],
        };
    }

    let addresses: Array<{ address: string; family: number }>;
    try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch (error) {
        throw new UrlPolicyError(
            `Unable to resolve hostname "${hostname}": ${error instanceof Error ? error.message : 'Unknown DNS error'}`
        );
    }

    if (addresses.length === 0) {
        throw new UrlPolicyError(`Hostname "${hostname}" did not resolve`);
    }

    const publicAddresses = addresses.map(address => {
        const family = ipVersionToFamily(address.family);
        assertPublicIp(address.address, family);
        return { address: address.address, family };
    });

    return { url: parsed, hostname, addresses: publicAddresses };
}

function normalizeHostname(hostname: string): string {
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
        return hostname.slice(1, -1);
    }
    return hostname;
}

function assertPublicIp(address: string, family: number): void {
    if (family === 4) {
        if (isBlockedIpv4(address)) {
            throw new UrlPolicyError(`IP address is not allowed: ${address}`);
        }
        return;
    }

    if (family === 6) {
        const ipv4Mapped = address
            .toLowerCase()
            .match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (ipv4Mapped) {
            assertPublicIp(ipv4Mapped[1], 4);
            return;
        }

        if (isBlockedIpv6(address)) {
            throw new UrlPolicyError(`IP address is not allowed: ${address}`);
        }
        return;
    }

    throw new UrlPolicyError(`Unknown IP address family for ${address}`);
}

function ipVersionToFamily(family: number): 4 | 6 {
    if (family === 4 || family === 6) {
        return family;
    }

    throw new UrlPolicyError(`Unknown IP address family: ${family}`);
}

function isBlockedIpv4(address: string): boolean {
    const numeric = ipv4ToNumber(address);
    return IPV4_BLOCKED_RANGES.some(
        ([range, mask]) => (numeric & mask) === range
    );
}

function ipv4ToNumber(address: string): bigint {
    const parts = address.split('.').map(part => Number(part));
    if (
        parts.length !== 4 ||
        parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
        throw new UrlPolicyError(`Invalid IPv4 address: ${address}`);
    }

    return (
        (BigInt(parts[0]) << 24n) +
        (BigInt(parts[1]) << 16n) +
        (BigInt(parts[2]) << 8n) +
        BigInt(parts[3])
    );
}

function isBlockedIpv6(address: string): boolean {
    const numeric = ipv6ToBigInt(address);
    return IPV6_BLOCKED_RANGES.some(
        ([range, mask]) => (numeric & mask) === range
    );
}

function ipv6ToBigInt(address: string): bigint {
    const lower = address.toLowerCase();
    const [head = '', tail = ''] = lower.split('::');
    const headParts = parseIpv6Parts(head);
    const tailParts = parseIpv6Parts(tail);
    const missing = 8 - headParts.length - tailParts.length;

    if (lower.includes('::')) {
        if (missing < 1) {
            throw new UrlPolicyError(`Invalid IPv6 address: ${address}`);
        }
    } else if (headParts.length !== 8) {
        throw new UrlPolicyError(`Invalid IPv6 address: ${address}`);
    }

    const parts = lower.includes('::')
        ? [...headParts, ...Array<number>(missing).fill(0), ...tailParts]
        : headParts;

    return parts.reduce((acc, part) => (acc << 16n) + BigInt(part), 0n);
}

function parseIpv6Parts(value: string): number[] {
    if (!value) {
        return [];
    }

    return value.split(':').map(part => {
        const parsed = Number.parseInt(part, 16);
        if (
            !part ||
            !Number.isInteger(parsed) ||
            parsed < 0 ||
            parsed > 0xffff
        ) {
            throw new UrlPolicyError(`Invalid IPv6 address part: ${part}`);
        }
        return parsed;
    });
}

function prefixMask(prefixLength: number): bigint {
    return ((1n << BigInt(prefixLength)) - 1n) << BigInt(128 - prefixLength);
}
