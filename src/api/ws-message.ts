import { JobStatusEnum } from './api-responses'
import {
    RawWebsocketMessage, WebsocketEventName,
    RawWebsocketCrudMessage, CrudOperationType, CrudResourceType, CrudPayload,
    RawWebsocketJobStatusMessage, JobStatusPayload,
    RawOutgoingWebsocketMessage
} from './ws-responses'

export interface IWebsocketMessage<T> {
    eventName: string
    uuid: string
    // Indicates that the message is in response to another message.
    originatorUuid?: string
    payload: T
}

export class WebsocketMessage<T> implements IWebsocketMessage<T> {
    constructor(
        private _eventName: WebsocketEventName,
        private _uuid: string,
        private _originatorUuid: string | undefined,
        private _payload: T
    ) {}

    get eventName() { return this._eventName }
    get uuid() { return this._uuid }
    get originatorUuid() { return this._originatorUuid }
    get payload() { return this._payload }

    // This is just a class method but the implementation is quite strange in TS.
    // Unclear if it's possible to further parametrize such that data matches the payload of T.
    static fromResponse<T extends WebsocketMessage<any>>(
        this: { new(...args: any[]): T },
        data: RawWebsocketMessage<any>
    ): T {
        return new this(
            data.event_name,
            data.uuid,
            data.originator,
            data.data
        )
    }
}

export interface IOutgoingWebsocketMessage<T> extends WebsocketMessage<T> {
    serialize(): RawOutgoingWebsocketMessage<T>
}

export class OutgoingWebsocketMessage<T> extends WebsocketMessage<T> implements IOutgoingWebsocketMessage<T> {
    serialize(): RawOutgoingWebsocketMessage<T> {
        return {
            event_name: this.eventName,
            uuid: this.uuid,
            originator: this.originatorUuid,
            data: this.payload
        }
    }
}

export interface IIncomingWebsocketMessage<T> extends WebsocketMessage<T> {
}

export class IncomingWebsocketMessage<T> extends WebsocketMessage<T> implements IIncomingWebsocketMessage<T> {}

interface IWebsocketCrudMessage extends IIncomingWebsocketMessage<CrudPayload> {
    operationType: CrudOperationType,
    resourceType: CrudResourceType,
    resourceId: number
}

export class WebsocketCrudMessage extends IncomingWebsocketMessage<CrudPayload> implements IWebsocketCrudMessage {
    get operationType() { return this.payload.crud_type }
    get resourceType() { return this.payload.resource_type }
    get resourceId() { return this.payload.resource_id }
}

interface IWebsocketJobStatusMessage extends IIncomingWebsocketMessage<JobStatusPayload> {
    jobId: string
    jobType: string | null
    jobStatus: JobStatusEnum
}

export class WebsocketJobStatusMessage extends IncomingWebsocketMessage<JobStatusPayload> implements IWebsocketJobStatusMessage {
    get jobId() { return this.payload.id }
    get jobType() { return this.payload.type }
    get jobStatus() { return this.payload.status }
}