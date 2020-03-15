import 'babel-polyfill';
import {
  expect
} from 'chai';
import nock from 'nock';
import path from 'path';
import Mocha from 'mocha';

describe('Test framework', () => {

  describe('petshop', () => {
    const USER_PROFILE_ID = '12345';
    const PETSHOP_URI = 'http://localhost/petshop';
    const SECURITY_SERVICE_URL = 'http://localhost'

    beforeEach(() => {
      nock.cleanAll();
      nock.disableNetConnect();

      nock(SECURITY_SERVICE_URL, {
          "encodedQueryParams": true
        })
        .get('/startSession')
        .query({
          "userProfileId": "12345"
        })
        .reply(200,
          "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606", {
            'Content-Type': 'text/plain'
          }
        );

      nock(SECURITY_SERVICE_URL, {
          "encodedQueryParams": true
        })
        .get(
          '/createJWTToken')
        .query({
          "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
        })
        .reply(200, 'request_token_123', {
          'Content-Type': 'text/plain'
        });

      nock(SECURITY_SERVICE_URL, {
          "encodedQueryParams": true
        })
        .get('/contextmanager/rs/ContextService/endSession')
        .query({
          userProfileId: USER_PROFILE_ID
        })
        .reply(204, '', {
          'Content-Type': 'text/plain'
        });
    })

    it('get a pet - success', async () => {
      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        });

      await runTestcase('get a pet');
    });

    it('get a pet - wrong status', async () => {
      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(201, pet1017, {
          'Content-Type': 'application/json'
        });

      await runTestcase('get a pet',
        'GET http://localhost/petshop/pet/1017: expected status code 201 to equal 200'
      );
    });

    it('get a pet - invalid json response', async () => {
      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, "{'a':'b'}", {
          'Content-Type': 'application/json'
        });

      await runTestcase('get a pet',
        'GET http://localhost/petshop/pet/1017: expected JSON to match schema'
      );
    });

    it('get a pet - invalid body path', async () => {
      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, pet1018, {
          'Content-Type': 'application/json'
        });

      await runTestcase('get a pet',
        "expect('$.id').to.deep.equal([1017]): expected [ 1019 ] to deeply equal [ 1017 ]"
      );
    });

    it('compare a pet with file - success', async () => {
      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        });

      await runTestcase('compare a pet with file');
    });

    it('create a pet - wrong status', async () => {
      nock(PETSHOP_URI)
        .post('/pet/1017')
        .reply(503, pet1017, {
          'Content-Type': 'application/json'
        });

      await runTestcase('create a pet',
        'POST http://localhost/petshop/pet/1017: expected status code 503 to be one of [200,409]'
      );
    });

    it('find a pet by default status - success', async () => {
      nock(PETSHOP_URI)
        .get('/pet/findByStatus?status=sold')
        .reply(200, pet1018, {
          'Content-Type': 'application/json'
        });

      await runTestcase('find a pet by default status');
    });

    it('create and update a pet', async () => {
      nock(SECURITY_SERVICE_URL, {
          "encodedQueryParams": true
        })
        .get(
          '/createJWTToken')
        .query({
          "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
        })
        .times(4)
        .reply(200, '', {
          'Content-Type': 'text/plain'
        });

      nock(PETSHOP_URI)
        .post('/pet')
        .reply(201, 'OK', {
          'Content-Type': 'text/plain',
          'Location': PETSHOP_URI +
            '/pet/1017'
        });

      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        });

      nock(PETSHOP_URI)
        .put('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        });

      nock(PETSHOP_URI)
        .delete('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'text/plain'
        });

      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(404, '', {
          'Content-Type': 'application/json'
        });

      await runTestcase('create and update a pet');
    });

    it('create and update a pet - failure in first before', async () => {
      let mocks = [];

      nock(SECURITY_SERVICE_URL, {
          "encodedQueryParams": true
        })
        .get(
          '/createJWTToken')
        .query({
          "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
        })
        .times(4)
        .reply(200, '', {
          'Content-Type': 'text/plain'
        });

      nock(PETSHOP_URI)
        .post('/pet')
        .reply(503, 'ERROR', {
          'Content-Type': 'text/plain'
        });

      mocks.push(nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        })
      );

      mocks.push(nock(PETSHOP_URI)
        .put('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        })
      );

      mocks.push(nock(PETSHOP_URI)
        .delete('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'text/plain'
        }));

      mocks.push(nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(404, '', {
          'Content-Type': 'application/json'
        }));

      await runTestcase('create and update a pet',
        'POST http://localhost/petshop/pet: expected status code 503 to equal 201'
      );

      let nonPendingMock = mocks.filter(m => m.pendingMocks()
          .length == 0)
        .map((m, index) => `request mock ${index}`);

      expect(nonPendingMock,
          'At least one request was performed after the "before" step failed'
        )
        .to.be.empty;
    });

    it(
      'create and update a pet - failure in first before during validation',
      async () => {
        let mocks = [];

        nock(SECURITY_SERVICE_URL, {
            "encodedQueryParams": true
          })
          .get(
            '/createJWTToken')
          .query({
            "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
          })
          .times(4)
          .reply(200, '', {
            'Content-Type': 'text/plain'
          });

        nock(PETSHOP_URI)
          .post('/pet')
          .reply(200, 'OK', {
            'Content-Type': 'text/plain',
            'Location': PETSHOP_URI +
              '/pet/1017'
          });

        mocks.push(nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'application/json'
          })
        );

        mocks.push(nock(PETSHOP_URI)
          .put('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'application/json'
          })
        );

        mocks.push(nock(PETSHOP_URI)
          .delete('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'text/plain'
          }));

        mocks.push(nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(404, '', {
            'Content-Type': 'application/json'
          }));

        await runTestcase('create and update a pet',
          '(before - Create a Pet) POST http://localhost/petshop/pet: expected status code 200 to equal 201'
        );

        let nonPendingMock = mocks.filter(m => m.pendingMocks()
            .length == 0)
          .map((m, index) => `request mock ${index}`);

        expect(nonPendingMock,
            'At least one request was performed after the "before" step failed'
          )
          .to.be.empty;
      });

    it(
      'create and update a pet - failure in second before during validation',
      async () => {
        let mocks = [];

        nock(SECURITY_SERVICE_URL, {
            "encodedQueryParams": true
          })
          .get(
            '/createJWTToken')
          .query({
            "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
          })
          .times(4)
          .reply(200, '', {
            'Content-Type': 'text/plain'
          });

        nock(PETSHOP_URI)
          .post('/pet')
          .reply(201, 'OK', {
            'Content-Type': 'text/plain',
            'Location': PETSHOP_URI +
              '/pet/1017'
          });

        nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(200, "{'a':'b'}", {
            'Content-Type': 'application/json'
          });

        mocks.push(nock(PETSHOP_URI)
          .put('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'application/json'
          })
        );

        mocks.push(nock(PETSHOP_URI)
          .delete('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'text/plain'
          }));

        mocks.push(nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(404, '', {
            'Content-Type': 'application/json'
          }));

        await runTestcase('create and update a pet',
          'GET http://localhost/petshop/pet/1017: expected JSON to match schema '
        );

        let nonPendingMock = mocks.filter(m => m.pendingMocks()
            .length == 0)
          .map((m, index) => `request mock ${index}`);

        expect(nonPendingMock,
            'At least one request was performed after the "before" step failed'
          )
          .to.be.empty;
      });

    it(
      'create and update a pet - failure in second before during validation (verifypath)',
      async () => {
        let mocks = [];

        nock(SECURITY_SERVICE_URL, {
            "encodedQueryParams": true
          })
          .get(
            '/createJWTToken')
          .query({
            "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
          })
          .times(4)
          .reply(200, '', {
            'Content-Type': 'text/plain'
          });

        nock(PETSHOP_URI)
          .post('/pet')
          .reply(201, 'OK', {
            'Content-Type': 'text/plain',
            'Location': PETSHOP_URI +
              '/pet/1017'
          });

        nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(200, pet1018, {
            'Content-Type': 'application/json'
          });

        mocks.push(nock(PETSHOP_URI)
          .put('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'application/json'
          })
        );

        mocks.push(nock(PETSHOP_URI)
          .delete('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'text/plain'
          }));

        mocks.push(nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(404, '', {
            'Content-Type': 'application/json'
          }));

        await runTestcase('create and update a pet',
          "expect('$.tags[?(@.name == 'golden')]').to.have.lengthOf.at.least(1): expected [] to have a length at least 1 but got 0"
        );

        let nonPendingMock = mocks.filter(m => m.pendingMocks()
            .length == 0)
          .map((m, index) => `request mock ${index}`);

        expect(nonPendingMock,
            'At least one request was performed after the "before" step failed'
          )
          .to.be.empty;
      });

    it(
      'create and update a pet - failure during handler validation',
      async () => {
        let mocks = [];

        nock(SECURITY_SERVICE_URL, {
            "encodedQueryParams": true
          })
          .get(
            '/createJWTToken')
          .query({
            "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
          })
          .times(4)
          .reply(200, '', {
            'Content-Type': 'text/plain'
          });

        nock(PETSHOP_URI)
          .post('/pet')
          .reply(201, 'OK', {
            'Content-Type': 'text/plain',
            'Location': PETSHOP_URI +
              '/pet/1017'
          });

        nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'application/json'
          });

        nock(PETSHOP_URI)
          .put('/pet/1017')
          .reply(200, pet1017_b, {
            'Content-Type': 'application/json'
          });

        mocks.push(nock(PETSHOP_URI)
          .delete('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'text/plain'
          }));

        mocks.push(nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(404, '', {
            'Content-Type': 'application/json'
          }));

        await runTestcase('create and update a pet',
          "Wrong photo urls: expected [ 'url5', 'url6' ] to deeply equal [ 'url1', 'url2' ]"
        );

        let nonPendingMock = mocks.filter(m => m.pendingMocks()
            .length == 0)
          .map((m, index) => `request mock ${index}`);

        expect(nonPendingMock, 'After blocks were not run')
          .to.be.lengthOf(2);
      });

    it('create and update a pet - failure in first after', async () => {
      nock(SECURITY_SERVICE_URL, {
          "encodedQueryParams": true
        })
        .get(
          '/createJWTToken')
        .query({
          "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
        })
        .times(4)
        .reply(200, '', {
          'Content-Type': 'text/plain'
        });

      nock(PETSHOP_URI)
        .post('/pet')
        .reply(201, 'OK', {
          'Content-Type': 'text/plain',
          'Location': PETSHOP_URI +
            '/pet/1017'
        });

      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        });

      nock(PETSHOP_URI)
        .put('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        });

      nock(PETSHOP_URI)
        .delete('/pet/1017')
        .reply(503, pet1017, {
          'Content-Type': 'text/plain'
        });

      let after1Mock = nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(404, '', {
          'Content-Type': 'application/json'
        });

      await runTestcase('create and update a pet',
        'DELETE http://localhost/petshop/pet/1017: expected status code 503 to equal 200'
      );

      // Make sure all after blocks are run.
      expect(after1Mock.pendingMocks(),
          'After block #1 pending request')
        .to.be.empty;
    });

    it('create and update a pet - failure in first and second after',
      async () => {
        nock(SECURITY_SERVICE_URL, {
            "encodedQueryParams": true
          })
          .get(
            '/createJWTToken')
          .query({
            "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
          })
          .times(4)
          .reply(200, '', {
            'Content-Type': 'text/plain'
          });

        nock(PETSHOP_URI)
          .post('/pet')
          .reply(201, 'OK', {
            'Content-Type': 'text/plain',
            'Location': PETSHOP_URI +
              '/pet/1017'
          });

        nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'application/json'
          });

        nock(PETSHOP_URI)
          .put('/pet/1017')
          .reply(200, pet1017, {
            'Content-Type': 'application/json'
          });

        nock(PETSHOP_URI)
          .delete('/pet/1017')
          .reply(503, 'Service Unavailable', {
            'Content-Type': 'text/plain'
          });

        let after1Mock = nock(PETSHOP_URI)
          .get('/pet/1017')
          .reply(503, 'Service Unavailable', {
            'Content-Type': 'application/json'
          });

        await runTestcase('create and update a pet',
          'DELETE http://localhost/petshop/pet/1017: expected status code 503 to equal 200'
        );

        // Make sure all after blocks are run.
        expect(after1Mock.pendingMocks(),
            'After block #1 pending request')
          .to.be.empty;
      });

    it('create and update a pet - failure in main request', async () => {
      nock(SECURITY_SERVICE_URL, {
          "encodedQueryParams": true
        })
        .get(
          '/createJWTToken')
        .query({
          "sessionId": "fe5644a2301e308a6bc351f5c2e6a80a.51653.521.1532955266606"
        })
        .times(4)
        .reply(200, '', {
          'Content-Type': 'text/plain'
        });

      nock(PETSHOP_URI)
        .post('/pet')
        .reply(201, 'OK', {
          'Content-Type': 'text/plain',
          'Location': PETSHOP_URI +
            '/pet/1017'
        });

      nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'application/json'
        });

      nock(PETSHOP_URI)
        .put('/pet/1017')
        .reply(503, 'Service Unavailable', {
          'Content-Type': 'application/json'
        });

      let after0Mock = nock(PETSHOP_URI)
        .delete('/pet/1017')
        .reply(200, pet1017, {
          'Content-Type': 'text/plain'
        });

      let after1Mock = nock(PETSHOP_URI)
        .get('/pet/1017')
        .reply(404, '', {
          'Content-Type': 'application/json'
        });

      await runTestcase('create and update a pet',
        'PUT http://localhost/petshop/pet/1017: expected status code 503 to equal 200'
      );

      // Make sure all after blocks are run.
      expect(after0Mock.pendingMocks(),
          'After block #0 pending request')
        .to.be.empty;

      expect(after1Mock.pendingMocks(),
          'After block #1 pending request')
        .to.be.empty;
    });

  });
});

