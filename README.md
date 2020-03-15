# Api-test-js

Api-test-js is a data-driven-test framework designed to perform tests on HTTP endpoints, specially with JSON, Text or XML content-type. You can use this framework to define integration tests across different micro-services in a common format that can be understood by devs and testers.

More advanced tests can be performed by using node.JS scripts embedded directly in the test definitions.

It can be run directly through npm command by providing test scenarios in json or yaml formats.


## Test scenarios

All information necessary to run a set of related tests must be defined inside the same file, which can have:

- test scenarios
- schemas
- before, beforeAll, after and afterAll fragments.

A test scenario is comprised of a _name_ (mandatory), _data_ and _asserts_ and/or a _script_ in node.JS;
The _test data_ and _schema_ can be configured in `json` or `yaml`.
The request options that can be specified in _data.options_ are the same supported by the [Simplified HTTP request client](https://github.com/request/request).

```yaml
---
- test: get a pet
  data:
    url: ${PETSHOP_URI}/pet/1017
    method: GET
    options:
      headers:
        Accept: application/json
  asserts:
    status: 200
    schema: petshop/pet
    verifypath:
      - path: $.id
        expect: .to.deep.equal([1017])
    responsetime: 10000
```

### Schema

The schema validation (_asserts.schema_) is optional and can be used together with other validations to ensure that the service response is as expected. The schema follows the [JSON schema specification](http://json-schema.org/specification.html). It can be defined inside the test data (inline mode) or in a separate fragment _schema_, so that it can be used to validate more than one enpoint.

```yaml
- schema: petshop/pet
  type: object
  properties:
    id:
      type: integer
    name:
      type: string
    category:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      required:
        - id
        - name
    photoUrls:
      type: array
      items:
        type: string
    tags:
      type: array
      items:
        type: object
        properties:
          id:
            type: integer
          name:
            type: string
        required:
          - id
          - name
    status:
      type: string
      enum:
        - available
        - pending
        - sold
  required:
    - id
    - category
    - name
```

## More examples

One test scenario can reference before, beforeAll, after and afterAll fragments by using the _id_ of these fragments.

```yaml
- beforeEach: requestToken
  url: ${SECURITY_SERVICE_URL}/createJWTToken
  method: GET
  options:
    qs:
      sessionId: ${beforeAll['sessionId'].body}
  asserts:
    status: 200
####################################################################
- test: compare a pet with file
  before:
    - id: read file
      script: >
        const fs = require('fs');
        fs.readFileSync(`${fileDir}/data.json`, 'utf8')
  data:
    url: ${PETSHOP_URI}/pet/1017
    method: GET
    options:
      headers:
        Accept: application/json
        Authorization: Bearer ${beforeEach['requestToken'].body}
  asserts:
    status: 200
    schema: petshop/pet
    verifypath:
      - path: $
        expect: .to.deep.equal([JSON.parse(before['read file'])])
    responsetime: 10000
```

You can take a look at other scenarios in [petshop/petshop.yaml](./petshop/petshop.yaml). This file is used in our unit tests.

### _Asserts_:

These assertions are supported in the _asserts_ fragment: _body_, _has-json_, _has-not-json_, _status_, _responsetime_ e _verifyPath_.

- _verifyPath_ is composed by an array of _expectations_ where each one contains a _path_
(as supported by https://www.npmjs.com/package/jsonpath) and an _expectation_ as supported by the Chai framework (http://chaijs.com/api/bdd/). The default expectation is _.to.have.lengthOf.at.least(1)_.
- body is an array of regular expressions that are tested against the response body (string).
- _has-json_ and _has-not-json_ verify whether the specified paths exist in the response json.

## Installation

Install _nvm_ (https://github.com/creationix/nvm#install-script), and run the following commands in the root directory:

```sh
nvm install
nvm use
npm install
```

## Running tests

Running all test in a test file:

```sh
npm run test -- --ddt=<ddt_file>
```

Running a single scenario in a test file:

```sh
npm run test -- --test='integration-tests/user-crud.yaml' --testcase='POST - Success'
```

Parameter --testcase can be specified more than once in the same command.
You can add _'only': true_ to a test scenario to force the execution of this test only.

## Report

The test report is generated at mockawesome-report/
Test parameters such as url, request options, response status and response text are added to each test scenario in the report.
