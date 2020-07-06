
<meta name="google-site-verification" content="d4XE3GwYE5ZNouXspM29G4GXXL-9Y8Dm5pK8IN5TRzI" />

# Api-test-js

Api-test-js is a data-driven-test framework designed to perform tests on REST endpoints, specially with JSON or Text Content-Type. You can use this framework to define integration tests across different micro-services in a common format that can be understood by devs and testers.

Although you can write your test definitions manually, sample test definitions can be generated directly from your Swagger documentation.

More advanced tests can be performed by using node.JS scripts embedded directly in the test definitions.

It can be run directly through npm command by providing test scenarios in json or yaml (or yml) formats.

The results and details of the API tests are presented in an HTML report for easy verification.

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

You can take a look at other scenarios in [petshop/petshop.yaml](https://github.com/negrello/api-test-js/blob/master/petshop/petshop.yaml). This file is used in our unit tests.

### _Asserts_:

These assertions are supported in the _asserts_ fragment: _body_, _has-json_, _has-not-json_, _status_, _responsetime_ e _verifyPath_.

- _verifyPath_ is composed by an array of _expectations_ where each one contains a _path_
(as supported by https://www.npmjs.com/package/jsonpath) and an _expectation_ as supported by the Chai framework (http://chaijs.com/api/bdd/). The default expectation is _.to.have.lengthOf.at.least(1)_.
- body is an array of regular expressions that are tested against the response body (string).
- _has-json_ and _has-not-json_ verify whether the specified paths exist in the response json.

## Installation

Installing api-test-js in current directory:

```sh
npm install api-test-js
```

You can use the binaries directly (./node_modules/api-test-js/bin/api-test.js) or through _npm-run_ (recommended). 
In this case, you also need to install npm-run globally:

```sh
sudo npm install -g npm-run
```

If you with to install api-test-js globally, some additional flags are required due to third-party restrictions:

```sh
sudo npm install -g --unsafe-perm=true --allow-root api-test-js
```

## Generating test scenarios from Swagger Documentation

Documenting your APIs with swagger is a good practice, and it can be accomplished by using tools such as Springfox (for Spring users) or express-swagger-generator for node users, among others.

You can generate sample test scenarios by using the _gen_ command. It will scan the swagger documentation and generate a test for each combination of path + method. It will also automatically add a sample payload based on the method parameters, and a _schema_ assert based on the response schema.
For each _tag_ defined by the API, a file will be created containing all paths/methods with that tag.

```sh
> npm-run gen-test --file=https://petstore.swagger.io/v2/swagger.json

Generating test descriptors generated at ./Swagger Petstore/pet.yaml
Generating test descriptors generated at ./Swagger Petstore/store.yaml
Generating test descriptors generated at ./Swagger Petstore/user.yaml
```

The _file_ argument must point to the json containing the swagger documentation of your service. It can be an URL or a local file.

You can specify the output directory with _outDir_ argument:

```sh
LOG_LEVEL=debug npm-run gen-test --file=http://automotive-query-service:8080/v2/api-docs --outDir=/home/negrello/tmp/pet-shot-swagger
```

## Running tests

Running all tests in a test file or directory:

```sh
npm-run api-test --file=<file_or_directory>
```

Running a single scenario in a test file:

```sh
npm-run api-test --file=<file> --test='integration-tests/user-crud.yaml' --testcase='POST - Success'
```

Running with log level DEBUG:

```sh
LOG_LEVEL=debug npm-run api-test --file='Swagger\ Petstore/pet.yaml' --testcase='Add a new pet to the store'
```

The --testcase argument can be specified more than once in the same command.
You can add _'only': true_ to a test scenario to force the execution of this test only.

You can call the binary directly without using npm-run:

```sh
./node_modules/api-test-js/bin/api-test.js --file pet.yaml
```

You can use _npx_ to run the tests. In this case, no installation is necessary but the commands may take longer to start running.

```sh
npx api-test-js api-test --file=<file_or_directory>
```

I recommend using npn-run, which is faster for a local installation.


## Report

The test report is generated at /api-report/report.html.
Test parameters such as url, request options, response status and response text are added to each test scenario in the report.
