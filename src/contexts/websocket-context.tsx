import React, { createContext, useContext, ReactNode, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { URLExt } from '@jupyterlab/coreutils'
import { ServerConnection } from '@jupyterlab/services'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import EventEmitter from 'events'
import { API_NAMESPACE_URL_PART } from '../handler'
import { IIncomingWebsocketMessage, IOutgoingWebsocketMessage, WebsocketCrudMessage, WebsocketJobStatusMessage } from '../api'
import { RawIncomingWebsocketMessage, WebsocketEventName } from '../api/ws-responses'
import { WebSocketLike } from 'react-use-websocket/dist/lib/types'

interface IWebsocketContext {
    readyState: ReadyState,
    incomingMessageLog: IIncomingWebsocketMessage<any>[]
    outgoingMessageLog: IOutgoingWebsocketMessage<any>[]
    lastWsMessage: IIncomingWebsocketMessage<any>
    sendWsMessage: <T,>(message: IOutgoingWebsocketMessage<T>) => void
    getWebSocket: () => (WebSocketLike | null)
    on: NodeJS.EventEmitter["on"]
    off: NodeJS.EventEmitter["off"]
}

interface IWebsocketProviderProps {
    children?: ReactNode
}

const WEBSOCKET_URL = URLExt.join(ServerConnection.makeSettings().wsUrl, API_NAMESPACE_URL_PART, "ws")

export const WebsocketContext = createContext<IWebsocketContext|undefined>(undefined)

export const WebsocketProvider = ({ children }: IWebsocketProviderProps) => {
    const [incomingLog, setIncomingLog] = useState<IIncomingWebsocketMessage<any>[]>([])
    const [outgoingLog, setOutgoingLog] = useState<IOutgoingWebsocketMessage<any>[]>([])

    const ee = useRef(new EventEmitter())

    const {
        sendMessage,
        lastJsonMessage,
        readyState,
        getWebSocket
    } = useWebSocket<RawIncomingWebsocketMessage<unknown>>(WEBSOCKET_URL)
    
    const lastWsMessage = useMemo(() => incomingLog[incomingLog.length - 1], [incomingLog])

    const sendWsMessage = useCallback(<T,>(message: IOutgoingWebsocketMessage<T>): void => {
        sendMessage(JSON.stringify(message.serialize()))
        setOutgoingLog((outgoingLog) => ([...outgoingLog, message]))
    }, [sendMessage])

    const parseWsMessage = useCallback((rawMessage: RawIncomingWebsocketMessage<unknown>): IIncomingWebsocketMessage<unknown> | null => {
        switch (rawMessage.event_name) {
            case WebsocketEventName.CRUD_EVENT: {
                return WebsocketCrudMessage.fromResponse(rawMessage)
            }
            case WebsocketEventName.JOB_STATUS_EVENT: {
                return WebsocketJobStatusMessage.fromResponse(rawMessage)
            }
            default: {
                console.warn(`Unimplemented websocket message type ${ rawMessage.event_name } with payload ${ rawMessage.data }`)
                return null
            }
        }
    }, [])

    useEffect(() => {
        if (!lastJsonMessage) return

        const wsMessage = parseWsMessage(lastJsonMessage)
        if (wsMessage === null) {
            console.warn("Unhandled websocket message, failed to parse", lastJsonMessage)
            return
        }
        setIncomingLog((incomingLog) => ([...incomingLog, wsMessage]))
        ee.current.emit(wsMessage.eventName, wsMessage)
    }, [lastJsonMessage, parseWsMessage])

    return <WebsocketContext.Provider value={{
        readyState,
        incomingMessageLog: incomingLog,
        outgoingMessageLog: outgoingLog,
        lastWsMessage,
        sendWsMessage,
        getWebSocket,
        on: ee.current.on,
        off: ee.current.off
    }}>
        { children }
    </WebsocketContext.Provider>
}
export const useWebsocket = () => useContext(WebsocketContext)