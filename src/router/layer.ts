import {ParseOptions, pathToRegexp, TokensToRegexpOptions} from 'path-to-regexp';
import {decode_param} from './helpers';

export type Regexp = RegExp & { fast_star: boolean, fast_slash: boolean };
export type Options = TokensToRegexpOptions & ParseOptions;
export type Callable = (...args: any[]) => void;

const has = Object.prototype.hasOwnProperty;

export class Layer {
    keys: any[] = [];
    handle: Callable;
    name: string;
    method: string = undefined;
    params: any = undefined;
    path: string = undefined;
    regexp: Regexp = undefined;

    constructor(path: string,
                options: Options = {},
                fn: Callable) {
        this.handle = fn;
        this.name = fn.name || '<anonymous>';
        this.regexp = pathToRegexp(path, this.keys, options || {}) as Regexp;
        this.regexp.fast_star = path === '*';
        this.regexp.fast_slash = path === '/' && options.end === false
    }

    handle_error(error: Error, req, res, next) {
        const fn = this.handle;

        if (fn.length !== 4) {
            return next(error);
        }

        try {
            fn(error, req, res, next);
        } catch (err) {
            next(err);
        }
    }

    handle_request(req, res, next) {
        const fn = this.handle;

        if (fn.length > 3) {
            return next();
        }

        try {
            fn(req, res, next);
        } catch (err) {
            next(err);
        }
    }

    match(path: string): boolean {
        if (null != path) {
            // fast path non-ending match for / (any path matches)
            if (this.regexp.fast_slash) {
                this.params = {};
                this.path = '';
                return true;
            }

            // fast path for * (everything matched in a param)
            if (this.regexp.fast_star) {
                this.params = {'0': decode_param(path)};
                this.path = path;
                return true;
            }
        }

        // match the path
        const match = this.regexp.exec(path);

        if (!match) {
            this.params = undefined;
            this.path = undefined;
            return false;
        }

        // todo simplify this section
        // store values
        this.params = {};
        this.path = match[0];

        const keys = this.keys;
        const params = this.params;

        for (let i = 1; i < match.length; i++) {
            const key = keys[i - 1];
            const prop = key.name;
            const val = decode_param(match[i])

            if (val !== undefined || !(has.call(params, prop))) {
                params[prop] = val;
            }
        }
        return true;
    }
}
