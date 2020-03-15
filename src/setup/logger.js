import pino from 'pino';
import pkginfo from 'setup/pkginfo';

const level = process.env.LOG_LEVEL || 'info';

export default pino({
  level,
  base: null,
  prettyPrint: {
    colorize: true,
    translateTime: true
  }
});
