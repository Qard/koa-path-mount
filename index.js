
/**
 * Module dependencies.
 */

var debug = require('debug')('koa-mount');
var compose = require('koa-compose');
var assert = require('assert');

var pathToRegexp = require('path-to-regexp');
var route = require('path-match')({ end: false });

/**
 * Expose `mount()`.
 */

module.exports = mount;

/**
 * Mount `app` with `prefix`, `app`
 * may be a Koa application or
 * middleware function.
 *
 * @param {String|Application|Function} prefix, app, or function
 * @param {Application|Function} [app or function]
 * @return {Function}
 * @api public
 */

function mount(prefix, app) {
  if ('string' != typeof prefix) {
    app = prefix;
    prefix = '/';
  }

  assert('/' == prefix[0], 'mount path must begin with "/"');

  // compose
  var downstream = app.middleware
    ? compose(app.middleware)
    : app;

  // don't need to do mounting here
  if ('/' == prefix) return downstream;

  var trailingSlash = '/' == prefix.slice(-1);

  var name = app.name || 'unnamed';
  debug('mount %s %s', prefix, name);

  // Create regexp matchers
  var matcher = route(prefix);
  var re = pathToRegexp(prefix, [], {
    end: false
  });

  return function *(upstream){
    var prev = this.path;
    var res = match(this);
    if (!res) return yield* upstream;
    debug('mount %s %s -> %s', prefix, name, res.path);

    this.mountPath = prefix;
    this.params = res.params;
    this.path = res.path;
    debug('enter %s -> %s', prev, this.path);

    yield* downstream.call(this, function *(){
      this.path = prev;
      yield* upstream;
      this.path = res.path;
    }.call(this));

    debug('leave %s -> %s', prev, this.path);
    this.path = prev;
  }

  /**
   * Check if `prefix` satisfies a `path`.
   * Returns the new path.
   *
   * match('/images/', '/lkajsldkjf') => false
   * match('/images', '/images') => /
   * match('/images/', '/images') => false
   * match('/images/', '/images/asdf') => /asdf
   *
   * @param {String} prefix
   * @param {String} path
   * @return {String|Boolean}
   * @api private
   */

  function match (ctx) {
    var path = ctx.path;
    var params = matcher(path, ctx.params);

    // does not match prefix at all
    if (params === false) {
      return false;
    }

    var newPath = path.replace(re, '') || '/';
    if (trailingSlash) {
      return {
        path: newPath,
        params: params
      };
    }

    // `/mount` does not match `/mountlkjalskjdf`
    if ('/' != newPath[0]) {
      return false;
    }

    return {
      path: newPath,
      params: params
    };
  }
}
