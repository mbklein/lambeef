const iiif = require('./lib/iiif');
const fs   = require('fs');

function handler(event, context, callback) {
  var scheme = event.headers['X-Forwarded-Proto'] || 'http';
  var host = event.headers['Host'];
  var path = event.path;
  var uri = `${scheme}://${host}${path}`;
  console.log(`GET ${uri}`)
  var resource = new iiif(uri);
  resource.execute()
    .then(result => {
      var response = {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': result.contentType
        },
        isBase64Encoded: /^image\//.test(result.contentType)
      };
      if (response.isBase64Encoded) {
        response.body = result.body.toString('base64');
      } else {
        response.body = result.body;
      }
      callback(null, response);
    })
    .catch(err => {
      if (err.statusCode) {
        callback(null, {
          statusCode: err.statusCode,
          body: err.message
        })
      }
      if (err instanceof resource.errorClass) {
        callback(null, {
          statusCode: 400,
          body: err.toString()
        });
      }
      callback(err, null)
    });
}

function test(url, outFile) {
  var resource = new iiif(url);
  return resource.execute()
    .then(result => {
      if (outFile == null) {
        outFile = url.split('/').pop();
      }
      var stream = fs.createWriteStream(outFile);
      stream.write(result.body);
      stream.end();
    })
    .catch(err => { throw err });
}

module.exports = {
  test,
  handler
};
