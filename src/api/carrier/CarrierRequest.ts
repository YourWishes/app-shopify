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

export interface ICarrierAddress {
  country:string,
  postal_code:string,
  province?:string,
  city:string,
  name?:string
  address1?:string
  address2?:string
  address3?:string,
  phone?:string,
  fax?:string,
  email?:string,
  address_type?:string,
  company_name?:string
}

export interface ICarrierItem {
  name?:string,
  sku?:string,
  quantity:number,
  grams?:number,
  price:number,
  vendor?:string,
  requires_shipping:boolean,
  taxable:boolean,
  fulfillment_service?:string,
  properties?:Shopify.ILineItemProperty[],
  product_id:number,
  variant_id:number
}

export interface ICarrierRequestBody {
  origin:ICarrierAddress,
  destination:ICarrierAddress,
  items:ICarrierItem[],
  currency:string,
  locale:string
}

export interface ICarrierRequest {
  rate:ICarrierRequestBody
}

//Response
export interface ICarrierResponse {
  service_name:string;
  description?:string;
  service_code:string;
  currency:string;
  total_price:number;
  phone_required?:boolean;
  min_delivery_date?:Date
  max_delivery_date?:Date
};
