/**
 * JSONPlaceholder — fake REST API (jsonplaceholder.typicode.com) for users, posts, comments, and todos.
 */
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
