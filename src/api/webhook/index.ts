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

import { RESPONSE_OK, RESPONSE_UNAUTHORIZED } from '@yourwishes/app-api';
import { ServerAPIRequest, ServerAPIResponse, ServerAPIHandler } from '@yourwishes/app-server';
import { IShopifyApp } from '~app';
import { WebhookTopic } from 'shopify-api-node';
import * as crypto from 'crypto';

export const HEADER_TOPIC = 'X-Shopify-Topic';
export const HEADER_HMAC = 'X-Shopify-Hmac-Sha256';
export const HEADER_DOMAIN = 'X-Shopify-Shop-Domain';

export const RESPONSE_HMAC_BAD = { code: RESPONSE_UNAUTHORIZED, data: 'Failed to verify request.' }

export class WebhookHandler extends ServerAPIHandler {
  topic:WebhookTopic;
  methodName:string;

  constructor(topic:WebhookTopic, methodName:string) {
    super(['POST'], `/shopify/${methodName}`);

    this.topic = topic;
    this.methodName = methodName;
  }

  getWebhookURL() { return `/shopify/${this.methodName}`; }

  async onRequest(request:ServerAPIRequest):Promise<ServerAPIResponse> {
    //Verify request
    if(!request.hasHeader(HEADER_TOPIC)) return RESPONSE_HMAC_BAD;
    if(!request.hasHeader(HEADER_HMAC)) return RESPONSE_HMAC_BAD;
    if(!request.hasHeader(HEADER_DOMAIN)) return RESPONSE_HMAC_BAD;

    //Get app hmac
    let app = request.owner.app as IShopifyApp;
    let crpt = crypto.createHmac('sha256', app.shopify.apiSecret);

    //Fetch data and passed hmac
    //@ts-ignore
    let data = request.req.rawBody
    let hmac = request.getHeader(HEADER_HMAC);

    //Digest and compare
    let calculatedHmac = crpt.update(data).digest('base64');
    if(calculatedHmac !== hmac) return RESPONSE_HMAC_BAD;

    //HMAC validated, validate store
    let shopName = request.getHeader(HEADER_DOMAIN);
    let shop = app.shopify.shops[shopName];
    if(!shop) return RESPONSE_HMAC_BAD;

    //Validate topic
    let topic = request.getHeader(HEADER_TOPIC);
    if(!topic || topic !== this.topic) return RESPONSE_HMAC_BAD;

    //Trigger listeners, async to stop blocking response to Shopify
    let listeners = (shop.webhooks.listeners[topic] || []);
    (async () => {
      for(let i = 0; i < listeners.length; i++) {
        await listeners[i](shop, topic, request.get());
      }
    })().catch(ex => shop.shopify.logger.severe(ex));

    //Respond to Shopify
    return { code: RESPONSE_OK, data: true };
  }
}
