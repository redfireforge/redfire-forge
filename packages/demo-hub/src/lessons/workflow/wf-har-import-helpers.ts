/**
 * wf-har-import demo lesson helpers.
 *
 * Contains the petstore HAR fixture used by the lesson to demonstrate HAR import
 * without driving the native OS file picker.
 *
 * The fixture produces:
 *   - 3 entries (POST /auth/login, GET /users/usr-42, GET /users/usr-42/pets)
 *   - {{baseUrl}} = https://api.petstore.example.com
 *   - Authorization header redacted → {{authToken}}
 *   - Chain variables: {{userId}} (from login response → GET paths), {{id}} (from user response)
 */

export const HAR_FIXTURE_FILENAME = 'petstore-session.har';

/**
 * Minimal valid HAR 1.2 representing a petstore session:
 *   POST /auth/login → GET /users/usr-42 → GET /users/usr-42/pets
 *
 * Sensitive values are illustrative (not real credentials).
 * Chain detection: userId ("usr-42") from login response appears in downstream paths.
 */
export const HAR_FIXTURE_PETSTORE = JSON.stringify({
  log: {
    version: '1.2',
    creator: { name: 'RedfireForge Demo', version: '1.0' },
    entries: [
      {
        startedDateTime: '2026-08-26T09:00:00.000Z',
        time: 120,
        request: {
          method: 'POST',
          url: 'https://api.petstore.example.com/auth/login',
          httpVersion: 'HTTP/1.1',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Accept', value: 'application/json' },
          ],
          queryString: [],
          postData: {
            mimeType: 'application/json',
            text: '{"email":"user@example.com","password":"secret"}',
          },
          cookies: [],
          headersSize: -1,
          bodySize: 48,
        },
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: 'HTTP/1.1',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          cookies: [],
          content: {
            mimeType: 'application/json',
            // userId in response → detected as chain variable for downstream paths
            text: '{"token":"eyJ.example","userId":"usr-42","expiresIn":3600}',
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: 60,
        },
        cache: {},
        timings: { send: 10, wait: 100, receive: 10 },
      },
      {
        startedDateTime: '2026-08-26T09:00:00.200Z',
        time: 85,
        request: {
          method: 'GET',
          url: 'https://api.petstore.example.com/users/usr-42',
          httpVersion: 'HTTP/1.1',
          headers: [
            // Real Bearer token — harParser redacts by header name → {{authToken}} placeholder
            { name: 'Authorization', value: 'Bearer eyJ.example' },
            { name: 'Accept', value: 'application/json' },
          ],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: 0,
        },
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: 'HTTP/1.1',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          cookies: [],
          content: {
            mimeType: 'application/json',
            text: '{"id":"usr-42","name":"Jane Smith","email":"user@example.com"}',
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: 64,
        },
        cache: {},
        timings: { send: 5, wait: 70, receive: 10 },
      },
      {
        startedDateTime: '2026-08-26T09:00:00.400Z',
        time: 95,
        request: {
          method: 'GET',
          url: 'https://api.petstore.example.com/users/usr-42/pets',
          httpVersion: 'HTTP/1.1',
          headers: [
            { name: 'Authorization', value: 'Bearer eyJ.example' },
            { name: 'Accept', value: 'application/json' },
          ],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: 0,
        },
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: 'HTTP/1.1',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          cookies: [],
          content: {
            mimeType: 'application/json',
            text: '[{"id":"pet-1","name":"Fido","species":"dog"},{"id":"pet-2","name":"Whiskers","species":"cat"}]',
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: 95,
        },
        cache: {},
        timings: { send: 5, wait: 80, receive: 10 },
      },
    ],
  },
});
