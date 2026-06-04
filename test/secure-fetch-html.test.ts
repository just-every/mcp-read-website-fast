import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({
    fetchMock: vi.fn(),
}));

vi.mock('undici', async importOriginal => {
    const actual = await importOriginal<typeof import('undici')>();
    return {
        ...actual,
        fetch: fetchMock,
    };
});

vi.mock('node:dns/promises', () => ({
    lookup: vi.fn(async (hostname: string) => {
        if (hostname === 'public.example') {
            return [{ address: '93.184.216.34', family: 4 }];
        }
        throw new Error(`Unexpected hostname: ${hostname}`);
    }),
}));

describe('secureFetchHtml', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    it('rejects redirects to private targets before following them', async () => {
        fetchMock.mockResolvedValueOnce({
            status: 302,
            ok: false,
            headers: new Headers({ location: 'http://127.0.0.1/metadata' }),
        });

        const { secureFetchHtml } = await import(
            '../src/internal/secureFetchHtml.js'
        );

        await expect(
            secureFetchHtml('https://public.example/start')
        ).rejects.toThrow('IP address is not allowed');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
