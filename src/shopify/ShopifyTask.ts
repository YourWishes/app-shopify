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

import { ShopifyToken } from './ShopifyToken';

export type ShopifyTask = (token:ShopifyToken) => Promise<any>;

export const PRIORITY_HIGH:number =   3000000;
export const PRIORITY_MEDIUM:number = 4000000;
export const PRIORITY_LOW:number =    5000000;

export class ShopifyTaskRequest {
  task:ShopifyTask;
  priority:number;
  queued:Date;
  token:ShopifyToken;

  promise:Promise<any>;
  result:any = null;
  error:any = null;

  id:number;

  interval:NodeJS.Timeout;
  resolve:(value?:any) => void = null;
  reject:(reason?:any) => void = null;

  constructor(task:ShopifyTask, priority?:number) {
    this.task = task;
    this.priority = priority || PRIORITY_MEDIUM;
    this.queued = new Date();
  }

  start(token:ShopifyToken) {
    //Track our token
    this.token = token;
    this.id = Math.round(Math.random()*1000000);

    //Now do my process
    let promise = this.task(token);
    if(!promise.then || promise.then !== Promise.prototype.then) {
      throw new Error("Passed Task Function is not a valid async function, or does not return a valid promise!");
    }

    this.interval = setInterval(this.checkTask.bind(this), 1);

    promise.then((result) => {
      this.onTaskFinished(result);
    }).catch((error) => {
      this.onTaskError(error);
    });
  }

  onTaskFinished(result:any) {
    this.result = result;
    if(this.resolve) this.resolve(result);
    this.stopTask();
    this.token.onTaskComplete(this);
  }

  onTaskError(error:any) {
    this.error = error;
    if(this.reject) this.reject(error);
    this.stopTask();
    this.token.onTaskError(this);
  }

  async wait():Promise<any> {
    //Did the task finish fast?
    if(this.result) return this.result;
    if(this.error) throw this.error;

    //Create an interval
    if(!this.promise) {
      this.promise = new Promise((resolve,reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }

    return await this.promise;
  }

  checkTask() {
    //Has it failed/succeeded?
    if(this.result == null && this.error == null) return;
    if(this.reject == null || this.resolve == null) return;

    //Yes, stop this worker
    this.stopTask();

    //Reject/Resolve
    if(this.error) return this.reject(this.error);
    return this.resolve(this.result);
  }

  stopTask() {
    clearInterval(this.interval);
    this.interval = null;
  }
};
