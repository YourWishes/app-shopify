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

import { RESPONSE_UNAUTHORIZED } from '@yourwishes/app-api';
import { ServerAPIRequest, ServerAPIResponse } from '@yourwishes/app-server';
import * as crypto from 'crypto';
import { IShopifyApp } from '~app';
import { ShopifyShop } from '~shopify';

export const HEADER_HMAC = 'X-Shopify-Hmac-Sha256';
export const HEADER_DOMAIN = 'X-Shopify-Shop-Domain';
export const RESPONSE_HMAC_BAD = { code: RESPONSE_UNAUTHORIZED, data: 'Failed to verify request.' }

export const verifyShopifyRequest = (request:ServerAPIRequest):ShopifyShop|null => {
  //Verify request
  if(!request.hasHeader(HEADER_HMAC)) throw RESPONSE_HMAC_BAD;
  if(!request.hasHeader(HEADER_DOMAIN)) throw RESPONSE_HMAC_BAD;

  //Get app hmac
  let app = request.owner.app as IShopifyApp;
  let crpt = crypto.createHmac('sha256', app.shopify.apiSecret);

  //Fetch data and passed hmac
  //@ts-ignore
  let data = request.req.rawBody
  let hmac = request.getHeader(HEADER_HMAC);

  //Digest and compare
  let calculatedHmac = crpt.update(data).digest('base64');
  if(calculatedHmac !== hmac) throw RESPONSE_HMAC_BAD;

  //HMAC validated, validate store
  let shopName = request.getHeader(HEADER_DOMAIN);
  let shop = app.shopify.shops[shopName];
  if(!shop) throw RESPONSE_HMAC_BAD;

  //Return null
  return shop;
}
