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

import { Module, NPMPackage } from '@yourwishes/app-base';
import { generateInstallUrl, isValidShopName } from '@yourwishes/shopify-utils';
import { IServerApp } from '@yourwishes/app-server';
import { IDatabaseApp } from '@yourwishes/app-database';

import { IShopifyApp } from '~app';
import { shopAuth, getInstallUrl, WebhookHandler } from '~api';
import { ShopifyShop, ShopifyToken, WebhookTypes } from '~shopify';
import { createNoncesTable, createTokensTable, getAccessTokens } from '~queries';

export const CONFIG_KEY = 'shopify.key';
export const CONFIG_SECRET ='shopify.secret';
export const CONFIG_HOST = 'shopify.host';
export const CONFIG_AUTHORIZE = 'shopify.authorize';
export const CONFIG_VERSION = 'shopify.apiVersion';

export class ShopifyModule extends Module {
  app:IShopifyApp;

  //App details
  apiKey:string;
  apiSecret:string;
  host:string;
  authorize:string;
  redirectUrl:string;
  apiVersion?:string;

  //Stores
  hasDatabase:boolean = false;
  shops:{[key:string]:ShopifyShop;}={};

  //API Handlers
  shopAuthHandler:shopAuth;
  getInstallUrlHandler:getInstallUrl;
  webhookHandlers:WebhookHandler[]=[];

  constructor(app:IShopifyApp) {
    super(app);
  }

  getInstallUrl(shop:string, nonce:string, scopes:string[]) {
    //Same as the one from the util but we are going to pass the config values
    return generateInstallUrl(shop, this.apiKey, scopes, this.redirectUrl, nonce);
  }

  getOrCreateShop(shopName:string) {
    if(!isValidShopName(shopName)) throw new Error("Cannot create a shop for an invalid shop name!");
    if(this.shops[shopName]) return this.shops[shopName];
    return this.shops[shopName] = this.app.createShopifyShop(this, shopName);
  }

  loadPackage():NPMPackage { return require('./../../package.json'); }

  async init():Promise<void> {
    //Confirm Modules
    let { app } = this;

    //Temporarily ignoring these two until they've updated.
    let dbApp = app as IDatabaseApp;
    let svApp = app as IServerApp;

    this.hasDatabase = dbApp.database && dbApp.database.isConnected();
    if(!this.hasDatabase) this.logger.warn(`Database is not connected. Shopify tokens cannot be stored!`);

    //Confirm Configuration
    if(
      app.config.has(CONFIG_KEY) &&
      app.config.has(CONFIG_SECRET) &&
      app.config.has(CONFIG_HOST)
    ) {
      //Set Configuration
      this.apiKey = app.config.get(CONFIG_KEY);
      this.apiSecret = app.config.get(CONFIG_SECRET);
      this.apiVersion = app.config.get(CONFIG_VERSION);

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
    } else {
      this.logger.warn(`Shopify Configuration isn't complete, only private tokens can be used!`);
    }

    //Run our create queries.
    if(this.hasDatabase) {
      await createNoncesTable(dbApp.database);
      await createTokensTable(dbApp.database);

      //Loud our stores
      let tokens = await getAccessTokens(dbApp.database);
      tokens.forEach(token => {
        try {
          let shop = this.getOrCreateShop(token.shop);
          let t = new ShopifyToken(shop, token);
          shop.addToken(t);
        } catch(e) {
          this.logger.error(`Failed to load token!`);
          this.logger.error(e);
        }
      });

      //Verify all tokens
      let verifyTasks = Object.entries(this.shops).map( ([k,shop]) => shop.verifyTokens() );
      await Promise.all(verifyTasks);
    }

    //Load API Handlers
    if(svApp.server) {
      this.shopAuthHandler = new shopAuth(this.authorize);
      this.getInstallUrlHandler = new getInstallUrl();

      //Setup webhook handlers
      this.webhookHandlers = WebhookTypes.map(webhook => new WebhookHandler(webhook, webhook));

      //Register API Handlers
      [
        this.shopAuthHandler, this.getInstallUrlHandler, ...this.webhookHandlers
      ].forEach( handler => svApp.server.api.addAPIHandler(handler) );

    } else {
      this.logger.warn(`Server Module not available, endpoits will not function.`);
    }
  }

  async destroy():Promise<void> {

  }

  removeShop(shop:ShopifyShop) {
    delete this.shops[shop.shopName];
  }
}
