import { App } from '@yourwishes/app-base';
import { ServerModule } from '@yourwishes/app-server';
import { DatabaseConnection } from '@yourwishes/app-database';
import { IShopifyApp, ShopifyModule } from './';

class TestApp extends App implements IShopifyApp {
  server:ServerModule;
  database:DatabaseConnection;
  shopify:ShopifyModule;

  constructor() {
    super();

    this.database = new DatabaseConnection(this);
    this.addModule(this.database);

    this.shopify = new ShopifyModule(this);
    this.addModule(this.shopify);

    this.server = new ServerModule(this);
    this.addModule(this.server);
  }

  getShopifyScopes() {
    return ['read_themes','write_themes'];
  }
}


const app = new TestApp();
app.init().catch(e => console.error(e));
