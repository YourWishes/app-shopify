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

import { RESPONSE_OK } from '@yourwishes/app-api';
import { ServerAPIRequest, ServerAPIResponse, ServerAPIHandler } from '@yourwishes/app-server';
import { ShopifyShop, CarrierListener } from '~shopify';
import { verifyShopifyRequest } from './../shared/';
import { ICarrierRequest } from './CarrierRequest';

export * from './CarrierRequest';

export const getCarrierCallbackUrl = (name:string) =>`/shopify/carrier/${name}`

export class CarrierHandler extends ServerAPIHandler {
  name:string;

  constructor(name:string) {
    super(['POST','GET'], getCarrierCallbackUrl(name));
    this.name = name;
  }

  async onRequest(request:ServerAPIRequest):Promise<ServerAPIResponse> {
    //Verify our request.
    let shop:ShopifyShop;
    try { shop = verifyShopifyRequest(request); } catch(e) { return e; }

    //Now Get data, and all of the listeners for this particular name.
    let data = request.get() as ICarrierRequest;
    let listeners = shop.carriers.listeners[this.name] || [];

    //Wrapping the async handler here because we don't want rejected promises
    //to cause Shopify to claim our callbacks are failing.
    let handler = async (listener:CarrierListener) => {
      try {
        let response = (await listener(shop, data)) || [];
        response = Array.isArray(response) ? response : [ response ];//Always array
        return response.filter(e => e);//Filter junk
      } catch(e) {
        shop.shopify.logger.severe(e);
        return [];//Return empty array
      }
    };

    //Now start the promise queue, this returns an array of arrays of rates
    let responses = await Promise.all( listeners.map(l => handler(l)) );

    //Log for various reasons but mostly to make sure we can find issues quick.
    shop.shopify.logger.info(`Returning rates to Shopify:`);
    shop.shopify.logger.info(responses);

    //Flatten array
    let rates = responses.reduce((x,y) => [...x,...y], []);

    //Give back to shopify
    return { code: RESPONSE_OK, data: { rates } };
  }
}
