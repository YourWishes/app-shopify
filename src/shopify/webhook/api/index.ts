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

export const WebhookTypes = [
  'app/uninstalled',

  'carts/create',
  'carts/update',

  'checkouts/create',
  'checkouts/update',
  'checkouts/delete',

  'collections/create',
  'collections/update',
  'collections/delete',

  'collection_listings/add',
  'collection_listings/remove',
  'collection_listings/update',

  'customers/create',
  'customers/disable',
  'customers/enable',
  'customers/update',
  'customers/delete',

  'customer_groups/create',
  'customer_groups/update',
  'customer_groups/delete',


  'draft_orders/create',
  'draft_orders/update',
  'draft_orders/delete',

  'fulfillments/create',
  'fulfillments/update',
  'fulfillment_events/create',
  'fulfillment_events/delete',

  'inventory_items/create',
  'inventory_items/update',
  'inventory_items/delete',

  'inventory_levels/connect',
  'inventory_levels/update',
  'inventory_levels/disconnect',

  'locations/create',
  'locations/update',
  'locations/delete',


  'orders/cancelled',
  'orders/create',
  'orders/fulfilled',
  'orders/paid',
  'orders/partially_fulfilled',
  'orders/updated',
  'orders/delete',

  'order_transactions/create',

  'products/create',
  'products/update',
  'products/delete',

  'product_listings/add',
  'product_listings/remove',
  'product_listings/update',

  'refunds/create',

  'shop/update',

  'themes/create',
  'themes/publish',
  'themes/update',
  'themes/delete'
] as Shopify.WebhookTopic[];
