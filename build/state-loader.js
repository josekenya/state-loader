var querystring = function () {

  var exports = {};

  /**
   * Object#toString() ref for stringify().
   */

  var toString = Object.prototype.toString;

  /**
   * Object#hasOwnProperty ref
   */

  var hasOwnProperty = Object.prototype.hasOwnProperty;

  /**
   * see issue #70
   */
  var isRestorableProto = (function () {
    var o;

    if (!Object.create) return false;

    o = Object.create(null);
    o.__proto__ = Object.prototype;

    return o.hasOwnProperty === hasOwnProperty;
  })();

  /**
   * Array#indexOf shim.
   */

  var indexOf = typeof Array.prototype.indexOf === 'function'
    ? function(arr, el) { return arr.indexOf(el); }
    : function(arr, el) {
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] === el) return i;
        }
        return -1;
      };

  /**
   * Array.isArray shim.
   */

  var isArray = Array.isArray || function(arr) {
    return toString.call(arr) == '[object Array]';
  };

  /**
   * Object.keys shim.
   */

  var objectKeys = Object.keys || function(obj) {
    var ret = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        ret.push(key);
      }
    }
    return ret;
  };

  /**
   * Array#forEach shim.
   */

  var forEach = typeof Array.prototype.forEach === 'function'
    ? function(arr, fn) { return arr.forEach(fn); }
    : function(arr, fn) {
        for (var i = 0; i < arr.length; i++) fn(arr[i]);
      };

  /**
   * Array#reduce shim.
   */

  var reduce = function(arr, fn, initial) {
    if (typeof arr.reduce === 'function') return arr.reduce(fn, initial);
    var res = initial;
    for (var i = 0; i < arr.length; i++) res = fn(res, arr[i]);
    return res;
  };

  /**
   * Create a nullary object if possible
   */

  function createObject() {
    return isRestorableProto
      ? Object.create(null)
      : {};
  }

  /**
   * Cache non-integer test regexp.
   */

  var isint = /^[0-9]+$/;

  function promote(parent, key) {
    if (parent[key].length == 0) return parent[key] = createObject();
    var t = createObject();
    for (var i in parent[key]) {
      if (hasOwnProperty.call(parent[key], i)) {
        t[i] = parent[key][i];
      }
    }
    parent[key] = t;
    return t;
  }

  function parse(parts, parent, key, val) {
    var part = parts.shift();
    // end
    if (!part) {
      if (isArray(parent[key])) {
        parent[key].push(val);
      } else if ('object' == typeof parent[key]) {
        parent[key] = val;
      } else if ('undefined' == typeof parent[key]) {
        parent[key] = val;
      } else {
        parent[key] = [parent[key], val];
      }
      // array
    } else {
      var obj = parent[key] = parent[key] || [];
      if (']' == part) {
        if (isArray(obj)) {
          if ('' != val) obj.push(val);
        } else if ('object' == typeof obj) {
          obj[objectKeys(obj).length] = val;
        } else {
          obj = parent[key] = [parent[key], val];
        }
        // prop
      } else if (~indexOf(part, ']')) {
        part = part.substr(0, part.length - 1);
        if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
        parse(parts, obj, part, val);
        // key
      } else {
        if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
        parse(parts, obj, part, val);
      }
    }
  }

  /**
   * Merge parent key/val pair.
   */

  function merge(parent, key, val){
    if (~indexOf(key, ']')) {
      var parts = key.split('[')
        , len = parts.length
        , last = len - 1;
      parse(parts, parent, 'base', val);
      // optimize
    } else {
      if (!isint.test(key) && isArray(parent.base)) {
        var t = createObject();
        for (var k in parent.base) t[k] = parent.base[k];
        parent.base = t;
      }
      set(parent.base, key, val);
    }

    return parent;
  }

  /**
   * Compact sparse arrays.
   */

  function compact(obj) {
    if ('object' != typeof obj) return obj;

    if (isArray(obj)) {
      var ret = [];

      for (var i in obj) {
        if (hasOwnProperty.call(obj, i)) {
          ret.push(obj[i]);
        }
      }

      return ret;
    }

    for (var key in obj) {
      obj[key] = compact(obj[key]);
    }

    return obj;
  }

  /**
   * Restore Object.prototype.
   * see pull-request #58
   */

  function restoreProto(obj) {
    if (!isRestorableProto) return obj;
    if (isArray(obj)) return obj;
    if (obj && 'object' != typeof obj) return obj;

    for (var key in obj) {
      if (hasOwnProperty.call(obj, key)) {
        obj[key] = restoreProto(obj[key]);
      }
    }

    obj.__proto__ = Object.prototype;
    return obj;
  }

  /**
   * Parse the given obj.
   */

  function parseObject(obj){
    var ret = { base: {} };

    forEach(objectKeys(obj), function(name){
      merge(ret, name, obj[name]);
    });

    return compact(ret.base);
  }

  /**
   * Parse the given str.
   */

  function parseString(str){
    var ret = reduce(String(str).split('&'), function(ret, pair){
      var eql = indexOf(pair, '=')
        , brace = lastBraceInKey(pair)
        , key = pair.substr(0, brace || eql)
        , val = pair.substr(brace || eql, pair.length)
        , val = val.substr(indexOf(val, '=') + 1, val.length);

      // ?foo
      if ('' == key) key = pair, val = '';
      if ('' == key) return ret;

      return merge(ret, decode(key), decode(val));
    }, { base: createObject() }).base;

    return restoreProto(compact(ret));
  }

  /**
   * Parse the given query `str` or `obj`, returning an object.
   *
   * @param {String} str | {Object} obj
   * @return {Object}
   * @api public
   */

  exports.parse = function(str){
    if (null == str || '' == str) return {};
    return 'object' == typeof str
      ? parseObject(str)
      : parseString(str);
  };

  /**
   * Turn the given `obj` into a query string
   *
   * @param {Object} obj
   * @return {String}
   * @api public
   */

  var stringify = exports.stringify = function(obj, prefix) {
    if (isArray(obj)) {
      return stringifyArray(obj, prefix);
    } else if ('[object Object]' == toString.call(obj)) {
      return stringifyObject(obj, prefix);
    } else if ('string' == typeof obj) {
      return stringifyString(obj, prefix);
    } else {
      return prefix + '=' + encodeURIComponent(String(obj));
    }
  };

  /**
   * Stringify the given `str`.
   *
   * @param {String} str
   * @param {String} prefix
   * @return {String}
   * @api private
   */

  function stringifyString(str, prefix) {
    if (!prefix) throw new TypeError('stringify expects an object');
    return prefix + '=' + encodeURIComponent(str);
  }

  /**
   * Stringify the given `arr`.
   *
   * @param {Array} arr
   * @param {String} prefix
   * @return {String}
   * @api private
   */

  function stringifyArray(arr, prefix) {
    var ret = [];
    if (!prefix) throw new TypeError('stringify expects an object');
    for (var i = 0; i < arr.length; i++) {
      ret.push(stringify(arr[i], prefix + '[' + i + ']'));
    }
    return ret.join('&');
  }

  /**
   * Stringify the given `obj`.
   *
   * @param {Object} obj
   * @param {String} prefix
   * @return {String}
   * @api private
   */

  function stringifyObject(obj, prefix) {
    var ret = []
      , keys = objectKeys(obj)
      , key;

    for (var i = 0, len = keys.length; i < len; ++i) {
      key = keys[i];
      if ('' == key) continue;
      if (null == obj[key]) {
        ret.push(encodeURIComponent(key) + '=');
      } else {
        ret.push(stringify(obj[key], prefix
          ? prefix + '[' + encodeURIComponent(key) + ']'
          : encodeURIComponent(key)));
      }
    }

    return ret.join('&');
  }

  /**
   * Set `obj`'s `key` to `val` respecting
   * the weird and wonderful syntax of a qs,
   * where "foo=bar&foo=baz" becomes an array.
   *
   * @param {Object} obj
   * @param {String} key
   * @param {String} val
   * @api private
   */

  function set(obj, key, val) {
    var v = obj[key];
    if (undefined === v) {
      obj[key] = val;
    } else if (isArray(v)) {
      v.push(val);
    } else {
      obj[key] = [v, val];
    }
  }

  /**
   * Locate last brace in `str` within the key.
   *
   * @param {String} str
   * @return {Number}
   * @api private
   */

  function lastBraceInKey(str) {
    var len = str.length
      , brace
      , c;
    for (var i = 0; i < len; ++i) {
      c = str[i];
      if (']' == c) brace = false;
      if ('[' == c) brace = true;
      if ('=' == c && !brace) return i;
    }
  }

  /**
   * Decode `str`.
   *
   * @param {String} str
   * @return {String}
   * @api private
   */

  function decode(str) {
    try {
      return decodeURIComponent(str.replace(/\+/g, ' '));
    } catch (err) {
      return str;
    }
  }

  return exports;
};

