import { App } from '@yourwishes/app-base';
import {
  ShopifyTask, ShopifyTaskRequest, PRIORITY_HIGH, PRIORITY_MEDIUM, PRIORITY_LOW,
  IShopifyApp, ShopifyModule, ShopifyShop, ShopifyToken
} from './../';


/// Dummies (Yes there's a lot) ///
class DummyAppClass extends App implements IShopifyApp {
  database; server; shopify;

  constructor() { super(); }

  scopes:string[]=[];
  getShopifyScopes(shop: string): string[] { return this.scopes; }
}

const DummyApp = new DummyAppClass();
const DummyModule = new ShopifyModule(DummyApp);
const DummyShop = new ShopifyShop(DummyModule, 'test.myshopify.com');
const DummyTask = async () => { };
const DummyToken = new ShopifyToken(DummyShop, {apiKey:'12345',password:'6789'});

describe('ShopifyTaskRequest', () => {
  it('should require a valid task', () => {
    expect(() => new ShopifyTaskRequest(null)).toThrow();
    expect(() => new ShopifyTaskRequest(DummyTask)).not.toThrow();
  });

  it('should allow a custom priority to be set', () => {
    expect(new ShopifyTaskRequest(DummyTask, PRIORITY_LOW)).toHaveProperty('priority', PRIORITY_LOW);
    expect(new ShopifyTaskRequest(DummyTask, PRIORITY_MEDIUM)).toHaveProperty('priority', PRIORITY_MEDIUM);
  });

  it('should set the queued time', () => {
    expect(new ShopifyTaskRequest(DummyTask)).toHaveProperty('queued');
    expect(new ShopifyTaskRequest(DummyTask).queued).toBeDefined();
    expect(new ShopifyTaskRequest(DummyTask).queued).not.toBeNull();
  });
});

describe('start', () => {
  it('should require a token', () => {
    let req = new ShopifyTaskRequest(DummyTask);
    expect(() => req.start(null)).toThrow();
    expect(() => req.start(undefined)).toThrow();

    expect(req.token).not.toBeDefined();
    expect(req.id).not.toBeDefined();
    expect(() => req.start(DummyToken)).not.toThrow();
    expect(req.token).toStrictEqual(DummyToken);
    expect(req.id).toBeDefined();
  });

  it('should require the task to return a promise', () => {
    let task = () => 'Not a promise';
    let req = new ShopifyTaskRequest(task as any);
    expect(() => req.start(DummyToken)).toThrow();
  });

  it('should process the task and store the result', async () => {
    let mock = jest.fn((token) => 'Hello');
    let task = async (token) => mock(token);
    let req = new ShopifyTaskRequest(task);

    expect(req.result).not.toBeDefined();
    expect(() => req.start(DummyToken)).not.toThrow();

    //Wait...
    await new Promise((resolve) => setImmediate(resolve));
    //End Wait...

    expect(mock).toHaveBeenCalled();
    expect(mock).toHaveBeenCalledWith(DummyToken);
    expect(req.result).toStrictEqual('Hello');
  });

  it('should store the errors', async () => {
    let mock = jest.fn(() => {throw new Error("Some error")});
    let task = async () => mock();
    let req = new ShopifyTaskRequest(task);

    expect(req.error).not.toBeDefined();
    expect(() => req.start(DummyToken)).not.toThrow();

    //Wait..
    await new Promise(resolve => setImmediate(resolve));

    expect(req.result).not.toBeDefined();
    expect(req.error).toBeDefined();
  });
});

describe('wait', () => {
  it('should return a promise that will wait for the task', async () => {
    let mock = jest.fn(() => {});
    let task = async () => {
      await new Promise(resolve => setImmediate(resolve));
      mock();
    };
    let req = new ShopifyTaskRequest(task);

    let waiter = req.wait();
    expect(waiter).toBeDefined();
    expect(mock).not.toHaveBeenCalled();

    expect(() => req.start(DummyToken)).not.toThrow();

    await new Promise(resolve => setImmediate(resolve));

    await expect(waiter).resolves.not.toThrow();
    expect(mock).toHaveBeenCalled();
  });

  it('should wait however long it takes', async () => {
    let mock = jest.fn(() => {});
    let task = async () => {
      for(let i = 0; i < 5; i++) {
        await new Promise(resolve => setImmediate(resolve));
        mock();
      }
    };
    let req = new ShopifyTaskRequest(task);

    let waiter = req.wait();
    expect(mock).not.toHaveBeenCalled();
    expect(() => req.start(DummyToken)).not.toThrow();

    //It's actually sometimes not true because of timing issues...
    //In theory the times these are getting called back should be consistent
    //but that's not always the case
    await new Promise(resolve => setImmediate(resolve));
    expect(mock).toHaveBeenCalledTimes(1);

    await new Promise(resolve => setImmediate(resolve));
    expect(mock).toHaveBeenCalledTimes(2);

    await expect(waiter).resolves.not.toThrow();
    expect(mock).toHaveBeenCalledTimes(5);
  });

  it('should throw if the task throws', async () => {
    let mock = jest.fn(() => { throw new Error(); });
    let task = async () => {
      await new Promise(resolve => setImmediate(resolve));
      mock();
    };
    let req = new ShopifyTaskRequest(task);

    let waiter = req.wait();
    expect(mock).not.toHaveBeenCalled();
    expect(() => req.start(DummyToken)).not.toThrow();

    await new Promise(resolve => setImmediate(resolve));

    expect(mock).toHaveBeenCalled();
    await expect(waiter).rejects.toThrow();
  });

  it('should return the value from the task', async () => {
    let mock = jest.fn(() => 'Hello World');
    let task = async () => {
      await new Promise(resolve => setImmediate(resolve));
      return mock();
    }
    let req = new ShopifyTaskRequest(task);

    let waiter = req.wait();
    expect(mock).not.toHaveBeenCalled();
    expect(() => req.start(DummyToken)).not.toThrow();

    await new Promise(resolve => setImmediate(resolve));

    expect(mock).toHaveBeenCalled();
    await expect(waiter).resolves.toStrictEqual('Hello World');
  });
});
