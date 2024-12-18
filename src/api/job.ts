import moment from 'moment'
import { JobStatusResponse, JobResultResponse, JobStatusEnum } from './api-responses'

export interface IJobStatus {
    readonly id: string
    readonly status: JobStatusEnum
    readonly type?: string | null
    readonly isComplete: boolean
}

export interface IJobResult extends IJobStatus {
    readonly result: any
    readonly successful: boolean
    readonly failed: boolean
    readonly type: string | null
    readonly queue: string | null
    readonly retries: number | null
    readonly traceback: string | null
    readonly finishedDate: Date | null
}

export class JobStatus implements IJobStatus {
    constructor(
        private _id: string,
        private _status: JobStatusEnum
    ) {}
    get id() { return this._id }
    get status() { return this._status }
    get isComplete() {
        return (
            this.status === JobStatusEnum.SUCCESS ||
            this.status === JobStatusEnum.FAILURE ||
            this.status === JobStatusEnum.REVOKED
        )
    }

    static fromResponse(data: JobStatusResponse): IJobStatus {
        return new JobStatus(
            data.id,
            data.status
        )
    }
}

export class JobResult extends JobStatus implements IJobResult {
    constructor(
        id: string,
        status: JobStatusEnum,
        private _result: any,
        private _successful: boolean,
        private _failed: boolean,
        private _type: string | null,
        private _queue: string | null,
        private _retries: number | null,
        private _traceback: string | null,
        private _finished_date: Date | null
    ) {
        super(id, status)
    }
    get result() { return this._result }
    get successful() { return this._successful }
    get failed() { return this._failed }
    get type() { return this._type }
    get queue() { return this._queue }
    get retries() { return this._retries }
    get traceback() { return this._traceback }
    get finishedDate() { return this._finished_date }

    static fromResponse(data: JobResultResponse): IJobResult {
        return new JobResult(
            data.id,
            data.status,
            data.result,
            data.successful,
            data.failed,
            data.type,
            data.queue,
            data.retries,
            data.traceback,
            data.finished_date ? new Date(data.finished_date) : null
        )
    }
}