/*global jQuery*/

;(function ($, window, document, undefined) {

  var plugin_name = 'animationStyle';

  var plugin = function (element, options) {

    var style = options.style;

    element.queue(function (next) {

      var end = function () {
        element.removeClass(style);
        next();
        options.callback && options.callback();
      };

      element.one('animationend webkitAnimationEnd oanimationend MSAnimationEnd', function () {
        end();
      });

      element.addClass(style);

      if (element.css('animation-name') === 'none') {
        end();
      }

    });

  };

  /* Initialize plugin */

  $.fn[plugin_name] = function (options) {
    return this.each(function () {
      if (!$.data(this, 'plugin_' + plugin_name)) {
        $.data(this, 'plugin_' + plugin_name, plugin($(this), options));
      }
    });
  };

})(jQuery, window, document);

/*global jQuery*/

;(function ($, window, document, undefined) {

  var plugin_name = 'loadState';

  var getState = function (url, callback) {
    
    $.get(url, function (response) {
      callback($(response));
    });

  };

  var plugin = function (element, options) {

    var id = element.attr('data-state-container');
    var url = options[id];
    var contents = element.contents();

    /* Load */

    if (url) {

      if (element.data('current_state') === url) {
        return; 
      }

      element.data('current_state', url);

      getState(url, function (state) {

        var resume = function () {
          if (contents.length) {
            element[0].removeChild(contents[0]);
          }
        };

        element.append(state);

        var event = $.Event('statechange');
        event.hash_object = options;

        element.trigger(event, [contents, state, resume]);

        if (!event.isDefaultPrevented()) {
          resume(); 
        }

        state.find('*[data-state-push]').stateHashPush();
        
      });

      return;

    }

    /* unload */

    if (contents.length !== 0) {
    
      var resume = function () {
        element.empty();
      };

      element.data('current_state', '');

      var event = $.Event('stateunload');
      event.state = url;

      element.trigger(event, [contents, resume]);

      if (!event.isDefaultPrevented()) {
        resume(); 
      }

    }

  };

  /* Initialize plugin */

  $.fn[plugin_name] = function (options) {
    return this.each(function () {
      if (!$.data(this, 'plugin_' + plugin_name)) {
        $.data(this, 'plugin_' + plugin_name, plugin($(this), options));
      }
    });
  };

})(jQuery, window, document);

