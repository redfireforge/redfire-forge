/**
 * Sample Pet Store API — pets, orders, and users CRUD.
 */
export const PET_STORE_API_SPEC = `openapi: "3.0.3"
info:
  title: Pet Store API
  version: "1.0.0"
  description: >
    Classic sample REST API for managing pets, orders, and users.
    Demonstrates CRUD operations, tags, pagination, and authentication.

servers:
  - url: https://api.petstore.example.com/v1
    description: Production
  - url: https://staging.petstore.example.com/v1
    description: Staging

tags:
  - name: pets
    description: Pet CRUD operations
  - name: orders
    description: Store order management
  - name: users
    description: User management and authentication

paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      description: Returns a paginated list of pets with optional filtering.
      tags: [pets]
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 20
            maximum: 100
          description: Maximum number of results
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            default: 0
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [available, pending, sold]
        - name: tag
          in: query
          required: false
          schema:
            type: string
      responses:
        "200":
          description: A list of pets
          content:
            application/json:
              schema:
                type: object
                properties:
                  pets:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: integer
                        name:
                          type: string
                        status:
                          type: string
                        tags:
                          type: array
                          items:
                            type: string
                  total:
                    type: integer
    post:
      operationId: createPet
      summary: Create a new pet
      tags: [pets]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name:
                  type: string
                category:
                  type: string
                status:
                  type: string
                  enum: [available, pending, sold]
                tags:
                  type: array
                  items:
                    type: string
            example:
              name: "Buddy"
              category: "dog"
              status: "available"
              tags: ["friendly", "trained"]
      responses:
        "201":
          description: Pet created
        "400":
          description: Invalid input

  /pets/{petId}:
    get:
      operationId: getPetById
      summary: Get pet by ID
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Pet details
        "404":
          description: Pet not found
    put:
      operationId: updatePet
      summary: Update an existing pet
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                status:
                  type: string
                  enum: [available, pending, sold]
      responses:
        "200":
          description: Pet updated
        "404":
          description: Pet not found
    delete:
      operationId: deletePet
      summary: Delete a pet
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "204":
          description: Pet deleted
        "404":
          description: Pet not found

  /pets/{petId}/images:
    post:
      operationId: uploadPetImage
      summary: Upload a pet image
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
      responses:
        "200":
          description: Image uploaded

  /orders:
    get:
      operationId: listOrders
      summary: List store orders
      tags: [orders]
      responses:
        "200":
          description: List of orders
    post:
      operationId: placeOrder
      summary: Place a new order
      tags: [orders]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [petId, quantity]
              properties:
                petId:
                  type: integer
                quantity:
                  type: integer
                shipDate:
                  type: string
                  format: date-time
            example:
              petId: 42
              quantity: 1
      responses:
        "201":
          description: Order placed
        "400":
          description: Invalid order

  /orders/{orderId}:
    get:
      operationId: getOrderById
      summary: Get order by ID
      tags: [orders]
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Order details
        "404":
          description: Order not found
    delete:
      operationId: cancelOrder
      summary: Cancel an order
      tags: [orders]
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "204":
          description: Order cancelled

  /users:
    post:
      operationId: createUser
      summary: Create user
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, email]
              properties:
                username:
                  type: string
                email:
                  type: string
                  format: email
                password:
                  type: string
                  format: password
      responses:
        "201":
          description: User created

  /users/login:
    post:
      operationId: loginUser
      summary: Log in
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username:
                  type: string
                password:
                  type: string
                  format: password
      responses:
        "200":
          description: Login successful
        "401":
          description: Invalid credentials

  /users/{username}:
    get:
      operationId: getUserByName
      summary: Get user by username
      tags: [users]
      parameters:
        - name: username
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: User info
        "404":
          description: User not found

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKeyAuth:
      type: apiKey
      name: X-API-Key
      in: header
`;
