/**
 * OpenAPI 3.0 YAML specifications for the Catalog Specs Gallery.
 *
 * Contains all 8 spec definitions including the 2 original specs
 * (Correlation Wait API, Pet Store) and 6 public API specs.
 */

// ─── JSONPlaceholder API ─────────────────────────────────────────────────────

export const JSONPLACEHOLDER_API_SPEC = `openapi: "3.0.3"
info:
  title: JSONPlaceholder API
  version: "1.0.0"
  description: >
    Free fake REST API for testing and prototyping. Provides users, posts,
    comments, albums, photos, and todos — all with full CRUD support.
  contact:
    url: https://jsonplaceholder.typicode.com

servers:
  - url: https://jsonplaceholder.typicode.com
    description: Production

tags:
  - name: posts
    description: Blog post operations
  - name: users
    description: User data
  - name: comments
    description: Post comments
  - name: todos
    description: Todo items

paths:
  /posts:
    get:
      operationId: listPosts
      summary: List all posts
      tags: [posts]
      parameters:
        - name: userId
          in: query
          schema:
            type: integer
          description: Filter by author
      responses:
        "200":
          description: Array of posts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Post"
    post:
      operationId: createPost
      summary: Create a post
      tags: [posts]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PostInput"
      responses:
        "201":
          description: Created post
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Post"

  /posts/{id}:
    get:
      operationId: getPost
      summary: Get a post by ID
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Post detail
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Post"
    put:
      operationId: updatePost
      summary: Update a post
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PostInput"
      responses:
        "200":
          description: Updated post
    delete:
      operationId: deletePost
      summary: Delete a post
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Deleted

  /posts/{id}/comments:
    get:
      operationId: getPostComments
      summary: Get comments for a post
      tags: [comments]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Array of comments
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Comment"

  /users:
    get:
      operationId: listUsers
      summary: List all users
      tags: [users]
      responses:
        "200":
          description: Array of users
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/User"

  /users/{id}:
    get:
      operationId: getUser
      summary: Get a user by ID
      tags: [users]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: User detail
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"

  /users/{id}/posts:
    get:
      operationId: getUserPosts
      summary: Get posts by a user
      tags: [posts]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Array of posts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Post"

  /users/{id}/todos:
    get:
      operationId: getUserTodos
      summary: Get todos for a user
      tags: [todos]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Array of todos
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Todo"

  /todos:
    get:
      operationId: listTodos
      summary: List all todos
      tags: [todos]
      responses:
        "200":
          description: Array of todos
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Todo"

  /comments:
    get:
      operationId: listComments
      summary: List all comments
      tags: [comments]
      parameters:
        - name: postId
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: Array of comments
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Comment"

components:
  schemas:
    Post:
      type: object
      properties:
        userId: { type: integer }
        id: { type: integer }
        title: { type: string }
        body: { type: string }
    PostInput:
      type: object
      required: [title, body, userId]
      properties:
        title: { type: string }
        body: { type: string }
        userId: { type: integer }
    Comment:
      type: object
      properties:
        postId: { type: integer }
        id: { type: integer }
        name: { type: string }
        email: { type: string }
        body: { type: string }
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        username: { type: string }
        email: { type: string }
        phone: { type: string }
        website: { type: string }
    Todo:
      type: object
      properties:
        userId: { type: integer }
        id: { type: integer }
        title: { type: string }
        completed: { type: boolean }
`;

// ─── FakeStore API ───────────────────────────────────────────────────────────

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

// ─── PokéAPI ─────────────────────────────────────────────────────────────────

