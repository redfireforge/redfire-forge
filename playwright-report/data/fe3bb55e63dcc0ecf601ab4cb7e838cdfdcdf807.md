# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: training-paths.spec.ts >> Training Paths — scroll & collapsible phases >> phase sections are collapsible
- Location: e2e/training-paths.spec.ts:45:3

# Error details

```
Test timeout of 10000ms exceeded while running "beforeEach" hook.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - heading "🔥 RedfireForgev0.5.7-beta.2" [level=1] [ref=e5]:
        - text: 🔥 RedfireForge
        - generic [ref=e6]: v0.5.7-beta.2
      - generic [ref=e7]:
        - combobox [ref=e9] [cursor=pointer]:
          - option "Environment…"
          - option "t01" [selected]
        - combobox [ref=e11] [cursor=pointer]:
          - option "Service…"
          - option "test-service" [selected]
        - button "🌙" [ref=e13] [cursor=pointer]
    - generic [ref=e14]:
      - navigation [ref=e15]:
        - button "🔌" [ref=e16] [cursor=pointer]:
          - generic [ref=e17]: 🔌
        - button "🔧" [ref=e18] [cursor=pointer]:
          - generic [ref=e19]: 🔧
        - button "🏋" [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: 🏋
        - button "🏪" [ref=e22] [cursor=pointer]:
          - generic [ref=e23]: 🏪
        - button "⚙️" [ref=e24] [cursor=pointer]:
          - generic [ref=e25]: ⚙️
      - main [ref=e26]:
        - generic [ref=e28]:
          - button "Samples" [ref=e29] [cursor=pointer]
          - button "Training Tracks" [ref=e30] [cursor=pointer]
        - generic [ref=e33]:
          - complementary [ref=e34]:
            - generic [ref=e35]:
              - generic [ref=e36]: Domains
              - button "📦 All" [ref=e37] [cursor=pointer]
              - button "📡 Requests" [ref=e38] [cursor=pointer]
              - button "📚 API Catalog" [ref=e39] [cursor=pointer]
              - button "🧪 Tests" [ref=e40] [cursor=pointer]
              - button "⚡ Workflows" [ref=e41] [cursor=pointer]
              - button "✅ Assertions" [ref=e42] [cursor=pointer]
            - generic [ref=e43]:
              - generic [ref=e45]: Training Paths
              - button "🔖 Versioning 17" [ref=e46] [cursor=pointer]:
                - generic [ref=e47]: 🔖
                - generic [ref=e48]: Versioning
                - generic [ref=e49]: "17"
              - button "⚡ Workflow Patterns 12" [ref=e50] [cursor=pointer]:
                - generic [ref=e51]: ⚡
                - generic [ref=e52]: Workflow Patterns
                - generic [ref=e53]: "12"
              - button "🔐 Auth Strategies 8" [ref=e54] [cursor=pointer]:
                - generic [ref=e55]: 🔐
                - generic [ref=e56]: Auth Strategies
                - generic [ref=e57]: "8"
              - button "✅ Assertion Mastery 17" [ref=e58] [cursor=pointer]:
                - generic [ref=e59]: ✅
                - generic [ref=e60]: Assertion Mastery
                - generic [ref=e61]: "17"
              - button "📡 Request Basics 14" [ref=e62] [cursor=pointer]:
                - generic [ref=e63]: 📡
                - generic [ref=e64]: Request Basics
                - generic [ref=e65]: "14"
              - button "🧪 Test Suites 34" [ref=e66] [cursor=pointer]:
                - generic [ref=e67]: 🧪
                - generic [ref=e68]: Test Suites
                - generic [ref=e69]: "34"
              - button "📚 API Catalog 9" [ref=e70] [cursor=pointer]:
                - generic [ref=e71]: 📚
                - generic [ref=e72]: API Catalog
                - generic [ref=e73]: "9"
              - button "🔀 Data Mapper 4" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: 🔀
                - generic [ref=e76]: Data Mapper
                - generic [ref=e77]: "4"
              - 'button "🔀 Workflow: Flow Control 6" [ref=e78] [cursor=pointer]':
                - generic [ref=e79]: 🔀
                - generic [ref=e80]: "Workflow: Flow Control"
                - generic [ref=e81]: "6"
              - 'button "🔗 Workflow: API Patterns 6" [ref=e82] [cursor=pointer]':
                - generic [ref=e83]: 🔗
                - generic [ref=e84]: "Workflow: API Patterns"
                - generic [ref=e85]: "6"
              - 'button "🌐 Workflow: Diverse APIs 5" [ref=e86] [cursor=pointer]':
                - generic [ref=e87]: 🌐
                - generic [ref=e88]: "Workflow: Diverse APIs"
                - generic [ref=e89]: "5"
              - 'button "📜 Workflow: Script Node 4" [ref=e90] [cursor=pointer]':
                - generic [ref=e91]: 📜
                - generic [ref=e92]: "Workflow: Script Node"
                - generic [ref=e93]: "4"
              - 'button "📡 Workflow: Event-Driven 4" [ref=e94] [cursor=pointer]':
                - generic [ref=e95]: 📡
                - generic [ref=e96]: "Workflow: Event-Driven"
                - generic [ref=e97]: "4"
              - 'button "⏳ Workflow: Async Correlation 7" [ref=e98] [cursor=pointer]':
                - generic [ref=e99]: ⏳
                - generic [ref=e100]: "Workflow: Async Correlation"
                - generic [ref=e101]: "7"
              - 'button "🎭 Workflow: Orchestration 5" [ref=e102] [cursor=pointer]':
                - generic [ref=e103]: 🎭
                - generic [ref=e104]: "Workflow: Orchestration"
                - generic [ref=e105]: "5"
              - 'button "📋 Workflow: Node Reference 6" [ref=e106] [cursor=pointer]':
                - generic [ref=e107]: 📋
                - generic [ref=e108]: "Workflow: Node Reference"
                - generic [ref=e109]: "6"
              - 'button "⚡ Workflow: Runner 9" [ref=e110] [cursor=pointer]':
                - generic [ref=e111]: ⚡
                - generic [ref=e112]: "Workflow: Runner"
                - generic [ref=e113]: "9"
            - generic:
              - generic:
                - generic: Category
                - combobox "Filter by category":
                  - option "All Categories" [selected]
                  - option "api-patterns"
                  - option "api-validation"
                  - option "auth"
                  - option "contract"
                  - option "crud"
                  - option "data-quality"
                  - option "event-driven"
                  - option "flow-control"
                  - option "load"
                  - option "microservices"
                  - option "orchestration"
                  - option "pagination"
                  - option "performance"
                  - option "public-api"
                  - option "regression"
                  - option "rest-api"
                  - option "search"
                  - option "security"
                  - option "smoke"
                  - option "webhooks"
              - generic:
                - generic: Difficulty
                - combobox "Filter by difficulty":
                  - option "All Levels" [selected]
                  - option "Easy"
                  - option "Medium"
                  - option "Advanced"
              - generic:
                - generic: Live API
                - combobox "Filter by live API":
                  - option "All APIs" [selected]
                  - option "dog.ceo"
                  - option "dummyjson.com"
                  - option "fakestoreapi.com"
                  - option "httpbin.org"
                  - option "jsonplaceholder.typicode.com"
                  - option "localhost:3001"
                  - option "openlibrary.org"
                  - option "petstore.swagger.io"
                  - option "pokeapi.co"
                  - option "restcountries.com"
              - generic:
                - generic: Tag
                - generic:
                  - textbox "Search tags":
                    - /placeholder: Search tags…
                  - list:
                    - listitem:
                      - button "#aggregate"
                    - listitem:
                      - button "#aggregation"
                    - listitem:
                      - button "#approval"
                    - listitem:
                      - button "#array"
                    - listitem:
                      - button "#async"
                    - listitem:
                      - button "#auth"
                    - listitem:
                      - button "#batch"
                    - listitem:
                      - button "#body"
                    - listitem:
                      - button "#books"
                    - listitem:
                      - button "#bottleneck"
                    - listitem:
                      - button "#branching"
                    - listitem:
                      - button "#callback"
                    - listitem:
                      - button "#cart"
                    - listitem:
                      - button "#carts"
                    - listitem:
                      - button "#classic"
                    - listitem:
                      - button "#concurrency"
                    - listitem:
                      - button "#condition"
                    - listitem:
                      - button "#conditions"
                    - listitem:
                      - button "#contract"
                    - listitem:
                      - button "#correlation"
                    - listitem:
                      - button "#countries"
                    - listitem:
                      - button "#create"
                    - listitem:
                      - button "#critical-path"
                    - listitem:
                      - button "#cron"
                    - listitem:
                      - button "#cross-fg"
                    - listitem:
                      - button "#cross-test"
                    - listitem:
                      - button "#crud"
                    - listitem:
                      - button "#dashboard"
                    - listitem:
                      - button "#data-driven"
                    - listitem:
                      - button "#data-source"
                    - listitem:
                      - button "#date"
                    - listitem:
                      - button "#debug"
                    - listitem:
                      - button "#delay"
                    - listitem:
                      - button "#delete"
                    - listitem:
                      - button "#deployment"
                    - listitem:
                      - button "#dummyjson"
                    - listitem:
                      - button "#echo"
                    - listitem:
                      - button "#ecommerce"
                    - listitem:
                      - button "#edge-cases"
                    - listitem:
                      - button "#edge-traversal"
                    - listitem:
                      - button "#enrichment"
                    - listitem:
                      - button "#error-handling"
                    - listitem:
                      - button "#expiry"
                    - listitem:
                      - button "#expressions"
                    - listitem:
                      - button "#extraction"
                    - listitem:
                      - button "#fakestore"
                    - listitem:
                      - button "#fetch-config"
                    - listitem:
                      - button "#filter"
                    - listitem:
                      - button "#filtering"
                    - listitem:
                      - button "#fork-join"
                    - listitem:
                      - button "#full"
                    - listitem:
                      - button "#full-suite"
                    - listitem:
                      - button "#functions"
                    - listitem:
                      - button "#geography"
                    - listitem:
                      - button "#get"
                    - listitem:
                      - button "#headers"
                    - listitem:
                      - button "#health"
                    - listitem:
                      - button "#heatmap"
                    - listitem:
                      - button "#http"
                    - listitem:
                      - button "#httpbin"
                    - listitem:
                      - button "#if-else"
                    - listitem:
                      - button "#image"
                    - listitem:
                      - button "#json"
                    - listitem:
                      - button "#jsonplaceholder"
                    - listitem:
                      - button "#jwt"
                    - listitem:
                      - button "#linked-data"
                    - listitem:
                      - button "#linked-resources"
                    - listitem:
                      - button "#list"
                    - listitem:
                      - button "#load"
                    - listitem:
                      - button "#load-testing"
                    - listitem:
                      - button "#logging"
                    - listitem:
                      - button "#login"
                    - listitem:
                      - button "#loop"
                    - listitem:
                      - button "#math"
                    - listitem:
                      - button "#multi-api"
                    - listitem:
                      - button "#multi-endpoint"
                    - listitem:
                      - button "#nested"
                    - listitem:
                      - button "#notification"
                    - listitem:
                      - button "#numeric"
                    - listitem:
                      - button "#openlibrary"
                    - listitem:
                      - button "#orchestration"
                    - listitem:
                      - button "#page"
                    - listitem:
                      - button "#pagination"
                    - listitem:
                      - button "#parallel"
                    - listitem:
                      - button "#parameterized"
                    - listitem:
                      - button "#payload"
                    - listitem:
                      - button "#payment"
                    - listitem:
                      - button "#performance"
                    - listitem:
                      - button "#pets"
                    - listitem:
                      - button "#pipeline"
                    - listitem:
                      - button "#pokeapi"
                    - listitem:
                      - button "#pokemon"
                    - listitem:
                      - button "#polling"
                    - listitem:
                      - button "#post"
                    - listitem:
                      - button "#posts"
                    - listitem:
                      - button "#price"
                    - listitem:
                      - button "#product"
                    - listitem:
                      - button "#products"
                    - listitem:
                      - button "#profile"
                    - listitem:
                      - button "#provisioning"
                    - listitem:
                      - button "#put"
                    - listitem:
                      - button "#query"
                    - listitem:
                      - button "#random"
                    - listitem:
                      - button "#range"
                    - listitem:
                      - button "#regex"
                    - listitem:
                      - button "#regression"
                    - listitem:
                      - button "#remove"
                    - listitem:
                      - button "#reporting"
                    - listitem:
                      - button "#response-time"
                    - listitem:
                      - button "#rest"
                    - listitem:
                      - button "#rest-countries"
                    - listitem:
                      - button "#results-explorer"
                    - listitem:
                      - button "#retry"
                    - listitem:
                      - button "#rollback"
                    - listitem:
                      - button "#routing"
                    - listitem:
                      - button "#row-tags"
                    - listitem:
                      - button "#schedule"
                    - listitem:
                      - button "#script"
                    - listitem:
                      - button "#search"
                    - listitem:
                      - button "#security"
                    - listitem:
                      - button "#sequential"
                    - listitem:
                      - button "#set-variable"
                    - listitem:
                      - button "#shape"
                    - listitem:
                      - button "#shared-data-source"
                    - listitem:
                      - button "#shipping"
                    - listitem:
                      - button "#simple"
                    - listitem:
                      - button "#simulator"
                    - listitem:
                      - button "#smoke"
                    - listitem:
                      - button "#status"
                    - listitem:
                      - button "#string-ops"
                    - listitem:
                      - button "#sub-workflow"
                    - listitem:
                      - button "#swim-lane"
                    - listitem:
                      - button "#switch"
                    - listitem:
                      - button "#testing"
                    - listitem:
                      - button "#timeout"
                    - listitem:
                      - button "#token"
                    - listitem:
                      - button "#tracing"
                    - listitem:
                      - button "#transform"
                    - listitem:
                      - button "#traversal"
                    - listitem:
                      - button "#trigger"
                    - listitem:
                      - button "#tutorial"
                    - listitem:
                      - button "#update"
                    - listitem:
                      - button "#users"
                    - listitem:
                      - button "#validation"
                    - listitem:
                      - button "#variables"
                    - listitem:
                      - button "#versioning-tutorial"
                    - listitem:
                      - button "#wait"
                    - listitem:
                      - button "#webhook"
                    - listitem:
                      - button "#workflow-level"
          - generic [ref=e114]:
            - generic [ref=e115]:
              - generic [ref=e116]:
                - button "📦 Samples" [ref=e117] [cursor=pointer]
                - button "📖 Training Paths" [active] [ref=e118] [cursor=pointer]
              - searchbox "Search gallery" [ref=e119]
              - generic [ref=e120]: 17 paths available
            - generic [ref=e122]:
              - generic [ref=e123]:
                - heading "📖 Training Paths" [level=2] [ref=e124]
                - paragraph [ref=e125]: Structured learning journeys. Click a path to see its phases, manuals, and linked samples.
              - generic [ref=e126]:
                - button "🔖 Versioning Master version control across all 6 entity types — workflows, tests, requests, environments, feature groups, and scripts. 17 manuals 8 phases 11 samples ▶" [ref=e128] [cursor=pointer]:
                  - generic [ref=e129]: 🔖
                  - generic [ref=e130]:
                    - heading "Versioning" [level=3] [ref=e131]
                    - paragraph [ref=e132]: Master version control across all 6 entity types — workflows, tests, requests, environments, feature groups, and scripts.
                    - generic [ref=e133]:
                      - generic [ref=e134]:
                        - strong [ref=e135]: "17"
                        - text: manuals
                      - generic [ref=e136]:
                        - strong [ref=e137]: "8"
                        - text: phases
                      - generic [ref=e138]:
                        - strong [ref=e139]: "11"
                        - text: samples
                  - generic [ref=e140]: ▶
                - button "⚡ Workflow Patterns Learn conditional branching, parallel execution, error handling, loops, and sub-workflow composition patterns. 12 manuals 4 phases 6 samples ▶" [ref=e142] [cursor=pointer]:
                  - generic [ref=e143]: ⚡
                  - generic [ref=e144]:
                    - heading "Workflow Patterns" [level=3] [ref=e145]
                    - paragraph [ref=e146]: Learn conditional branching, parallel execution, error handling, loops, and sub-workflow composition patterns.
                    - generic [ref=e147]:
                      - generic [ref=e148]:
                        - strong [ref=e149]: "12"
                        - text: manuals
                      - generic [ref=e150]:
                        - strong [ref=e151]: "4"
                        - text: phases
                      - generic [ref=e152]:
                        - strong [ref=e153]: "6"
                        - text: samples
                  - generic [ref=e154]: ▶
                - button "🔐 Auth Strategies API Key, Bearer Token, OAuth2, Basic Auth, and chained auth flows across tests and workflows. 8 manuals 3 phases 2 samples ▶" [ref=e156] [cursor=pointer]:
                  - generic [ref=e157]: 🔐
                  - generic [ref=e158]:
                    - heading "Auth Strategies" [level=3] [ref=e159]
                    - paragraph [ref=e160]: API Key, Bearer Token, OAuth2, Basic Auth, and chained auth flows across tests and workflows.
                    - generic [ref=e161]:
                      - generic [ref=e162]:
                        - strong [ref=e163]: "8"
                        - text: manuals
                      - generic [ref=e164]:
                        - strong [ref=e165]: "3"
                        - text: phases
                      - generic [ref=e166]:
                        - strong [ref=e167]: "2"
                        - text: samples
                  - generic [ref=e168]: ▶
                - button "✅ Assertion Mastery From simple status checks to structured JSON assertions, regex patterns, and custom validation scripts. 17 manuals 4 phases 5 samples ▶" [ref=e170] [cursor=pointer]:
                  - generic [ref=e171]: ✅
                  - generic [ref=e172]:
                    - heading "Assertion Mastery" [level=3] [ref=e173]
                    - paragraph [ref=e174]: From simple status checks to structured JSON assertions, regex patterns, and custom validation scripts.
                    - generic [ref=e175]:
                      - generic [ref=e176]:
                        - strong [ref=e177]: "17"
                        - text: manuals
                      - generic [ref=e178]:
                        - strong [ref=e179]: "4"
                        - text: phases
                      - generic [ref=e180]:
                        - strong [ref=e181]: "5"
                        - text: samples
                  - generic [ref=e182]: ▶
                - button "📡 Request Basics Learn to build, send, and inspect API requests against real public endpoints — from simple GETs to authenticated flows. 14 manuals 3 phases 12 samples ▶" [ref=e184] [cursor=pointer]:
                  - generic [ref=e185]: 📡
                  - generic [ref=e186]:
                    - heading "Request Basics" [level=3] [ref=e187]
                    - paragraph [ref=e188]: Learn to build, send, and inspect API requests against real public endpoints — from simple GETs to authenticated flows.
                    - generic [ref=e189]:
                      - generic [ref=e190]:
                        - strong [ref=e191]: "14"
                        - text: manuals
                      - generic [ref=e192]:
                        - strong [ref=e193]: "3"
                        - text: phases
                      - generic [ref=e194]:
                        - strong [ref=e195]: "12"
                        - text: samples
                  - generic [ref=e196]: ▶
                - button "🧪 Test Suites Build and run test suites — from simple smoke tests to full regression and load profiles. 34 manuals 6 phases 22 samples ▶" [ref=e198] [cursor=pointer]:
                  - generic [ref=e199]: 🧪
                  - generic [ref=e200]:
                    - heading "Test Suites" [level=3] [ref=e201]
                    - paragraph [ref=e202]: Build and run test suites — from simple smoke tests to full regression and load profiles.
                    - generic [ref=e203]:
                      - generic [ref=e204]:
                        - strong [ref=e205]: "34"
                        - text: manuals
                      - generic [ref=e206]:
                        - strong [ref=e207]: "6"
                        - text: phases
                      - generic [ref=e208]:
                        - strong [ref=e209]: "22"
                        - text: samples
                  - generic [ref=e210]: ▶
                - button "📚 API Catalog Explore public API endpoints pre-configured in the gallery — from REST basics to advanced HTTP toolkits. 9 manuals 3 phases 8 samples ▶" [ref=e212] [cursor=pointer]:
                  - generic [ref=e213]: 📚
                  - generic [ref=e214]:
                    - heading "API Catalog" [level=3] [ref=e215]
                    - paragraph [ref=e216]: Explore public API endpoints pre-configured in the gallery — from REST basics to advanced HTTP toolkits.
                    - generic [ref=e217]:
                      - generic [ref=e218]:
                        - strong [ref=e219]: "9"
                        - text: manuals
                      - generic [ref=e220]:
                        - strong [ref=e221]: "3"
                        - text: phases
                      - generic [ref=e222]:
                        - strong [ref=e223]: "8"
                        - text: samples
                  - generic [ref=e224]: ▶
                - button "🔀 Data Mapper Visual source-to-target field mapping — drag-and-drop, expressions, array loops, aggregation, and workflow integration. 4 manuals 2 phases ▶" [ref=e226] [cursor=pointer]:
                  - generic [ref=e227]: 🔀
                  - generic [ref=e228]:
                    - heading "Data Mapper" [level=3] [ref=e229]
                    - paragraph [ref=e230]: Visual source-to-target field mapping — drag-and-drop, expressions, array loops, aggregation, and workflow integration.
                    - generic [ref=e231]:
                      - generic [ref=e232]:
                        - strong [ref=e233]: "4"
                        - text: manuals
                      - generic [ref=e234]:
                        - strong [ref=e235]: "2"
                        - text: phases
                  - generic [ref=e236]: ▶
                - 'button "🔀 Workflow: Flow Control Conditional branching, switch routing, loops, and error handling patterns in workflow execution. 6 manuals 3 phases 5 samples ▶" [ref=e238] [cursor=pointer]':
                  - generic [ref=e239]: 🔀
                  - generic [ref=e240]:
                    - 'heading "Workflow: Flow Control" [level=3] [ref=e241]'
                    - paragraph [ref=e242]: Conditional branching, switch routing, loops, and error handling patterns in workflow execution.
                    - generic [ref=e243]:
                      - generic [ref=e244]:
                        - strong [ref=e245]: "6"
                        - text: manuals
                      - generic [ref=e246]:
                        - strong [ref=e247]: "3"
                        - text: phases
                      - generic [ref=e248]:
                        - strong [ref=e249]: "5"
                        - text: samples
                  - generic [ref=e250]: ▶
                - 'button "🔗 Workflow: API Patterns Common API integration patterns — create-extract-verify, parallel calls, debug tracing, and expression functions. 6 manuals 2 phases 5 samples ▶" [ref=e252] [cursor=pointer]':
                  - generic [ref=e253]: 🔗
                  - generic [ref=e254]:
                    - 'heading "Workflow: API Patterns" [level=3] [ref=e255]'
                    - paragraph [ref=e256]: Common API integration patterns — create-extract-verify, parallel calls, debug tracing, and expression functions.
                    - generic [ref=e257]:
                      - generic [ref=e258]:
                        - strong [ref=e259]: "6"
                        - text: manuals
                      - generic [ref=e260]:
                        - strong [ref=e261]: "2"
                        - text: phases
                      - generic [ref=e262]:
                        - strong [ref=e263]: "5"
                        - text: samples
                  - generic [ref=e264]: ▶
                - 'button "🌐 Workflow: Diverse APIs Real-world workflow samples integrating multiple public APIs — Pokémon, books, countries, products, and dashboards. 5 manuals 2 phases 5 samples ▶" [ref=e266] [cursor=pointer]':
                  - generic [ref=e267]: 🌐
                  - generic [ref=e268]:
                    - 'heading "Workflow: Diverse APIs" [level=3] [ref=e269]'
                    - paragraph [ref=e270]: Real-world workflow samples integrating multiple public APIs — Pokémon, books, countries, products, and dashboards.
                    - generic [ref=e271]:
                      - generic [ref=e272]:
                        - strong [ref=e273]: "5"
                        - text: manuals
                      - generic [ref=e274]:
                        - strong [ref=e275]: "2"
                        - text: phases
                      - generic [ref=e276]:
                        - strong [ref=e277]: "5"
                        - text: samples
                  - generic [ref=e278]: ▶
                - 'button "📜 Workflow: Script Node Custom JavaScript execution within workflows — JSON transformation, cross-API validation, and data pipeline reporting. 4 manuals 2 phases 3 samples ▶" [ref=e280] [cursor=pointer]':
                  - generic [ref=e281]: 📜
                  - generic [ref=e282]:
                    - 'heading "Workflow: Script Node" [level=3] [ref=e283]'
                    - paragraph [ref=e284]: Custom JavaScript execution within workflows — JSON transformation, cross-API validation, and data pipeline reporting.
                    - generic [ref=e285]:
                      - generic [ref=e286]:
                        - strong [ref=e287]: "4"
                        - text: manuals
                      - generic [ref=e288]:
                        - strong [ref=e289]: "2"
                        - text: phases
                      - generic [ref=e290]:
                        - strong [ref=e291]: "3"
                        - text: samples
                  - generic [ref=e292]: ▶
                - 'button "📡 Workflow: Event-Driven Webhook triggers, scheduled execution, and wait-for-condition polling patterns. 4 manuals 2 phases 3 samples ▶" [ref=e294] [cursor=pointer]':
                  - generic [ref=e295]: 📡
                  - generic [ref=e296]:
                    - 'heading "Workflow: Event-Driven" [level=3] [ref=e297]'
                    - paragraph [ref=e298]: Webhook triggers, scheduled execution, and wait-for-condition polling patterns.
                    - generic [ref=e299]:
                      - generic [ref=e300]:
                        - strong [ref=e301]: "4"
                        - text: manuals
                      - generic [ref=e302]:
                        - strong [ref=e303]: "2"
                        - text: phases
                      - generic [ref=e304]:
                        - strong [ref=e305]: "3"
                        - text: samples
                  - generic [ref=e306]: ▶
                - 'button "⏳ Workflow: Async Correlation Pause workflows and resume on matching webhook callbacks — payment flows, approval chains, and parallel async patterns. 7 manuals 2 phases 6 samples ▶" [ref=e308] [cursor=pointer]':
                  - generic [ref=e309]: ⏳
                  - generic [ref=e310]:
                    - 'heading "Workflow: Async Correlation" [level=3] [ref=e311]'
                    - paragraph [ref=e312]: Pause workflows and resume on matching webhook callbacks — payment flows, approval chains, and parallel async patterns.
                    - generic [ref=e313]:
                      - generic [ref=e314]:
                        - strong [ref=e315]: "7"
                        - text: manuals
                      - generic [ref=e316]:
                        - strong [ref=e317]: "2"
                        - text: phases
                      - generic [ref=e318]:
                        - strong [ref=e319]: "6"
                        - text: samples
                  - generic [ref=e320]: ▶
                - 'button "🎭 Workflow: Orchestration Complex multi-stage workflows — sub-workflow composition, order pipelines, batch provisioning, and multi-region deployments. 5 manuals 2 phases 4 samples ▶" [ref=e322] [cursor=pointer]':
                  - generic [ref=e323]: 🎭
                  - generic [ref=e324]:
                    - 'heading "Workflow: Orchestration" [level=3] [ref=e325]'
                    - paragraph [ref=e326]: Complex multi-stage workflows — sub-workflow composition, order pipelines, batch provisioning, and multi-region deployments.
                    - generic [ref=e327]:
                      - generic [ref=e328]:
                        - strong [ref=e329]: "5"
                        - text: manuals
                      - generic [ref=e330]:
                        - strong [ref=e331]: "2"
                        - text: phases
                      - generic [ref=e332]:
                        - strong [ref=e333]: "4"
                        - text: samples
                  - generic [ref=e334]: ▶
                - 'button "📋 Workflow: Node Reference Comprehensive reference guide covering every workflow node type, configuration options, and assertion integration. 6 manuals 2 phases ▶" [ref=e336] [cursor=pointer]':
                  - generic [ref=e337]: 📋
                  - generic [ref=e338]:
                    - 'heading "Workflow: Node Reference" [level=3] [ref=e339]'
                    - paragraph [ref=e340]: Comprehensive reference guide covering every workflow node type, configuration options, and assertion integration.
                    - generic [ref=e341]:
                      - generic [ref=e342]:
                        - strong [ref=e343]: "6"
                        - text: manuals
                      - generic [ref=e344]:
                        - strong [ref=e345]: "2"
                        - text: phases
                  - generic [ref=e346]: ▶
                - 'button "⚡ Workflow: Runner Run workflows as performance tests — iterations, concurrency, variables, and results analysis. 9 manuals 3 phases 7 samples ▶" [ref=e348] [cursor=pointer]':
                  - generic [ref=e349]: ⚡
                  - generic [ref=e350]:
                    - 'heading "Workflow: Runner" [level=3] [ref=e351]'
                    - paragraph [ref=e352]: Run workflows as performance tests — iterations, concurrency, variables, and results analysis.
                    - generic [ref=e353]:
                      - generic [ref=e354]:
                        - strong [ref=e355]: "9"
                        - text: manuals
                      - generic [ref=e356]:
                        - strong [ref=e357]: "3"
                        - text: phases
                      - generic [ref=e358]:
                        - strong [ref=e359]: "7"
                        - text: samples
                  - generic [ref=e360]: ▶
        - text: • • •
  - status
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { seedAppData } from './helpers';
  3   | 
  4   | test.describe('Training Paths — scroll & collapsible phases', () => {
> 5   |   test.beforeEach(async ({ page }) => {
      |        ^ Test timeout of 10000ms exceeded while running "beforeEach" hook.
  6   |     await seedAppData(page);
  7   |     await page.goto('/?tab=gallery');
  8   |     await page.waitForTimeout(500);
  9   |     // Switch to Training Paths mode
  10  |     await page.locator('.gallery-mode-btn', { hasText: 'Training Paths' }).click();
  11  |     await page.waitForTimeout(300);
  12  |   });
  13  | 
  14  |   test('training paths view is scrollable', async ({ page }) => {
  15  |     const scrollArea = page.locator('.gallery-scroll-area');
  16  |     await expect(scrollArea).toBeVisible();
  17  | 
  18  |     // Click Versioning in the sidebar — auto-expands the path
  19  |     await page.locator('.gallery-training-btn', { hasText: 'Versioning' }).click();
  20  |     await page.waitForTimeout(300);
  21  | 
  22  |     // Verify phases are visible (auto-expanded by sidebar click)
  23  |     await expect(page.locator('.training-phase-header').first()).toBeVisible();
  24  | 
  25  |     // The training paths view should have scrollable content
  26  |     const scrollHeight = await scrollArea.evaluate(el => el.scrollHeight);
  27  |     const clientHeight = await scrollArea.evaluate(el => el.clientHeight);
  28  | 
  29  |     // Content MUST overflow when Versioning is expanded (15 manuals across 7 phases)
  30  |     expect(scrollHeight).toBeGreaterThan(clientHeight);
  31  | 
  32  |     // Scroll down and verify it actually scrolls
  33  |     await scrollArea.evaluate(el => el.scrollTo(0, el.scrollHeight));
  34  |     await page.waitForTimeout(200);
  35  |     const scrollTop = await scrollArea.evaluate(el => el.scrollTop);
  36  |     expect(scrollTop).toBeGreaterThan(0);
  37  | 
  38  |     // Scroll back to top
  39  |     await scrollArea.evaluate(el => el.scrollTo(0, 0));
  40  |     await page.waitForTimeout(200);
  41  |     const scrollTopAfter = await scrollArea.evaluate(el => el.scrollTop);
  42  |     expect(scrollTopAfter).toBe(0);
  43  |   });
  44  | 
  45  |   test('phase sections are collapsible', async ({ page }) => {
  46  |     // Click Versioning in sidebar — auto-expands the path
  47  |     await page.locator('.gallery-training-btn', { hasText: 'Versioning' }).click();
  48  |     await page.waitForTimeout(300);
  49  | 
  50  |     // Phases should be visible and expanded by default
  51  |     const phaseHeaders = page.locator('.training-phase-header');
  52  |     await expect(phaseHeaders.first()).toBeVisible();
  53  |     const chevron = phaseHeaders.first().locator('.training-phase-chevron');
  54  |     await expect(chevron).toHaveClass(/open/);
  55  | 
  56  |     // Manuals should be visible
  57  |     const manuals = page.locator('.training-manual-row');
  58  |     const initialCount = await manuals.count();
  59  |     expect(initialCount).toBeGreaterThan(0);
  60  | 
  61  |     // Click the first phase header to collapse it
  62  |     await phaseHeaders.first().click();
  63  |     await page.waitForTimeout(200);
  64  | 
  65  |     // Chevron should no longer have 'open' class
  66  |     await expect(chevron).not.toHaveClass(/open/);
  67  | 
  68  |     // Manual count should decrease
  69  |     const afterCollapseCount = await manuals.count();
  70  |     expect(afterCollapseCount).toBeLessThan(initialCount);
  71  | 
  72  |     // Click again to re-expand
  73  |     await phaseHeaders.first().click();
  74  |     await page.waitForTimeout(200);
  75  |     await expect(chevron).toHaveClass(/open/);
  76  |     const afterExpandCount = await manuals.count();
  77  |     expect(afterExpandCount).toBe(initialCount);
  78  |   });
  79  | 
  80  |   test('collapse all / expand all button works', async ({ page }) => {
  81  |     // Click Versioning in sidebar — auto-expands the path
  82  |     await page.locator('.gallery-training-btn', { hasText: 'Versioning' }).click();
  83  |     await page.waitForTimeout(300);
  84  | 
  85  |     const manuals = page.locator('.training-manual-row');
  86  |     const collapseBtn = page.locator('.training-path-collapse-all-btn');
  87  |     await expect(collapseBtn).toBeVisible();
  88  | 
  89  |     // Initially all expanded — button says "Collapse All"
  90  |     await expect(collapseBtn).toContainText('Collapse All');
  91  |     const initialCount = await manuals.count();
  92  |     expect(initialCount).toBeGreaterThan(0);
  93  | 
  94  |     // Click "Collapse All" — all manuals should disappear
  95  |     await collapseBtn.click();
  96  |     await page.waitForTimeout(200);
  97  |     await expect(manuals).toHaveCount(0);
  98  |     await expect(collapseBtn).toContainText('Expand All');
  99  | 
  100 |     // All chevrons should be closed
  101 |     const openChevrons = page.locator('.training-phase-chevron.open');
  102 |     await expect(openChevrons).toHaveCount(0);
  103 | 
  104 |     // Click "Expand All" — manuals should reappear
  105 |     await collapseBtn.click();
```