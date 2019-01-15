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

import { IShopifyApp } from './../app/';
import { Module } from '@yourwishes/app-base';
import { generateInstallUrl } from '@yourwishes/shopify-utils';
import { shopAuth, getInstallUrl } from './../api/';
import * as crypto from 'crypto';

import { ShopifyShop } from './../shopify';

import {
  createNoncesTable, createTokensTable
} from './../queries/';

export const CONFIG_KEY = 'shopify.key';
export const CONFIG_SECRET ='shopify.secret';
export const CONFIG_HOST = 'shopify.host';
export const CONFIG_AUTHORIZE = 'shopify.authorize';

export class ShopifyModule extends Module {
  apiKey:string;
  apiSecret:string;
  host:string;
  authorize:string;
  redirectUrl:string;

  shops:{[key:string]:ShopifyShop;}={};

  shopAuthHandler:shopAuth;
  getInstallUrlHandler:getInstallUrl;


  constructor(app:IShopifyApp) {
    super(app);
  }

  async init():Promise<void> {
    //Confirm Modules
    let app = this.app as IShopifyApp;
    if(!app.database || !app.database.isConnected()) throw new Error("Database must be connected before Shopify can init.");
    if(!app.server) throw new Error("Server must be setup before Shopify can init.");

    //Confirm Configuration
    if(!app.config.has(CONFIG_KEY)) throw new Error("Missing API Key in Shopify Configuration.");
    if(!app.config.has(CONFIG_SECRET)) throw new Error("Missing API Secret in Shopify Configuration.");
    if(!app.config.has(CONFIG_HOST)) throw new Error("Missing Host in Shopify Configuration.");

    //Set Configuration
    this.apiKey = app.config.get(CONFIG_KEY);
    this.apiSecret = app.config.get(CONFIG_SECRET);

    let host = app.config.get(CONFIG_HOST);
    if(!host.startsWith('http')) host = `https://${host}`;
    this.host = host;

    let authorize = '/shopify/authorize';
    if(app.config.has(CONFIG_AUTHORIZE)) {
      authorize = app.config.get(CONFIG_AUTHORIZE);
      if(!authorize.startsWith('/')) authorize = `/${authorize}`;
    }
    this.authorize = authorize;
    this.redirectUrl = `${this.host}${authorize}`;

    //Run our create queries.
    await createNoncesTable(app.database);
    await createTokensTable(app.database);

    //Load API Handlers
    this.shopAuthHandler = new shopAuth(this.authorize);
    this.getInstallUrlHandler = new getInstallUrl();

    app.server.addAPIHandler(this.shopAuthHandler);
    app.server.addAPIHandler(this.getInstallUrlHandler);
  }

  getInstallUrl(shop:string, nonce:string, scopes:string[]) {
    //Same as the one from the util but we are going to pass the config values
    return generateInstallUrl(shop, this.apiKey, scopes, this.redirectUrl, nonce);
  }

  generateNonce():string {
    return crypto.randomBytes(16).toString('base64');
  }

  getOrCreateShop(shopName:string) {
    if(this.shops[shopName]) return this.shops[shopName];
    return this.shops[shopName] = new ShopifyShop(this, shopName);
  }
}
