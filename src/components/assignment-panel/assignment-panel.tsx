import React, { Fragment, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { CircularProgress } from '@material-ui/core'
import { Popover, Tooltip } from 'antd'
import { ArrowBackSharp, HelpOutlineOutlined, SupervisorAccountOutlined, SyncOutlined } from '@material-ui/icons'
import {
    panelWrapperClass,
    panelHeaderClass,
    capitalizedTitlePopoverOverlayClass
} from './style'
import { AssignmentContent } from './assignment-content'
import { useAssignment, useCommands, useSettings, useSnackbar } from '../../contexts'
import { syncToLMS } from '../../api'
import { IJobStatus } from '../../api/job'
import { JobStatusEnum } from '../../api/api-responses'

interface IAssignmentPanelProps {
}

export const AssignmentPanel = ({}: IAssignmentPanelProps) => {
    const commands = useCommands()!
    const snackbar = useSnackbar()!
    const { repoRoot, documentationUrl } = useSettings()!
    const { course, students, assignment, jobStatuses } = useAssignment()!
    
    const [syncJob, setSyncJob] = useState<IJobStatus|null>(null)

    const syncLoading = useMemo(() => {
        if (!syncJob) return false
        return !syncJob.isComplete
    }, [syncJob])

    const headerName = useMemo<ReactNode>(() => {
        const headerFragments = []
        // if (assignment) headerFragments.push(assignment.name)
        if (course) headerFragments.push(course.name)
        else headerFragments.push('EduHeLx')
        return (
            <Fragment>
                { headerFragments.join(' • ') }
            </Fragment>
        )
    }, [course])

    const doSync = useCallback(async () => {
        try {
            const job = await syncToLMS()
            setSyncJob(job)
        } catch (e: any) {
            snackbar.open({
                type: 'error',
                message: 'Failed to sync with LMS!'
            })
        }
    }, [snackbar])

    const openDocumentation = useCallback(() => {
        if (!documentationUrl) return

        window.open(documentationUrl, "_blank")
    }, [documentationUrl])

    /** On page load, we want to `cd` to the repo root. */
    useEffect(() => {
        // console.log("CDing to repo root", repoRoot)
        commands.execute('filebrowser:go-to-path', {
            path: repoRoot,
            dontShowBrowser: true
        })
    }, [repoRoot])

    useEffect(() => {
        if (syncJob === null) return

        let newestSyncUpdate
        // Iterate from newest to oldest statuses
        for (let i=jobStatuses.length-1; i>=0; i--) {
            const jobStatus = jobStatuses[i]
            if (jobStatus.id === syncJob.id) {
                newestSyncUpdate = jobStatus
                break
            }
        }
        if (newestSyncUpdate && newestSyncUpdate.status !== syncJob.status) {
            // Update the status of the current sync job.
            if (newestSyncUpdate.isComplete) snackbar.open({
                type: 'success',
                message: 'Successfully synced with LMS'
            })
            setSyncJob(newestSyncUpdate)
        }
    }, [syncJob, jobStatuses])
    
    return (
        <div className={ panelWrapperClass }>
            <header className={ panelHeaderClass }>
                { assignment && (
                    <ArrowBackSharp
                        onClick={ () => commands.execute('filebrowser:go-to-path', {
                            path: `${ assignment.absoluteDirectoryPath }/../`,
                            dontShowBrowser: true
                        }) }
                        style={{ marginRight: 8, fontSize: 16, cursor: 'pointer' }}
                    />
                ) }
                { headerName }
                <div style={{ flexGrow: 1 }} />
                { students && (
                    <Popover title={
                        <span>Students</span>
                    } content={
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                           { students.map((student) => (
                            <li key={ student.onyen }>
                                { student.name } ({ student.onyen })
                            </li>
                           )) } 
                        </ul>
                    } overlayClassName={ capitalizedTitlePopoverOverlayClass }>
                        <div style={{ display: "flex", alignItems: "center" }}>
                            { students.length } <SupervisorAccountOutlined style={{ fontSize: 20, marginLeft: 4 }} />
                        </div>
                    </Popover>
                ) }
                { students && (
                    <Tooltip title={ !syncLoading ? "Immediately sync with LMS" : "Syncing..." }>
                        <div
                            style={{ display: "flex", alignItems: "center", marginLeft: 8, cursor: !syncLoading ? "pointer" : "default" }}
                            onClick={ !syncLoading ? doSync : undefined }
                        >
                            { !syncLoading ? (
                                <SyncOutlined style={{ fontSize: 20 }} />
                            ) : (
                                <div style={{ width: 20, height: 20, display: "flex", justifyContent: "center", alignItems: "center" }}>
                                    <CircularProgress color="inherit" size={ 16 } />
                                </div>
                            ) }
                        </div>
                    </Tooltip>
                ) }
                { students && documentationUrl && (
                    <Tooltip title="Open user documentation">
                        <div
                            style={{ display: "flex", alignItems: "center", marginLeft: 8, cursor: "pointer" }}
                            onClick={ openDocumentation }
                        >
                            <HelpOutlineOutlined style={{ fontSize: 20 }} />
                        </div>
                    </Tooltip>
                ) }
            </header>
            <AssignmentContent />
        </div>
    )
}