import qs from 'qs'
import p from 'path'
import { ServerConnection } from '@jupyterlab/services'
import { requestAPI } from '../handler'
import { IAssignment, Assignment, ICurrentAssignment } from './assignment'
import { IStudent, Student } from './student'
import { ISubmission, Submission } from './submission'
import { ICourse, Course } from './course'
import { IServerSettings, ServerSettings } from './server-settings'
import {
    AssignmentResponse,
    CourseResponse,
    StudentResponse,
    SubmissionResponse,
    ServerSettingsResponse,
    InstructorResponse,
    JobStatusResponse,
    JobResultResponse,
} from './api-responses'
import { IInstructor, Instructor } from './instructor'
import { IStagedChange } from './staged-change'
import { IJobResult, IJobStatus, JobResult, JobStatus } from './job'

export interface UpdateAssignmentData {
    name?: string | null,
    directory_path?: string | null,
    master_notebook_path?: string,
    manual_grading?: boolean
    available_date?: string | null,
    due_date?: string | null,
}

export interface GetAssignmentsResponse {
    assignments: IAssignment[] | null
    currentAssignment: ICurrentAssignment | null
}

export interface GetInstructorAndStudentsAndCourseResponse {
    instructor: IInstructor
    students: IStudent[]
    course: ICourse
}

export interface NotebookFilesResponse {
    notebooks: { [assignmentId: string]: string[] }
}

export async function restoreFile(stagedChange: IStagedChange, requestOptions: RequestInit={}): Promise<void> {
    await requestAPI<void>(`/restore_file`, {
        method: 'PUT',
        body: JSON.stringify({
            path_from_repo_root: stagedChange.pathFromRepositoryRoot
        }),
        ...requestOptions
    })
}

export async function listNotebookFiles(requestOptions: RequestInit={}): Promise<NotebookFilesResponse> {
    const data = await requestAPI<NotebookFilesResponse>(`/notebook_files`, {
        method: 'GET',
        ...requestOptions
    })
    return data
}

export async function getInstructorAndStudentsAndCourse(
    requestOptions: RequestInit={}
): Promise<GetInstructorAndStudentsAndCourseResponse> {
    const { instructor, students, course } = await requestAPI<{
        instructor: InstructorResponse
        students: StudentResponse[]
        course: CourseResponse
    }>(`/course_instructor_students`, {
        method: 'GET',
        ...requestOptions
    })
    return {
        instructor: Instructor.fromResponse(instructor),
        students: students.map((student) => Student.fromResponse(student)),
        course: Course.fromResponse(course)
    }
}


export async function getAssignments(path: string, requestOptions: RequestInit={}): Promise<GetAssignmentsResponse> {
    const queryString = qs.stringify({ path })
    const { assignments, current_assignment } = await requestAPI<{
        assignments: AssignmentResponse[] | null
        current_assignment: AssignmentResponse | null
    }>(`/assignments?${ queryString }`, {
        method: 'GET',
        ...requestOptions
    })
    return {
        assignments: assignments ? assignments.map((data) => Assignment.fromResponse(data)) : null,
        currentAssignment: current_assignment ? Assignment.fromResponse(current_assignment) as ICurrentAssignment : null
    }
}

export async function updateAssignment(
    assignmentName: string,
    data: UpdateAssignmentData,
    requestOptions: RequestInit={}
): Promise<void> {
    const queryString = qs.stringify({ name: assignmentName })
    await requestAPI<void>(`/assignments?${ queryString }`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        ...requestOptions
    })
}

export async function gradeAssignment(currentPath: string, requestOptions: RequestInit={}): Promise<void> {
    await requestAPI<void>(`/grade_assignment`, {
        method: 'POST',
        body: JSON.stringify({
            current_path: currentPath
        }),
        ...requestOptions
    })
}

export async function getServerSettings(requestOptions: RequestInit={}): Promise<IServerSettings> {
    try {
        const data = await requestAPI<ServerSettingsResponse>('/settings', {
            method: 'GET',
            ...requestOptions
        })
        return ServerSettings.fromResponse(data)
    } catch (e) {
        if (e instanceof ServerConnection.ResponseError) {
            const response = e.response;
            if (response.status === 404) {
                const message =
                    'EduHeLx Submission server extension is unavailable. Please ensure you have installed the ' +
                    'JupyterLab EduHeLx Submission server extension by running: pip install --upgrade eduhelx_jupyterlab_prof. ' +
                    'To confirm that the server extension is installed, run: jupyter server extension list.'
                throw new ServerConnection.ResponseError(response, message);
            } else {
                const message = e.message;
                console.error('Failed to get the server extension settings', message);
                throw new ServerConnection.ResponseError(response, message);
            }
        } else {
            throw e;
        }
    }
}

export async function uploadAssignment(
    currentPath: string,
    summary: string,
    requestOptions: RequestInit={}
): Promise<void> {
    const res = await requestAPI<void>(`/submit_assignment`, {
        method: 'POST',
        body: JSON.stringify({
            summary,
            current_path: currentPath
        }),
        ...requestOptions
    })
}

export async function getLMSSyncStatus(requestOptions: RequestInit={}): Promise<IJobStatus | null> {
    const data = await requestAPI<JobStatusResponse>(`/sync_to_lms`, {
        method: 'GET',
        ...requestOptions
    })
    return data !== null ? JobStatus.fromResponse(data) : null
}

export async function syncToLMS(requestOptions: RequestInit={}): Promise<IJobStatus> {
    const data = await requestAPI<JobStatusResponse>(`/sync_to_lms`, {
        method: 'POST',
        ...requestOptions
    })
    return JobStatus.fromResponse(data)
}

export async function createFile(path: string, content: string, requestOptions: RequestInit={}): Promise<void> {
    const directoryPath = p.dirname(path)
    const ext = p.extname(path)
    // Create a new file
    const { name } = await requestAPI<any>(`/api/contents/${ directoryPath }`, {
        method: 'POST',
        body: JSON.stringify({
            type: "file",
            directoryPath
        }),
        ...requestOptions
    }, true)
    // Rename the file
    await requestAPI(`/api/contents/${ directoryPath }/${ name }`, {
        method: 'PATCH',
        body: JSON.stringify({
            path
        }),
        ...requestOptions
    }, true)
    // Set the file's contents
    await requestAPI(`/api/contents/${ path }`, {
        method: 'PUT',
        body: JSON.stringify({
            format: "text",
            type: "file",
            path,
            content
        }),
        ...requestOptions
    }, true)

}

export async function createStudentNotebook(assignmentId: number, requestOptions: RequestInit={}): Promise<void> {
    await requestAPI<void>(`/create_student_notebook`, {
        method: 'POST',
        body: JSON.stringify({
            assignment_id: assignmentId
        }),
        ...requestOptions
    })
}

export async function getJobStatus(jobId: string, requestOptions: RequestInit={}): Promise<IJobStatus> {
    const data = await requestAPI<JobStatusResponse>(`/job_status`, {
        method: 'POST',
        ...requestOptions
    })
    return JobStatus.fromResponse(data)
}

export async function getJobResult(jobId: string, requestOptions: RequestInit={}): Promise<IJobResult> {
    const data = await requestAPI<JobResultResponse>(`/job_result`, {
        method: 'POST',
        ...requestOptions
    })
    return JobResult.fromResponse(data)
}
