import { App } from '@yourwishes/app-base';
import { IShopifyApp } from './../app/';
import { ShopifyModule } from './ShopifyModule';
import { ShopifyShop } from './../shopify/';
import { ServerModule } from '@yourwishes/app-server';
import { DatabaseConnection } from '@yourwishes/app-database';

class DummyApp extends App implements IShopifyApp {
  server:ServerModule;
  database:DatabaseConnection;
  shopify:ShopifyModule;

  constructor() {
    super();
    this.server = new ServerModule(this);
    this.database = dummyDatabase(this);
  }

  getShopifyScopes() { return ['read_themes', 'write_themes']; }
}


let dummyDatabase = (app):any => {
  return {
    app,
    query: async query => {},
    any: async query => [],
    isConnected: () => true
  }
};

let sampleConfig = {
  shopify: {
    key: 'samplekey', secret: 'samplesecret', host: 'http://localhost'
  }
}

describe('init', () => {
  it('should require the database to be connected first', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.database = null;
    await expect(module.init()).rejects.toThrow();
  });

  it('should require the server to be setup', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.server = null;
    await expect(module.init()).rejects.toThrow();
  });

  it('should require the configuration to have the api key', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    await expect(module.init()).rejects.toThrow();
  });

  it('should require the configuration to have the api secret', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.config.data = { shopify: { key: 'samplekey' } };
    await expect(module.init()).rejects.toThrow();
  });

  it('should require the configuration to have the api host', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.config.data = { shopify: { key: 'samplekey', secret: 'samplesecret' } };
    await expect(module.init()).rejects.toThrow();
  });

  it('should initialize if the config is correct', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.config.data = sampleConfig;
    await expect(module.init()).resolves.not.toThrow();
  });

  it('should allow a custom authorize url', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.config.data = { ...sampleConfig };
    app.config.data['shopify'].authorize = 'test';
    await expect(module.init()).resolves.not.toThrow();
    expect(module.authorize).toEqual('/test');
  });

  it('should create the tables', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    let query = app.database.query = jest.fn();
    app.config.data = sampleConfig;
    await module.init();
    expect(query).toHaveBeenCalled();
  });

  it('should add the API Handlers', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.config.data = sampleConfig;
    expect(app.server.apiHandlers).toHaveLength(0);
    await module.init();
    expect(app.server.apiHandlers.length).toBeGreaterThan(0);
  });

  it('should load the tokens, and verify them', async () => {
    let app = new DummyApp();
    let module = new ShopifyModule(app);
    app.config.data = sampleConfig;

    let dummyTokens = [
      {shop:'test.myshopify.com',accessToken:'1234567890',id:1},
      {shop:'myshop.myshopify.com',accessToken:'1234567890',id:1},
      {shop:'sample.myshopify.com',accessToken:'1234567890',id:1}
    ];

    app.database.any = async () => dummyTokens;
    expect(module.shops).toStrictEqual({});
    let verified = jest.fn();
    ShopifyShop.prototype.verifyTokens = async () => verified();
    await module.init();

    dummyTokens.forEach((token,i) => {
      let shop = module.shops[token.shop];
      expect(shop).toBeDefined();
      expect(shop.tokens).toHaveLength(1);
    });

    expect(verified).toHaveBeenCalledTimes(3);
  });
});


describe('generateNonce', () => {
  let app = new DummyApp();
  let module = new ShopifyModule(app);

  it('should generate a random string', () => {
    expect(module.generateNonce()).not.toStrictEqual(module.generateNonce());
    expect(module.generateNonce()).not.toStrictEqual(module.generateNonce());
    expect(module.generateNonce()).not.toStrictEqual(module.generateNonce());
    expect(module.generateNonce()).not.toStrictEqual(module.generateNonce());
  });
});

describe('getOrCreateShop', () => {
  let app = new DummyApp();

  it('should require a valid shop name', () => {
    let module = new ShopifyModule(app);
    expect(() => module.getOrCreateShop('invalidshopname')).toThrow();
    expect(() => module.getOrCreateShop('test.notshopify.com')).toThrow();
  });

  it('should create a store if it does not exist', () => {
    let module = new ShopifyModule(app);
    expect(module.getOrCreateShop('test.myshopify.com')).toHaveProperty('shopName', 'test.myshopify.com');
    expect(module.getOrCreateShop('anothershop.myshopify.com')).toHaveProperty('shopName', 'anothershop.myshopify.com');
    expect(module.getOrCreateShop('yeah.myshopify.com')).toHaveProperty('shopName', 'yeah.myshopify.com');
  });

  it('should return an existing store if it already exists', () => {
    let module = new ShopifyModule(app);
    let shopA = module.getOrCreateShop('shop-a.myshopify.com');
    let shopB = module.getOrCreateShop('shop-b.myshopify.com');

    expect(module.getOrCreateShop('shop-a.myshopify.com')).toStrictEqual(shopA);
    expect(module.getOrCreateShop('shop-b.myshopify.com')).toStrictEqual(shopB);
  });
});
