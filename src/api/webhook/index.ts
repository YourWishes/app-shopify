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

import { RESPONSE_OK, RESPONSE_BAD_REQUEST } from '@yourwishes/app-api';
import { ServerAPIRequest, ServerAPIResponse, ServerAPIHandler } from '@yourwishes/app-server';
import { WebhookTopic } from 'shopify-api-node';
import { verifyShopifyRequest } from './../shared/';

export const HEADER_TOPIC = 'X-Shopify-Topic';
export const RESPONSE_TOPIC_BAD = { code: RESPONSE_BAD_REQUEST, data: 'Invalid topic' };

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
    //Verify the HMAC...
    let shop;
    try { shop = verifyShopifyRequest(request); } catch(e) { return e; }

    //Validate topic
    if(!request.hasHeader(HEADER_TOPIC)) return RESPONSE_TOPIC_BAD;
    let topic = request.getHeader(HEADER_TOPIC);
    if(!topic || topic !== this.topic) return RESPONSE_TOPIC_BAD;

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