export const POKEAPI_SPEC = `openapi: "3.0.3"
info:
  title: PokéAPI
  version: "2.0.0"
  description: >
    The RESTful Pokémon API. All the Pokémon data you'll ever need in one
    place, easily accessible through a modern RESTful API.
  contact:
    url: https://pokeapi.co

servers:
  - url: https://pokeapi.co/api/v2
    description: Production

tags:
  - name: pokemon
    description: Pokémon data
  - name: types
    description: Pokémon type data
  - name: abilities
    description: Pokémon abilities
  - name: moves
    description: Pokémon moves
  - name: species
    description: Pokémon species data

paths:
  /pokemon:
    get:
      operationId: listPokemon
      summary: List Pokémon (paginated)
      tags: [pokemon]
      parameters:
        - name: limit
          in: query
          schema: { type: integer, default: 20 }
        - name: offset
          in: query
          schema: { type: integer, default: 0 }
      responses:
        "200":
          description: Paginated Pokémon list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaginatedList"

  /pokemon/{nameOrId}:
    get:
      operationId: getPokemon
      summary: Get Pokémon by name or ID
      tags: [pokemon]
      parameters:
        - name: nameOrId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Full Pokémon data
        "404":
          description: Not found

  /type:
    get:
      operationId: listTypes
      summary: List all Pokémon types
      tags: [types]
      responses:
        "200":
          description: Type list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaginatedList"

  /type/{nameOrId}:
    get:
      operationId: getType
      summary: Get type details
      tags: [types]
      parameters:
        - name: nameOrId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Type detail with damage relations
        "404":
          description: Not found

  /ability/{nameOrId}:
    get:
      operationId: getAbility
      summary: Get ability details
      tags: [abilities]
      parameters:
        - name: nameOrId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Ability detail
        "404":
          description: Not found

  /move/{nameOrId}:
    get:
      operationId: getMove
      summary: Get move details
      tags: [moves]
      parameters:
        - name: nameOrId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Move detail
        "404":
          description: Not found

  /pokemon-species/{nameOrId}:
    get:
      operationId: getPokemonSpecies
      summary: Get species details (evolution chain, flavor text)
      tags: [species]
      parameters:
        - name: nameOrId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Species detail
        "404":
          description: Not found

  /evolution-chain/{id}:
    get:
      operationId: getEvolutionChain
      summary: Get evolution chain
      tags: [species]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: Evolution chain data
        "404":
          description: Not found

  /generation/{nameOrId}:
    get:
      operationId: getGeneration
      summary: Get generation details
      tags: [pokemon]
      parameters:
        - name: nameOrId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Generation detail
        "404":
          description: Not found

  /berry/{nameOrId}:
    get:
      operationId: getBerry
      summary: Get berry details
      tags: [pokemon]
      parameters:
        - name: nameOrId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Berry detail
        "404":
          description: Not found

components:
  schemas:
    PaginatedList:
      type: object
      properties:
        count: { type: integer }
        next: { type: string, nullable: true }
        previous: { type: string, nullable: true }
        results:
          type: array
          items:
            type: object
            properties:
              name: { type: string }
              url: { type: string }
`;

// ─── DummyJSON Products API ──────────────────────────────────────────────────

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

// ─── REST Countries API ─────────────────────────────────────────────────────

export const REST_COUNTRIES_API_SPEC = `openapi: "3.0.3"
info:
  title: REST Countries API
  version: "3.1.0"
  description: >
    Get information about countries via a RESTful API. Filter by name, code,
    currency, language, capital, region, and more.
  contact:
    url: https://restcountries.com

servers:
  - url: https://restcountries.com/v3.1
    description: Production (v3.1)

tags:
  - name: countries
    description: Country data queries

paths:
  /all:
    get:
      operationId: getAllCountries
      summary: Get all countries
      tags: [countries]
      parameters:
        - name: fields
          in: query
          schema: { type: string }
          description: Comma-separated fields to include
      responses:
        "200":
          description: All countries

  /name/{name}:
    get:
      operationId: searchByName
      summary: Search countries by name
      tags: [countries]
      parameters:
        - name: name
          in: path
          required: true
          schema: { type: string }
        - name: fullText
          in: query
          schema: { type: boolean }
      responses:
        "200":
          description: Matching countries
        "404":
          description: Not found

  /alpha/{code}:
    get:
      operationId: getByCode
      summary: Get country by alpha code (2 or 3 letter)
      tags: [countries]
      parameters:
        - name: code
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Country detail
        "404":
          description: Not found

  /currency/{currency}:
    get:
      operationId: getByCurrency
      summary: Search by currency code
      tags: [countries]
      parameters:
        - name: currency
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Countries using this currency
        "404":
          description: Not found

  /lang/{language}:
    get:
      operationId: getByLanguage
      summary: Search by language
      tags: [countries]
      parameters:
        - name: language
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Countries speaking this language

  /capital/{capital}:
    get:
      operationId: getByCapital
      summary: Search by capital city
      tags: [countries]
      parameters:
        - name: capital
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Countries with this capital
        "404":
          description: Not found

  /region/{region}:
    get:
      operationId: getByRegion
      summary: Get countries in a region
      tags: [countries]
      parameters:
        - name: region
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Countries in region

  /subregion/{subregion}:
    get:
      operationId: getBySubregion
      summary: Get countries in a subregion
      tags: [countries]
      parameters:
        - name: subregion
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Countries in subregion
`;

