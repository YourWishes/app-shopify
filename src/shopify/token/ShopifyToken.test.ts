import { App } from '@yourwishes/app-base';
import { ShopifyToken, ShopifyShop, ShopifyModule, IShopifyApp } from './../../';

class DummyAppClass extends App implements IShopifyApp {
  database; server; shopify;

  constructor() {
    super();
  }

  scopes:string[]=[];
  getShopifyScopes(shop: string): string[] { return this.scopes; }
  createShopifyShop(module,shopName) {return null;}
}

const DummyApp = new DummyAppClass();
const DummyModule = new ShopifyModule(DummyApp);
const DummyShop = new ShopifyShop(DummyModule, 'test.myshopify.com');

const SamplePrivate = {apiKey:'12345',password:'6789'};
const SampleOauth =  {accessToken:'1234'};

describe('ShopifyToken', () => {
  it('should require a shop', () => {
    expect( () => new ShopifyToken(null,SampleOauth) ).toThrow();
    expect( () => new ShopifyToken(DummyShop,SampleOauth) ).not.toThrow();
  });

  it('should require a valid token', () => {
    expect( () => new ShopifyToken(DummyShop, null) ).toThrow();
    expect( () => new ShopifyToken(DummyShop,SampleOauth) ).not.toThrow();
  });

  it('should accept a private app token or an Oauth2 token', () => {
    expect(() => new ShopifyToken(DummyShop,SampleOauth)).not.toThrow();
    expect(() => new ShopifyToken(DummyShop,SamplePrivate)).not.toThrow();
  });

  it('should allow the tokens to have the accessScope predefined', () => {
    let token = new ShopifyToken(DummyShop,SampleOauth);
    expect(token.scopes).toHaveLength(0);

    token = new ShopifyToken(DummyShop,{...SamplePrivate,scopes:['lorem','ipsum']});
    expect(token.scopes).toHaveLength(2);

    token = new ShopifyToken(DummyShop,{...SampleOauth,scopes:['dolor']});
    expect(token.scopes).toHaveLength(1);
  });
});

describe('getAvailableSlots', () => {
  it('when no slots have been used ever, it will use the max from the limits, if no max is provided it will use 0, also a 10 slot buffer is added for app safety', () => {
    let token = new ShopifyToken(DummyShop,SampleOauth);
    token.limits = { max: 40, current: 0, remaining: 40 };
    expect(token.getAvailableSlots()).toStrictEqual(30);//Since we have a 10 buffer

    //The getAvailableSlots will attempt to trigger a manual update of the call limits by fetching the access scopes.
    token.fetchAccessScopes = async () => [];
    token.limits = { max: 4, current: 36, remaining: 4 };
    expect(token.getAvailableSlots()).toStrictEqual(0);
  });

  it('should return the available slots based on the limits, current and processing tasks', () => {
    let token = new ShopifyToken(DummyShop,SampleOauth);
    token.limits = { max: 40, current: 0, remaining: 40 };
    token.processingTasks.push({} as null);
    token.processingTasks.push({} as null);
    token.processingTasks.push({} as null);
    token.processingTasks.push({} as null);

    expect(token.getAvailableSlots()).toEqual(40 - 10 - 4);

    token.limits.current = 5;
    expect(token.getAvailableSlots()).toEqual(40 - 10 - 4 - 5);

    token.processingTasks = [];
    expect(token.getAvailableSlots()).toEqual(40 - 10 - 5);
  });
});

describe('fetchAccessScopes', () => {
  it('should attempt to fetch the access scopes from shopify', async () => {
    let token = new ShopifyToken(DummyShop,SamplePrivate);
    let fn = jest.fn();
    token.startTask = async (t) => {
      t.wait = async () =>  [ {handle: 'write_themes'},{handle:'read_themes'} ];
      fn();
    }

    await expect(token.fetchAccessScopes()).resolves.toEqual(['write_themes','read_themes']);
    expect(fn).toHaveBeenCalled();
    expect(token.scopes).toStrictEqual(['write_themes','read_themes']);
  });

  it('should not fetch the scopes if there are any pending tasks', async () => {
    let token = new ShopifyToken(DummyShop, SamplePrivate);
    token.processingTasks.push({} as null);
    let fn = jest.fn();
    token.startTask = async (t) => {
      t.wait = async () =>  [ {handle: 'write_themes'},{handle:'read_themes'} ];
      fn();
    }

    await expect(token.fetchAccessScopes()).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('verify', () => {
  it('should fetch the access scopes and return true if the token is valid', async () => {
    let app = new DummyAppClass();
    let module = new ShopifyModule(app);
    let shop = new ShopifyShop(module, 'test.myshopify.com');
    let token = new ShopifyToken(shop,SampleOauth);
    token.processingTasks.push({} as null);//This will stop the fetchAccessScopes from actually fetching
    token.scopes = app.scopes = ['read_themes', 'read_orders'];//Setupn the dummy scopes

    await expect(token.verify()).resolves.toEqual(true);
  });

  /* 2020-03-12 - No longer fails if missing access permission 
  it('should fail if the token is missing scopes that are required by the app', async () => {
    let app = new DummyAppClass();
    let module = new ShopifyModule(app);
    let shop = new ShopifyShop(module, 'test.myshopify.com');
    let token = new ShopifyToken(shop,SampleOauth);
    token.processingTasks.push({} as null);//This will stop the fetchAccessScopes from actually fetching
    token.scopes = ['read_themes'];//Setupn the dummy scopes
    app.scopes = [ 'read_themes', 'read_scopes' ];
    let mock = jest.fn();
    token.delete = async () => mock();
    module.logger.warn = () => {};
    await expect(token.verify()).resolves.toEqual(false);
    expect(mock).toHaveBeenCalled();
  });
  */
});

describe('delete', () => {
  it('should not delete if the token is a private token', async () => {
    let token = new ShopifyToken(DummyShop,SamplePrivate);
    await expect(token.delete()).resolves.not.toThrow();
  });
});

describe('save', () => {
  it('should not save a private token', async () => {
    let app = new DummyAppClass();
    let module = new ShopifyModule(app);
    let shop = new ShopifyShop(module, 'test.myshopify.com');
    let fn = jest.fn();
    app.database = { one: async () => fn() };
    module.hasDatabase = true;

    let tokenPrivate = new ShopifyToken(shop,SamplePrivate);
    await expect(tokenPrivate.save()).resolves.not.toThrow();
    expect(fn).not.toHaveBeenCalled();

    let tokenPublic = new ShopifyToken(shop, SampleOauth);
    await expect(tokenPublic.save()).resolves.not.toThrow();
    expect(fn).toHaveBeenCalled();
  });
});