/*global jQuery*/

;(function ($, window, document, querystring, undefined) {

  var plugin_name = 'stateHashChange';

  /* Get hash object */

  var getHashObject = function () {
    return querystring.parse(window.location.hash.substr(1));
  };

  /* Plugin */

  var plugin = function (element) {

    setTimeout(function () {
      element.trigger('statehashchange', getHashObject());
    }, 0);

    element.on('hashchange', function () {
      element.trigger('statehashchange', getHashObject());
    });

  };

  /* Initialize plugin */

  $.fn[plugin_name] = function (options) {
    return this.each(function () {
      if (!$.data(this, 'plugin_' + plugin_name)) {
        $.data(this, 'plugin_' + plugin_name, plugin($(this), options));
      }
    });
  };

})(jQuery, window, document, window.querystring());

/*global jQuery*/

;(function ($, window, document, querystring, undefined) {

  var plugin_name = 'stateHashPush';

  /* Get hash object */

  var getHashObject = function () {
    return querystring.parse(window.location.hash.substr(1));
  };


  /* Set hash */

  var setHashObject = function (obj) {
    window.location.hash = querystring.stringify(obj);
  };


  /* Plugin */

  var plugin = function (element) {

    element.click(function () {
      var qs = eval('(' + element.attr('data-state-push') + ')');
      var hash_object = getHashObject();

      if (!qs.reverse) {
        delete hash_object.reverse;
      }

      setHashObject($.extend(hash_object, qs));
    });

  };


  /* Initialize plugin */

  $.fn[plugin_name] = function (options) {
    return this.each(function () {
      if (!$.data(this, 'plugin_' + plugin_name)) {
        $.data(this, 'plugin_' + plugin_name, plugin($(this), options));
      }
    });
  };

})(jQuery, window, document, window.querystring());
