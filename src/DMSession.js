import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WSS_BASE_URL, USER_AGENT } from './constants.js';

export class DMSession extends EventEmitter {
    constructor(token, recipientId) {
        super();
        this._token = token;
        this.recipientId = recipientId;
        this.ws = null;
    }

    connect() {
        this.ws = new WebSocket(`${WSS_BASE_URL}/users/dm`, {
            headers: { 'User-Agent': USER_AGENT }
        });

        this.ws.on('open', () => {
            this.ws.send(JSON.stringify({ // we only have one open dm session for each bot because idk if you can connect to multiple dms at once
                type: 'dm:join',
                token: this._token,
                recipientId: this.recipientId
            }));
            this.emit('open');
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'dm:receive') {
                this.emit('message', message.message);
            }
        });

        this.ws.on('close', () => this.emit('close'));
        this.ws.on('error', (err) => this.emit('error', err));
    }

    sendMessage(content, options = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('DMSession is not connected');
        }

        const payload = {
            type: 'dm:message',
            recipientId: this.recipientId,
            content,
            effect: options.effect || '',
            spoiler: options.spoiler || false
        };
        this.ws.send(JSON.stringify(payload));
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}