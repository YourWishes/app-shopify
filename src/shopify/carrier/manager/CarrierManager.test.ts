import { App } from '@yourwishes/app-base';
import { ServerModule } from '@yourwishes/app-server';
import { DatabaseConnection } from '@yourwishes/app-database';

import { CarrierManager, ShopifyShop, IShopifyApp, ShopifyModule, getCarrierCallbackUrl } from '~index';

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

describe('CarrierManager', () => {
  it('should require a real shop to be passed', () => {
    expect(() => new CarrierManager(null)).toThrow();
    expect(() => new CarrierManager(undefined)).toThrow();
  });

  it('should construct with a store', () => {
    let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');
    expect(() => new CarrierManager(shop)).not.toThrow();
  });
});

describe('hasCarrier', () => {
  let callMock = (prom) => prom({
    api: { carrierService: {
      list: (async () => {
        return [
          { name: 'test1', callback_url: getCarrierCallbackUrl('test1') },
          { name: 'test2', callback_url: getCarrierCallbackUrl('test2') },
          { name: 'test3', callback_url: getCarrierCallbackUrl('test3') }
        ];
      }),
      //TODO: Test delete simulate
      delete: async () => {}
    } }
  } as any);

  it('should require a name', async () => {
    let shop= new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');
    let mgr = new CarrierManager(shop);

    await expect(mgr.hasCarrier('')).rejects.toThrow();
    await expect(mgr.hasCarrier(null)).rejects.toThrow();
    await expect(mgr.hasCarrier(undefined)).rejects.toThrow();
  });

  it('should poll Shopify for the carriers', async () => {
    let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');
    let fn = jest.fn();
    shop.callPrimary = async prom => { fn(); return  await callMock(prom); };
    let mgr = new CarrierManager(shop);

    expect(fn).not.toHaveBeenCalled();
    await expect(mgr.hasCarrier('test1')).resolves.toBeTruthy();
    expect(fn).toHaveBeenCalled();
  });

  it('should return true if the carrier is in the list of registered carriers', async () => {
    let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');
    shop.callPrimary = async prom => callMock(prom);
    let mgr = new CarrierManager(shop);

    await expect(mgr.hasCarrier('test1')).resolves.toBeTruthy();
    await expect(mgr.hasCarrier('test2')).resolves.toBeTruthy();
    await expect(mgr.hasCarrier('test3')).resolves.toBeTruthy();
  });

  it('should return false if the carrier is not in the list of registered carriers', async () => {
    let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');
    shop.callPrimary = async prom => await callMock(prom);
    let mgr = new CarrierManager(shop);

    await expect(mgr.hasCarrier('test4')).resolves.toBeFalsy()
    await expect(mgr.hasCarrier('test5')).resolves.toBeFalsy()
    await expect(mgr.hasCarrier('test6')).resolves.toBeFalsy()
  });
});

describe('addListener', () => {
  let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');

  it('should register the listener and not double up the array', async () => {
    let cm = new CarrierManager(shop);
    cm.registerCarrier = async () => null;
    let cb = async () => null;

    expect(cm.listeners['test1']).not.toBeDefined();
    await expect(cm.addListener('test1', cb)).resolves.not.toThrow();
    await expect(cm.addListener('test2', cb)).resolves.not.toThrow();
    expect(cm.listeners['test1']).toBeDefined();
    expect(cm.listeners['test1']).toContain(cb);
    expect(cm.listeners['test1']).toHaveLength(1);

    await expect(cm.addListener('test1', cb)).resolves.not.toThrow();
    expect(cm.listeners['test1']).toHaveLength(1);

    await expect(cm.addListener('test1', async () => [] )).resolves.not.toThrow();
    expect(cm.listeners['test1']).toHaveLength(2);
  });
});

describe('removeListener', () => {
  let shop = new ShopifyShop(DummyApp.shopify, 'test.myshopify.com');

  it('should remove the listener from the array', async () => {
    let cm = new CarrierManager(shop);
    cm.registerCarrier = async () => null;
    let cb = async () => null;

    await cm.addListener('test1', cb);
    expect(cm.listeners['test1']).toHaveLength(1);
    expect(() => cm.removeListener('test1', cb)).not.toThrow();
    expect(cm.listeners['test1']).toHaveLength(0);

    expect(() => cm.removeListener('test1', cb)).not.toThrow();
    expect(() => cm.removeListener('other', cb)).not.toThrow();
    await cm.addListener('other', cb);
    expect(cm.listeners['other']).toHaveLength(1);
  });
});
