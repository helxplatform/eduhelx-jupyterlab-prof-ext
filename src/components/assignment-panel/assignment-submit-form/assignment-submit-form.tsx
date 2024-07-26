import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Tooltip } from 'antd'
import { Backdrop, CircularProgress, Input, Snackbar } from '@material-ui/core'
import { PublishSharp, SyncSharp } from '@material-ui/icons'
import { Alert } from '@material-ui/lab'
import { Dialog, showErrorMessage } from '@jupyterlab/apputils'
import { AssignmentSubmitButton } from './assignment-submit-button'
import { PushPolicyViolationMessage } from './push-policy-violation-message'
import {
    submitFormContainerClass, submitRootClass,
    summaryClass,
    activeStyle, disabledStyle
} from './style'
import { InfoTooltip } from '../../info-tooltip'
import { useAssignment, useBackdrop, useSnackbar } from '../../../contexts'
import { uploadAssignment as apiUploadAssignment } from '../../../api'

interface AssignmentSubmitFormProps {

}

export const AssignmentSubmitForm = ({ }: AssignmentSubmitFormProps) => {
    const { assignment, course, path, gradedNotebookExists } = useAssignment()!
    const backdrop = useBackdrop()!
    const snackbar = useSnackbar()!

    const [summaryText, setSummaryText] = useState<string>("")
    const [pushing, setPushing] = useState<boolean>(false)
    const [publishing, setPublishing] = useState<boolean>(false)

    const pushDisabled = !assignment || pushing || publishing || summaryText === "" || !gradedNotebookExists(assignment)
    const pushDisabledReason = pushDisabled ? (
        !assignment ? undefined :
        pushing ? `Currently uploading changes` :
        publishing ? `Currently publishing assignment` :
        !gradedNotebookExists(assignment) ? "Please select a notebook to use for grading" :
        summaryText === "" ? `Please enter a summary describing your changes` : undefined
    ) : undefined

    const publishDisabled = !assignment || pushing || publishing || !gradedNotebookExists(assignment)
    const publishDisabledReason = publishDisabled ? (
        !assignment ? undefined :
        pushing ? `Currently uploading changes` :
        publishing ? `Currently publishing assignment` :
        !gradedNotebookExists(assignment) ? "Please select a notebook to use for grading" : undefined
    ) : undefined
    
    const pushAssignment = async () => {
        if (!assignment) {
            console.log("Unknown assignment, can't submit")
            return
        }
        if (!path) {
            // If this component is being rendered, this should never be possible.
            console.log("Unknown cwd, can't submit")
            return
        }
        setPushing(true)
        try {
            const submission = await apiUploadAssignment(path, summaryText)
            // Only clear summary if the upload goes through.
            setSummaryText("")

            snackbar.open({
                type: 'success',
                message: 'Successfully uploaded assignment!'
            })
        } catch (e: any) {
            if (e.response?.status === 409) {
                showErrorMessage(
                    'Push policy violation',
                    {
                        message: (
                            <PushPolicyViolationMessage
                                remoteMessages={ await e.response.json() }
                                assignmentPath={ assignment!.directoryPath }
                            />
                        )
                    },
                    [Dialog.warnButton({ label: 'Dismiss' })]
                )
            } else snackbar.open({
                type: 'error',
                message: 'Failed to upload changes!'
            })
        }
        setPushing(false)
    }

    const publishAssignment = async () => {
        if (!assignment) {
            console.log("Unknown assignment, can't publish")
            return
        }
        if (!path) {
            console.log("Unknown cwd, can't publish")
            return
        }
        setPublishing(true)
        
        setPublishing(false)
    }
    
    useEffect(() => {
        backdrop.setLoading(pushing)
    }, [pushing])

    useEffect(() => {
        backdrop.setLoading(publishing)
    }, [publishing])
    
    return (
        <div className={ submitFormContainerClass }>
            <Input
                className={ summaryClass }
                classes={{
                    root: submitRootClass,
                    focused: activeStyle,
                    disabled: disabledStyle
                }}
                placeholder="*Summary"
                title="Enter a summary for the assignment changes"
                multiline
                minRows={ 1 }
                value={ summaryText }
                onChange={ (e) => setSummaryText(e.target.value) }
                onKeyDown={ (e) => {
                    if (pushDisabled) return
                    // if (e.key === 'Enter') submitAssignment()
                } }
                disabled={ pushing }
                required
                disableUnderline
                fullWidth
            />
            <div style={{ display: "flex", gap: 4 }}>
                <div style={{ flexGrow: 1 }}>
                    <Tooltip title={ pushDisabledReason }>
                        <div>
                            <AssignmentSubmitButton
                                onClick={ pushAssignment }
                                disabled={ pushDisabled }
                                style={{ width: "100%" }}
                            />
                        </div>
                    </Tooltip>
                </div>
                <Tooltip
                    title={ publishDisabled ? publishDisabledReason : "Publish to students" }
                >
                    <div>
                        <AssignmentSubmitButton
                            onClick={ publishAssignment }
                            disabled={ publishDisabled }
                        >
                            <PublishSharp style={{ fontSize: 22, marginRight: 4 }} />Publish
                        </AssignmentSubmitButton>
                    </div>
                </Tooltip>
            </div>
        </div>
    )
}