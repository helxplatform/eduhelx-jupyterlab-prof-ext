import React, { Fragment, useEffect, useState } from 'react'
import { CircularProgress, Divider } from '@material-ui/core'
import { assignmentContainerClass, containerClass, loadingContainerClass } from './style'
import { NoAssignmentWarning } from '../no-assignment-warning'
import { AssignmentInfo } from '../assignment-info'
import { AssignmentSubmitForm } from '../assignment-submit-form'
import { AssignmentStagedChanges } from '../assignment-staged-changes'
import { AssignmentSubmissionInfo } from '../assignment-submission-info'
import { useAssignment } from '../../../contexts'
import { Tabs } from '../../tabs'

export const AssignmentContent = () => {
    const { loading, path, assignment, instructor, assignments } = useAssignment()!
    
    return (
        <div className={ containerClass }>
            {
                loading ? (
                    <div className={ loadingContainerClass }>
                        <CircularProgress color="inherit" />
                    </div>
                ) : assignments === null || assignment === null ? (
                    <NoAssignmentWarning noRepository={ assignments === null } />
                ) : (
                    <div className={ assignmentContainerClass }>
                        <AssignmentInfo />
                        <AssignmentSubmissionInfo />
                        <AssignmentStagedChanges style={{ marginTop: 16 }} />
                        <AssignmentSubmitForm />
                    </div>
                )
            }
        </div>
    )
}