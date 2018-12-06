const iiif = require('./lib/iiif');
const fs = require('fs');

function handler(event, context, callback) {
  var scheme = event.headers['X-Forwarded-Proto'] || 'http';
  var host = event.headers['Host'];
  var path = event.path;
  var uri = `${scheme}://${host}${path}`;
  console.log(`GET ${uri}`)
  var resource = new iiif(uri);
  resource.execute()
    .then(result => {
      callback(null, {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': result.contentType
        },
        body: result.body
      });
    })
    .catch(err => callback(err, null));
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

module.exports = test;
