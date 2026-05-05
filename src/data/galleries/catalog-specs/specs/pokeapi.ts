/**
 * PokéAPI — Pokémon data REST API (pokeapi.co/api/v2).
 */
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
