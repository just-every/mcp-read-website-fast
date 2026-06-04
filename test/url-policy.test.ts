import { describe, expect, it } from 'vitest';
import { assertPublicHttpUrl } from '../src/utils/urlPolicy.js';

describe('URL policy', () => {
    it.each([
        'file:///etc/passwd',
        'ftp://example.com/',
        'http://127.0.0.1/',
        'http://2130706433/',
        'http://10.0.0.1/',
        'http://172.16.0.1/',
        'http://192.168.0.1/',
        'http://169.254.169.254/',
        'http://[::1]/',
        'http://[fc00::1]/',
        'http://[fe80::1]/',
        'http://localhost/',
    ])('rejects unsafe target %s', async target => {
        await expect(assertPublicHttpUrl(target)).rejects.toThrow();
    });

    it('allows public HTTP and HTTPS targets after DNS validation', async () => {
        await expect(
            assertPublicHttpUrl('https://example.com/')
        ).resolves.toBeInstanceOf(URL);
        await expect(
            assertPublicHttpUrl('http://example.com/')
        ).resolves.toBeInstanceOf(URL);
    });
});