const runTestcase = (testcase, expectedError) => {
  return new Promise((resolve, reject) => {
    runMocha(testcase)
      .then(() => {
        if (expectedError) {
          reject(
            new ApiTestError(
              `Testcase "${testcase}" passed but should have failed with error: "${expectedError}"`
            )
          )
        } else {
          resolve();
        }
      })
      .catch((errors) => {
        let err = errors[0] || errors;

        if (expectedError) {
          if (err.message.indexOf(expectedError) !== -1) {
            resolve();
          } else {
            console.error(err);
            reject(
              new ApiTestError(
                `Testcase "${testcase}" failed with error "${err}" but should have failed with error ${expectedError}`,
                err.stack
              )
            )
          }
        } else {
          console.error(err);
          reject(
            new ApiTestError(
              `Testcase "${testcase}" failed with error "${err}" but should have passed`
            )
          )
        }
      });
  });
};

function clearRequireCache() {
  Object.keys(require.cache)
    .some(function(key) {
      if (key.indexOf('scanner.js') !== -1) {
        delete require.cache[key];
        return true;
      }
    });
}

class ApiTestError extends Error {
  constructor(message, stack) {
    super()
    this.name = 'ApiTestError'
    this.message = message;
    this.stack = stack;
  }
}

const runMocha = (testcase) => {
  return new Promise((resolve, reject) => {
    clearRequireCache();
    let errors = [];

    const mocha = new Mocha({
      timeout: 30000,
      fullTrace: true,
      reporter: function(runner) {
      }
    });

    const file = path.resolve(__dirname,
      'scanner.js');

    global.__testfile = 'petshop/petshop.yaml';
    global.__testcase = testcase;

    mocha.addFile(file);
    let runner = mocha.run();

    runner.on('fail', (t, e) => reject(e));
    runner.on('pass', t => resolve());
    runner.on('end', function() {
      
    });

  });
};

const pet1017 = {
  "id": 1017,
  "category": {
    "id": 1016,
    "name": "string"
  },
  "name": "Max",
  "photoUrls": [
    "url1",
    "url2"
  ],
  "tags": [{
    "id": 0,
    "name": "golden"
  }],
  "status": "available"
}

const pet1018 = {
  "id": 1019,
  "category": {
    "id": 1018,
    "name": "string"
  },
  "name": "Julie",
  "photoUrls": [
    "url3",
    "url4"
  ],
  "tags": [{
    "id": 0,
    "name": "border"
  }],
  "status": "sold"
}

const pet1017_b = {
  "id": 1017,
  "category": {
    "id": 1016,
    "name": "string"
  },
  "name": "Max",
  "photoUrls": [
    "url5",
    "url6"
  ],
  "tags": [{
    "id": 0,
    "name": "golden"
  }],
  "status": "available"
}
