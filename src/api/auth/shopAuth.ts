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

import { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } from '@yourwishes/app-api';
import { ServerAPIRequest, ServerAPIResponse, ServerAPIHandler } from '@yourwishes/app-server';
import { encodeObject, isValidShopName, generateShopUrl } from '@yourwishes/shopify-utils';
import * as crypto from 'crypto';
import { IShopifyApp } from '~app/';
import { getNonceForShop, deleteNonceForShop } from '~queries/nonce';
import { fetch } from 'cross-fetch';
import { ShopifyToken } from '~shopify/';

export const NONCE_TIMEOUT_MS = 10*60*1000;

export interface TokenResponse { access_token:string, scope:string };
export const getAccessTokenUrl = (shop:string) =>  generateShopUrl(shop, '/admin/oauth/access_token');

export class shopAuth extends ServerAPIHandler {
  constructor(url:string|string[]) {
    super('GET', url);
  }

  async onRequest(request:ServerAPIRequest):Promise<ServerAPIResponse> {
    //https://help.shopify.com/en/api/getting-started/authentication/oauth
    if(!request.hasString('code', 32)) return { code: 403, data: 'Missing or Invalid code' };
    if(!request.hasString('hmac', 64)) return { code: 403, data: 'Missing or Invalid hmac' };
    if(!request.hasString('shop', 128)) return { code: 403, data: 'Missing or Invalid shop' };
    if(!request.hasString('state', 1024)) return { code: 403, data: 'Missing or Invalid state' };
    if(!request.hasInteger('timestamp')) return { code: 403, data: 'Missing or Invalid timestamp' };

    //Prepare Cryptography
    let app = request.owner.app as IShopifyApp;
    let hmac = request.getString('hmac', 64);
    let state = request.getString('state', 1024);
    let shopName = request.getString('shop', 128);

    if(!isValidShopName(shopName)) return { code: 403, data: 'Missing or Invalid shop' };

    //Duplicate the query object
    let queryOriginal = {...request.get()};
    ['hmac','signature'].forEach(e => delete queryOriginal[e]);// Remove HMAC and Signature
    let keys = Object.keys(queryOriginal);// Get keys
    keys.sort();// Sort lexicographically
    let query = {};// Construct new Query from sorted keys
    keys.forEach(key => query[key] = queryOriginal[key]);

    //Now build a Shopify query string, and generate a hmac
    let crpt = crypto.createHmac('sha256', app.shopify.apiSecret);
    let qs = encodeObject(query);
    let calculatedHmac = crpt.update(qs).digest('hex');

    //Now finally validate the hmac
    if(calculatedHmac !== hmac) return { code: 403, data: 'Missing or Invalid hmac' };

    //hmac is valid, now validate the nonce.
    let nonce = await getNonceForShop(app.database, shopName);
    if(!nonce || nonce.nonce !== state || (new Date().getTime() - nonce.generated.getTime()) > NONCE_TIMEOUT_MS ) {
      return { code: 408, data: 'Authorization request expired' };
    }

    //Remove the nonce
    await deleteNonceForShop(app.database, shopName);

    //All validated on our end, let's fetch our permanent access token
    let code = request.getString('code', 32);
    let tokenResponse:TokenResponse;

    try {
      //Fetch as JSON POST
      let x = await fetch(getAccessTokenUrl(shopName), {
        method: 'POST',
        body: JSON.stringify({
          client_id: app.shopify.apiKey,
          client_secret: app.shopify.apiSecret,
          code
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      try {
        //Atempt a parse to JSON, Shopify will respond with HTML (not JSON) if the token is invalid.
        tokenResponse = await x.json();
      } catch(ex) {
        return { code: 408, data: 'Authorization request expired' };
      }

      if(!tokenResponse.access_token || !tokenResponse.access_token.length) throw new Error("Returned token is missing access_token parameter.");
      if(!tokenResponse.scope || !tokenResponse.scope.length) throw new Error("Returned token is missing scopes parameter.");
    } catch(e) {
      app.shopify.logger.error('Failed to fetch token from Shopify');
      app.shopify.logger.error(e);
      return { code: RESPONSE_INTERNAL_ERROR, data: 'Failed to confirm token with Shopify' };
    }

    //Token response gotten, we can finally create and validate our token!
    let shop = app.shopify.getOrCreateShop(shopName);

    let token = new ShopifyToken(shop, {
      accessToken: tokenResponse.access_token,
      scopes: tokenResponse.scope.split(',')
    });

    if(await token.verify()) await token.save();
    await shop.verifyTokens();

    return { code: RESPONSE_OK, data: 'Token Validated!' };
  }
}
