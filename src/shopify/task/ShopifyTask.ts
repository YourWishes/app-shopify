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

import { ShopifyToken, IShopifyToken, TOKEN_RESET_COOLDOWN } from './../token/';

export type ShopifyTask<T> = (token:ShopifyToken) => Promise<T>;

export const PRIORITY_FORCE:number = -50;
export const PRIORITY_HIGH:number =   -1;
export const PRIORITY_MEDIUM:number =  0;
export const PRIORITY_LOW:number =     1;

export class ShopifyTaskRequest<T> {
  task:ShopifyTask<T>;
  targetToken:IShopifyToken;
  priority:number;
  queued:Date;
  token:ShopifyToken;

  promise:Promise<T>;
  result:T;
  error:any;

  id:number;

  interval:NodeJS.Immediate;
  resolve:(value?:T) => void = null;
  reject:(reason?:any) => void = null;

  maxRetries:number=3;
  try:number=0;

  constructor(task:ShopifyTask<T>, targetToken:IShopifyToken=null, priority:number=PRIORITY_MEDIUM) {
    if(!task) throw new Error("Invalid task supplied.");
    this.task = task;
    this.targetToken = targetToken;
    this.priority = priority;
    this.queued = new Date();
  }

  start(token:ShopifyToken) {
    if(!token) throw new Error("Invalid token supplied");

    //Track our token
    this.token = token;
    this.id = Math.round(Math.random()*1000000);
    this.try++;

    //Now do my process
    let promise = this.task(token);
    if(!promise.then || promise.then !== Promise.prototype.then) {
      throw new Error("Passed Task Function is not a valid async function, or does not return a valid promise!");
    }

    this.interval = setImmediate(() => this.checkTask());

    promise.then((result) => {
      this.onTaskFinished(result);
    }).catch((error) => {
      this.onTaskError(error);
    });
  }

  shouldErrorRestart(e:any) {
    let ej = JSON.stringify(e).toLowerCase();
    return [
      'calls per second', 'too many requests', 'econnreset', 'econnrefused'
    ].some(x => ej.includes(x));
  }

  onTaskFinished(result:T) {
    this.stopTask();
    
    this.result = result;
    if(this.resolve) this.resolve(result);
    this.token.onTaskComplete(this);
  }

  onTaskError(error:any) {
    //Make a nice Shopify Error
    let e = error;
    if(error && error.response && error.response.body && error.response.body.errors) {
      e = error.response.body.errors;
    }

    //Check the type of error, under certain conditions we're going to restart
    //the task.
    if(this.shouldErrorRestart(e)) {
      //How many tries are we on?
      if(this.maxRetries && this.try >= this.maxRetries) {
        this.token.shop.shopify.logger.severe(`Max retries was reached for task #${this.id}!`);
      } else {
        this.stopTask();
        return this.token.shop.retry(this);
      }
    }

    if(e.base) e = e.base;
    if(Array.isArray(e)) e = e.join('\n');

    this.error = error;
    if(this.reject) this.reject(e);
    this.stopTask();
    this.token.onTaskError(this);
  }

  async wait() {
    //Did the task finish fast?
    if(this.result) return this.result;
    if(this.error) throw this.error;

    //Create an interval
    if(!this.promise) {
      this.promise = new Promise<T>((resolve,reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }

    return await this.promise;
  }

  checkTask() {
    this.interval = setImmediate(() => this.checkTask());

    //Has it failed/succeeded?
    let isNorU = (r:any) => r === null || typeof r === typeof undefined;//isNorU
    if(isNorU(this.result) && isNorU(this.error)) return;
    if(this.reject == null || this.resolve == null) return;

    //Yes, stop this worker
    this.stopTask();
    
    //Reject/Resolve
    if(this.error) return this.reject(this.error);
    this.resolve(this.result);
    this.token.onTaskComplete(this);
  }

  stopTask() {
    clearImmediate(this.interval);
    this.interval = null;
  }
};
