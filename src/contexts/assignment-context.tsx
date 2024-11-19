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
import { useWebsocket } from './websocket-context'
import { IJobStatus } from '../api/job'

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
    jobStatusMap: Map<string, IJobStatus>
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
const POLL_DELAY = 60000
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
    const [jobStatusMap, setJobStatusMap] = useState<Map<string, IJobStatus>>(new Map())

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
    const updateNotebookFiles = useCallback(async (requestOptions: RequestInit={}) => {
        const { notebooks } = await listNotebookFiles(requestOptions)
        setNotebookFiles(notebooks)
    }, [])

    // Pull assignments and current assignment (of the cwd, when applicable)
    const updateAssignments = useCallback(async (requestOptions: RequestInit={}) => {
        if (currentPath === null) return
        const data = await getAssignments(currentPath, requestOptions)
        setAssignments(data.assignments)
        setCurrentAssignment(data.currentAssignment)
    }, [currentPath])

    // Pull course, current user, and students
    const updateCourseAndUserData = useCallback(async (requestOptions: RequestInit={}) => {
        const data = await getInstructorAndStudentsAndCourse(requestOptions)
        setCourse(data.course)
        setInstructor(data.instructor)
        setStudents(data.students)
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

        let controller = new AbortController()
        const timeout = async () => {
            // If the controller is ever aborted, that indicates we should cancel the polling
            // loop since the effect has since rerendered.
            if (controller.signal.aborted) return
            controller = new AbortController()

            try {
                await updateAssignments({ signal: controller.signal })
                window.setTimeout(timeout, POLL_DELAY)
            } catch (e: any) {
                // Stop polling if an abort error is encountered.
                if (e.name !== "AbortError") {
                    console.warn(`Encountered unexpected error while pulling assignment data for path ${ currentPath }`, e)
                    // Expedite the next poll if an unexpected error is encountered.
                    window.setTimeout(timeout, POLL_RETRY_DELAY)
                }
            }
        }
        timeout()

        return () => {
            // We could also store the timeout ID and cancel the timeout directly here.
            // But the controller itself is sufficient for supporting this logic.
            controller.abort()
        }
    }, [currentPath])

    /** Supplemental polling of course and user data. */
    useEffect(() => {
        // Since this effect only runs on mount, returning to loading state is not necessary (we start in loading state).
        // Included in case this ever changes to have dependencies. Right now, these setStates are effectively no-ops.
        setCourse(undefined)
        setInstructor(undefined)
        setStudents(undefined)

        // Same as above--since this context is global and the poll begins on mount, we are perpetually
        // polling until full app demount anyways (i.e., closing the page). So the "cancellation" logic
        // isn't really necessary here, but included in case it's needed in the future.
        let controller = new AbortController()
        const timeout = async () => {
            // If the controller is aborted, it indicates that the effect has rerendered
            // and we should cancel the current polling loop.
            if (controller.signal.aborted) return
            controller = new AbortController()

            try {
                await updateCourseAndUserData({ signal: controller.signal })
                window.setTimeout(timeout, POLL_DELAY)
            } catch (e: any) {
                // Stop polling if an abort error is encountered.
                if (e.name !== "AbortError") {
                    console.warn(`Encountered unexpected error while pulling course/user data`, e)
                    // Expedite the next poll if an unexpected error is encountered.
                    window.setTimeout(timeout, POLL_RETRY_DELAY)
                }
            }
        }
        timeout()

        return () => {
            controller.abort()
        }
    }, [])

    /** Poll notebook files.
     * At the moment, this isn't integrated into websockets (not beneficial enough to warranting FS monitoring)
     * so polling is done quite frequently. The endpoint only requires a filesystem scan against the repo, so lightweight. */
    useEffect(() => {
        setNotebookFiles(undefined)

        let controller = new AbortController()
        const timeout = async () => {
            // If the controller is ever aborted, that indicates we should cancel the polling
            // loop since the effect has since rerendered.
            // This won't actually happen though since this is a did-mount hook at the moment.
            if (controller.signal.aborted) return
            controller = new AbortController()

            try {
                await updateNotebookFiles({ signal: controller.signal })
                window.setTimeout(timeout, POLL_NOTEBOOK_FILES_DELAY)
            } catch (e: any) {
                // Stop polling if an abort error is encountered.
                if (e.name !== "AbortError") {
                    console.warn(`Encountered unexpected error while pulling notebook files`, e)
                    // Expedite the next poll if an unexpected error is encountered.
                    window.setTimeout(timeout, POLL_RETRY_DELAY)
                }
            }
        }
        timeout()

        return () => {
            controller.abort()
        }
    }, [])

    /**
     * Handle incoming WS messages and update state accordingly.
     */
    useEffect(() => {
        if (!lastWsMessage) return

        if (lastWsMessage instanceof WebsocketCrudMessage) {
            // TODO
            console.log(lastWsMessage)
        } else if (lastWsMessage instanceof WebsocketJobStatusMessage) {
            console.log(lastWsMessage)
            setJobStatusMap((jobStatusMap) => (
                new Map(jobStatusMap).set(lastWsMessage.jobId, lastWsMessage.payload)
            ))
        }
    }, [lastWsMessage])

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
            jobStatusMap,
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