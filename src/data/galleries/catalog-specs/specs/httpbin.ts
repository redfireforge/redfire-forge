/**
 * HTTPBin — HTTP echo, auth, delays, and inspection (httpbin.org).
 */
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
