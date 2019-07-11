import { App } from '@yourwishes/app-base';
import { ShopifyModule, ShopifyShop, ShopifyToken, IShopifyApp } from './../../';

class DummyAppClass extends App implements IShopifyApp {
  server; database;
  shopify:ShopifyModule;
  scopes:string[] = [];

  constructor() { super(); }
  getShopifyScopes() { return this.scopes; }
  createShopifyShop(module,shopName) {return new ShopifyShop(module, shopName);}
};

const DummyApp = new DummyAppClass();
const DummyModule = new ShopifyModule(DummyApp);
const DummyName = 'myshop.myshopify.com';

describe('ShopifyShop', () => {
  it('should require the shopify module', () => {
    expect(() => new ShopifyShop(null, DummyName)).toThrow();
    expect(() => new ShopifyShop(DummyModule, DummyName)).not.toThrow();
  });

  it('should require the shopName to be a valid shop name', () => {
    expect(() => new ShopifyShop(DummyModule, null)).toThrow();
    expect(() => new ShopifyShop(DummyModule, 'badshop.notshopify.com')).toThrow();
    expect(() => new ShopifyShop(DummyModule, DummyName)).not.toThrow();
  });
});

describe('addToken', () => {
  it('should require a real ShopifyToken', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);
    expect(() => shop.addToken(null)).toThrow();
    expect(() => {
      shop.addToken( new ShopifyToken(shop, {accessToken:'1234'}) );
    }).not.toThrow();
  });

  it('should add a token to the array', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);
    let token = new ShopifyToken(shop, {accessToken:'9876'});
    let token2 = new ShopifyToken(shop, {accessToken:'1234'});
    expect(() => shop.addToken(token)).not.toThrow();
    expect(shop.tokens).toContain(token);
    shop.addToken(token2);
    expect(shop.tokens).toContain(token2);
    expect(shop.tokens).toHaveLength(2);
  });

  it('should not add token twice', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);
    let token = new ShopifyToken(shop, {accessToken:'1234'});
    shop.addToken(token);
    shop.addToken(token);
    expect(shop.tokens).toHaveLength(1);
  });
});

describe('removeToken', () => {
  it('should require a real token', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);
    shop.addToken( new ShopifyToken(shop,{accessToken:'9876'}) );

    expect(() => shop.removeToken(null)).toThrow();
    expect(() => {
      shop.removeToken( new ShopifyToken(shop,{accessToken:'1234'}) );
    }).not.toThrow();
  });

  it('should remove a token from the array', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);
    let token = new ShopifyToken(shop, {accessToken:'9876'});
    let token2 = new ShopifyToken(shop, {accessToken:'1234'});
    shop.addToken(token);
    shop.addToken(token2);
    expect(shop.tokens).toHaveLength(2);

    expect(() => shop.removeToken(token)).not.toThrow();
    expect(shop.tokens).toHaveLength(1);
    expect(shop.tokens).toContain(token2);
    expect(shop.tokens).not.toContain(token);

    shop.removeToken(token2);
    expect(shop.tokens).toHaveLength(0);
  });

  it('should not remove anything if the token isnt in the array', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);
    let token = new ShopifyToken(shop, {accessToken:'9876'});
    let token2 = new ShopifyToken(shop, {accessToken:'1234'});
    shop.addToken(token);

    expect(shop.tokens).toHaveLength(1);
    expect(() => shop.removeToken(token2)).not.toThrow();
    expect(shop.tokens).toHaveLength(1);
  });
});

describe('verifyTokens', () => {
  it('should make all of the tokens check themselves', async () => {
    let module = new ShopifyModule(DummyApp);
    let shop = module.getOrCreateShop(DummyName);

    let tokenA = new ShopifyToken(shop, {accessToken:'1234'});
    let verifyA = tokenA.verify = jest.fn(() => true) as any;

    let tokenB = new ShopifyToken(shop,{accessToken:'5678'});
    let verifyB = tokenB.verify = jest.fn(() => true) as any;

    shop.addToken(tokenA);
    shop.addToken(tokenB);

    await expect(shop.verifyTokens()).resolves.not.toThrow();

    expect(verifyA).toHaveBeenCalled();
    expect(verifyB).toHaveBeenCalled();
  });

  it('should remove itself from the shops memory if all of the tokens are invalidated', async () => {
    let module = new ShopifyModule(DummyApp);
    let shop = module.getOrCreateShop('test.myshopify.com');

    let tokenA = new ShopifyToken(shop,{accessToken:'1234'});
    let tokenB = new ShopifyToken(shop,{accessToken:'5678'});

    tokenA.verify = async () => {
      shop.removeToken(tokenA); return false;
    };

    tokenB.verify = async () => {
      shop.removeToken(tokenB); return false;
    };

    shop.addToken(tokenA);
    shop.addToken(tokenB);

    expect(module.shops['test.myshopify.com']).toStrictEqual(shop);
    await expect(shop.verifyTokens()).resolves.not.toThrow();
    expect(module.shops['test.myshopify.com']).not.toEqual(shop);
  });
});

describe('queue', () => {
  it('should queue a task and then trigger a pending check', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);

    expect(shop.queuedTasks).toHaveLength(0);
    expect(() => shop.queue(async () => true)).not.toThrow();
    expect(shop.queuedTasks).toHaveLength(1);
    let fn = jest.fn();
    let wrap = async () => fn();
    let request = shop.queue(wrap);
    expect(request.task).toStrictEqual(wrap);

    let check = shop.checkPending = jest.fn();
    let req2 = shop.queue(wrap);
    expect(check).toHaveBeenCalled();
  });

  it('should allow me to pass a priority', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);
    expect(shop.queue(async () => true, 10)).toHaveProperty('priority', 10);
  });
});

describe('queueToken', () => {
  it('should force a task to go to the specified token only.', () => {
    let shop = new ShopifyShop(DummyModule, DummyName);

    let tokenA = new ShopifyToken(shop, {accessToken:'1234'});
    let tokenB = new ShopifyToken(shop,{accessToken:'5678'});

    //Mock available
    tokenA.isAvailable = tokenB.isAvailable = () => true;

    shop.addToken(tokenA);
    shop.addToken(tokenB);

    let fnNon = jest.fn(token => true);
    let fnSpec = jest.fn(token => true);

    let notSpecific = shop.queue(async token => fnNon(token));
    let specific = shop.queueToken(async token => fnSpec(token), tokenB.token);

    expect(fnNon).toHaveBeenCalledWith(tokenA);
    expect(fnSpec).toHaveBeenCalledWith(tokenB);
  });
});

//describe('call');//See ShopifyToken.wait()
