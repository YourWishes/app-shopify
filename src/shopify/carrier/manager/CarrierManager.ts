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

import { ShopifyShop } from './../../shop/';
import { CarrierListener } from './../listener/';
import { CarrierHandler, getCarrierCallbackUrl } from '~api/carrier/';

export class CarrierManager {
  shop:ShopifyShop;
  listeners:{[key:string]:CarrierListener[]} = {};

  constructor(shop:ShopifyShop) {
    if(!shop) throw new Error('Missing Shop');
    this.shop = shop;
  }

  async hasCarrier(name:string) {
    //Name required...
    if(!name) throw new Error(`Missing Name`);

    //Get path
    let handlerPath = getCarrierCallbackUrl(name);

    //Get carriers
    let carriers = await this.shop.call(token => token.api.carrierService.list());
    let carrier = carriers.find(c => c.callback_url.startsWith(this.shop.shopify.host));

    //Verify the URL, if the url doesn't match we may need to do a remove
    if(carrier && !carrier.callback_url.endsWith(handlerPath)) {
      await this.shop.call(token => token.api.carrierService.delete(carrier['id'] as any));
      carrier = null;
    }

    return carrier;
  }

  async registerCarrier(name:string) {
    //Handler path, this is where the callback will get fired.
    let handlerPath = getCarrierCallbackUrl(name);

    //First, confirm we have an API handler setup for this name (e.g. another
    //shop may have setup the handler for this name already)
    if(this.shop.shopify.app.server) {
      let { api } = this.shop.shopify.app.server;
      if(!api.apiHandlers.some(handler => handler.hasPath(handlerPath))) {
        //No handler setup for this path, we need to register one
        api.addAPIHandler(new CarrierHandler(name));
      }
    }

    //Now check what's in shopify, this requires first confirming what Shopify
    //has registered and then if it's not registered we're going to do the same
    let carrier = await this.hasCarrier(name);
    if(carrier) return carrier;

    return await this.shop.call(token => token.api.carrierService.create({
      name, callback_url: this.shop.shopify.host+handlerPath, format: 'json',
      service_discovery: true
    }));
  }

  async addListener(name:string, listener:CarrierListener) {
    await this.registerCarrier(name);

    this.listeners[name] = this.listeners[name]||[];
    if(this.listeners[name].indexOf(listener) !== -1) return;
    this.listeners[name].push(listener);
  }

  removeListener(name:string, listener:CarrierListener) {
    this.listeners[name] = this.listeners[name] || [];
    let i = this.listeners[name].indexOf(listener);
    if(i === -1) return;
    this.listeners[name].splice(i, 1);
  }
}
