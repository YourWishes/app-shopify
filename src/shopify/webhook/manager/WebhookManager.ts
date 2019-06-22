// Copyright (c) 2019 Dominic Masters
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import { ShopifyShop } from '~shopify/shop/';
import { IWebhook, WebhookTopic } from 'shopify-api-node';
import { WebhookReturnTypes } from './../types/';

export type WebhookListener<T extends WebhookTopic = any> = (shop:ShopifyShop, topic:T, data:WebhookReturnTypes<T>) => Promise<void>;

export class WebhookManager {
  shop:ShopifyShop;
  webhooks:IWebhook[]=[];

  listeners:{ [topic:string]:WebhookListener[] } = {};

  constructor(shop:ShopifyShop) {
    if(!shop) throw new Error("Invalid Shop Provided");
    this.shop = shop;
  }

  async init() {

  }

  hasTopic(topic:WebhookTopic) {
    return this.webhooks.some(webhook => webhook.topic == topic && webhook.address.startsWith(this.shop.shopify.host));
  }

  getTopicHandler(topic:WebhookTopic) {
    return this.shop.shopify.webhookHandlers.find(h => h.topic == topic);
  }

  addWebhook(topic:WebhookTopic) {
    let handler = this.getTopicHandler(topic);
    if(!handler) throw new Error(`Topic ${topic} is unrecognised.`);

    return this.shop.call(token => token.api.webhook.create({
      topic, format: 'json',
      address: `${this.shop.shopify.host}${handler.getWebhookURL()}`
    }));
  }

  async addListener<T extends WebhookTopic>(topic:T, listener:WebhookListener<T>) {
    await this.registerTopic(topic);

    if(typeof this.listeners[topic] === typeof undefined) this.listeners[topic] = [];
    if(this.listeners[topic].indexOf(listener) !== -1) return;
    this.listeners[topic].push(listener);
  }

  removeListener(topic:WebhookTopic, listener:WebhookListener) {
    if(typeof this.listeners[topic] === typeof undefined) return;
    let index = this.listeners[topic].indexOf(listener);
    if(index === -1) return;
    this.listeners[topic].splice(index, 1);
  }

  async registerTopic(topic:WebhookTopic) {
    if(!topic) throw new Error(`Invalid topic!`);
    if(!this.webhooks.length) await this.updateHooks();
    if(this.hasTopic(topic)) return;
    let result = await this.addWebhook(topic);
    this.webhooks.push(result);
  }

  async updateHooks() {
    //Get all the shops webhooks
    let shopHooks = await this.shop.call(token => token.api.webhook.list());

    //Find out what webhooks belong to us
    this.webhooks = shopHooks.filter(webhook => webhook.address.startsWith(this.shop.shopify.host));
  }

  async resetWebhoooks() {
    let hooks = await this.shop.call(token => token.api.webhook.list());
    await Promise.all(hooks.map(hook => this.shop.call(token => token.api.webhook.delete(hook.id))));
    await Promise.all(Object.keys(this.listeners).map(topic => this.addWebhook(topic as WebhookTopic)));
  }
}
