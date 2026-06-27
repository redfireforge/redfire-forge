import { buildSchema, printSchema } from 'graphql';

export interface SdlDiffGoldenChangedLine {
  kind: 'removed' | 'added' | 'modified';
  side: 'left' | 'right';
  contains: string;
}

export interface SdlDiffGoldenCase {
  id: string;
  description: string;
  oldSdl: string;
  newSdl: string;
  stats: {
    removed: number;
    added: number;
    modified: number;
    unchanged: number;
  };
  changedLines?: SdlDiffGoldenChangedLine[];
  /** Substrings that must appear on unchanged rows (both sides). */
  unchangedMustInclude?: string[];
}

const ps = (sdl: string) => printSchema(buildSchema(sdl));

/** Prior-release baseline vs Docker :4010 — the GQL-12 demo pair. */
const LESSON12_OLD = ps(`
  type Query {
    health: String
    user(id: ID!): User
    users: [User!]!
  }
  type User {
    id: ID!
    name: String!
  }
  input OrderInput {
    customerId: ID!
    items: [String!]
  }
  type Order {
    id: ID!
    status: OrderStatusEnum!
    customerId: ID!
  }
  enum OrderStatusEnum {
    PENDING
    PROCESSING
    COMPLETE
  }
  type OrderStatus {
    status: OrderStatusEnum!
    updatedAt: String!
  }
  type Mutation {
    createOrder(input: OrderInput!): Order!
    createUser(name: String!, email: String!): User!
    deleteUser(id: ID!): DeleteResult!
  }
  type DeleteResult {
    success: Boolean!
  }
  type Subscription {
    orderStatus(orderId: ID!): OrderStatus!
  }
`);

const LESSON12_NEW = ps(`
  type Query {
    health: String
    user(id: ID!): User
  }
  type User {
    id: ID!
    name: String!
    email: String!
  }
  input OrderInput {
    customerId: ID!
    items: [String!]
  }
  type Order {
    id: ID!
    status: OrderStatusEnum!
    customerId: ID!
  }
  enum OrderStatusEnum {
    PENDING
    PROCESSING
    COMPLETE
  }
  type OrderStatus {
    status: OrderStatusEnum!
    updatedAt: String!
  }
  type Mutation {
    createOrder(input: OrderInput!): Order!
    createUser(name: String!, email: String!): User!
    deleteUser(id: ID!): DeleteResult!
  }
  type DeleteResult {
    success: Boolean!
  }
  type Subscription {
    orderStatus(orderId: ID!): OrderStatus!
  }
`);

