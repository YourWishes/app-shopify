// Copyright (c) 2019 Dominic Masters
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicen se, and/or sell copies of the Software, and to
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



import { APIRequest, APIResponse, APIHandler, RESPONSE_OK, RESPONSE_INTERNAL_ERROR } from '@yourwishes/app-server';
import { isValidShopName } from '@yourwishes/shopify-utils';
import { IShopifyApp } from './../app/';
import { insertNonce, deleteNonceForShop } from './../queries/nonce/';

export class getInstallUrl extends APIHandler {
  constructor() {
    super('GET', '/shopify/getInstallUrl');
  }

  async onRequest(request:APIRequest):Promise<APIResponse> {
    if(!request.hasString('shop', 128)) return { code: 400, data: 'Missing or Invalid shop' };

    let app = request.server.app as IShopifyApp;
    let { shopify } = app;

    let shop = request.getString('shop', 128);
    if(!isValidShopName(shop)) return { code: 400, data: 'Missing or Invalid shop' };

    let shopfiyShop = app.shopify.getOrCreateShop(shop);
    if(shopfiyShop.tokens.length) return { code: 400, data: 'Shop already validated' };

    let nonce = shopify.generateNonce();
    let scopes = app.getShopifyScopes(shop);
    let url = shopify.getInstallUrl(shop, nonce, scopes);

    //Now take our nonce and store it before we can return it.
    await deleteNonceForShop(app.database, shop);
    await insertNonce(app.database, shop, nonce, new Date());

    return { code: RESPONSE_OK, data: url };
  }
}
