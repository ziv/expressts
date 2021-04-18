import EventEmitter from 'events';
import {createServer} from 'http';

export class Express extends EventEmitter {

    listen(port: number, host: string) {
        createServer()
    }
}
