/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

if (__DEV__) {
  // Paths to exclude from logging. Can be strings (exact or prefix matches) or RegExp.
  const EXCLUDE_PATHS = [
    '/ping',
	'/symbolicate'
  ];

  const originalFetch = global.fetch;
  global.fetch = function(...args) {
    const requestArg = args[0];
    const requestUrl = typeof requestArg === 'string' ? requestArg : (requestArg && requestArg.url);
    let pathOnly = requestUrl || '';

    try {
      const u = new URL(requestUrl);
      pathOnly = u.pathname + u.search;
    } catch (e) {
      // If parsing fails, strip protocol+host (e.g., https://example.com) to keep only the path
      pathOnly = ('' + requestUrl).replace(/^[a-zA-Z]+:\/\/[^/]+/, '');
    }

    if (!pathOnly) pathOnly = '/';

    // Check exclusion list
    const isExcluded = EXCLUDE_PATHS.some(pattern => {
      if (!pattern) return false;
      if (typeof pattern === 'string') {
        return pathOnly === pattern || pathOnly.startsWith(pattern);
      }
      if (pattern instanceof RegExp) {
        return pattern.test(pathOnly);
      }
      return false;
    });

    if (isExcluded) {
      // Do not log request/response bodies for excluded paths
      return originalFetch(...args);
    }

    const method = (typeof requestArg === 'string')
      ? ((args[1] && args[1].method) ? args[1].method.toUpperCase() : 'GET')
      : (requestArg && requestArg.method ? requestArg.method : 'GET');

    console.log('==> Request:', method, pathOnly);

    // Log request body similarly to response body (async, don't block fetch)
    (function logRequestBody() {
      // If Request object, try clone().text()
      if (requestArg && typeof requestArg === 'object' && typeof requestArg.clone === 'function') {
        try {
          requestArg.clone().text().then(bodyText => {
            let toLog = bodyText;
            try {
              const parsed = JSON.parse(bodyText);
              toLog = '\n' + JSON.stringify(parsed, null, 2);
            } catch (e) {
              // Not JSON — leave as raw text
            }
            if (bodyText) console.log('==> Request Body:', method, pathOnly, toLog);
          }).catch(err => {
            console.log('==> Request Body:', method, pathOnly, '<unable to read body>', err);
          });
        } catch (e) {
          console.log('==> Request Body:', method, pathOnly, '<unable to clone request>', e);
        }
        return;
      }

      // Otherwise check init.body (args[1])
      const init = args[1] || {};
      const body = init.body;
      if (body == null) return;

      if (typeof body === 'string') {
        let toLog = body;
        try {
          const parsed = JSON.parse(body);
          toLog = '\n' + JSON.stringify(parsed, null, 2);
        } catch (e) {
          // not JSON
        }
        console.log('==> Request Body:', method, pathOnly, toLog);
        return;
      }

      if (body instanceof URLSearchParams) {
        console.log('==> Request Body:', method, pathOnly, body.toString());
        return;
      }

      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        try {
          const entries = [];
          for (const pair of body.entries()) entries.push([pair[0], pair[1]]);
          console.log('==> Request Body (FormData):', method, pathOnly, entries);
        } catch (e) {
          console.log('==> Request Body:', method, pathOnly, '<FormData>');
        }
        return;
      }

      try {
        const str = JSON.stringify(body, null, 2);
        console.log('==> Request Body:', method, pathOnly, '\n' + str);
      } catch (e) {
        console.log('==> Request Body:', method, pathOnly, '<unserializable body>', e);
      }
    })();

    return originalFetch(...args).then(res => {
      // clone the response so we can read the body without consuming the original
      res.clone().text().then(bodyText => {
        let toLog = bodyText;
        try {
          const parsed = JSON.parse(bodyText);
          toLog = '\n' + JSON.stringify(parsed, null, 2);
        } catch (e) {
          // Not JSON — leave as raw text
        }
        console.log('<== Response:', pathOnly, res.status, toLog);
      }).catch(err => {
        console.log('<== Response:', pathOnly, res.status, '<unable to read body>', err);
      });
      return res;
    });
  };
}
AppRegistry.registerComponent(appName, () => App);
