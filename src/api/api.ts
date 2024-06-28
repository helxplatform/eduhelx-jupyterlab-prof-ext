import qs from 'qs'
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
} from './api-responses'
import { IInstructor, Instructor } from './instructor'

export interface UpdateAssignmentData {
    new_name?: string,
    directory_path?: string,
    master_notebook_path?: string,
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

export async function listNotebookFiles(): Promise<NotebookFilesResponse> {
    const data = await requestAPI<NotebookFilesResponse>(`/notebook_files`, {
        method: 'GET'
    })
    return data
}

export async function getInstructorAndStudentsAndCourse(): Promise<GetInstructorAndStudentsAndCourseResponse> {
    const { instructor, students, course } = await requestAPI<{
        instructor: InstructorResponse
        students: StudentResponse[]
        course: CourseResponse
    }>(`/course_instructor_students`, {
        method: 'GET'
    })
    return {
        instructor: Instructor.fromResponse(instructor),
        students: students.map((student) => Student.fromResponse(student)),
        course: Course.fromResponse(course)
    }
}


export async function getAssignments(path: string): Promise<GetAssignmentsResponse> {
    const queryString = qs.stringify({ path })
    const { assignments, current_assignment } = await requestAPI<{
        assignments: AssignmentResponse[] | null
        current_assignment: AssignmentResponse | null
    }>(`/assignments?${ queryString }`, {
        method: 'GET'
    })
    return {
        assignments: assignments ? assignments.map((data) => Assignment.fromResponse(data)) : null,
        currentAssignment: current_assignment ? Assignment.fromResponse(current_assignment) as ICurrentAssignment : null
    }
}

export async function updateAssignment(assignmentName: string, data: UpdateAssignmentData): Promise<void> {
    const queryString = qs.stringify({ name: assignmentName })
    await requestAPI<void>(`/assignments?${ queryString }`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
}

export async function gradeAssignment(currentPath: string): Promise<void> {
    await requestAPI<void>(`/grade_assignment`, {
        method: 'POST',
        body: JSON.stringify({
            current_path: currentPath
        })
    })
}

export async function getServerSettings(): Promise<IServerSettings> {
    try {
        const data = await requestAPI<ServerSettingsResponse>('/settings', {
            method: 'GET'
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
    summary: string
): Promise<void> {
    const res = await requestAPI<void>(`/submit_assignment`, {
        method: 'POST',
        body: JSON.stringify({
            summary,
            current_path: currentPath
        })
    })
}

export async function syncToLMS(): Promise<void> {
    await requestAPI<void>(`/sync_to_lms`, {
        method: 'POST'
    })
}