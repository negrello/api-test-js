import 'babel-core/register';
import 'babel-polyfill';
import 'babel-polyfill';
import chai from 'chai';
import path from 'path'
import fs from 'fs';
import logger from 'setup/logger';
import yaml from 'js-yaml';
import jsonpath from 'jsonpath';
import addContext from 'mochawesome/addContext';
import {
  makeRequest
} from 'services/request/request.service';
import {
  walkSync,
  recursiveEval,
  replaceByEval
} from 'services/util/util';
import {
  verifyResult,
  verifySchema
} from 'services/util/validation';

global.__basedir = path.resolve(__dirname, '../../');

const jp = jsonpath;
const chaiVar = chai;
const argv = require('minimist')(process.argv.slice(2));
const expect = chai.expect;
const readJSONFile = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const readYamlFile = (f) => yaml.safeLoad(fs.readFileSync(f, 'utf8'));
const testSchema = readJSONFile(__dirname + '/test.config.schema.json');

const createSpec = (options) => {
  let fileContent;
  let specName;
  let config;
  let tests;
  let schemas;
  let handlers;
  let f = options.testfile || global.__testfile;
  let testcaseFilter = options.testcaseFilter || global.__testcase || [];
  let beforeAllBlocks;
  let beforeEachBlocks;
  let beforeEach;
  let beforeAll;
  let afterAllBlocks;
  let afterEachBlocks;
  let afterAll;
  let afterEach;
  let fileDir;

  if (!f) {
    throw Error('No option testfile specified.');
  }

  if (testcaseFilter && (!testcaseFilter.forEach)) {
    testcaseFilter = [testcaseFilter];
  }

  try {
    if (/.json$/.test(f)) {
      specName = path.basename(f, '.json');
      fileContent = readJSONFile(f);
    } else if (/.yaml$/.test(f)) {
      specName = path.basename(f, '.yaml');
      fileContent = readYamlFile(f);
    } else if (/.yml$/.test(f)) {
      specName = path.basename(f, '.yml');
      fileContent = readYamlFile(f);
    } else {
      logger.error(`Invalid file: ${f}`);
      return;
    }
  } catch (err) {
    logger.error(`Could not load/parse file ${f}: ${err}`);
  }

  fileDir = path.dirname(f);

  tests = fileContent.filter(block => typeof block.test !== 'undefined');
  schemas = fileContent.filter(block => typeof block.schema !== 'undefined')
    .reduce(function (map, obj) {
      map[obj.schema] = obj;
      return map;
    }, {});
  handlers = fileContent.filter(block => typeof block.handler !== 'undefined')
    .reduce(function (map, obj) {
      map[obj.handler] = obj;
      return map;
    }, {});
  config = fileContent.filter(block => typeof block.config !== 'undefined')
    .reduce(function (map, obj) {
      map = Object.assign(map, obj.config);
      return map;
    }, {});
  beforeAllBlocks = fileContent.filter(block => typeof block.beforeAll !== 'undefined')
    .reduce(function (list, obj) {
      list.push(obj);
      return list;
    }, []);
  beforeEachBlocks = fileContent.filter(block => typeof block.beforeEach !== 'undefined')
    .reduce(function (list, obj) {
      list.push(obj);
      return list;
    }, []);
  afterEachBlocks = fileContent.filter(block => typeof block.afterEach !== 'undefined')
    .reduce(function (list, obj) {
      list.push(obj);
      return list;
    }, []);
  afterAllBlocks = fileContent.filter(block => typeof block.afterAll !== 'undefined')
    .reduce(function (list, obj) {
      list.push(obj);
      return list;
    }, []);

  if (config) {
    Object.entries(config)
      .forEach(([key, value]) => {
        if (!global[key]) {
          global[key] = eval("`" + value + "`");
          if (global[key] == 'undefined') {
            logger.error(`Could not define global variable ${key}`);
          }
        }
      });
  }

  if (tests.some(test => test.skipall)) {
    return;
  }

  async function createAndRunBeforeAll(beforeAllBlocks) {

    async function runBeforeAll(beforeBlock, index) {
      logger.debug(`- beforeAllBlocks ${index}`);

      if (beforeBlock.url) {
        var evalExpr = "`" + beforeBlock.url.replace(
          /#\(([^\{]+)\)/, '${jp.query(' + '$1' +
        ')}') +
          "`";
        logger.debug(
          `beforeAllBlocks ${index} url expresssion: ${evalExpr}`
        );
        const beforeUrl = eval(evalExpr);
        logger.debug(
          `beforeAllBlocks url #${index}: ${beforeUrl}`);

        var beforeOptions = beforeBlock.options || {};

        recursiveEval(beforeOptions, s => eval(s));

        let beforeMethod = beforeBlock.method || 'GET';
        logger.debug(`${beforeMethod} ${beforeUrl}`);

        await makeRequest(beforeMethod,
          beforeUrl, beforeOptions)
          .then(async function (beforeResult) {

            await verifyResult(this, beforeResult,
              beforeBlock,
              `(beforeAllBlocks #${index}) ${beforeMethod} ${beforeUrl}`,
              (s) =>
                eval(s), schemas, jp, null);

            logger.debug(
              `- beforeAllBlocks ${index} verification`);
            beforeAll[beforeBlock.beforeAll] = beforeResult
          })
          .catch(err => {
            throw err
          });
      }

      if (beforeBlock.script) {
        let evalResult = eval(beforeBlock.script);

        if (evalResult) {
          beforeAll[beforeBlock.beforeAll] = evalResult;
        }
      }
    }

    await beforeAllBlocks.reduce((promise, beforeBlock,
      index) =>
      promise.then(async () => await runBeforeAll(
        beforeBlock,
        index)), Promise.resolve());

    logger.debug("Done beforeAll");
  }

  async function createAndRunAfterAll(afterAllBlocks) {

    async function runAfterAll(afterBlock, index) {
      logger.debug(`- afterAllBlocks ${index}`);

      if (afterBlock.url) {
        var evalExpr = "`" + afterBlock.url.replace(
          /#\(([^\{]+)\)/, '${jp.query(' + '$1' +
        ')}') +
          "`";
        logger.debug(
          `afterAllBlocks ${index} url expresssion: ${evalExpr}`
        );
        const afterUrl = eval(evalExpr);
        logger.debug(
          `afterAllBlocks url #${index}: ${afterUrl}`);

        var afterOptions = afterBlock.options || {};

        recursiveEval(afterOptions, s => eval(s));

        let afterMethod = afterBlock.method || 'GET';
        logger.debug(`${afterMethod} ${afterUrl}`);

        await makeRequest(afterMethod,
          afterUrl, afterOptions)
          .then(async function (afterResult) {

            await verifyResult(this, afterResult,
              afterBlock,
              `(afterAllBlocks #${index}) ${afterMethod} ${afterUrl}`,
              (s) =>
                eval(s), schemas, jp, null);

            logger.debug(
              `- afterAllBlocks ${index} verification`);
            afterAll[afterBlock.afterAll] = afterResult
          })
          .catch(err => {
            throw err
          });
      }

      if (afterBlock.script) {
        let evalResult = eval(afterBlock.script);

        if (evalResult) {
          afterAll[afterBlock.afterAll] = evalResult;
        }
      }
    }

    await afterAllBlocks.reduce((promise, afterBlock,
      index) =>
      promise.then(async () => await runAfterAll(
        afterBlock,
        index)), Promise.resolve());

    logger.debug("Done afterAll");
  }

  describe(specName, function () {
    var testNames = [],
      dependencies = {},
      results = {},
      onlyall = false;

    beforeAll = {};
    beforeEach = {};

    before("Before", async function () {
      this.timeout(60000);
      await createAndRunBeforeAll(beforeAllBlocks);
    });

    tests.forEach(test => {
      if (test.data && test.data.dependson) {
        if (dependencies[test.data.dependson]) {
          dependencies[test.data.dependson].push(test.test);
        } else {
          dependencies[test.data.dependson] = [test.test];
        }
      }
    });

    tests.forEach(test => {
      onlyall = onlyall || test.onlyall;
      var func = test.only || onlyall ? it.only || onlyall : it;

      if (testcaseFilter && testcaseFilter.length > 0) {
        if (!testcaseFilter.some(filter => test.test.indexOf(
          filter) !== -1)) {
          logger.debug(
            `(filter) skipping spec testcase ${test.test}`
          );
          return;
        }
      }

      func(test.test, async function () {
        var $dependson;
        let before = {};

        verifySchema(test, testSchema, `Invalid test configuration at ${f}`, {}, true);

        if (test.data && test.data.dependson) {
          $dependson = results[test.data.dependson];
          if (!$dependson) {
            expect($dependson,
              `Could not retrieve result from test ${test.data.dependson}`
            )
              .to.exist;
          }
        }

        var url;
        var options = test.data.options || {},
          mainScope = this;

        if (testNames.indexOf(test.test) !== -1) {
          for (let i = 2; i < 100; i++) {
            let testnameI = `${test.test} (${i})`;
            if (testNames.indexOf(testnameI) === -1) {
              test.test = testnameI;
              break;
            }
          }
        }

        expect(testNames.indexOf(test.test) == -1,
          `Duplicate test description at ${f}: ${test.test}`
        )
          .to.be.true;

        testNames.push(test.test);

        var handler;
        if (test.handler) {
          handler = handlers[test.handler];
          expect(handler, `Handler ${test.handler}`)
            .to.exist;
        }

        var req = async () => {
          if (handler && handler.before) {
            await handler.before(test);
          }

          recursiveEval(options, s => eval(s));

          addContext(this, {
            title: 'Request options',
            value: options
          });

          var evalExpr = replaceByEval(test.data.url);
          logger.debug('url expresssion: ' + evalExpr);
          url = eval(evalExpr.replace(/\$\{([^\}]*)\}/g,
            function (s) {
              try {
                var result = eval("`" + s + "`");
                logger.debug(`${s} => ${result}`);
                if (!result) {
                  logger.warn(
                    `Could not evaluate expression in url: ${s}`
                  );
                }
                return result;
              } catch (err) {
                throw new Error(
                  `Could not evaluate expression: ${s}`)
              }
            }));

          let method = test.data.method || 'GET';
          logger.debug(`${method} ${url}`);

          addContext(mainScope, {
            title: 'Url',
            value: url
          });

          let reqResult = null;

          logger.debug(
            `- request options: `, options);

          await makeRequest(method, url, options)
            .then(async function (r) {
              if (dependencies[test.test]) {
                // store result to be used in other scenarios.
                results[test.test] = r.body;
              }

              await verifyResult(mainScope, r, test,
                `(main request) ${method} ${url}`, (s) =>
                eval(s), schemas, jp, handler);
            })
            .catch((err) => {
              reqResult = err;
            });

          if (test.after || afterEachBlocks.length > 0) {

            async function runAfter(afterBlock, index, prefix, type, typeMap) {
              logger.debug(`- ${prefix} ${index}`);

              if (afterBlock.url) {
                var evalExpr = "`" + afterBlock.url.replace(
                  /#\(([^\{]+)\)/, '${jp.query(' + '$1' +
                ')}') +
                  "`";
                logger.debug(
                  `${prefix} ${index} url expresssion: ${evalExpr}`
                );
                const afterUrl = eval(evalExpr);
                logger.debug(
                  `${prefix} url #${index}: ${afterUrl}`);

                var afterOptions = afterBlock.options || {};

                recursiveEval(afterOptions, s => eval(s));

                let afterMethod = afterBlock.method || 'GET';
                logger.debug(`${afterMethod} ${afterUrl}`);

                await makeRequest(afterMethod,
                  afterUrl, afterOptions)
                  .then(async function (afterResult) {

                    await verifyResult(mainScope, afterResult,
                      afterBlock,
                      `(${type} - ${prefix}) ${afterMethod} ${afterUrl}`,
                      (s) =>
                        eval(s), schemas, jp, null);

                    logger.debug(
                      `- ${prefix} verification`);

                    typeMap[prefix] = afterResult;
                    logger.debug(`${type}['${prefix}'] = afterResult`);
                  })
                  .catch(err => {
                    throw err
                  });
              }

              if (afterBlock.script) {
                let evalResult = eval(afterBlock.script);

                if (evalResult) {
                  typeMap[prefix] = evalResult;
                  logger.debug(`${type}['${prefix}'] = evalResult`);
                }
              }
            }

            let afterBlocksResult = [];

            await afterEachBlocks.reduce((promise, afterBlock,
              index) =>
              promise.then(async () => await runAfter(
                afterBlock,
                index, afterBlock.afterEach, 'afterEach', afterEach)
                .catch(err => {
                  afterBlocksResult.push(err);
                })), Promise.resolve());

            if (afterBlocksResult.length > 1) {
              afterBlocksResult.forEach(e => logger.error(e.message));
            }

            afterBlocksResult = [];
            let afterBlocks = [];

            if (test.after) {
              if (test.after.forEach) {
                afterBlocks = test.after;
              } else {
                afterBlocks = [test.after];
              }
            }

            await afterBlocks.reduce((promise, afterBlock,
              index) =>
              promise.then(async () => await runAfter(
                afterBlock,
                index, afterBlock.after, 'after', after)
                .catch(err => {
                  afterBlocksResult.push(err);
                })), Promise.resolve());

            if (afterBlocksResult.length > 1) {
              afterBlocksResult.forEach(e => logger.error(e.message));
            }

            if (reqResult) {
              if (afterBlocksResult.length !== 0) {
                return Promise.reject(afterBlocksResult[0]);
              }
              return Promise.reject(reqResult);
            } else if (afterBlocksResult.length !== 0) {
              return Promise.reject(afterBlocksResult[0]);
            }

          } else if (reqResult) {
            return Promise.reject(reqResult);
          }
        }

        if (test.before || beforeEachBlocks) {

          async function runBefore(beforeBlock, index, prefix, type, typeMap) {
            logger.debug(`- ${prefix} ${index}`);

            if (beforeBlock.url) {
              var evalExpr = "`" + beforeBlock.url.replace(
                /#\(([^\{]+)\)/, '${jp.query(' + '$1' +
              ')}') +
                "`";
              logger.debug(
                `${prefix} ${index} url expresssion: ${evalExpr}`
              );
              const beforeUrl = eval(evalExpr);
              logger.debug(
                `${prefix} url #${index}: ${beforeUrl}`);

              var beforeOptions = beforeBlock.options || {};

              recursiveEval(beforeOptions, s => eval(s));

              let beforeMethod = beforeBlock.method || 'GET';
              logger.debug(`${beforeMethod} ${beforeUrl}`);

              await makeRequest(beforeMethod,
                beforeUrl, beforeOptions)
                .then(async function (beforeResult) {

                  await verifyResult(mainScope, beforeResult,
                    beforeBlock,
                    `(${type} - ${prefix}) ${beforeMethod} ${beforeUrl}`,
                    (s) =>
                      eval(s), schemas, jp, null);

                  logger.debug(
                    `- ${prefix} verification`);

                  typeMap[prefix] = beforeResult;
                  logger.debug(`${type}['${prefix}'] = beforeResult`);
                })
                .catch(err => {
                  throw err
                });
            }

            if (beforeBlock.script) {
              let evalResult = eval(beforeBlock.script);

              if (evalResult) {
                typeMap[prefix] = evalResult;
                logger.debug(`${type}['${prefix}'] = evalResult`);
              }
            }
          }

          let beforeBlocks = [];

          if (beforeEachBlocks) {
            beforeBlocks.push(...beforeEachBlocks);
          }

          await beforeBlocks.reduce((promise, beforeBlock,
            index) =>
            promise.then(async () => await runBefore(
              beforeBlock,
              index, beforeBlock.beforeEach, 'beforeEach', beforeEach)), Promise.resolve());

          beforeBlocks = [];

          if (test.before) {
            if (test.before.forEach) {
              beforeBlocks.push(...test.before);
            } else {
              beforeBlocks.push(test.before);
            }
          }

          await beforeBlocks.reduce((promise, beforeBlock,
            index) =>
            promise.then(async () => await runBefore(
              beforeBlock,
              index, beforeBlock.id || beforeBlock.before, 'before', before)), Promise.resolve());

          await req()
            .catch(err => {
              throw err
            });
        } else {
          await req()
            .catch(err => {
              throw err
            });
        }
      })
        .timeout(test.asserts && test.asserts.responsetime ||
          120000);
    });

    after("After", async function () {
      this.timeout(60000);
      await createAndRunAfterAll(afterAllBlocks);
    });
  });
}

module.exports = createSpec;

if (global.__testfile) {
  createSpec({
    testfile: global.__testfile,
    testcase: global.__testcase
  });
} else {
  const basedir = path.resolve(__dirname, '../../');

  if (argv.ddt) {
    if (!fs.existsSync(argv.ddt)) {
      logger.error(`File or directory does not exist: ${argv.ddt}`);
      process.exit(1);
    }

    const ddt = path.resolve(basedir, argv.ddt);

    if (fs.lstatSync(argv.ddt).isDirectory()) {
      walkSync(ddt, (file => {
        createSpec({
          testfile: file,
          testcaseFilter: argv.testcase
        });
      }));
    } else {
      const ddtFile = path.resolve(basedir, argv.ddt);
      createSpec({
        testfile: ddtFile,
        testcaseFilter: argv.testcase
      });
    }
  } else {
    logger.error('Parameter ddt is required.');
    process.exit(1);
  }
}
