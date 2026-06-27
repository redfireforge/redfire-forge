/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  getResponseDataUser,
  getResponseDataCreateUser,
  getResponseDataCreateOrder,
  getResponseDataDeleteUser,
} from './graphqlResponseDataExtractors';

describe('graphqlResponseDataExtractors', () => {
  it('getResponseDataUser returns user object from data.user', () => {
    const result = getResponseDataUser({
      data: { user: { id: '1', name: 'Alice' } },
    });
    expect(result).toEqual({ id: '1', name: 'Alice' });
  });

  it('getResponseDataUser returns null when user missing or non-object', () => {
    expect(getResponseDataUser(null)).toBeNull();
    expect(getResponseDataUser({ data: { user: null } })).toBeNull();
    expect(getResponseDataUser({ data: { user: ['x'] } })).toBeNull();
  });

  it('getResponseDataCreateUser returns createUser object from data.createUser', () => {
    const result = getResponseDataCreateUser({
      data: { createUser: { id: 'u1', name: 'Carol' } },
    });
    expect(result).toEqual({ id: 'u1', name: 'Carol' });
  });

  it('getResponseDataCreateUser returns null when createUser missing or non-object', () => {
    expect(getResponseDataCreateUser(null)).toBeNull();
    expect(getResponseDataCreateUser({ data: {} })).toBeNull();
    expect(getResponseDataCreateUser({ data: { createUser: 'bad' } })).toBeNull();
  });

  it('getResponseDataCreateOrder returns createOrder object from data.createOrder', () => {
    const result = getResponseDataCreateOrder({
      data: { createOrder: { id: 'ord-1', status: 'PENDING', customerId: 'cust-demo' } },
    });
    expect(result).toEqual({ id: 'ord-1', status: 'PENDING', customerId: 'cust-demo' });
  });

  it('getResponseDataCreateOrder returns null when createOrder missing or non-object', () => {
    expect(getResponseDataCreateOrder(null)).toBeNull();
    expect(getResponseDataCreateOrder({ data: {} })).toBeNull();
    expect(getResponseDataCreateOrder({ data: { createOrder: 'bad' } })).toBeNull();
  });

  it('getResponseDataDeleteUser returns deleteUser object from data.deleteUser', () => {
    const result = getResponseDataDeleteUser({
      data: { deleteUser: { success: false } },
    });
    expect(result).toEqual({ success: false });
  });

  it('getResponseDataDeleteUser returns null when deleteUser missing or non-object', () => {
    expect(getResponseDataDeleteUser(null)).toBeNull();
    expect(getResponseDataDeleteUser({ data: {} })).toBeNull();
    expect(getResponseDataDeleteUser({ data: { deleteUser: 'bad' } })).toBeNull();
  });
});
