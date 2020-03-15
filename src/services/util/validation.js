import chai from 'chai';
import logger from 'setup/logger';
import addContext from 'mochawesome/addContext';
import tv4 from 'tv4';

const expect = chai.expect;
const chaiVar = chai;

const verifyStatus = (r, assertMsgPrefix, status) => {
  if (r.response && r.response.statusCode) {
    assertStatus(assertMsgPrefix, status, r.response.statusCode);
  } else {
    if (r.error && r.error.status) {
      assertStatus(assertMsgPrefix, status, r.error.statusCode);
    } else {
      assertStatus(assertMsgPrefix, status, r.response && r.response.statusCode);
    }
  }
};

const verifySchema = (data, schema, assertMsgPrefix) => {
  const result = tv4.validateMultiple(data, schema, false, false);

  const composeErrorMessage = function () {
    var errorMsg = assertMsgPrefix + ': expected JSON to match schema ' +
      JSON.stringify(schema, null, 2) + '.';

    if (result.missing.length > 0) {
      errorMsg += '\n unresolved schemas: ' +
        JSON.stringify(result.missing) + '.';
    }

    if (Array.isArray(result.errors)) {
      result.errors.forEach(function (error) {
        errorMsg += `\n Error: ${error.message}.\n data path: ${error.dataPath}.\n schema path: ${error.schemaPath}.`;
      });
    }

    return errorMsg;
  };

  chai.assert(
    result.valid && result.missing.length === 0,
    composeErrorMessage()
  );
}

const assertStatus = (assertMsgPrefix, expectedStatus, actualStatus) => {
  if (typeof expectedStatus == 'number') {
    if (actualStatus != expectedStatus) {
      chai.assert.fail(0, 1,
        `${assertMsgPrefix}: expected status code ${actualStatus} to equal ${expectedStatus}`
      );
    }
  } else {
    if (expectedStatus.indexOf(actualStatus) == -1) {
      chai.assert.fail(0, 1,
        `${assertMsgPrefix}: expected status code ${actualStatus} to be one of ${JSON.stringify(expectedStatus)}`
      );
    }
  }
}

const verifyResult = async (mainScope, r, test, assertMsgPrefix, evalFunc,
  schemas, jp, handler) => {
  logger.debug(`${assertMsgPrefix} response: ${JSON.stringify(r)}`);

  if (logger.levelVal <= 20) {
    if (r.response) {
      console.log(
        `${assertMsgPrefix} status: ${r.response.statusCode}`
      );
    }
    console.log(`${assertMsgPrefix} body:`);
    console.log(r.body);
  }

  if (mainScope) {
    if (r.error && r.error.status) {
      addContext(mainScope, {
        title: 'Response Status Code',
        value: r.error.status
      });
    } else {
      addContext(mainScope, {
        title: 'Response Status Code',
        value: r.response && r.response.statusCode
      });
    }

    if (r.response && r.response.statusMessage) {
      addContext(mainScope, {
        title: 'Response Status Message',
        value: r.response.statusMessage
      })
    }

    if (r.error) {
      addContext(mainScope, {
        title: 'Response Error',
        value: r.error
      })
    }

    if (r.body) {
      addContext(mainScope, {
        title: 'Response Body',
        value: r.body
      })
    }
  }

  if (logger.levelVal <= 20) {
    console.log('Response Body');
    console.log(r.body);
  }

  if (test.status) {
    verifyStatus(r, assertMsgPrefix, test.status);
  }

  if (test.asserts) {
    if (test.asserts.status) {
      verifyStatus(r, assertMsgPrefix, test.asserts.status);
    }

    if (test.asserts.script) {
      evalFunc(test.asserts.script);
    }

    if (test.asserts.schema) {
      var schema;
      if (typeof test.asserts.schema ==
        'string') {
        schema = schemas[test.asserts.schema];
      } else {
        schema = test.asserts.schema;
      }
      expect(schema,
        `Schema ${test.asserts.schema}`)
        .to.exist;
      verifySchema(r.body, schema, assertMsgPrefix);
    }

    if (test.asserts.headers) {
      Object.entries(test.asserts.headers)
        .forEach(([key, value]) => {
          expect(r, assertMsgPrefix)
            .to.have.header(key,
              new RegExp(value));
        });
    }


    if (test.asserts['has-json']) {
      test.asserts['has-json']
        .forEach((v) => {
          Object.entries(v)
            .forEach(([key, value]) => {
              expect(r, assertMsgPrefix)
                .to.be.comprised.json(key,
                  value);
            });
        });
    }

    if (test.asserts['has-not-json']) {
      test.asserts['has-not-json']
        .forEach((v) => {
          Object.entries(v)
            .forEach(([key, value]) => {
              expect(r, assertMsgPrefix)
                .to.not.be.comprised.json(
                  key,
                  value);
            });
        });
    }

    if (test.asserts['verifypath']) {
      test.asserts['verifypath']
        .forEach((v) => {
          expect(v.path,
            'path property not defined! verify your configuration.'
          )
            .to.exist;

          let afterExpect;

          if (v.expect) {
            var evalExpr = "`" + v.expect.replace(
              /#\(([^\{]+?)\)/,
              '${jp.query(' +
              '$1' +
              ')}') +
              "`";
            logger.debug(
              'expect expresssion: ' +
              evalExpr);
            afterExpect = evalFunc(evalExpr);
            logger.debug('expect: ' +
              afterExpect);
          }

          var value,
            ran = false;
          try {
            value = jp.query(r.body, v.path);
            ran = true;
            logger.debug(`verifypath`, v.path,
              value);
          } catch (e) {
            logger.error(e);
            chai.expect(e, v.path)
              .not.to.exist;
          }

          if (ran) {
            var expectation = afterExpect ||
              '.to.have.lengthOf.at.least(1)';

            global.__expectation = expectation;
            global.__value = value;
            global.__path = v.path;
            global.chai = chaiVar;
            global.expect = chaiVar.expect;

            evalFunc(
              'chaiVar.expect(__value, "expect(\'"+ __path + "\')" + __expectation)' +
              expectation);
          }
        });
    }

    if (test.asserts.body) {
      const body = typeof r.body == 'object' ?
        JSON.stringify(
          r.body) : r.body;
      test.asserts['body']
        .forEach((v) => {
          expect(body, assertMsgPrefix)
            .to.match(new RegExp(v))
        });
    }

    if (test.asserts.responsetime) {
      if (r.responseTime > test.asserts.responsetime) {
        chai.assert.fail(0, 1,
          `expected response time of ${r.responseTime}ms to be less than or equal to ${test.asserts.responsetime}ms`
        );
      }
    }

    if (handler && handler.validate) {
      handler.validate(r, test);
    }

    if (handler && handler.after) {
      await handler.after(r, test);
    }

  }
}


export {
  verifyResult,
  verifySchema
}
