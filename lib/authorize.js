const isObject = require('lodash.isobject');
const isString = require('lodash.isstring');
const fetch    = require('node-fetch');
const jwt      = require('jsonwebtoken');
const url      = require('url');

const apiTokenSecret = process.env.api_token_secret;
const elasticSearch  = process.env.elastic_search;

function getCurrentUser(token) {
  if (isString(token)) {
    try {
      return jwt.verify(token, apiTokenSecret);
    } catch(err) {
      return null;
    }
  } else {
    return null;
  }
}

async function authorize(token, id) {
  var currentUser = getCurrentUser(token);
  var docUrl = url.resolve(elasticSearch, `common/_doc/${id}`);
  var response = await fetch(docUrl);
  var doc = await response.json();

  if (process.env.allow_everything) {
    return true;
  }
  
  if (isObject(doc._source) && isString(doc._source.visibility)) {
    switch(doc._source.visibility) {
      case 'open':          return true;
      case 'authenticated': return isObject(currentUser);
      case 'restricted':    return false;
    }
  }
  return false;
}

module.exports = authorize;