import {
  WebhookManager, IShopifyApp, ShopifyModule, ShopifyShop
} from './../../../';
import { App } from '@yourwishes/app-base';
import { ServerModule } from '@yourwishes/app-server';
import { DatabaseConnection } from '@yourwishes/app-database';
import { IWebhook } from 'shopify-api-node';

const DUMMY_HOST = 'https://1.1.1.1';

const DummyAppClass = class extends App implements IShopifyApp {
  server:ServerModule;
  database:DatabaseConnection;
  shopify:ShopifyModule;

  constructor() {
    super();
    this.server = new ServerModule(this);
    this.database = { isConnected: () => true } as any;
    this.shopify = new ShopifyModule(this);
    this.shopify.host = DUMMY_HOST;
  }

  getShopifyScopes() { return []; }
  createShopifyShop(module,name) { return new ShopifyShop(module, name); }
}

const DummyApp = new DummyAppClass();

const DummyWebhook:IWebhook = {
  address: `${DUMMY_HOST}/shopify/onProudctCreated`,
  topic: 'products/create',
  created_at: new Date().toString(),
  fields: [],
  format: 'json',
  id: 111111,
  metafield_namespaces: [],
  updated_at: new Date().toString()
};

describe('WebhookManager', () => {
  it('should require a shop', () => {
    expect(() => new WebhookManager(null)).toThrow();
    expect(() => new WebhookManager(undefined)).toThrow();
  });

  it('should construct', () => {
    let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');
    expect(() => new WebhookManager(shop)).not.toThrow();
  });
});

describe('hasTopic', () => {
  let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');
  let manager = new WebhookManager(shop);

  manager.webhooks.push(DummyWebhook);
  manager.webhooks.push({...DummyWebhook, topic: 'checkouts/create' });
  manager.webhooks.push({
    ...DummyWebhook, topic: 'collections/create',
    address: 'https://2.2.2.2/shopify/onProductCreated'
  });

  it('should return true if the topic exists in the array of webhooks', () => {
    expect(manager.hasTopic('products/create')).toEqual(true);
    expect(manager.hasTopic('checkouts/create')).toEqual(true);
  });

  it('should return false if the topic isnt in the array', () => {
    expect(manager.hasTopic('inventory_items/create')).toEqual(false);
    expect(manager.hasTopic('locations/update')).toEqual(false);
  });

  it('should return false if the address does not match the host', () => {
    expect(manager.hasTopic('collections/create')).toEqual(false);
  });
});


//TODO: Write tests for getTopicHandler
