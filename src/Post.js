import { User } from './User.js';

export class Post {
    constructor(bot, data) {
        this._bot = bot;
        this._api = bot.api;
        
        this.id = data.id;
        this.content = data.content;
        this.author = new User(this._api, data.author || { id: data.authorId, username: data.authorUsername });
        this.likes = data.likes || [];
        this.replies = (data.replies || []).map(replyData => new Post(bot, replyData));
        this.created = new Date(data.created);
        this.replyingToId = data.replyingToId || null;
    
        this._rawData = data;
    }

    async like() {
        await this._api.patch(`/posts/${this.id}/like`, {});
    }

    async reply(content) {
        return this._bot.createPost(content, this.id);
    }

    async delete() {
        await this._api.delete(`/posts/${this.id}`);
    }
}