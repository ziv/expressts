// const slice = Array.prototype.slice;
// const toString = Object.prototype.toString;
import {METHODS as UCMethods} from 'http';
import {flatten} from 'array-flatten';
import {Layer} from './layer';

const METHODS = UCMethods.map(m => m.toLowerCase());

export class Route {
    stack = [];
    methods: any = {};

    static create(path: string): Route {
        return new Proxy<Route>(new Route(path), {
            get(target: Route, p: string): any {
                return p in target ? target[p] : target._method(p);
            }
        });
    }

    constructor(public readonly path: string) {
    }

    dispatch(req, res, done) {
        let idx = 0;
        const stack = this.stack;
        if (stack.length === 0) {
            return done();
        }

        let method = req.method.toLowerCase();
        if (method === 'head' && !this.methods['head']) {
            method = 'get';
        }

        req.route = this;

        next();

        function next(err?: any) {
            // signal to exit route
            if (err && err === 'route') {
                return done();
            }

            // signal to exit router
            if (err && err === 'router') {
                return done(err)
            }

            const layer = stack[idx++];
            if (!layer) {
                return done(err);
            }

            if (layer.method && layer.method !== method) {
                return next(err);
            }

            if (err) {
                layer.handle_error(err, req, res, next);
            } else {
                layer.handle_request(req, res, next);
            }
        }
    }

    all() {
        const handles = flatten(Array.prototype.slice.call(arguments));

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i];

            if (typeof handle !== 'function') {
                const type = toString.call(handle);
                const msg = 'Route.all() requires a callback function but got a ' + type;
                throw new TypeError(msg);
            }

            const layer = new Layer('/', {}, handle);
            layer.method = undefined;

            this.methods._all = true;
            this.stack.push(layer);
        }

        return this;
    }

    get(...handles: any[]) {
        const method = 'get';
        handles = flatten(handles);
        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i];

            if (typeof handle !== 'function') {
                const type = toString.call(handle);
                const msg = 'Route.' + method + '() requires a callback function but got a ' + type
                throw new Error(msg);
            }

            const layer = new Layer('/', {}, handle);
            layer.method = method;

            this.methods[method] = true;
            this.stack.push(layer);
        }
    }

    // methods.forEach(function(method){
    //     Route.prototype[method] = function(){
    //         var handles = flatten(slice.call(arguments));
    //
    //         for (var i = 0; i < handles.length; i++) {
    //             var handle = handles[i];
    //
    //             if (typeof handle !== 'function') {
    //                 var type = toString.call(handle);
    //                 var msg = 'Route.' + method + '() requires a callback function but got a ' + type
    //                 throw new Error(msg);
    //             }
    //
    //             debug('%s %o', method, this.path)
    //
    //             var layer = Layer('/', {}, handle);
    //             layer.method = method;
    //
    //             this.methods[method] = true;
    //             this.stack.push(layer);
    //         }
    //
    //         return this;
    //     };
    // });

    _method(method: string) {
        return (function (...handles: any[]) {
            for (var i = 0; i < handles.length; i++) {
                var handle = handles[i];

                if (typeof handle !== 'function') {
                    var type = toString.call(handle);
                    var msg = 'Route.' + method + '() requires a callback function but got a ' + type
                    throw new Error(msg);
                }

                var layer = new Layer('/', {}, handle);
                layer.method = method;

                this.methods[method] = true;
                this.stack.push(layer);
            }

            return this;
        }).bind(this);
    }

    _handles_method(method: string): boolean {
        if (this.methods._all) {
            return true;
        }
        let name = method.toLowerCase();
        if ('head' === name && !this.methods.head) {
            name = 'get';
        }
        return !!this.methods[name];
    }

    _options() {
        const methods = Object.keys(this.methods);

        // append automatic head
        if (this.methods.get && !this.methods.head) {
            methods.push('head');
        }

        for (let i = 0; i < methods.length; i++) {
            // make upper case
            methods[i] = methods[i].toUpperCase();
        }

        return methods;
    }
}
