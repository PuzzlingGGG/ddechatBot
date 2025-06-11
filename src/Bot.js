import { EventEmitter } from 'events';
import axios from 'axios';
import WebSocket from 'ws';
import FormData from 'form-data';
import { API_BASE_URL, WSS_BASE_URL, USER_AGENT } from './constants.js';
import { User } from './User.js';
import { Post } from './Post.js';
import { DMSession } from './DMSession.js';

export class Bot extends EventEmitter {
    constructor(username, password) {
        super();
        this.username = username;
        this.password = password;
        this.token = null;
        this.user = null; // user obj
        this.api = null; // axios, passed to other classes
        this._presenceWs = null;
        this._presenceInterval = null;
    }

    async login() {
        try {
            const loginResponse = await axios.put(`${API_BASE_URL}/users/login`, {
                username: this.username,
                password: this.password,
            }, {
                headers: { 'User-Agent': USER_AGENT }
            });

            this.token = loginResponse.data.token;
            if (!this.token) {
                throw new Error('login failed: no token received');
            }

            this.api = axios.create({
                baseURL: API_BASE_URL,
                headers: {
                    'Authorization': this.token,
                    'User-Agent': USER_AGENT
                }
            });

            const meResponse = await this.api.get('/users/me');
            this.user = new User(this.api, meResponse.data);

            this._connectPresence();

            this.emit('ready', this.user);

        } catch (error) {
            const err_msg = error.response ? JSON.stringify(error.response.data) : error.message;
            this.emit('error', new Error(`login failed: ${err_msg}`));
        }
    }

    _connectPresence() {
        this._presenceWs = new WebSocket(`${WSS_BASE_URL}/users/presence`, {
            headers: { 'User-Agent': USER_AGENT }
        });

        this._presenceWs.on('open', () => {
            this._presenceInterval = setInterval(() => {
                this._presenceWs.send(JSON.stringify({ type: 'presence:heartbeat' }));
            }, 10000);
        });

        this._presenceWs.on('close', () => {
            clearInterval(this._presenceInterval);
            this.emit('disconnect');
        });

        this._presenceWs.on('error', (err) => this.emit('error', err));
    }

    async createPost(content, replyToPostId = null) {
        const payload = { content };
        if (replyToPostId) {
            payload.reply = replyToPostId;
        }
        const response = await this.api.post('/posts', payload);

        if (replyToPostId) {
            const newReplyData = response.data.replies.find(r => r.content === content);
            return new Post(this, newReplyData || response.data);
        }
        return new Post(this, response.data);
    }

    async getLatestPosts() {
        const response = await this.api.get('/posts/latest');
        return response.data.map(postData => new Post(this, postData));
    }

    async updateAvatar(avatarBuffer) {
        const form = new FormData();
        form.append('avatar', avatarBuffer, {
            filename: 'avatar.png',
            contentType: 'image/png',
        });

        await this.api.post('/users/me/avatar', form, {
            headers: form.getHeaders(),
        });
    }

    async readAllAlerts() {
        await this.api.patch('/users/me/readAlerts', {});
    }

    connectDM(recipientId) {
        const dmSession = new DMSession(this.token, recipientId);
        dmSession.connect();
        return dmSession;
    }

    logout() {
        if (this._presenceWs) {
            this._presenceWs.close();
        }
        clearInterval(this._presenceInterval);
        this.token = null;
        this.user = null;
        this.api = null;
    }

    async getUser(userId) {
        try {
            const response = await this.api.get(`/users/${userId}`); 
            return new User(this.api, response.data);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return null;
            }
            this.emit('error', new Error(`failed to get user ${userId}: ${error.message}`));
            throw error;
        }
    }
}