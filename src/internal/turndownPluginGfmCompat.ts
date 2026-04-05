import { createRequire } from 'node:module';

type GfmPlugin = (service: unknown) => void;

const require = createRequire(import.meta.url);
const turndownPluginGfmModule = require('turndown-plugin-gfm') as {
    default?: { gfm?: GfmPlugin };
    gfm?: GfmPlugin;
};

export const gfm =
    turndownPluginGfmModule.gfm ?? turndownPluginGfmModule.default?.gfm;

if (typeof gfm !== 'function') {
    throw new Error('turndown-plugin-gfm did not provide a usable gfm export');
}
