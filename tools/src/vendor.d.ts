declare module 'postcss-prefix-selector' {
    import type { Plugin } from 'postcss';

    interface Options {
        prefix: string;
        transform?: (prefix: string, selector: string, prefixedSelector: string) => string;
    }

    export default function prefixSelector(options: Options): Plugin;
}
