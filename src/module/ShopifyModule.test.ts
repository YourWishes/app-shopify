import { App } from '@yourwishes/app-base';
import { IShopifyApp } from './../app/';
import { ShopifyModule } from './ShopifyModule';
import { ServerModule } from '@yourwishes/app-server';
import { DatabaseConnection } from '@yourwishes/app-database';

class DummyApp extends App implements IShopifyApp {
  server:ServerModule;
  database:DatabaseConnection;
  shopify:ShopifyModule;

  constructor() {
    super();
    this.server = dummyServer(this);
    this.database = dummyDatabase(this);
  }

  getShopifyScopes() { return ['read_themes', 'write_themes']; }
}


let dummyDatabase = (app):any => {
  return {
    app,
    query: async query => {},
    isConnected: () => true
  }
};

let dummyServer = (app):any => {
  return {
    app,
    addAPIHandler: authHandler => {}
  };
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
});
