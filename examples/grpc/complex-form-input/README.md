# gRPC Complex Form Input Demo

Use this sample to validate hybrid Form Input UX for deep proto payloads.

## Files
- `complex-echo.proto`: complex request schema with nested messages, oneof, repeated, map, and timestamp fields.
- `complex-echo.request.json`: prefilled request payload matching the schema.

## Quick UI Validation Flow
1. Open gRPC Studio and click `Manage Schemas`.
2. Import `complex-echo.proto` from this folder.
3. Open method `echo.EchoService/CreateComplexEcho` into a tab.
4. In `Form Input`, verify:
   - repeated arrays (`labels`, `line_items`, `windows`)
   - map editors (`attributes`, `experiment_flags`, nested `dimensions`)
   - oneof branch (`payment_method`) branch state and editor behavior
   - timestamp string fields (`deadline`, window start/end)
5. Open `Full Form Editor`:
   - Option A shows complexity insight chips
   - Option C shows visual assist cards for oneof/map/repeated while editing JSON
6. Paste `complex-echo.request.json` in JSON mode and confirm no parse errors.
