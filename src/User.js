import { API_BASE_URL } from './constants.js';

export class User {
    constructor(api, data) {
        this._api = api;
        
        this.id = data.id;
        this.username = data.username;
        this.avatarData = data.avatar;
        this.friends = data.friends || [];
        this.alerts = data.alerts || [];
        this.isModerator = data.isModerator || false;

        this._rawData = data;
    }

    async getAvatar() {
        const response = await this._api.get(`/users/${this.id}/avatar`, {
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data, 'binary');
    }

    async sendFriendRequest() {
        await this._api.post(`/users/${this.id}/friendRequest`, {});
    }

    isFriendsWith(userId) {
        if (!this.friends || this.friends.length === 0) {
            return false;
        }
        return this.friends.some(friend => friend.id === userId);
    }
}