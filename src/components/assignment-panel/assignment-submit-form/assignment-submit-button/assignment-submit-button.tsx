import React, { ButtonHTMLAttributes, Fragment } from 'react'
import { GroupSharp, SyncSharp } from '@material-ui/icons'
import { assignmentSubmitButton } from './style'
import { useAssignment } from '../../../../contexts'
import { classes } from 'typestyle'
import { disabledButtonClass } from '../../../style'

interface AssignmentSubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    onClick: (e: any) => void
}

export const AssignmentSubmitButton = ({ onClick, children=null, disabled=false, ...props }: AssignmentSubmitButtonProps) => {
    return (
        <button
            className={ classes(assignmentSubmitButton, disabled && disabledButtonClass) }
            onClick={ onClick }
            disabled={ disabled }
            { ...props }
        >
            { children ?? (
                <Fragment>
                    <GroupSharp style={{ fontSize: 22, marginRight: 8 }} />Push Instructor Changes
                </Fragment>
            ) }
        </button>
    )
}