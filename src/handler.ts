import { URLExt } from '@jupyterlab/coreutils'
import { ServerConnection } from '@jupyterlab/services'

export const API_NAMESPACE_URL_PART = 'eduhelx-jupyterlab-prof' // URL part representing the API namespace on Jupyter server

// handleRequest implementation (makeRequest) in jupyterlab wraps non-response errors in its own
// NetworkError which completely throws away the actual error object, e.g. AbortErrors.
// So we have to manually redefine the entire thing here...
function getCookie(name: any) {
  // From http://www.tornadoweb.org/en/stable/guide/security.html
  const matches = document.cookie.match('\\b' + name + '=([^;]*)\\b');
  return matches === null || matches === void 0 ? void 0 : matches[1];
}
function makeRequest(url: any, init: any, settings: any) {
  // eslint-disable-next-line no-var
  var _a;
  if (url.indexOf(settings.baseUrl) !== 0) {
      throw new Error('Can only be used for notebook server requests');
  }
  const cache = (_a = init.cache) !== null && _a !== void 0 ? _a : settings.init.cache;
  if (cache === 'no-store') {
      url += (/\?/.test(url) ? '&' : '?') + new Date().getTime();
  }
  const request = new settings.Request(url, { ...settings.init, ...init });
  let authenticated = false;
  if (settings.token) {
      authenticated = true;
      request.headers.append('Authorization', `token ${settings.token}`);
  }
  if (typeof document !== 'undefined' && (document === null || document === void 0 ? void 0 : document.cookie)) {
      const xsrfToken = getCookie('_xsrf');
      if (xsrfToken !== undefined) {
          authenticated = true;
          request.headers.append('X-XSRFToken', xsrfToken);
      }
  }
  if (!request.headers.has('Content-Type') && authenticated) {
      request.headers.set('Content-Type', 'application/json');
  }
  return settings.fetch.call(null, request).catch((e: any) => {
    throw e
  })
}

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {},
  useBaseUrl: boolean = false
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings()
  const requestUrl = useBaseUrl ? URLExt.join(settings.baseUrl, endPoint) : URLExt.join(
    settings.baseUrl,
    API_NAMESPACE_URL_PART,
    endPoint
  )

  const response = await makeRequest(requestUrl, init, settings)

  let data
  try {
    // Clone so we don't read the response body in the event of an error (we return the response). 
    data = await response.clone().json()
  } catch (error) {
    console.log('Not a JSON response body.', response)
  }

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data?.message || data)
  }

  return data
}
