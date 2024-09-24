import React, { Fragment, useMemo, useState } from 'react'
import {
    Avatar, List, ListItem, ListItemAvatar as _ListItemAvatar, ListItemText,
    ExpansionPanel, ExpansionPanelSummary, ExpansionPanelDetails
} from '@material-ui/core'
import { OpenInNewSharp, QueryBuilderOutlined, ExpandMoreSharp } from '@material-ui/icons'
import { classes } from 'typestyle'
import { assignmentBucketContainerClass, assignmentListHeaderClass, assignmentListItemClass, assignmentsListClass, downloadAssignmentButtonClass } from './style'
import { TextDivider } from '../../text-divider'
import { useAssignment, useCommands } from '../../../contexts'
import type { IAssignment } from '../../../api'
import { DateFormat } from '../../../utils'
import { disabledButtonClass } from '../../style'

const ListItemAvatar = _ListItemAvatar as any

interface ListHeaderProps extends React.HTMLProps<HTMLSpanElement> {
    titleText: string
}

interface AssignmentListItemProps {
    assignment: IAssignment
}

interface AssignmentsBucketProps {
    title: string
    titleProps?: React.HTMLProps<HTMLSpanElement>
    assignments?: IAssignment[]
    emptyText?: string
    defaultExpanded?: boolean
}

const ListHeader = ({ titleText, ...props }: ListHeaderProps) => {
    return (
        <span className={ assignmentListHeaderClass } { ...props }>
            { titleText }
        </span>
    )
}

const AssignmentListItem = ({ assignment }: AssignmentListItemProps) => {
    const commands = useCommands()!
    return (
        <ListItem
            key={ assignment.id }
            className={ assignmentListItemClass }
            dense
            style={{
                padding: '4px 8px'
            }}
        >
            <ListItemText disableTypography>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                    { assignment.name }
                </div>
                <div style={{ fontSize: 13, color: 'var(--jp-ui-font-color2' }}>
                    {
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div
                                title={ assignment.availableDate
                                    ? new DateFormat(assignment.availableDate).toBasicDatetime()
                                    : ""
                                }
                            >
                                { assignment.availableDate ? (
                                    `Opens ${ new DateFormat(assignment.availableDate).toNumberDatetime() }`
                                ) : (
                                    `No open date`
                                ) }
                            </div>
                            <div
                                title={ assignment.dueDate
                                    ? new DateFormat(assignment.dueDate).toBasicDatetime()
                                    : ""
                                }
                                style={{ marginTop: 4 }}
                            >
                                { assignment.dueDate ? (
                                    `Due ${ new DateFormat(assignment.dueDate!).toNumberDatetime() }`
                                ) : (
                                    `No close date`
                                ) }
                            </div>
                            { assignment.availableDate && assignment.dueDate && (
                                <div
                                    title={ `Due ${ new DateFormat(assignment.dueDate!).toBasicDatetime() }` }
                                    style={{ marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center' }}
                                >
                                    <QueryBuilderOutlined style={{ fontSize: 16 }} />
                                    &nbsp;Lasts { new DateFormat(assignment.dueDate!).toRelativeDatetime(assignment.availableDate!) }
                                </div>
                            ) }
                        </div>
                    }
                </div>
            </ListItemText>
            <ListItemAvatar style={{ minWidth: 0, marginLeft: 16 }}>
                <Avatar variant="square">
                    <button
                        className={ downloadAssignmentButtonClass }
                        onClick={ () => commands.execute('filebrowser:go-to-path', {
                            path: assignment.absoluteDirectoryPath,
                            dontShowBrowser: true
                        }) }
                    >
                        <OpenInNewSharp />
                    </button>
                </Avatar>
            </ListItemAvatar>
        </ListItem>
    )
}

const AssignmentsBucket = ({
    title,
    titleProps={},
    assignments,
    emptyText="There are currently no assignments to work on.",
    defaultExpanded=false,
}: AssignmentsBucketProps) => {
    const [expanded, setExpanded] = useState<boolean>(defaultExpanded)

    const assignmentsSource = useMemo(() => assignments?.sort((a, b) => {
        const aDue = a.dueDate?.getTime() ?? Infinity
        const bDue = b.dueDate?.getTime() ?? Infinity
        // Sort by date, or name if same date.
        if (aDue > bDue) return 1
        if (aDue < bDue) return -1
        return a.name.localeCompare(b.name, undefined, { numeric: true })
    }), [assignments])

    const isEmpty = useMemo(() => !assignmentsSource || assignmentsSource.length === 0, [assignmentsSource])

    return (
        <ExpansionPanel
            className={ assignmentBucketContainerClass }
            square
            expanded={ expanded }
            onChange={ () => setExpanded(!expanded) }
        >
            <ExpansionPanelSummary
                expandIcon={ <ExpandMoreSharp /> }
                style={{ paddingLeft: 11 }}
            >
                <ListHeader { ...titleProps } titleText={ title } />
            </ExpansionPanelSummary>
            <ExpansionPanelDetails
                style={{ display: 'flex', flexDirection: 'column', paddingTop: 0, paddingLeft: 11, paddingRight: 11 }}
            >
                { !isEmpty ? (
                    assignmentsSource?.map((assignment) => (
                        <AssignmentListItem key={ assignment.id } assignment={ assignment } />
                    ))
                ) : (
                    <span style={{ color: 'var(--jp-ui-font-color1)', paddingLeft: 8 }}>
                        { emptyText }
                    </span>
                ) }
            </ExpansionPanelDetails>
        </ExpansionPanel>
    )
}

export const AssignmentsList = () => {
    const { assignments } = useAssignment()!

    const publishedAssignments = useMemo(() => assignments?.filter((assignment) => assignment.isPublished), [assignments])
    const unpublishedAssignments = useMemo(() => assignments?.filter((assignment) => !assignment.isPublished), [assignments])
    
    return (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: 'calc(100% + 22px)' }}>
            <div className={ assignmentsListClass }>
                <AssignmentsBucket
                    title={ `Published${ publishedAssignments ? " (" + publishedAssignments.length + ")" : "" }` }
                    assignments={ publishedAssignments }
                    emptyText="There are not any published assignments currently."
                    defaultExpanded={ true }
                />
                <AssignmentsBucket
                    title={ `Unpublished${ unpublishedAssignments ? " (" + unpublishedAssignments.length + ")" : "" }` }
                    titleProps={{ title: "An assignment is considered published once it has an open and close date." }}
                    assignments={ unpublishedAssignments }
                    emptyText="There are not any unpublished assignments currently."
                    defaultExpanded={ true }
                />
            </div>
        </div>
    )
}