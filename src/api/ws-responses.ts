import { JobStatusResponse } from "./api-responses"

export enum WebsocketEventName {
    CRUD_EVENT = "crud_event",
    JOB_STATUS_EVENT = "job_status_event"
}

/**
 * Note that websocket messages use the same interface both ways (WebsocketMessage)
 * but may involve different payloads depending on if they are in/out-going
 */
export interface RawWebsocketMessage<T> {
    event_name: WebsocketEventName
    uuid: string
    // Indicates that the message is in response to another message.
    originator?: string
    data: T
}

/** It is likely these will always be the exact same as WebsocketMessage.
 * They have mainly been added to distinguish between interfaces intended for
 * client -> server messaging versus those used for server -> client messaging
 */
// Incoming indicates a message sent by the server to a client.
export interface RawIncomingWebsocketMessage<T> extends RawWebsocketMessage<T> {}
// Outgoing indicates a message sent by the client (this) to the server.
export interface RawOutgoingWebsocketMessage<T> extends RawWebsocketMessage<T> {}


export enum CrudOperationType {
    CREATE = "CREATE",
    MODIFY = "MODIFY",
    DELETE = "DELETE"
}
export enum CrudResourceType {
    COURSE = "COURSE",
    USER = "USER",
    ASSIGNMENT = "ASSIGNMENT",
    SUBMISSION = "SUBMISSION"
}
export interface CrudPayload {
    crud_type: CrudOperationType
    resource_type: CrudResourceType
    resource_id: number
}
export interface RawWebsocketCrudMessage extends RawIncomingWebsocketMessage<CrudPayload> {
    event_name: WebsocketEventName.CRUD_EVENT
}

export type JobStatusPayload = JobStatusResponse
export interface RawWebsocketJobStatusMessage extends RawIncomingWebsocketMessage<JobStatusPayload> {
    event_name: WebsocketEventName.JOB_STATUS_EVENT
}