// ─── HTTPBin Toolkit ─────────────────────────────────────────────────────────

export const HTTPBIN_API_SPEC = `openapi: "3.0.3"
info:
  title: HTTPBin
  version: "1.0.0"
  description: >
    A simple HTTP request/response service. Useful for testing HTTP clients,
    debugging headers, auth, status codes, redirects, and delays.
  contact:
    url: https://httpbin.org

servers:
  - url: https://httpbin.org
    description: Production

tags:
  - name: http-methods
    description: HTTP method echo endpoints
  - name: auth
    description: Authentication testing
  - name: status
    description: Status code responses
  - name: request-inspection
    description: Inspect request details
  - name: response-inspection
    description: Inspect response details
  - name: dynamic
    description: Dynamic data endpoints
  - name: redirects
    description: Redirect testing

paths:
  /get:
    get:
      operationId: httpGet
      summary: Echo GET request
      tags: [http-methods]
      responses:
        "200":
          description: Request details echoed back

  /post:
    post:
      operationId: httpPost
      summary: Echo POST request
      tags: [http-methods]
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        "200":
          description: Request details echoed back

  /put:
    put:
      operationId: httpPut
      summary: Echo PUT request
      tags: [http-methods]
      responses:
        "200":
          description: Request details echoed back

  /patch:
    patch:
      operationId: httpPatch
      summary: Echo PATCH request
      tags: [http-methods]
      responses:
        "200":
          description: Request details echoed back

  /delete:
    delete:
      operationId: httpDelete
      summary: Echo DELETE request
      tags: [http-methods]
      responses:
        "200":
          description: Request details echoed back

  /status/{codes}:
    get:
      operationId: getStatus
      summary: Return given status code
      tags: [status]
      parameters:
        - name: codes
          in: path
          required: true
          schema: { type: string }
          description: Status code(s), comma-separated for random selection
      responses:
        "200":
          description: Returns the requested status code

  /headers:
    get:
      operationId: getHeaders
      summary: Return request headers
      tags: [request-inspection]
      responses:
        "200":
          description: Headers echoed back

  /ip:
    get:
      operationId: getIp
      summary: Return client IP
      tags: [request-inspection]
      responses:
        "200":
          description: Client IP address

  /user-agent:
    get:
      operationId: getUserAgent
      summary: Return user agent
      tags: [request-inspection]
      responses:
        "200":
          description: User agent string

  /basic-auth/{user}/{passwd}:
    get:
      operationId: basicAuth
      summary: Test HTTP Basic Auth
      tags: [auth]
      parameters:
        - name: user
          in: path
          required: true
          schema: { type: string }
        - name: passwd
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Authenticated
        "401":
          description: Unauthorized

  /bearer:
    get:
      operationId: bearerAuth
      summary: Test Bearer token auth
      tags: [auth]
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Authenticated
        "401":
          description: Unauthorized

  /delay/{delay}:
    get:
      operationId: getDelay
      summary: Delay response by N seconds (max 10)
      tags: [dynamic]
      parameters:
        - name: delay
          in: path
          required: true
          schema: { type: integer, maximum: 10 }
      responses:
        "200":
          description: Delayed response

  /bytes/{n}:
    get:
      operationId: getBytes
      summary: Generate N random bytes
      tags: [dynamic]
      parameters:
        - name: "n"
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: Random bytes

  /uuid:
    get:
      operationId: getUuid
      summary: Generate a UUID4
      tags: [dynamic]
      responses:
        "200":
          description: UUID4 string

  /redirect/{n}:
    get:
      operationId: redirect
      summary: 302 redirect N times
      tags: [redirects]
      parameters:
        - name: "n"
          in: path
          required: true
          schema: { type: integer }
      responses:
        "302":
          description: Redirect

  /response-headers:
    get:
      operationId: responseHeaders
      summary: Set arbitrary response headers
      tags: [response-inspection]
      responses:
        "200":
          description: Response with custom headers

  /cookies:
    get:
      operationId: getCookies
      summary: Return cookies
      tags: [request-inspection]
      responses:
        "200":
          description: Cookies echoed back

  /cookies/set:
    get:
      operationId: setCookies
      summary: Set cookies via query params
      tags: [response-inspection]
      responses:
        "302":
          description: Redirect with Set-Cookie headers

  /anything:
    get:
      operationId: anything
      summary: Echo anything — method, headers, body, args
      tags: [http-methods]
      responses:
        "200":
          description: Everything echoed back

  /image/{format}:
    get:
      operationId: getImage
      summary: Return an image in the given format
      tags: [dynamic]
      parameters:
        - name: format
          in: path
          required: true
          schema:
            type: string
            enum: [png, jpeg, webp, svg]
      responses:
        "200":
          description: Image data

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
    basicAuth:
      type: http
      scheme: basic
`;

