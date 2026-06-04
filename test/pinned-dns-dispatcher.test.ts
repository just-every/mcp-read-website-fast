import { describe, expect, it } from 'vitest';
import { createPinnedLookup } from '../src/internal/pinnedDnsDispatcher.js';

describe('pinned DNS dispatcher lookup', () => {
    it('returns only the validated addresses from URL policy resolution', async () => {
        const lookup = createPinnedLookup({
            url: new URL('https://public.example/'),
            hostname: 'public.example',
            addresses: [
                { address: '93.184.216.34', family: 4 },
                { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
            ],
        });

        await expect(
            new Promise((resolve, reject) => {
                lookup('public.example', { all: true }, (error, addresses) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(addresses);
                });
            })
        ).resolves.toEqual([
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ]);
    });

    it('rejects lookups for any hostname other than the validated one', async () => {
        const lookup = createPinnedLookup({
            url: new URL('https://public.example/'),
            hostname: 'public.example',
            addresses: [{ address: '93.184.216.34', family: 4 }],
        });

        await expect(
            new Promise((resolve, reject) => {
                lookup('attacker.example', {}, error => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(undefined);
                });
            })
        ).rejects.toThrow('Unexpected hostname lookup');
    });
});
