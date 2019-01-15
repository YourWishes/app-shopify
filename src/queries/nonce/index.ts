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

export interface NonceRecord {
  id:string, shop:string, nonce:string, generated:Date
};


export const createNoncesTable = (db:DatabaseConnection):Promise<void> => {
  return db.query(`CREATE TABLE IF NOT EXISTS "ShopifyNonces" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "shop" varchar(128) NOT NULL UNIQUE,
    "nonce" text NOT NULL,
    "generated" TIMESTAMP NOT NULL
  );`);
}


export const insertNonce = async (db:DatabaseConnection, shop:string, nonce:string, generated:Date):Promise<NonceRecord> => {
  return db.one(
    'INSERT INTO "ShopifyNonces" ("shop","nonce","generated") VALUES (${shop},${nonce},${generated}) RETURNING *;',
    { shop, nonce, generated }
  );
}


export const deleteNonceForShop = (db:DatabaseConnection, shop:string):Promise<void> => {
  return db.query('DELETE FROM "ShopifyNonces" WHERE "shop"=${shop};', { shop });
};


export const getNonceForShop = (db:DatabaseConnection, shop:string):Promise<NonceRecord> => {
  return db.oneOrNone('SELECT * FROM "ShopifyNonces" WHERE "shop"=${shop};', { shop });
}
