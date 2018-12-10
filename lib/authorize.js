const request = require('request');
const url     = require('url');

const apiTokenSecret = process.env.api_token_secret;
const elasticSearch  = process.env.elastic_search;

function getCurrentUser(auth_header) {
  var token = null;
  if (_.isString(auth_header) && auth_header.match(/^Bearer /)) {
    token = req.get('Authorization').replace(/^Bearer /, '');
  }
  if (token != null) {
    try {
      return jwt.verify(token, apiTokenSecret);
    } catch(err) {
      return null;
    }
  } else {
    return null;
  }
}

async function authorize(auth_header, id) {
  var authenticated = (getCurrentUser(auth_header) != null);
  var docUrl = url.resolve(elasticSearch, `common/_doc/${id}`);
  request(docUrl, (error, response, body) => { var doc = JSON.parse(body); console.log(error, response.statusCode, doc); });
  request(docUrl, (error, response, body) => { 
    if (error) {
      throw error;
    }

    var doc = JSON.parse(body); 
    if (!doc._source) {
      return false;
    }
    switch(doc._source.visibility) {
      case 'open':
        return true;
      case 'authenticated':
        if (!authenticated) {
          throw 'Unauthorized';
        }
        return authenticated;
      default:
        throw 'Unauthorized';
    }
  });
}

module.exports = authorize;