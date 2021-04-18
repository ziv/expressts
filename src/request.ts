import {IncomingMessage} from 'http';
import accepts from 'accepts';
import RangeParser from 'range-parser';
import parseurl from 'parseurl';
import typeIs from 'type-is';
import proxyAddr from 'proxy-addr';
import {isIP} from 'net';
import fresh from 'fresh';

export type HeaderValue = string | string[];

export class Request extends IncomingMessage {
    app: any;
    res: any;

    // getters

    get query() {
        const fn = this.app.get('query parser fn');
        if (!fn) {
            return {};
        }
        // todo parse url from Node core is better
        return fn(parseurl(this).query);
    }

    get protocol() {
        // todo change to socket (Node 13 and up)
        // @ts-ignore
        let proto = this.connection.encrypted ? 'https' : 'http';
        const trust = this.app.get('trust proxy fn');

        if (!trust(this.connection.remoteAddress, 0)) {
            return proto;
        }

        // Note: X-Forwarded-Proto is normally only ever a
        //       single value, but this is to be safe.
        proto = this.get('X-Forwarded-Proto') as string || proto;
        return proto.split(/\s*,\s*/)[0];
    }

    get secure(): boolean {
        return 'https' === this.protocol;
    }

    get ip(): string {
        return proxyAddr(this, this.app.get('trust proxy fn'));
    }

    get ips(): string[] {
        const addrs = proxyAddr.all(this, this.app.get('trust proxy fn'));
        addrs.reverse().pop();
        return addrs;
    }

    get subdomains(): string[] {
        const hostname = this.hostname;
        if (!hostname) {
            return [];
        }

        const offset = this.app.get('subdomain offset');
        const subdomains = !isIP(hostname)
            ? hostname.split('.').reverse()
            : [hostname];

        return subdomains.slice(offset);
    }

    get path(): string {
        return parseurl(this).pathname;
    }

    get host(): string | undefined {
        const trust = this.app.get('trust proxy fn');
        let val = this.get('X-Forwarded-Host') as string;

        if (!val || !trust(this.connection.remoteAddress, 0)) {
            val = this.get('Host') as string;
        }

        return val || undefined;
    }

    get hostname(): string {
        const host = this.host;
        if (!host) {
            return;
        }
        // IPv6 literal support
        const offset = host[0] === '['
            ? host.indexOf(']') + 1
            : 0;
        const index = host.indexOf(':', offset);

        return index !== -1
            ? host.substring(0, index)
            : host;
    }

    get fresh() {
        const method = this.method;
        const res = this.res
        const status = res.statusCode

        // GET or HEAD for weak freshness validation only
        if ('GET' !== method && 'HEAD' !== method) {
            return false;
        }

        // 2xx or 304 as per rfc2616 14.26
        if ((status >= 200 && status < 300) || 304 === status) {
            return fresh(this.headers, {
                'etag': res.get('ETag'),
                'last-modified': res.get('Last-Modified')
            })
        }

        return false;
    }

    get stale(): boolean {
        return !this.fresh;
    }

    get xhr(): boolean {
        return 'xmlhttprequest' === (this.get('X-Requested-With') as string || '').toLowerCase();
    }

    // methods

    is(...types: any[]) {
        return typeIs(this, types);
    }

    get(name: string): HeaderValue {
        if (!name) {
            throw new TypeError('name argument is required to req.get');
        }

        if (typeof name !== 'string') {
            throw new TypeError('name must be a string to req.get');
        }
        const lc = name.toLowerCase();
        switch (lc) {
            case 'referer':
            case 'referrer':
                return (this.headers.referrer || this.headers.referer);
            default:
                return this.headers[lc];
        }
    }

    header(name: string): HeaderValue {
        return this.get(name);
    }

    accepts(...items: any[]) {
        // todo remove use of accepts, no need for shortened
        const accept = accepts(this);
        return accept.types.apply(accept, items);
    }

    acceptsEncodings(...items: any[]) {
        // todo remove use of accepts, no need for shortened
        const accept = accepts(this);
        return accept.encodings.apply(accept, items);
    };

    acceptsCharsets(...items: any[]) {
        // todo remove use of accepts, no need for shortened
        const accept = accepts(this);
        return accept.charsets.apply(accept, items);
    }

    acceptsLanguages(...items: any[]) {
        // todo remove use of accepts, no need for shortened
        const accept = accepts(this);
        return accept.languages.apply(accept, items);
    }

    range(size: number, options?: RangeParser.Options) {
        const range = this.get('Range') as string;
        if (!range) {
            return;
        }
        return RangeParser(size, range, options);
    }
}
