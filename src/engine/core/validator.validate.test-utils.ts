import type { AssertionContext } from './validator';

export const collectionCtx: AssertionContext = {
  httpStatus: 200,
  responseTimeMs: 50,
  responseHeaders: {},
  responseBody: {
    offers: [
      { offerName: 'EV Access', rank: 1, isActive: true },
      { offerName: 'Acme Connect Plan', rank: 2, isActive: true },
      { offerName: 'Basic Plan', rank: 0, isActive: false },
    ],
    numbers: [10, 20, 30, 40],
    strings: ['apple', 'banana', 'cherry'],
    nested: { arr: [1, 2, 3] },
    notArray: 'hello',
    emptyArray: [],
    response: { status: 'active', enabled: true, extra: 'data' },
  },
};

export const baseCtx: AssertionContext = {
  httpStatus: 200,
  responseTimeMs: 50,
  responseHeaders: {},
  responseBody: {
    name: 'Alice',
    price: 19.99,
    active: true,
    tags: ['vip', 'premium'],
    address: { city: 'NYC', zip: '10001' },
    deleted: null,
    items: [
      { id: 1, name: 'Widget' },
      { id: 2, name: 'Gadget' },
    ],
    score: 0,
    empty: '',
  },
};
