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

import * as Shopify from 'shopify-api-node';
import { $PropertyType } from 'utility-types';

/// Custom Types ///
export type ICart = {
  "id":string,
  "token":string,
  "line_items": Shopify.ICheckoutLineItem[],
  "note": string|null,
  "updated_at": string,
  "created_at": string
}

export type IDeletedItem = { id:number };


// Return Types //
export type WebhookReturnTypesMap = {
  'app/uninstalled':Shopify.IShop,

  'carts/create':ICart
  'carts/update':ICart

  'checkouts/create':Shopify.ICheckout
  'checkouts/update':Shopify.ICheckout
  'checkouts/delete':IDeletedItem

  'collections/create':(Shopify.ISmartCollection|Shopify.ICustomCollection)
  'collections/update':(Shopify.ISmartCollection|Shopify.ICustomCollection)
  'collections/delete':IDeletedItem

  'collection_listings/add':Shopify.ICollectionListing
  'collection_listings/remove':Shopify.ICollectionListing
  'collection_listings/update':Shopify.ICollectionListing

  'customers/create':Shopify.ICustomer
  'customers/disable':Shopify.ICustomer
  'customers/enable':Shopify.ICustomer
  'customers/update':Shopify.ICustomer
  'customers/delete':IDeletedItem

  'customer_groups/create':Shopify.ICustomerSavedSearch
  'customer_groups/update':Shopify.ICustomerSavedSearch
  'customer_groups/delete':IDeletedItem


  'draft_orders/create':Shopify.IDraftOrder
  'draft_orders/update':Shopify.IDraftOrder
  'draft_orders/delete':IDeletedItem

  'fulfillments/create':Shopify.IFulfillment
  'fulfillments/update':Shopify.IFulfillment
  'fulfillment_events/create':Shopify.IFulfillmentEvent
  'fulfillment_events/delete':IDeletedItem

  'inventory_items/create':Shopify.IInventoryItem
  'inventory_items/update':Shopify.IInventoryItem
  'inventory_items/delete':IDeletedItem

  'inventory_levels/connect':Shopify.IInventoryLevel
  'inventory_levels/update':Shopify.IInventoryLevel
  'inventory_levels/disconnect':Shopify.IInventoryLevel

  'locations/create':Shopify.ILocation
  'locations/update':Shopify.ILocation
  'locations/delete':IDeletedItem


  'orders/cancelled':Shopify.IOrder
  'orders/create':Shopify.IOrder
  'orders/fulfilled':Shopify.IOrder
  'orders/paid':Shopify.IOrder
  'orders/partially_fulfilled':Shopify.IOrder
  'orders/updated':Shopify.IOrder
  'orders/delete':IDeletedItem

  'order_transactions/create':Shopify.ITransaction

  'products/create':Shopify.IProduct
  'products/update':Shopify.IProduct
  'products/delete':IDeletedItem

  'product_listings/add':Shopify.IProductListing
  'product_listings/remove':Shopify.IProductListing
  'product_listings/update':Shopify.IProductListing

  'refunds/create':Shopify.IRefund

  'shop/update':Shopify.IShop

  'themes/create':Shopify.ITheme
  'themes/publish':Shopify.ITheme
  'themes/update':Shopify.ITheme
  'themes/delete':IDeletedItem
};

export type WebhookReturnTypes<T extends Shopify.WebhookTopic> = $PropertyType<WebhookReturnTypesMap, T>;
