import { URLExt } from '@jupyterlab/coreutils'
import { ServerConnection } from '@jupyterlab/services'

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings()
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'eduhelx-jupyterlab-prof', // API Namespace
    endPoint
  )

  let response: Response
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings)
  } catch (error) {
    throw new ServerConnection.NetworkError(error as any)
  }

  // let data: any = await response.text()

  // if (data.length > 0) {
  //   try {
  //     data = JSON.parse(data)
  //   } catch (error) {
  //     console.log('Not a JSON response body.', response)
  //   }
  // }
  let data
  try {
    // Clone so we don't read the response body in the event of an error (we return the response). 
    data = await response.clone().json()
  } catch (error) {
    console.log('Not a JSON response body.', response)
  }

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message || data)
  }

  return data
}
