import { IStudent, Student } from './student'
import { ISubmission, Submission } from './submission'
import { AssignmentResponse, AssignmentStatus } from './api-responses'
import { IStagedChange, StagedChange } from './staged-change'

interface StudentSubmissions {
    [onyen: string]: ISubmission[]
}

export interface IAssignment {
    readonly id: number
    readonly name: string
    readonly directoryPath: string
    // Added by serverextension so that we know what path to give the filebrowser
    // to open an assignment, even though we don't know where the repo root is.
    readonly absoluteDirectoryPath: string
    readonly masterNotebookPath: string
    readonly studentNotebookPath: string,
    readonly manualGrading: boolean,
    readonly createdDate: Date
    readonly availableDate: Date | null
    readonly dueDate: Date | null
    readonly lastModifiedDate: Date
    readonly stagedChanges: IStagedChange[]
    readonly protectedFiles: string[]
    readonly overwritableFiles: string[]

    readonly isPublished: boolean
    readonly status: AssignmentStatus

    // Indicates that release date has been deferred to a later date for the student
    readonly isDeferred: boolean
    // Indicates that due date is extended to a later date for the student
    readonly isExtended: boolean
    // Indicates if an assignment is available to work on (e.g. date is greater than available_date)
    readonly isAvailable: boolean
    // Indicates if an assignment is no longer available to work on (e.g. date is greater than due_date)
    readonly isClosed: boolean
}

// Submissions and staged changes are definitely defined in an ICurrentAssignment
export interface ICurrentAssignment extends IAssignment {
    readonly studentSubmissions: StudentSubmissions
    readonly ignoredFiles: string[]
}

export class Assignment implements IAssignment {
    constructor(
        private _id: number,
        private _name: string,
        private _directoryPath: string,
        private _absoluteDirectoryPath: string,
        private _masterNotebookPath: string,
        private _studentNotebookPath: string,
        private _manualGrading: boolean,
        private _protectedFiles: string[],
        private _overwritableFiles: string[],
        private _createdDate: Date,
        private _availableDate: Date | null,
        private _dueDate: Date | null,
        private _lastModifiedDate: Date,
        private _stagedChanges: IStagedChange[],

        private _isPublished: boolean,
        private _status: AssignmentStatus,

        private _isDeferred: boolean,
        private _isExtended: boolean,
        private _isAvailable: boolean,
        private _isClosed: boolean,

        /** Current assignment */
        private _studentSubmissions: StudentSubmissions | undefined,
        private _ignoredFiles: string[] | undefined
    ) {}
    get studentSubmissions() { return this._studentSubmissions }
    get ignoredFiles() { return this._ignoredFiles }
    
    get id() { return this._id }
    get name() { return this._name }
    get directoryPath() { return this._directoryPath }
    get absoluteDirectoryPath() { return this._absoluteDirectoryPath }
    get masterNotebookPath() { return this._masterNotebookPath }
    get studentNotebookPath() { return this._studentNotebookPath }
    get manualGrading() { return this._manualGrading }
    get protectedFiles() { return this._protectedFiles }
    get overwritableFiles() { return this._overwritableFiles }
    get createdDate() { return this._createdDate }
    get availableDate() { return this._availableDate }
    get dueDate() { return this._dueDate }
    get lastModifiedDate() { return this._lastModifiedDate }
    get stagedChanges() { return this._stagedChanges }
    
    get isPublished() { return this._isPublished }
    get status() { return this._status }

    get isDeferred() { return this._isDeferred }
    get isExtended() { return this._isExtended }
    get isAvailable() { return this._isAvailable }
    get isClosed() { return this._isClosed }
    

    static fromResponse(data: AssignmentResponse): IAssignment {
        let studentSubmissions: any = data.student_submissions ? {} : undefined
        if (data.student_submissions) Object.keys(data.student_submissions).forEach((onyen) => {
            studentSubmissions[onyen] = data.student_submissions![onyen].map((res) => Submission.fromResponse(res))
        })
        return new Assignment(
            data.id,
            data.name,
            data.directory_path,
            data.absolute_directory_path,
            data.master_notebook_path,
            data.student_notebook_path,
            data.manual_grading,
            data.protected_files,
            data.overwritable_files,
            new Date(data.created_date),
            data.available_date ? new Date(data.available_date) : null,
            data.due_date ? new Date(data.due_date) : null,
            new Date(data.last_modified_date),
            data.staged_changes.map((s) => StagedChange.fromResponse(s)),

            data.is_published,
            data.status,

            data.is_deferred,
            data.is_extended,
            data.is_available,
            data.is_closed,

            studentSubmissions,
            data.ignored_files
        )
    }
}