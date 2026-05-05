/**
 * DummyJSON — products, carts, users, and auth (dummyjson.com).
 */
export const DUMMYJSON_API_SPEC = `openapi: "3.0.3"
info:
  title: DummyJSON API
  version: "1.0.0"
  description: >
    Free fake REST API with products, carts, users, auth, quotes, and more.
    Rich response shapes with images, ratings, reviews, and nested objects.
  contact:
    url: https://dummyjson.com

servers:
  - url: https://dummyjson.com
    description: Production

tags:
  - name: products
    description: Product catalog
  - name: carts
    description: Shopping carts
  - name: users
    description: User data
  - name: auth
    description: Authentication

paths:
  /products:
    get:
      operationId: listProducts
      summary: List products (paginated)
      tags: [products]
      parameters:
        - name: limit
          in: query
          schema: { type: integer, default: 30 }
        - name: skip
          in: query
          schema: { type: integer, default: 0 }
        - name: select
          in: query
          schema: { type: string }
          description: Comma-separated fields to select
      responses:
        "200":
          description: Product list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProductList"

  /products/{id}:
    get:
      operationId: getProduct
      summary: Get product by ID
      tags: [products]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: Product detail
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Product"

  /products/search:
    get:
      operationId: searchProducts
      summary: Search products
      tags: [products]
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Search results
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProductList"

  /products/categories:
    get:
      operationId: listCategories
      summary: List all product categories
      tags: [products]
      responses:
        "200":
          description: Category list
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    slug: { type: string }
                    name: { type: string }
                    url: { type: string }

  /products/category/{category}:
    get:
      operationId: getProductsByCategory
      summary: Get products by category
      tags: [products]
      parameters:
        - name: category
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Products in category
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProductList"

  /carts:
    get:
      operationId: listCarts
      summary: List all carts
      tags: [carts]
      responses:
        "200":
          description: Cart list

  /carts/{id}:
    get:
      operationId: getCart
      summary: Get cart by ID
      tags: [carts]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: Cart detail

  /carts/add:
    post:
      operationId: addCart
      summary: Add a new cart
      tags: [carts]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                userId: { type: integer }
                products:
                  type: array
                  items:
                    type: object
                    properties:
                      id: { type: integer }
                      quantity: { type: integer }
      responses:
        "200":
          description: Cart created

  /carts/user/{userId}:
    get:
      operationId: getCartsByUser
      summary: Get carts by user ID
      tags: [carts]
      parameters:
        - name: userId
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: User carts

  /users:
    get:
      operationId: listUsers
      summary: List users
      tags: [users]
      parameters:
        - name: limit
          in: query
          schema: { type: integer }
        - name: skip
          in: query
          schema: { type: integer }
      responses:
        "200":
          description: User list

  /users/{id}:
    get:
      operationId: getUser
      summary: Get user by ID
      tags: [users]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: User detail
        "404":
          description: User not found

  /users/search:
    get:
      operationId: searchUsers
      summary: Search users
      tags: [users]
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Search results

  /auth/login:
    post:
      operationId: login
      summary: Login and get token
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
          description: Auth token
        "400":
          description: Invalid credentials

  /users/filter:
    get:
      operationId: filterUsers
      summary: Filter users by key/value
      tags: [users]
      parameters:
        - name: key
          in: query
          schema: { type: string }
        - name: value
          in: query
          schema: { type: string }
      responses:
        "200":
          description: Filtered users

components:
  schemas:
    Product:
      type: object
      properties:
        id: { type: integer }
        title: { type: string }
        description: { type: string }
        price: { type: number }
        discountPercentage: { type: number }
        rating: { type: number }
        stock: { type: integer }
        brand: { type: string }
        category: { type: string }
        thumbnail: { type: string }
        images:
          type: array
          items: { type: string }
    ProductList:
      type: object
      properties:
        products:
          type: array
          items:
            $ref: "#/components/schemas/Product"
        total: { type: integer }
        skip: { type: integer }
        limit: { type: integer }
`;
