import {name, description, version} from '../../package.json';

const info = {
  name: process.env.SERVICE_NAME || name,
  description,
  version
};

export default info;
