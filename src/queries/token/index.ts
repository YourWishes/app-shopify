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

import { DatabaseConnection } from '@yourwishes/app-database';

export interface TokenRecord {
  id:string, shop:string, accessToken:string, timestamp:Date
}

export const createTokensTable = (db:DatabaseConnection) => {
  return db.query(`CREATE TABLE IF NOT EXISTS "ShopifyTokens" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "shop" varchar(128) NOT NULL,
    "accessToken" text NOT NULL,
    "timestamp" TIMESTAMP NOT NULL
  );`);
};

export const insertToken = (db:DatabaseConnection, shop:string, accessToken:string, timestamp:Date) => {
  return db.one<TokenRecord>(
    'INSERT INTO "ShopifyTokens" ("shop", "accessToken", "timestamp") VALUES (${shop}, ${accessToken}, ${timestamp}) RETURNING *;',
    { shop, accessToken, timestamp }
  );
};

export const deleteToken = (db:DatabaseConnection, shop:string, accessToken:string) => {
  return db.query('DELETE FROM "ShopifyTokens" WHERE "shop"=${shop} AND "accessToken"=${accessToken};', { shop, accessToken });
}

export const getAccessTokens = (db:DatabaseConnection) => {
  return db.manyOrNone<TokenRecord>('SELECT * FROM "ShopifyTokens";');
};
