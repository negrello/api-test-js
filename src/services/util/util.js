import fs from 'fs';
import path from 'path';
import logger from 'setup/logger';
import chai from 'chai'

const expect = chai.expect;

const walkSync = (d, fn) => {
  if (fs.existsSync(d)) {
    fs.statSync(d)
      .isDirectory() ? fs.readdirSync(d)
        .map(f => walkSync(path.join(d, f), fn)) : fn(d);
  } else {
    logger.debug(`Directory not found: ${d}`);
  }
};

const recursiveEval = (map, evalFunc) => {
  if (map) {
    Object.keys(map)
      .forEach(k => {
        if (typeof map[k] == 'string') {
          var expr = replaceByEval(map[k]);
          logger.debug(
            `eval ${k}: ${map[k]} -> ${expr}`
          );
          try {
            var exprResult = evalFunc(expr.replace(
              /\$\{([^\}]*)\}/g,
              function (s) {
                var result = evalFunc("`" + s +
                  "`");
                logger.debug(
                  `${s} => ${result}`);
                if (!result) {
                  logger.warn(
                    `Could not evaluate expression: ${s}`
                  );
                }
                return result;
              }));
            logger.debug(
              `${k}: ${map[k]} -> '${expr}' evals to '${exprResult}'`
            );
            expect(exprResult,
              `Could not evaluate expression: ${map[k]}`
            )
              .to.exist;

            map[k] = exprResult;
          } catch (e) {
            logger.error(`An error ocurred when evaluating expression: ${expr}`);
            throw e;
          }
        } else if (map[k] && typeof map[k] ==
          'object') {
          recursiveEval(map[k], evalFunc);
        }
      });
  }
};

const replaceByEval = (s) => {
  return "`" + s.replace(
    /#\(([^\{]+)\)/, '${jp.query(' + '$1' + ')}') +
    "`";
};

export {
  walkSync,
  recursiveEval,
  replaceByEval
}