export const SDL_DIFF_GOLDEN_CASES: SdlDiffGoldenCase[] = [
  {
    id: 'lesson12-demo',
    description: 'GQL-12 prior release vs current Docker schema',
    oldSdl: LESSON12_OLD,
    newSdl: LESSON12_NEW,
    stats: { removed: 1, added: 1, modified: 0, unchanged: 45 },
    changedLines: [
      { kind: 'removed', side: 'left', contains: 'users: [User!]!' },
      { kind: 'added', side: 'right', contains: 'email: String!' },
    ],
    unchangedMustInclude: ['type Query {', 'health: String', 'type Mutation {'],
  },
  {
    id: 'identical-canonical',
    description: 'Identical schemas produce zero highlighted rows',
    oldSdl: ps('type Query { health: String ping: String }'),
    newSdl: ps('type Query { health: String ping: String }'),
    stats: { removed: 0, added: 0, modified: 0, unchanged: 4 },
  },
  {
    id: 'field-type-change',
    description: 'Scalar field type change is one modified row with inline diff',
    oldSdl: ps('type Query { x: User } type User { id: ID! score: Int }'),
    newSdl: ps('type Query { x: User } type User { id: ID! score: String }'),
    stats: { removed: 0, added: 0, modified: 1, unchanged: 7 },
    changedLines: [
      { kind: 'modified', side: 'left', contains: 'score: Int' },
      { kind: 'modified', side: 'right', contains: 'score: String' },
    ],
    unchangedMustInclude: ['type User {', 'id: ID!'],
  },
  {
    id: 'enum-value-added',
    description: 'New enum value is a single added row',
    oldSdl: ps('type Query { x: Status } enum Status { ACTIVE INACTIVE }'),
    newSdl: ps('type Query { x: Status } enum Status { ACTIVE INACTIVE PENDING }'),
    stats: { removed: 0, added: 1, modified: 0, unchanged: 8 },
    changedLines: [
      { kind: 'added', side: 'right', contains: 'PENDING' },
    ],
    unchangedMustInclude: ['enum Status {', 'ACTIVE', 'INACTIVE'],
  },
  {
    id: 'query-arg-added',
    description: 'Field signature change is one modified row',
    oldSdl: ps('type Query { user: User } type User { id: ID! }'),
    newSdl: ps('type Query { user(id: ID!): User } type User { id: ID! }'),
    stats: { removed: 0, added: 0, modified: 1, unchanged: 6 },
    changedLines: [
      { kind: 'modified', side: 'left', contains: 'user: User' },
      { kind: 'modified', side: 'right', contains: 'user(id: ID!): User' },
    ],
  },
  {
    id: 'type-rename',
    description: 'Renamed object type surfaces as modified reference + type header lines',
    oldSdl: ps('type Query { account: Account } type Account { id: ID! }'),
    newSdl: ps('type Query { account: Customer } type Customer { id: ID! }'),
    stats: { removed: 0, added: 0, modified: 2, unchanged: 5 },
    changedLines: [
      { kind: 'modified', side: 'left', contains: 'Account' },
      { kind: 'modified', side: 'right', contains: 'Customer' },
    ],
  },
  {
    id: 'type-rename-with-reference',
    description: 'Renamed type referenced in Query updates both the field line and type header',
    oldSdl: ps('type Query { node: LegacyNode } type LegacyNode { id: ID! }'),
    newSdl: ps('type Query { node: ModernNode } type ModernNode { id: ID! }'),
    stats: { removed: 0, added: 0, modified: 2, unchanged: 5 },
    changedLines: [
      { kind: 'modified', side: 'left', contains: 'LegacyNode' },
      { kind: 'modified', side: 'right', contains: 'ModernNode' },
    ],
  },
  {
    id: 'multi-scattered-edits',
    description: 'Several independent edits across Query, User, and Role enum',
    oldSdl: ps(`
      type Query { a: String b: String c: Int }
      type User { id: ID! name: String }
      enum Role { ADMIN USER }
    `),
    newSdl: ps(`
      type Query { a: String b: String c: Float d: Boolean }
      type User { id: ID! name: String email: String }
      enum Role { ADMIN USER GUEST }
    `),
    stats: { removed: 1, added: 4, modified: 0, unchanged: 14 },
    changedLines: [
      { kind: 'removed', side: 'left', contains: 'c: Int' },
      { kind: 'added', side: 'right', contains: 'c: Float' },
      { kind: 'added', side: 'right', contains: 'd: Boolean' },
      { kind: 'added', side: 'right', contains: 'email: String' },
      { kind: 'added', side: 'right', contains: 'GUEST' },
    ],
    unchangedMustInclude: ['a: String', 'b: String', 'ADMIN', 'USER'],
  },
  {
    id: 'whole-type-added',
    description: 'Adding a new type emits only added rows for its lines',
    oldSdl: ps('type Query { a: String }'),
    newSdl: ps('type Query { a: String } type NewType { id: ID! label: String }'),
    stats: { removed: 0, added: 5, modified: 0, unchanged: 3 },
    changedLines: [
      { kind: 'added', side: 'right', contains: 'type NewType {' },
      { kind: 'added', side: 'right', contains: 'label: String' },
    ],
    unchangedMustInclude: ['type Query {', 'a: String'],
  },
  {
    id: 'input-field-removed',
    description: 'Removing an input field is one removed row inside unchanged input block',
    oldSdl: ps(`
      type Query { create(data: CreateInput!): String }
      input CreateInput { title: String! legacyId: Int }
    `),
    newSdl: ps(`
      type Query { create(data: CreateInput!): String }
      input CreateInput { title: String! }
    `),
    stats: { removed: 1, added: 0, modified: 0, unchanged: 7 },
    changedLines: [
      { kind: 'removed', side: 'left', contains: 'legacyId: Int' },
    ],
    unchangedMustInclude: ['input CreateInput {', 'title: String!'],
  },
  {
    id: 'formatting-only-indented',
    description: 'Manual indentation matches after canonicalization — no false edits',
    oldSdl: ps('type Query { ping: String }')
      .split('\n')
      .map((line) => (line ? `  ${line}` : line))
      .join('\n'),
    newSdl: ps('type Query { ping: String }'),
    stats: { removed: 0, added: 0, modified: 0, unchanged: 3 },
  },
];
