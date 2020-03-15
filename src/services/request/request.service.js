import request from 'request';

async function makeRequest(method, url, options) {
  options.headers = options.headers || {};

  var reqOptions = Object.assign(options, {
      url: url,
      method: method,
      json: true
    });

  var timer = process.hrtime();

  return new Promise((resolve, reject) => {
    request(reqOptions, function(err, res, body) {
      var elapsedTime = process.hrtime(timer);
      var elapsedMilliseconds = (elapsedTime[0] * 1000) + (elapsedTime[1] / 1000000);
      resolve({
        error: err,
        response: res,
        body: body,
        url: url,
        responseTime: elapsedMilliseconds
      });
    });
  });

  return chakram.request(method, url, options);
}

export {
  makeRequest
}
