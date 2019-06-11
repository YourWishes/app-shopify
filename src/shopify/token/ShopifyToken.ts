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

import * as Shopify from 'shopify-api-node';
import { ICallLimits, IAccessScope } from 'shopify-api-node';
import { ShopifyShop } from './../shop/';
import { ShopifyTaskRequest } from './../task/';
import { IShopifyApp } from '~app';
import { insertToken, deleteToken } from '~queries';

export interface IShopifyPublicToken { accessToken:string, scopes?:string[] };
export interface IShopifyPrivateToken { apiKey:string, password:string, scopes?:string[] };

//How often should we ping Shopify to see how many slots are free.
export const TOKEN_RESET_COOLDOWN = 750;

export class ShopifyToken {
  token:IShopifyPublicToken|IShopifyPrivateToken;
  shop:ShopifyShop;
  scopes:string[]=[];

  processingTasks:ShopifyTaskRequest<any>[]=[];
  checkScopesTask:NodeJS.Timeout;
  lastRequest:Date = new Date();

  api:Shopify;
  limits:ICallLimits;

  constructor(shop:ShopifyShop, token:IShopifyPublicToken|IShopifyPrivateToken) {
    if(shop == null) throw new Error("Invalid Shop");
    if(token == null) throw new Error("Invalid Token");

    this.shop = shop;
    this.token = token;
    if(token.scopes && token.scopes.length) this.scopes = token.scopes;

    //Create API Connection
    this.api = new Shopify({
      ...token,
      shopName: shop.shopName
    });
    this.api.on('callLimits', (limits) => this.onLimitsAdjusted(limits));
  }

  getAvailableSlots() {
    //Returns a count of the amount of available slots that this token
    //has available before it will hit it's limit (roughly). Some padding
    //has been added to ensure that if for some reason there's too many
    //tasks being queued then it won't overflow.
    let max = this.limits && this.limits.max ? this.limits.max : 0;
    let available = max - 10//Total available, we're going to subtract some to allow some movement
    available -= (this.limits ? this.limits.current : 0);
    available -= this.processingTasks.length;//Remove the limits we've used, and remove the tasks we're waiting for.

    if(available <= 0) {
      if(this.processingTasks.length) return 0;//We're fetching something, it should be what triggers an availibility recheck
      this.queueCheckTask();
      return 0;
    }

    return available;
  }

  isAvailable() { return this.getAvailableSlots() > 1 || (new Date().getTime() - this.lastRequest.getTime()) > TOKEN_RESET_COOLDOWN; }

  async fetchAccessScopes() {
    if(this.processingTasks.length) return this.scopes;

    //Create a task for this token only, then start it
    let task = new ShopifyTaskRequest((token) => token.api.accessScope.list());
    this.startTask(task);

    //Wait for it...
    let scopes:IAccessScope[] = await task.wait();

    //Store
    this.scopes = scopes.map(e => e.handle);

    //Return scopes cuz why not
    return this.scopes;
  }

  queueCheckTask(delay:number=TOKEN_RESET_COOLDOWN) {
    //Puts a small delay on checking the access scopes, this will also cause the
    //token to update it's call limits, but only once every $delay milliseconds
    if(this.checkScopesTask) return;

    this.checkScopesTask = setTimeout(async () => {
      try {
        await this.fetchAccessScopes();
      } catch(ex) {
        //Failed to fetch, this could be because we're still hitting the limits
        //If this fails because of a 429 we can run the queue check again
        console.error(ex);
        //this.shop.shopify.logger.severe(ex);
      }

      if(this.checkScopesTask) clearTimeout(this.checkScopesTask);
      this.checkScopesTask = null;
    }, delay);
  }

  async verify():Promise<boolean> {
    try {
      let scopes = await this.fetchAccessScopes();
      let app = this.shop.shopify.app as IShopifyApp;
      if(!app.getShopifyScopes(this.shop.shopName).every(scope => scopes.indexOf(scope) !== -1)) {
        throw new Error("Shop is missing the required scopes!");
      }
      return true;
    } catch(e) {
      this.shop.shopify.logger.warn(`Shop ${this.shop.shopName} failed to verify!`);
      this.shop.shopify.logger.warn(e);
    }

    //For some reason the token doesn't work (unverified)
    try {
      await this.delete();
    } catch(ex) {
      this.shop.shopify.logger.severe(ex);
    }
    return false;
  }

  async delete() {
    if(!this.shop.shopify.hasDatabase) return;

    let app = this.shop.shopify.app as IShopifyApp;
    this.shop.removeToken(this);
    if(!this.token['accessToken']) return;

    let token = this.token as IShopifyPublicToken;
    try {
      await deleteToken(app.database, this.shop.shopName, token.accessToken);
    } catch(e) {
      this.shop.shopify.logger.error(`Failed to delete token ${token.accessToken}`);
      this.shop.shopify.logger.error(e);
    }
  }

  async save() {
    if(!this.shop.shopify.hasDatabase) return;

    let app = this.shop.shopify.app as IShopifyApp;
    let token = this.token as IShopifyPublicToken;
    if(!token.accessToken) return;
    await insertToken(app.database, this.shop.shopName, token.accessToken, new Date());
  }

  startTask(task:ShopifyTaskRequest<any>) {
    this.lastRequest = new Date();//Update the last request
    this.processingTasks.push(task);
    task.start(this);
  }

  onLimitsAdjusted(limits:ICallLimits) {
    this.lastRequest = new Date();
    this.limits = limits;
    this.shop.checkPending();
  }

  onTaskComplete(task:ShopifyTaskRequest<any>) {
    let index = this.processingTasks.indexOf(task);
    if(index !== -1) this.processingTasks.splice(index, 1);
    this.shop.onTaskComplete(task);
  }

  onTaskError(task:ShopifyTaskRequest<any>) {
    let index = this.processingTasks.indexOf(task);
    if(index !== -1) this.processingTasks.splice(index, 1);
    this.shop.onTaskError(task);
  }
}
