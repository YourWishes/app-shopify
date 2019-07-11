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
import { ShopifyToken, IShopifyToken } from './../token/';
import { ShopifyTask, ShopifyTaskRequest, PRIORITY_HIGH } from './../task/';
import { ShopifyModule } from '~module';
import { WebhookManager } from './../webhook/';
import { CarrierManager } from './../carrier/';

export class ShopifyShop {
  shopName:string;
  shopify:ShopifyModule;
  tokens:ShopifyToken[]=[];
  webhooks:WebhookManager;
  carriers:CarrierManager;

  queuedTasks:ShopifyTaskRequest<any>[]=[];
  processingTasks:ShopifyTaskRequest<any>[]=[];
  queueCheck:NodeJS.Timeout;

  isChecking:boolean=false;
  isInitialized:boolean=false;

  constructor(shopify:ShopifyModule, shopName:string) {
    if(shopify == null) throw new Error("Invalid Shopify Module");
    if(!isValidShopName(shopName)) throw new Error("Invalid Shop Name.");

    this.shopify = shopify;
    this.shopName = shopName;
    this.webhooks = new WebhookManager(this);
    this.carriers = new CarrierManager(this);
  }

  //============= Tokens =============//
  addToken(token:ShopifyToken) {
    if(token == null) throw new Error("Invalid Token");
    if(this.tokens.indexOf(token) !== -1) return;

    //Start the checking timer (if required)
    if(!this.queueCheck) this.queueCheck = setInterval(() => this.checkPending(), 1000);

    this.tokens.push(token);
  }

  removeToken(token:ShopifyToken) {
    if(token == null) throw new Error("Invalid Token");
    let index = this.tokens.indexOf(token);
    if(index === -1) return;
    this.tokens.splice(index, 1);

    //Stop the checking timer
    if(!this.tokens.length) {
      clearInterval(this.queueCheck);
      this.queueCheck = null;
    }
  }

  async verifyTokens() {
    //This will verify each token in the shop.
    let tokens = [...this.tokens];//Duplicate for modified arrays.
    let promises = await tokens.map(token => token.verify());
    if(this.tokens.length === 0) {
      this.shopify.removeShop(this);
    } else if(!this.isInitialized) {
      this.isInitialized = true;
      this.onInitialize();
    }
  }

  //============= Tasks =============//
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

      let i = 0;
      while(true) {
        let task = tasks[i++];
        if(!task) break;

        //If this specific task has a token restriction, let's enforce it.
        if(task.targetToken && token.token != task.targetToken) continue;

        //Task can exec, let's do so.
        task = tasks.shift(), i = 0;
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

  retry(task:ShopifyTaskRequest<any>) {
    let index = this.processingTasks.indexOf(task);
    if(index === -1) throw new Error(`Cannot requeue a task unless it's still pending!`);
    this.processingTasks.splice(index, 1);
    task.priority = PRIORITY_HIGH;
    this.queuedTasks.push(task);
    this.checkPending();
  }

  //Queuing functions.
  queueToken<T>(task:ShopifyTask<T>, token:IShopifyToken, priority?:number) {
    //Supply an apiKey to enforce that token receives the task.
    let request = new ShopifyTaskRequest<T>(task, token, priority);
    this.queuedTasks.push(request);
    this.checkPending();
    return request;
  }

  queue<T>(task:ShopifyTask<T>, priority?:number) { return this.queueToken(task, null, priority); }

  //Calling Functions
  async callToken<T>(task:ShopifyTask<T>, token:IShopifyToken, priority?:number) {
    //Essentially a "queue, wait, and then return my result"
    let request = this.queueToken<T>(task, token, priority);
    return await request.wait();
  }

  call<T>(task:ShopifyTask<T>, priority?:number) { return this.callToken<T>(task, null, priority); }

  callPrimary<T>(task:ShopifyTask<T>, priority?:number) {
    if(!this.tokens.length) throw new Error(`Can't queue primary when there are no available tokens!`);
    return this.callToken<T>(task, this.tokens[0].token, priority);
  }

  //============= Events =============//
  onInitialize() {

  }

  onTaskComplete(task:ShopifyTaskRequest<any>) {
    let index = this.processingTasks.indexOf(task);
    if(index !== -1) this.processingTasks.splice(index, 1);
    this.checkPending();
  }

  onTaskError(task:ShopifyTaskRequest<any>) {
    let index = this.processingTasks.indexOf(task);
    if(index !== -1) this.processingTasks.splice(index, 1);
    this.checkPending();
  }
}
