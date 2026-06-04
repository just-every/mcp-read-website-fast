import type { LookupFunction } from 'node:net';
import { Agent } from 'undici';
import type { PublicHttpUrlResolution } from '../utils/urlPolicy.js';

interface LookupOptions {
    all?: boolean;
}

export function createPinnedDnsAgent(
    resolution: PublicHttpUrlResolution
): Agent {
    return new Agent({
        connect: {
            lookup: createPinnedLookup(resolution),
        },
    });
}

export function createPinnedLookup(
    resolution: PublicHttpUrlResolution
): LookupFunction {
    return (hostname, options, callback) => {
        const normalizedHostname = normalizeLookupHostname(hostname);
        if (normalizedHostname !== resolution.hostname) {
            callback(
                new Error(
                    `Unexpected hostname lookup: ${normalizedHostname}`
                ) as NodeJS.ErrnoException,
                ''
            );
            return;
        }

        if ((options as LookupOptions).all) {
            callback(null, resolution.addresses);
            return;
        }

        const address = resolution.addresses[0];
        callback(null, address.address, address.family);
    };
}

function normalizeLookupHostname(hostname: string): string {
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
        return hostname.slice(1, -1);
    }

    return hostname;
}