// ─── Legacy specs (migrated from sampleCatalogSpecs.ts) ──────────────────────

export const CORRELATION_WAIT_API_SPEC = `openapi: "3.0.3"
info:
  title: RedfireForge Correlation Wait API
  version: "1.0.0"
  description: >
    Server-side API for managing paused workflow correlations and processing
    webhook callbacks. Supports correlation matching by body JSONPath, HTTP
    header, or query parameter. Optional HMAC-SHA256 security, idempotency,
    and webhook filter expressions.

servers:
  - url: http://localhost:3001
    description: Local Development

tags:
  - name: correlations
    description: Manage paused workflow correlations
  - name: webhooks
    description: Webhook callback endpoints for external systems
  - name: diagnostics
    description: Idempotency stats and unmatched webhook logs

paths:
  /api/correlations/pause:
    post:
      operationId: pauseCorrelation
      summary: Register a paused correlation
      description: >
        Register a workflow as paused and waiting for a webhook callback.
        The correlation ID is used to match incoming webhooks to the paused
        workflow. When WEBHOOK_SECURITY_ENABLED=true, the response includes
        a signed webhook token.
      tags: [correlations]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [correlationId, webhookPath, executionId]
              properties:
                correlationId:
                  type: string
                  description: Unique ID to match against incoming webhooks
                webhookPath:
                  type: string
                  description: Webhook path to match
                executionId:
                  type: string
                  description: Workflow execution ID
                workflowId:
                  type: string
                pausedNodeId:
                  type: string
                timeoutMs:
                  type: integer
                  default: 0
                correlationSource:
                  type: string
                  enum: [body, header, query]
                  default: body
                correlationJsonPath:
                  type: string
                correlationHeader:
                  type: string
                correlationQueryParam:
                  type: string
                webhookFilter:
                  type: string
            example:
              correlationId: "pay_4kF9xR2mNqLp"
              webhookPath: "/webhooks/callback/payment"
              executionId: "exec-abc-001"
              timeoutMs: 300000
              correlationSource: "body"
              correlationJsonPath: "$.paymentId"
      responses:
        "201":
          description: Correlation registered successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  paused:
                    type: boolean
                  correlationId:
                    type: string
                  timeoutAt:
                    type: integer
        "409":
          description: Correlation ID already exists

  /api/correlations/resume:
    post:
      operationId: resumeCorrelation
      summary: Resume a paused correlation directly
      description: >
        Directly resume a paused workflow by its correlation ID.
        Used by the "Resume Manually" button and Test Webhook feature.
      tags: [correlations]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [correlationId]
              properties:
                correlationId:
                  type: string
                webhookData:
                  type: object
            example:
              correlationId: "pay_4kF9xR2mNqLp"
              webhookData:
                paymentId: "pay_4kF9xR2mNqLp"
                status: "approved"
                transactionId: "txn_8mK3vP7wXjRs"
                amount: 99.99
                currency: "USD"
                cardBrand: "visa"
                last4: "4242"
                authorizationCode: "AUTH-779231"
                riskScore: 12
                processedAt: "2024-01-15T10:26:14.392Z"
                receiptUrl: "https://pay.example.com/receipts/txn_8mK3vP7wXjRs"
      responses:
        "200":
          description: Resume result
          content:
            application/json:
              schema:
                type: object
                properties:
                  resumed:
                    type: boolean
                  correlationId:
                    type: string
                  executionId:
                    type: string

  /api/correlations:
    get:
      operationId: listCorrelations
      summary: List all paused correlations
      tags: [correlations]
      responses:
        "200":
          description: List of paused correlations
          content:
            application/json:
              schema:
                type: object
                properties:
                  correlations:
                    type: array
                    items:
                      type: object
                      properties:
                        correlationId:
                          type: string
                        webhookPath:
                          type: string
                        executionId:
                          type: string
                        pausedAt:
                          type: integer
                  count:
                    type: integer

  /api/correlations/{correlationId}:
    delete:
      operationId: cancelCorrelation
      summary: Cancel a paused correlation
      tags: [correlations]
      parameters:
        - name: correlationId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Correlation cancelled
        "404":
          description: Correlation not found

  /api/correlations/cleanup:
    post:
      operationId: cleanupCorrelations
      summary: Cleanup expired correlations
      tags: [correlations]
      responses:
        "200":
          description: Cleanup result
          content:
            application/json:
              schema:
                type: object
                properties:
                  cleaned:
                    type: integer
                  remaining:
                    type: integer

  /api/correlations/unmatched:
    get:
      operationId: getUnmatchedWebhooks
      summary: Get unmatched webhook log
      description: >
        Returns a log of webhook callbacks that did not match any paused workflow.
      tags: [diagnostics]
      responses:
        "200":
          description: Unmatched webhook list
          content:
            application/json:
              schema:
                type: object
                properties:
                  unmatched:
                    type: array
                    items:
                      type: object
                      properties:
                        path:
                          type: string
                        correlationId:
                          type: string
                        receivedAt:
                          type: integer
                  count:
                    type: integer

  /api/correlations/idempotency:
    get:
      operationId: getIdempotencyStats
      summary: Get idempotency cache stats
      tags: [diagnostics]
      responses:
        "200":
          description: Idempotency stats
          content:
            application/json:
              schema:
                type: object
                properties:
                  size:
                    type: integer

  /webhooks/callback/{path}:
    post:
      operationId: webhookCallbackPost
      summary: Webhook callback (POST)
      description: >
        Primary endpoint that external systems call to resume paused workflows.
        Extracts correlation ID from body, header, or query parameter.
      tags: [webhooks]
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
          description: Webhook path suffix
        - name: x-webhook-signature
          in: header
          required: false
          schema:
            type: string
          description: HMAC-SHA256 hex digest (when security enabled)
        - name: x-idempotency-key
          in: header
          required: false
          schema:
            type: string
          description: Idempotency key for deduplication
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
            example:
              paymentId: "pay_4kF9xR2mNqLp"
              status: "approved"
              transactionId: "txn_8mK3vP7wXjRs"
              amount: 99.99
              currency: "USD"
              cardBrand: "visa"
              last4: "4242"
              authorizationCode: "AUTH-779231"
              riskScore: 12
              processedAt: "2024-01-15T10:26:14.392Z"
              receiptUrl: "https://pay.example.com/receipts/txn_8mK3vP7wXjRs"
      responses:
        "200":
          description: Webhook processed — workflow resumed
          content:
            application/json:
              schema:
                type: object
                properties:
                  resumed:
                    type: boolean
                  correlationId:
                    type: string
                  executionId:
                    type: string
        "401":
          description: Signature verification failed
        "403":
          description: IP not allowed
        "404":
          description: No matching paused workflow
        "422":
          description: Webhook filter rejected the payload
    get:
      operationId: webhookCallbackGet
      summary: Webhook callback (GET)
      description: Alternative GET endpoint for query-parameter-based callbacks.
      tags: [webhooks]
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Webhook processed
        "404":
          description: No matching paused workflow
`;

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

