/**
 * FakeStore — free e-commerce REST API (fakestoreapi.com) for products, carts, users, and login.
 */
export const FAKESTORE_API_SPEC = `openapi: "3.0.3"
info:
  title: FakeStore API
  version: "1.0.0"
  description: >
    A free online REST API for e-commerce prototyping. Provides products, carts,
    users, and login endpoints — no API key required.
  contact:
    url: https://fakestoreapi.com

servers:
  - url: https://fakestoreapi.com
    description: Production

tags:
  - name: products
    description: Product listing and detail
  - name: carts
    description: Shopping cart operations
  - name: users
    description: User accounts
  - name: auth
    description: Authentication

paths:
  /products:
    get:
      operationId: listProducts
      summary: List all products
      tags: [products]
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
        - name: sort
          in: query
          schema:
            type: string
            enum: [asc, desc]
      responses:
        "200":
          description: Array of products
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Product"

  /products/{id}:
    get:
      operationId: getProduct
      summary: Get a single product
      tags: [products]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Product detail

  /products/categories:
    get:
      operationId: listCategories
      summary: List all categories
      tags: [products]
      responses:
        "200":
          description: Array of category strings

  /carts:
    get:
      operationId: listCarts
      summary: List all carts
      tags: [carts]
      responses:
        "200":
          description: Array of carts

  /users:
    get:
      operationId: listUsers
      summary: List all users
      tags: [users]
      responses:
        "200":
          description: Array of users

  /auth/login:
    post:
      operationId: login
      summary: Login
      tags: [auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: { type: string }
                password: { type: string }
      responses:
        "200":
          description: Token returned
          content:
            application/json:
              schema:
                type: object
                properties:
                  token: { type: string }

components:
  schemas:
    Product:
      type: object
      properties:
        id: { type: integer }
        title: { type: string }
        price: { type: number }
        description: { type: string }
        category: { type: string }
        image: { type: string }
        rating:
          type: object
          properties:
            rate: { type: number }
            count: { type: integer }
`;
