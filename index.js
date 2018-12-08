const AWS  = require('aws-sdk');
const IIIF = require('iiif');
const fs   = require('fs');

const tiffBucket  = process.env.tiff_bucket;

function s3Object(id) {
  var s3 = new AWS.S3();
  var path = id.match(/.{1,2}/g).join('/');
  return s3.getObject({ 
    Bucket: tiffBucket, 
    Key: `${path}-pyramid.tif`, 
  }).createReadStream();
}

function handler(event, context, callback) {
  var scheme = event.headers['X-Forwarded-Proto'] || 'http';
  var host = event.headers['Host'];
  var path = event.path.replace(/%2f/gi, '');
  if (process.env.include_stage) {
    path = '/' + event.requestContext.stage + path;
  }
  var uri = `${scheme}://${host}${path}`;
  console.log(`GET ${uri}`)
  var resource = new IIIF.Processor(uri, id => s3Object(id));
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
  var resource = new IIIF.Processor(url, id => s3Object(id));
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
