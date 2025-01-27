import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Progress, Tooltip } from 'antd'
import { classes } from 'typestyle'
import { CircularProgress } from '@material-ui/core'
import { ClearOutlined, PlayArrowOutlined } from '@material-ui/icons'
import { assignmentSubmissionInfoClass } from './style'
import { tagClass } from '../assignment-info/style'
import { assignmentSubmitButton } from '../assignment-submit-form/assignment-submit-button/style'
import { TextDivider } from '../../text-divider'
import { disabledButtonClass } from '../../style'
import { useAssignment, useSnackbar } from '../../../contexts'
import { gradeAssignment, IStudent, ISubmission } from '../../../api'
import { AssignmentStatus } from '../../../api/api-responses'

interface SubmissionLegendProps {
    graded: string[]
    submitted: string[]
    unsubmitted: string[]
    
    // Subset of graded in which the student has been given a grade for an old submission
    // but has since resubmitted (stale grade).
    // This is independent of graded/submitted/unsubmitted
    resubmitted: string[]
}

interface AssignmentSubmissionInfoProps {

}

// eslint-disable-next-line
const Circle = ({ size=8, color, style={}, ...props }: { size?: number, color: string } & React.HTMLProps<HTMLDivElement>) => {
    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            ...style
        }} { ...props } />
    )
}

// eslint-disable-next-line
const LegendItem = ({ label, value, color, style={}, ...props }: { label: React.ReactNode, value: React.ReactNode, color: string } & React.HTMLProps<HTMLDivElement>) => {
    return (
        <div style={{ display: "flex", alignItems: "center", ...style }} { ...props }>
            <Circle color={ color } style={{ marginRight: 4 }} />
            { label }&nbsp;
            <span style={{ color: "var(--jp-ui-font-color2)" }}>{ value }</span>
        </div>
    )
}

const SubmissionLegend = ({ graded, submitted, unsubmitted, resubmitted }: SubmissionLegendProps) => {
    const gradedTitle = useMemo<string>(() => {
        return graded.map((onyen) => `${ onyen }${ resubmitted.includes(onyen) ? " (stale)" : "" }`).join(", ")
    }, [graded, resubmitted])
    
    return (
        <div>
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 8, fontSize: 13, marginTop: 2, marginBottom: 4 }}>
                <Tooltip title={ gradedTitle }>
                    <LegendItem label="Graded" value={ `${ graded.length }${ resubmitted.length > 0 ? "*" : ""}` } color="var(--md-green-500)" />
                </Tooltip>
                <Tooltip title={ submitted.join(", ") }>
                    <LegendItem label="Submitted" value={ submitted.length } color="var(--md-yellow-500)" />
                </Tooltip>
                <Tooltip title={ unsubmitted.join(", ") }>
                    <LegendItem label="Unsubmitted" value={ unsubmitted.length } color="var(--md-red-500)" />
                </Tooltip>
            </div>
            { resubmitted.length > 0 && (
                <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--jp-ui-font-color2)" }}>
                    *{ resubmitted.length } submission{ resubmitted.length > 1 ? "s are" : " is" } graded but out of date
                </div>
            ) }
        </div>
    )
}

export const AssignmentSubmissionInfo = ({ }: AssignmentSubmissionInfoProps) => {
    const { assignment, students, path, gradedNotebookExists } = useAssignment()!
    const snackbar = useSnackbar()!

    const [gradingActive, setGradingActive] = useState<boolean>(false)

    const [graded, submitted, unsubmitted, resubmitted, total] = useMemo(() => {
        if (!assignment || !students) return [[], [], [], [], 0]
        const graded: string[] = []
        const submitted: string[] = []
        const unsubmitted: string[] = []
        const resubmitted: string[] = []

        Object.keys(assignment.studentSubmissions).forEach((onyen) => {
            const submissions = assignment.studentSubmissions[onyen]

            // If they student has no submissions, they are unsubmitted.
            if (submissions.length === 0) unsubmitted.push(onyen)
            else {
                const activeSubmission = submissions.find((s) => s.active)!
                const hasGradedSubmission = submissions.some((s) => s.graded)

                // The student's active submission is graded.
                if (activeSubmission.graded) graded.push(onyen)
                else {
                    // The student has submitted but their active submission is not graded. Possibly none are graded.
                    if (hasGradedSubmission) {
                        // The student already has a graded submission but it isn't their active submission
                        graded.push(onyen)
                        resubmitted.push(onyen)
                    } else {
                        submitted.push(onyen)
                    }
                }
            }
        })
        return [graded, submitted, unsubmitted, resubmitted, graded.length + submitted.length + unsubmitted.length]
    }, [assignment?.studentSubmissions, students])

    const gradingDisabledReason = useMemo<string|undefined>(() => (
        gradingActive ? undefined :
        !gradedNotebookExists(assignment!) ? "Please select a notebook to use for grading" :
        (graded.length === 0 && submitted.length === 0) ? "There's nothing to grade right now" :
        undefined
    ), [gradingActive, graded, submitted, assignment, gradedNotebookExists])

    const grade = useCallback(async () => {
        if (path === null) return
        setGradingActive(true)
        try {
            await gradeAssignment(path)
        } catch (e: any) {
            snackbar.open({
                type: "error",
                message: "Failed to grade assignments!"
            })
        } finally {
            setGradingActive(false)
        }
    }, [path, snackbar])

    const abort = useCallback(async () => {
        setGradingActive(false)
    }, [])

    if (assignment?.status === AssignmentStatus.UNPUBLISHED || assignment?.status === AssignmentStatus.UPCOMING) return (
        <div className={ assignmentSubmissionInfoClass } style={{ marginBottom: 8 }}>
            <TextDivider innerStyle={{ fontSize: 16 }} style={{ marginBottom: 8 }}>Submissions</TextDivider>
            The assignment is not open to submissions yet.
        </div>
    )
    return (
        <div className={ assignmentSubmissionInfoClass }>
            <TextDivider innerStyle={{ fontSize: 16 }} style={{ marginBottom: 8 }}>Submissions</TextDivider>
            <Progress
                percent={ ( graded.length + submitted.length ) / total * 100 }
                strokeColor="var(--md-yellow-500)"
                success={{ percent: graded.length / total * 100, strokeColor: "var(--md-green-500)" }}
                trailColor='var(--md-red-500)'
                showInfo={ false }
                size={ ["100%", 8] }
            />
            <SubmissionLegend graded={ graded } submitted={ submitted } unsubmitted={ unsubmitted } resubmitted={ resubmitted } />
            <Tooltip
                title={ gradingDisabledReason }
                placement="bottom"
            >
                <button
                    className={ classes(assignmentSubmitButton, gradingDisabledReason && disabledButtonClass) }
                    style={{
                        marginTop: 16,
                        height: 28,
                        backgroundColor: gradingActive || gradingDisabledReason ? 'var(--jp-layout-color3)' : undefined
                    }}
                    disabled={ gradingDisabledReason !== undefined }
                    onClick={ !gradingActive ? grade : abort }
                >
                    { gradingActive ? (
                        <CircularProgress size={ 12 } style={{ color: "white", marginRight: 8 }} />
                    ) : (
                        <PlayArrowOutlined style={{ fontSize: 20 }} />
                    ) }
                    &nbsp;
                    { gradingActive
                        ? `Cancel`
                        : `${ submitted.length === 0 && graded.length > 0 ? "Regrade" : "Grade" } and Upload Submissions` }
                </button>
            </Tooltip>
            
        </div>
    )
}