import { resolveTurndownPluginCompatUrl } from './turndownPluginCompat.js';

const turndownPluginCompatUrl = resolveTurndownPluginCompatUrl();

export async function resolve(
    specifier: string,
    context: { parentURL?: string },
    defaultResolve: (
        specifier: string,
        context: { parentURL?: string }
    ) => Promise<{ url: string }>
): Promise<{ shortCircuit?: boolean; url: string }> {
    if (specifier === 'turndown-plugin-gfm') {
        return {
            shortCircuit: true,
            url: turndownPluginCompatUrl,
        };
    }

    return defaultResolve(specifier, context);
}
