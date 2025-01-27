import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Tooltip } from 'antd'
import { Backdrop, CircularProgress, Input, Snackbar } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { Dialog, showErrorMessage } from '@jupyterlab/apputils'
import { AssignmentSubmitButton } from './assignment-submit-button'
import { PushPolicyViolationMessage } from './push-policy-violation-message'
import {
    submitFormContainerClass, submitRootClass,
    summaryClass,
    activeStyle, disabledStyle
} from './style'
import { useAssignment, useBackdrop, useSnackbar } from '../../../contexts'
import { uploadAssignment as apiUploadAssignment } from '../../../api'

interface AssignmentSubmitFormProps {

}

export const AssignmentSubmitForm = ({ }: AssignmentSubmitFormProps) => {
    const { assignment, course, path, gradedNotebookExists, updateAssignments } = useAssignment()!
    const backdrop = useBackdrop()!
    const snackbar = useSnackbar()!

    const [summaryText, setSummaryText] = useState<string>("")
    const [submitting, setSubmitting] = useState<boolean>(false)

    const masterNotebookIgnoredForManualAssignment = useMemo<boolean>(() => (
        !!assignment && assignment.manualGrading && assignment.ignoredFiles.includes(assignment.masterNotebookPath)
    ), [assignment])

    const disabled = (
        !assignment ||
        submitting ||
        summaryText === "" ||
        !gradedNotebookExists(assignment) ||
        masterNotebookIgnoredForManualAssignment
    )
    const disabledReason = disabled ? (
        !assignment ? undefined :
        submitting ? `Currently uploading assignment` :
        !gradedNotebookExists(assignment) ? "Please select a notebook to use for grading" :
        masterNotebookIgnoredForManualAssignment ? "Please remove the master notebook from your gitignore" :
        summaryText === "" ? `Please enter a summary describing your changes` : undefined
    ) : undefined
    
    const submitAssignment = async () => {
        if (!assignment) {
            console.log("Unknown assignment, can't submit")
            return
        }
        if (!path) {
            // If this component is being rendered, this should never be possible.
            console.log("Unknown cwd, can't submit")
            return
        }
        setSubmitting(true)
        try {
            const submission = await apiUploadAssignment(path, summaryText)
            // Only clear summary if the upload goes through.
            setSummaryText("")

            snackbar.open({
                type: 'success',
                message: 'Successfully uploaded assignment!'
            })
        } catch (e: any) {
            let data = undefined
            try { data = await e.response?.json() }
            catch {}

            if (e.response?.status === 400 && data?.error_code === "NOTEBOOK_GENERATION") {
                showErrorMessage(
                    'Failed to generate student notebook',
                    {
                        message: <pre>{ data.error }</pre>
                    },
                    [Dialog.warnButton({ label: 'Dismiss' })]
                )
            }
            else if (e.response?.status === 409) {
                showErrorMessage(
                    'Push policy violation',
                    {
                        message: (
                            <PushPolicyViolationMessage
                                remoteMessages={ data }
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
        try {
            // In order to immediately update staged changes tacked onto `current_assignment`.
            await updateAssignments()
        } catch (e: any) {}
        setSubmitting(false)
    }
    
    useEffect(() => {
        backdrop.setLoading(submitting)
    }, [submitting])
    
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
                    if (disabled) return
                    // if (e.key === 'Enter') submitAssignment()
                } }
                disabled={ submitting }
                required
                disableUnderline
                fullWidth
            />
            <Tooltip title={ disabledReason }>
                <div>
                    <AssignmentSubmitButton
                        onClick={ submitAssignment }
                        disabled={ disabled }
                        style={{ width: "100%" }}
                    />
                </div>
            </Tooltip>
        </div>
    )
}