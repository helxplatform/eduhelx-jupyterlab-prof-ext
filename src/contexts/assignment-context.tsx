import React, { createContext, useContext, ReactNode, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { IChangedArgs } from '@jupyterlab/coreutils'
import { FileBrowserModel, IDefaultFileBrowser } from '@jupyterlab/filebrowser'
import { useSnackbar } from './snackbar-context'
import {
    IAssignment, IInstructor, ICurrentAssignment, ICourse, IStudent,
    getAssignments, getInstructorAndStudentsAndCourse, listNotebookFiles,
    WebsocketCrudMessage,
    WebsocketJobStatusMessage
} from '../api'
import { CrudResourceType } from '../api/ws-responses'
import { IJobStatus, JobStatus } from '../api/job'
import { JobStatusEnum } from '../api/api-responses'
import { useWebsocket } from './websocket-context'

interface GradedNotebookExists {
    (assignment: IAssignment, directoryPath?: string | undefined): boolean
}

interface IAssignmentContext {
    loading: boolean
    path: string | null
    assignments: IAssignment[] | null | undefined
    assignment: ICurrentAssignment | null | undefined
    instructor: IInstructor | undefined
    students: IStudent[] | undefined
    course: ICourse | undefined
    notebookFiles: { [assignmentId: string]: string[] } | undefined
    jobStatuses: IJobStatus[]
    gradedNotebookExists: GradedNotebookExists
    updateNotebookFiles: (requestOptions?: RequestInit) => Promise<void>
    updateAssignments: (requestOptions?: RequestInit) => Promise<void>
    updateCourseAndUserData: (requestOptions?: RequestInit) => Promise<void>
}

interface IAssignmentProviderProps {
    fileBrowser: IDefaultFileBrowser
    children?: ReactNode
}

/**
 * Supplemental polling is utilized in addition to websockets
 * to mitigate any downtime/missed messaging.
 */
const POLL_DELAY = 30000
const POLL_RETRY_DELAY = 2500
// It would be a lot more effort than its worth to observe filesystem changes on the server extension
// just in order to track which notebook files are in the user's repository directory. It's much
// easier to just short poll it, since it doesn't involve any API calls (just a basic directory scan).
const POLL_NOTEBOOK_FILES_DELAY = 2500

export const AssignmentContext = createContext<IAssignmentContext|undefined>(undefined)

export const AssignmentProvider = ({ fileBrowser, children }: IAssignmentProviderProps) => {
    const snackbar = useSnackbar()!
    const { lastWsMessage } = useWebsocket()!
    const [currentPath, setCurrentPath] = useState<string|null>(null)
    const [currentAssignment, setCurrentAssignment] = useState<ICurrentAssignment|null|undefined>(undefined)
    const [assignments, setAssignments] = useState<IAssignment[]|null|undefined>(undefined)
    const [instructor, setInstructor] = useState<IInstructor|undefined>(undefined)
    const [students, setStudents] = useState<IStudent[]|undefined>(undefined)
    const [course, setCourse] = useState<ICourse|undefined>(undefined)
    const [notebookFiles, setNotebookFiles] = useState<{ [key: string]: string[] }|undefined>(undefined)
    const [jobStatuses, setJobStatuses] = useState<IJobStatus[]>([])

    const notebookFileController = useRef<AbortController>()
    const assignmentsController = useRef<AbortController>()
    const courseUserController = useRef<AbortController>()

    const loading = useMemo(() => (
        currentAssignment === undefined ||
        assignments === undefined ||
        instructor === undefined ||
        students === undefined ||
        course === undefined ||
        notebookFiles === undefined
    ), [currentAssignment, assignments, instructor, students, course, notebookFiles])

    const gradedNotebookExists = useCallback((assignment: IAssignment, gradedNotebookPath?: string | undefined) => {
        if (!notebookFiles) return false
        if (gradedNotebookPath === undefined) gradedNotebookPath = assignment.masterNotebookPath
        return notebookFiles[assignment.id].some((file) => file === gradedNotebookPath)
    }, [notebookFiles])

    // Pull all notebook files (currently, *.ipynb) in the repository.
    const updateNotebookFiles = useCallback(async () => {
        notebookFileController.current?.abort()
        notebookFileController.current = new AbortController()
        const { notebooks } = await listNotebookFiles({ signal: notebookFileController.current.signal })
        setNotebookFiles(notebooks)
    }, [])

    // Pull assignments and current assignment (of the cwd, when applicable)
    const updateAssignments = useCallback(async () => {
        if (currentPath === null) return
        assignmentsController.current?.abort()
        assignmentsController.current = new AbortController()
        const data = await getAssignments(currentPath, { signal: assignmentsController.current.signal })
        setAssignments(data.assignments)
        setCurrentAssignment(data.currentAssignment)
    }, [currentPath])

    // Pull course, current user, and students
    const updateCourseAndUserData = useCallback(async () => {
        courseUserController.current?.abort()
        courseUserController.current = new AbortController()
        const data = await getInstructorAndStudentsAndCourse({ signal: courseUserController.current.signal })
        setCourse(data.course)
        setInstructor(data.instructor)
        setStudents(data.students)
    }, [])

    const poll = useCallback((
        pollFn: () => Promise<void>, 
        {
            pollDelay=POLL_DELAY,
            pollRetryDelay=POLL_RETRY_DELAY,
            onFailure=(e: any) => {}
        }
    ) => {
        let timeoutId: number
        const timeout = async () => {
            try {
                await pollFn()
                timeoutId = window.setTimeout(timeout, pollDelay)
            } catch (e: any) {
                // Stop polling if an abort error is encountered.
                if (e.name === "AbortError") return
                else {
                    await onFailure(e)
                    // Expedite the next poll if an unexpected error is encountered.
                    timeoutId = window.setTimeout(timeout, pollRetryDelay)
                }
            }
        }
        timeout()
        return function cancel() {
            window.clearTimeout(timeoutId)
        }
    }, [])
    
    /** Track the current working directory of the user (relative to the server CWD). */
    useEffect(() => {
        setCurrentPath(fileBrowser.model.path)

        const onCurrentPathChanged = (model: FileBrowserModel, change: IChangedArgs<string|null>) => {
            setCurrentPath(change.newValue)
        }
        fileBrowser.model.pathChanged.connect(onCurrentPathChanged)
        return () => {
            fileBrowser.model.pathChanged.disconnect(onCurrentPathChanged)
        }
    }, [fileBrowser])

    /** Supplemental polling of assignment data. */
    useEffect(() => {
        // If the currentPath changes, we need to immediately return to a loading state.
        setAssignments(undefined)
        setCurrentAssignment(undefined)

        // Current path being undefined is a precursor to loading.
        // We cannot begin to load assignment data until current path is loaded.
        if (!currentPath) return
        
        const cancelPoll = poll(updateAssignments, {
            onFailure: (e) => console.warn(`Encountered unexpected error while pulling assignment data for path ${ currentPath }`, e)
        })

        return () => {
            cancelPoll()
            assignmentsController.current?.abort()
        }
    }, [currentPath, updateAssignments, poll])

    /** Supplemental polling of course and user data. */
    useEffect(() => {
        // Since this effect only runs on mount, returning to loading state is not necessary (we start in loading state).
        // Included in case this ever changes to have dependencies. Right now, these setStates are effectively no-ops.
        setCourse(undefined)
        setInstructor(undefined)
        setStudents(undefined)

        const cancelPoll = poll(updateCourseAndUserData, {
            onFailure: (e) => console.warn(`Encountered unexpected error while pulling course/user data`, e)
        })

        return () => {
            cancelPoll()
            courseUserController.current?.abort()
        }
    }, [updateCourseAndUserData, poll])

    /** Poll notebook files.
     * At the moment, this isn't integrated into websockets (not beneficial enough to warranting FS monitoring)
     * so polling is done quite frequently. The endpoint only requires a filesystem scan against the repo, so lightweight. */
    useEffect(() => {
        setNotebookFiles(undefined)

        const cancelPoll = poll(updateNotebookFiles, {
            pollDelay: POLL_NOTEBOOK_FILES_DELAY,
            onFailure: (e) => console.warn(`Encountered unexpected error while pulling notebook files`, e)
        })

        return () => {
            cancelPoll()
            notebookFileController.current?.abort()
        }
    }, [updateNotebookFiles, poll])

    /**
     * Handle incoming WS messages and update state accordingly.
     */
    useEffect(() => {
        if (!lastWsMessage) return

        void async function() {
            if (lastWsMessage instanceof WebsocketCrudMessage) {
                switch (lastWsMessage.resourceType) {
                    case CrudResourceType.COURSE:
                    case CrudResourceType.USER:
                        await updateCourseAndUserData()
                        break;
                    case CrudResourceType.SUBMISSION:
                    case CrudResourceType.ASSIGNMENT:
                        await updateAssignments()
                        break;
                    default:
                        console.log("Unrecognized CRUD resource type", lastWsMessage.resourceType)
                        break;
                }
            } else if (lastWsMessage instanceof WebsocketJobStatusMessage) {
                const newJobStatus = JobStatus.fromResponse(lastWsMessage.payload)
                setJobStatuses((jobStatuses) => {
                    const newStatuses = jobStatuses.map((jobStatus) => {
                        if (jobStatus.id === lastWsMessage.jobId) return newJobStatus
                        else return jobStatus
                    })
                    if (!newStatuses.map((s) => s.id).includes(lastWsMessage.jobId)) newStatuses.push(newJobStatus)
                    return newStatuses
                })
            }
        }()
    }, [lastWsMessage, updateAssignments, updateCourseAndUserData])

    return (
        <AssignmentContext.Provider value={{
            assignment: currentAssignment,
            assignments,
            instructor,
            students,
            course,
            notebookFiles,
            path: currentPath,
            loading,
            jobStatuses,
            gradedNotebookExists,
            updateNotebookFiles,
            updateAssignments,
            updateCourseAndUserData
        }}>
            { children }
        </AssignmentContext.Provider>
    )
}
export const useAssignment = () => useContext(AssignmentContext)