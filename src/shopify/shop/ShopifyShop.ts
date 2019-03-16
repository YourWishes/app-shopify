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

import { isValidShopName } from '@yourwishes/shopify-utils';
import { ShopifyToken } from './../token/ShopifyToken';
import { ShopifyTask, ShopifyTaskRequest } from './../task/ShopifyTask';
import { ShopifyModule } from './../../module/';

export class ShopifyShop {
  shopName:string;
  shopify:ShopifyModule;
  tokens:ShopifyToken[]=[];

  queuedTasks:ShopifyTaskRequest[]=[];
  processingTasks:ShopifyTaskRequest[]=[];

  isChecking:boolean=false;

  constructor(shopify:ShopifyModule, shopName:string) {
    if(shopify == null) throw new Error("Invalid Shopify Module");
    if(!isValidShopName(shopName)) throw new Error("Invalid Shop Name.");
    this.shopify = shopify;
    this.shopName = shopName;
  }

  addToken(token:ShopifyToken) {
    if(token == null) throw new Error("Invalid Token");
    if(this.tokens.indexOf(token) !== -1) return;
    this.tokens.push(token);
  }

  removeToken(token:ShopifyToken) {
    if(token == null) throw new Error("Invalid Token");
    let index = this.tokens.indexOf(token);
    if(index === -1) return;
    this.tokens.splice(index, 1);
  }

  async verifyTokens() {
    //This will verify each token in the shop.
    let tokens = [...this.tokens];//Duplicate for modified arrays.
    let promises = tokens.map(token => token.verify());
    if(this.tokens.length === 0) this.shopify.removeShop(this);
  }

  checkPending() {
    if(this.isChecking) return false;
    this.isChecking = true;

    let tasks = [...this.queuedTasks].sort((l,r) => {
      return l.priority - r.priority;
    });

    if(!tasks.length) return this.isChecking = false;

    let availableTokens = this.tokens.filter(token => token.isAvailable());
    if(!availableTokens.length) return this.isChecking = false;

    availableTokens.forEach(token => {
      if(!tasks.length || !this.queuedTasks.length) return;

      while(true) {
        let task = tasks.shift();
        if(!task) break;
        let index = this.queuedTasks.indexOf(task);
        if(index !== -1) this.queuedTasks.splice(index, 1);

        this.processingTasks.push(task);
        token.startTask(task);

        if(!tasks.length || !this.queuedTasks.length) break;
        if(!token.isAvailable()) break;
      }
    });

    this.isChecking = false;
  }

  queue(task:ShopifyTask, priority?:number) {
    let request = new ShopifyTaskRequest(task, priority);
    this.queuedTasks.push(request);
    this.checkPending();
    return request;
  }

  async call(task:ShopifyTask, priority?:number) {
    //Essentially a "queue, wait, and then return my result"
    let request = this.queue(task, priority);
    return await request.wait();
  }

  onTaskComplete(task:ShopifyTaskRequest) {
    let index = this.processingTasks.indexOf(task);
    if(index !== -1) this.processingTasks.splice(index, 1);
    this.checkPending();
  }

  onTaskError(task:ShopifyTaskRequest) {
    let index = this.processingTasks.indexOf(task);
    if(index !== -1) this.processingTasks.splice(index, 1);
    this.checkPending();
  }
}
