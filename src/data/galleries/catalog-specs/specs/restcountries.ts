/**
 * REST Countries — country lookup and filters (restcountries.com/v3.1).
 */
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
