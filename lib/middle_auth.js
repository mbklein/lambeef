const isString = require('lodash.isstring');
const cookie   = require('cookie');

const MiddleAuth = {
  before: (handler, next) => {
    if (!isString(handler.event.headers['Authorization'])) {
      var cookies = cookie(handler.event.headers['Cookie']);
      if (isString(cookies.IIIFAuthToken)) {
        handler.event.headers['Authorization'] = `Bearer ${cookies.IIIFAuthToken}`
      }
    }
    next();
  },

  after: (handler, next) => {
    var cookies = cookie(handler.event.headers['Cookie']);
    if (isString(handler.event.headers['Authorization']) && !isString(cookies.IIIFAuthToken)) {
      var token = handler.event.headers['Authorization'].replace(/^Bearer /, '');
      handler.response.headers['Set-Cookie'] = cookie.serialize('IIIFAuthToken', token);
    }
    next();
  },

  onError: (handler, next) => {
    next();
  }
}

module.exports = MiddleAuth;
