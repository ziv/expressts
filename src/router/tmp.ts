

class Foo {
}

const p = new Proxy(Foo, {
    get(target: Foo, p: string | symbol, receiver: any): any {
        return () => {
            console.log(p);
        };
    },
    apply(target: Foo, thisArg: any, argArray: any[]): any {
        console.log(target, thisArg, argArray);
        return target;
    }
});


// @ts-ignore
p.fff();
