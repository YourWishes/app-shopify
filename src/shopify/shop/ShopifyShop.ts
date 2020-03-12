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
import { isValidShopName } from '@yourwishes/shopify-utils';
import { ShopifyToken, IShopifyToken } from './../token/';
import { ShopifyTask, ShopifyTaskRequest, PRIORITY_HIGH, PRIORITY_MEDIUM, PRIORITY_FORCE } from './../task/';
import { ShopifyModule } from '~module';
import { WebhookManager } from './../webhook/';
import { CarrierManager } from './../carrier/';
import { $Keys, $PropertyType } from 'utility-types';

export interface FetchableParams {
  limit?:number
};

export interface FetchableIdsParams extends FetchableParams {
  ids:number[]|string[]
}

export type FetchableResourceTypes = {
  blog:Shopify.IBlog,
  checkout:Shopify.ICheckout,
  collect:Shopify.ICollect,
  collectionListing:Shopify.ICollectionListing,
  comment:Shopify.IComment,
  country:Shopify.ICountry,
  customCollection:Shopify.ICustomCollection,
  customer:Shopify.ICustomer,
  customerSavedSearch:Shopify.ICustomerSavedSearch,
  draftOrder:Shopify.IDraftOrder,
  event:Shopify.IEvent,
  giftCard:Shopify.IGiftCard,
  location:Shopify.ILocation,
  marketingEvent:Shopify.IMarketingEvent,
  metafield:Shopify.IMetafield,
  order:Shopify.IOrder,
  page:Shopify.IPage,
  priceRule:Shopify.IPriceRule,
  product:Shopify.IProduct,
  productListing:Shopify.IProductListing,
  redirect:Shopify.IRedirect,
  report:Shopify.IReport,
  scriptTag:Shopify.IScriptTag,
  smartCollection:Shopify.ISmartCollection,
  webhook:Shopify.IWebhook
}

export type FetchableResource = $Keys<FetchableResourceTypes>;
export type FetchableResourceMap<T extends FetchableResource> = $PropertyType<FetchableResourceTypes, T>;

export const LIMIT_MAX = 250;

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

    //Get tasks, sorted by priority
    let tasks = [...this.queuedTasks].sort((l,r) => {
      return l.priority - r.priority;
    });
    
    //Forced tasks
    let forcedTasks = tasks.filter(t => t.priority <= PRIORITY_FORCE);
    if(forcedTasks.length) {
      forcedTasks.every(task => {
        let token = this.tokens.find(t => t.getAvailableSlots() > 0);
        if(!token) return false;

        //Specific token restriction
        if(task.targetToken && token.token != task.targetToken) return true;
        
        //Remove from pending lists
        let index = this.queuedTasks.indexOf(task);
        if(index !== -1) this.queuedTasks.splice(index, 1);
        
        index = tasks.indexOf(task);
        if(index !== -1) tasks.splice(index, 1);
        
        //Add to processing list
        this.processingTasks.push(task);
        token.startTask(task);
        return true;
      });
    }
    
    //Anything to do?
    if(!tasks.length) return this.isChecking = false;

    //Fetch tokens we can use
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

  //Advanced Calling Functions
  async fetchAll<T extends FetchableResource,P extends FetchableParams = any>(resource:T, params?:P, priority:number=PRIORITY_MEDIUM) {
    if(!params) params = {} as P;

    //Get type expected for the given resource
    type M = FetchableResourceMap<typeof resource>;

    //Set the limit if not already set.
    params.limit = params.limit || LIMIT_MAX;

    //Convert to string, helps with some typescript issues that are around
    let res = resource as any as string;

    //Make our buffer & params
    let resources:M[] = [];
    let pageParams = { ...params };

    //Fetch each page...
    while(pageParams !== undefined) {
      //Fetch...
      let pageResources:M[] = await this.call(token => token.api[res].list(pageParams), priority);
      pageParams = pageResources['nextPageParameters'];
      //Flatten...
      resources.push(...pageResources);
    }
    return resources;
  }

  async fetchAllIds<T extends FetchableResource,P extends FetchableIdsParams = any>(resource:T, params:P, priority:number=PRIORITY_MEDIUM) {
    //Once again determine type based off resource
    type M = FetchableResourceMap<typeof resource>;
    let { limit, ids } = params;
    if(!ids.length) return [];//Nothing to do?
    limit = params.limit || LIMIT_MAX;//Set Limit if not already

    //Determine the amount of calls we're going to have to do
    let idCalls = Math.ceil(ids.length / limit);

    //Create a buffer
    let stuff:M[] = [];

    //Fetch each set of IDs, since there's a limit per call this is how we're
    //going to do it.
    for(let call = 0; call < idCalls; call++) {
      let fetchIds = [];
      for(let x = call*limit; x < Math.min(ids.length, call*limit+call); x++) {
        fetchIds.push(ids[x]);//Figure out and only do the IDs we can this time.
      }
      let s = await this.fetchAll<T,P>(resource, { ...params, ids: fetchIds }, priority);
      stuff = [ ...stuff,...s ];//Fetch and append to buffer before returning
    }
    return stuff;
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
