import React, { ChangeEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from 'antd'
import moment from 'moment'
import classNames from 'classnames'
import { Dialog, showErrorMessage } from '@jupyterlab/apputils'
import { TextField, MenuItem, Checkbox, Select, FormHelperText, CircularProgress } from '@material-ui/core'
import { ArrowBackSharp } from '@material-ui/icons'
import { useDebouncedCallback } from 'use-debounce'
import { assignmentInfoClass, assignmentInfoSectionClass, assignmentInfoSectionHeaderClass, assignmentInfoSectionWarningClass, assignmentNameClass, tagClass } from './style'
import { InfoTooltip } from '../../info-tooltip'
import { disabledButtonClass } from '../../style'
import { useAssignment, useCommands, useSnackbar } from '../../../contexts'
import { addLocalTimezone, getLocalTimezoneAbbr } from '../../../utils'
import { createFile, updateAssignment, createStudentNotebook as apiCreateStudentNotebook } from '../../../api'
import { openFileBrowserButtonClass } from '../no-assignment-warning/style'
import { AssignmentStatus } from '../../../api/api-responses'

const MS_IN_HOURS = 3.6e6

interface AssignmentInfoProps {
}

const formatDateToMui = (date: Date | null | undefined): string => {
    if (date === null || date === undefined) return ""
    return moment(date).utcOffset(-new Date().getTimezoneOffset()).format("YYYY-MM-DDTHH:mm")
}

const formatMuiToDate = (date: string): Date | null => {
    if (date === "") return null
    return new Date(date)
}

export const AssignmentInfo = ({  }: AssignmentInfoProps) => {
    const { assignment, instructor, course, notebookFiles, gradedNotebookExists } = useAssignment()!
    const commands = useCommands()
    const snackbar = useSnackbar()!
    // We need the raw undebounced value so that other parts of the UI can respond immediately to the expected value
    const [availableDateControlled, setAvailableDateControlled] = useState<string|undefined>(formatDateToMui(assignment?.availableDate))
    const [dueDateControlled, setDueDateControlled] = useState<string|undefined>(formatDateToMui(assignment?.dueDate))
    const [manualGradingControlled, setManualGradingControlled] = useState<boolean|undefined>(assignment?.manualGrading)
    const [gradedNotebookControlled, setGradedNotebookControlled] = useState<string|undefined>(assignment?.masterNotebookPath)
    const [creatingTemplateNotebook, setCreatingTemplateNotebook] = useState<boolean>(false)
    const [creatingStudentNotebook, setCreatingStudentNotebook] = useState<boolean>(false)

    if (!instructor || !assignment || !course || !notebookFiles) return null

    const multipleInstructors = useMemo(() => course.instructors.length > 1, [course])

    const hoursUntilDue = useMemo(() => (
        assignment.dueDate ? (
            (assignment.dueDate!.getTime() - Date.now()) / MS_IN_HOURS
        ) : Infinity
    ), [assignment])

    const masterNotebookTooltipContent = useMemo(() => {
        return (
            <div>
                { assignment.manualGrading ? (
                    "This notebook contains the questions for students to answer."
                ) : (
                    "This notebook contains the solutions and test cases used for autograding."
                ) }
            </div>
        )
    }, [assignment])

    const assignmentReleasedTag = useMemo(() => {
        let color = undefined
        let backgroundColor = undefined
        let borderColor = undefined
        let text = undefined
        let tooltip = undefined
        let filled = false
        if (assignment.isPublished) {
            color = "white"
            backgroundColor = "#1890ff"
            text = "Published"
            tooltip = `You can unpublish this assignment in Canvas`
            filled = true
        } else {
            color = "rgba(0, 0, 0, 0.88)"
            backgroundColor = "#fafafa"
            borderColor = "#d9d9d9"
            text = "Unpublished"
            tooltip = `You can publish this assignment in Canvas`
            filled = true
        }
        return (
            <Tooltip title={ tooltip }>
                <span
                    className={ tagClass }
                    style={{
                        marginTop: 8,
                        color,
                        backgroundColor: filled ? backgroundColor: "transparent",
                        border: `1px solid ${ borderColor ?? backgroundColor }`,
                        textTransform: "capitalize"
                    }}
                >
                    { text }
                </span>
            </Tooltip>
        )
    }, [assignment.isPublished])

    const assignmentStatusTag = useMemo(() => {
        let color = undefined
        let backgroundColor = undefined
        let borderColor = undefined
        let text = undefined
        let tooltip = undefined
        let filled = false
        switch (assignment.status) {
            // We don't actually show this tag if the assignment is unpublished.
            case AssignmentStatus.UNPUBLISHED:
            case AssignmentStatus.UPCOMING: {
                color = "rgba(0, 0, 0, 0.88)"
                backgroundColor = "#fafafa"
                borderColor = "#d9d9d9"
                text = "Upcoming"
                tooltip = "The assignment has not opened yet for students"
                break
            }
            case AssignmentStatus.OPEN: {
                color = "rgba(0, 0, 0, 0.88)"
                backgroundColor = "#fafafa"
                borderColor = "#d9d9d9"
                text = "Open"
                tooltip = "The assignment is currently open for students to work on"
                break
            }
            case AssignmentStatus.CLOSED: {
                color = "var(--jp-error-color1)"
                backgroundColor = "var(--jp-error-color1)"
                text = "Closed"
                tooltip = "The assignment has closed for students"
                filled = false
                break
            }
        }
        return (
            <Tooltip title={ tooltip }>
                <span
                    className={ tagClass }
                    style={{
                        marginTop: 8,
                        marginLeft: 8,
                        color,
                        backgroundColor: filled ? backgroundColor: "transparent",
                        border: `1px solid ${ borderColor ?? backgroundColor }`,
                        textTransform: "capitalize"
                    }}
                >
                    { text }
                </span>
            </Tooltip>
        )
    }, [course, assignment])

    const showCreateGradedNotebookButton = useMemo(() => notebookFiles[assignment.id].length === 0, [notebookFiles])
    
    const gradedNotebookInvalid = useMemo(() => (
        !gradedNotebookExists(assignment, gradedNotebookControlled)
    ), [gradedNotebookExists, assignment, gradedNotebookControlled])

    const studentNotebookInvalid = useMemo(() => (
        !gradedNotebookExists(assignment, assignment.studentNotebookPath)
    ), [gradedNotebookExists, assignment])

    const onAvailableDateChanged = useDebouncedCallback((e: ChangeEvent<HTMLInputElement>) => {
        void async function() {
            const newDate = e.target.value !== "" ? addLocalTimezone(e.target.value) : null
            try {
                await updateAssignment(assignment.name, {
                    available_date: newDate
                })
            } catch (e: any) {
                const error = await e.response.json()
                snackbar.open({
                    type: 'error',
                    message: `Failed to update: ${ error.message ?? "network error" }`
                })
            }
        }()
    }, 1000, { leading: false })

    const onDueDateChanged = useDebouncedCallback((e: ChangeEvent<HTMLInputElement>) => {
        void async function() {
            const newDate = e.target.value !== "" ? addLocalTimezone(e.target.value) : null
            try {
                await updateAssignment(assignment.name, {
                    due_date: newDate
                })
            } catch (e: any) {
                const error = await e.response?.json()
                snackbar.open({
                    type: 'error',
                    message: `Failed to update: ${ error.message ?? "network error" }`
                })
            }
        }()
    }, 1000, { leading: false })

    const onManualGradingChanged = useDebouncedCallback((e: ChangeEvent<HTMLInputElement>) => {
        const manualGrading = e.target.checked
        void async function() {
            setManualGradingControlled(manualGrading)
            try {
                await updateAssignment(assignment.name, {
                    manual_grading: manualGrading
                })
            } catch (e: any) {
                // Revert optimistic update back to original value
                setManualGradingControlled(!manualGrading)
                const error = await e.response?.json()
                snackbar.open({
                    type: "error",
                    message: `Failed to update: ${ error.message ?? "network error" }`
                })
            }
        }()
    }, 1000, { leading: true })

    const onGradedNotebookChanged = useDebouncedCallback((e: ChangeEvent<HTMLInputElement>) => {
        void async function() {
            try {
                await updateAssignment(assignment.name, {
                    master_notebook_path: e.target.value
                })
            } catch (e: any) {
                const error = await e.response?.json()
                snackbar.open({
                    type: "error",
                    message: `Failed to update: ${ error.message ?? "network error" }`
                })
            }
        }()
    }, 1000, { leading: true })

    const openGradedNotebook = useCallback(() => {
        if (!commands || !assignment) return
        const gradedNotebookPath = assignment.absoluteDirectoryPath + "/" + gradedNotebookControlled
        commands.execute('docmanager:open', { path: gradedNotebookPath })
    }, [commands, assignment, gradedNotebookControlled])

    const createStudentNotebook = useCallback(async () => {
        if (!commands || !assignment) return
        setCreatingStudentNotebook(true)
        try {
            await apiCreateStudentNotebook(assignment.id)
            await commands.execute('docmanager:open', { path: assignment.absoluteDirectoryPath + "/" + assignment.studentNotebookPath })
        } catch (e: any) {
            const data = await e.response?.json()
            showErrorMessage(
                'Failed to generate student notebook',
                {
                    message: <pre>{ data.error ?? "network error" }</pre>
                },
                [Dialog.warnButton({ label: 'Dismiss' })]
            )
        }
        setCreatingStudentNotebook(false)
    }, [commands, assignment])

    const createTemplateNotebook = useCallback(async (setActive: boolean=true) => {
        if (!commands || !assignment || !notebookFiles) return
        setCreatingTemplateNotebook(true)
        
        const assignmentNotebooks = notebookFiles[assignment.id]
        const computeUniqueNotebookName = () => {
            // eslint-disable-next-line
            for (let i=0; true; i++) {
                const name = `${ assignment.name }${ i ? " (" + i + ")" : ""}.ipynb`
                if (!assignmentNotebooks.includes(name)) return name
            }

        }

        const templateNotebookName = computeUniqueNotebookName()
        const templateNotebookPath = `${ assignment.absoluteDirectoryPath }/${ templateNotebookName }`
        const notebookMetadata = {
            "metadata":{
                "kernelspec":{"display_name":"Python 3 (ipykernel)","language":"python","name":"python3"},
                "language_info":{"codemirror_mode":{"name":"ipython","version":3},"file_extension":".py","mimetype":"text/x-python","name":"python","nbconvert_exporter":"python","pygments_lexer":"ipython3"}
            },
            "nbformat":4,
            "nbformat_minor":5
        }
        const autogradedTemplateNotebookContent = JSON.stringify({
            "cells": [
                {"cell_type":"markdown","id":"b35bba0c-d691-43e9-852f-4cf05f651f2c","metadata":{},"source": ["## This is a template. Delete this cell.\n","\n","This template is intended to help you start writing an assignment for Otter.\n","\n","You can find Otter Grader documentation on creating notebooks [here](https://otter-grader.readthedocs.io/en/latest/otter_assign/notebook_format.html) and [EduHeLx user documentation here](https://renci.atlassian.net/wiki/spaces/EHI/overview). Make sure you restart kernel and run all cells before attempting to push the notebook.\n","\n","*This cell should be removed prior to pushing.*"]},
                {"cell_type":"raw","id":"0f25e6b1-e3f3-4d6f-828b-d002f4f84f0f","metadata":{},"source":["# ASSIGNMENT CONFIG\n","requirements: requirements.txt\n","show_question_points: true"]},
                {"cell_type":"markdown","id":"efa64998-0bee-4ec4-8b2f-ae369eb24b73","metadata":{},"source":[`# ${ assignment.name }`]},
                {"cell_type":"code","execution_count":1,"id":"a018cc99-7dc6-4cbc-a919-8fafc2a3b3b3","metadata":{},"outputs":[],"source":["# Import statements\n","import pandas as pd\n","import numpy as np"]},
                {"cell_type":"raw","id":"813f41e7-e7b8-479c-b187-5ece631470f6","metadata":{},"source":["# BEGIN QUESTION\n","name: question1"]},
                {"cell_type":"markdown","id":"29f1c87e-7816-436e-8b9d-e363eb877c4f","metadata":{},"source":["**Question 1**: Description"]},
                {"cell_type":"raw","id":"c3213d44-0317-4f30-bd7c-61c37e707f38","metadata":{},"source":["# BEGIN SOLUTION"]},
                {"cell_type":"code","execution_count":2,"id":"90415b96-4baf-4730-90f0-2cfc2006e94b","metadata":{},"outputs":[],"source":["def multiply_by_2(x):\n","    return x * 2 # SOLUTION"]},
                {"cell_type":"raw","id":"656c6bda-c919-44b5-a241-3cf973611aba","metadata":{},"source":["# END SOLUTION"]},
                {"cell_type":"raw","id":"90ef153c-d9bd-444e-8539-0393bbf836a5","metadata":{},"source":["# BEGIN TESTS"]},
                {"cell_type":"code","execution_count":3,"id":"6ccb3a31-8449-4e21-9452-c6059133d414","metadata":{},"outputs":[{"data":{"text/plain":["True"]},"execution_count":3,"metadata":{},"output_type":"execute_result"}],"source":["multiply_by_2(2.5) == 5"]},
                {"cell_type":"code","execution_count":4,"id":"5ef4d1f6-c3bd-4ca0-b950-05c39d0e2394","metadata":{},"outputs":[{"data":{"text/plain":["True"]},"execution_count":4,"metadata":{},"output_type":"execute_result"}],"source":["multiply_by_2(7) == 14"]},
                {"cell_type":"code","execution_count":5,"id":"4778bb3f-2a40-475e-82aa-a555500b8803","metadata":{},"outputs":[{"data":{"text/plain":["True"]},"execution_count":5,"metadata":{},"output_type":"execute_result"}],"source":["multiply_by_2(-9.28) == -18.56"]},
                {"cell_type":"code","execution_count":6,"id":"db98cd00-2c4b-4c52-bcfc-c893cda449ce","metadata":{},"outputs":[{"data":{"text/plain":["True"]},"execution_count":6,"metadata":{},"output_type":"execute_result"}],"source":["# HIDDEN\n","multiply_by_2(6543.359) == 13086.718"]},
                {"cell_type":"raw","id":"3857366d-26d4-4d52-9ce2-bf94b984479c","metadata":{},"source":["# END TESTS"]},
                {"cell_type":"raw","id":"42c48a4e-7efa-4b90-8d5b-d747d1ddffc5","metadata":{},"source":["# END QUESTION"]}
            ],
            ...notebookMetadata
        })
        const manuallyGradedTemplateNotebookContent = JSON.stringify({
            "cells": [
                {"cell_type":"markdown","id":"efa64998-0bee-4ec4-8b2f-ae369eb24b73","metadata":{},"source":[`# ${ assignment.name }`]},
                {"cell_type":"code","execution_count":1,"id":"a018cc99-7dc6-4cbc-a919-8fafc2a3b3b3","metadata":{},"outputs":[],"source":["# Import statements\n","import pandas as pd\n","import numpy as np"]},
            ],
            ...notebookMetadata
        })
        try {
            await createFile(
                templateNotebookPath,
                assignment.manualGrading ? manuallyGradedTemplateNotebookContent : autogradedTemplateNotebookContent
            )
            if (setActive) try {
                await updateAssignment(assignment.name, {
                    master_notebook_path: templateNotebookName
                })
            } catch {}
            await commands.execute('docmanager:open', { path: templateNotebookPath })
        } catch (e: any) {
            snackbar.open({
                type: 'error',
                message: "Sorry! Unable to create template notebook. Please contact support."
            })
        }
        
        setCreatingTemplateNotebook(false)
    }, [commands, assignment, notebookFiles, gradedNotebookControlled])

    useEffect(() => {
        setAvailableDateControlled(formatDateToMui(assignment.availableDate))
        setDueDateControlled(formatDateToMui(assignment.dueDate))
        setManualGradingControlled(assignment.manualGrading)
    }, [assignment])

    return (
        <div className={ assignmentInfoClass }>
            <div>
                <header className={ assignmentNameClass }>{ assignment.name }</header>
                {/*
                if (!assignment.isCreated) {
                    // Upcoming assignment (doesn't have either an open or close date yet)
                    color = "white"
                    backgroundColor = "#1890ff"
                    text = "Not released"
                    tooltip = `Set an available date and due date to release the assignment`
                    filled = true
                }
                */}
                { assignmentReleasedTag }
                { assignment.isPublished && assignmentStatusTag }
            </div>
            <div className={ assignmentInfoSectionClass } style={{ marginTop: 16 }}>
                <h5 className={ assignmentInfoSectionHeaderClass }>
                    Available date
                    { availableDateControlled === "" && ` (not set)` }
                </h5>
                <div style={{ width: "100%" }}>
                    <TextField
                        type="datetime-local"
                        value={ availableDateControlled }
                        onChange={ (e: ChangeEvent<HTMLInputElement>) => {
                            const newAvailableDate = new Date(e.target.value)
                            if (assignment.dueDate && newAvailableDate >= assignment.dueDate) {
                                e.preventDefault()
                                snackbar.open({
                                    type: 'error',
                                    message: `The assignment cannot open after its due date!`
                                })
                                return false
                            }
                            setAvailableDateControlled(e.target.value)
                            onAvailableDateChanged(e)
                        } }
                        InputProps={{ inputProps: {
                            // Gets overriden in top-level inputProps
                            max: dueDateControlled ?? "9999-12-31T11:59",
                            step: 900, // 15 min step
                            style: { boxSizing: "content-box", paddingTop: 4, paddingBottom: 5, fontSize: 15 }
                        } }}
                        // helperText={ "(" + getLocalTimezoneAbbr() + ")" }
                        style={{ width: "100%" }}
                    />
                </div>
            </div>
            <div className={ assignmentInfoSectionClass } style={{ marginTop: 0 }}>
                <h5 className={ assignmentInfoSectionHeaderClass }>
                    Due date
                    { dueDateControlled === "" && ` (not set)` }
                </h5>
                <div style={{ width: "100%" }}>
                    <TextField
                        type="datetime-local"
                        value={ dueDateControlled }
                        onChange={ (e: ChangeEvent<HTMLInputElement>) => {
                            const newDueDate = new Date(e.target.value)
                            // Due date cannot be earlier than available date
                            if (assignment.availableDate && newDueDate <= assignment.availableDate) {
                                e.preventDefault()
                                snackbar.open({
                                    type: 'error',
                                    message: `The assignment cannot close before its open date!`
                                })
                                return
                            }
                            setDueDateControlled(e.target.value)
                            onDueDateChanged(e)
                        } }
                        InputProps={{ inputProps: {
                            min: availableDateControlled,
                            // Gets overriden in top-level inputProps
                            max: "9999-12-31T11:59",
                            step: 900, // 15 min step
                            style: { boxSizing: "content-box", paddingTop: 4, paddingBottom: 5, fontSize: 15 }
                        } }}
                        style={{ width: "100%" }}
                    />
                </div>
            </div>
            <div
                className={ assignmentInfoSectionClass }
                style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 4 }}
            >
                <h5 className={ assignmentInfoSectionHeaderClass } style={{ margin: 0 }}>
                    Manually graded
                </h5>
                <div>
                    <Checkbox
                        checked={ manualGradingControlled }
                        onChange={ (e: ChangeEvent<HTMLInputElement>) => {
                            onManualGradingChanged(e)
                        } }
                        size="small"
                        style={{ boxSizing: "content-box", padding: 0, color: "var(--md-blue-500)" }}
                    />
                </div>
            </div>
            <div className={ assignmentInfoSectionClass } style={{ marginTop: 0 }}>
                <h5 className={ assignmentInfoSectionHeaderClass }>
                    Master notebook
                    { gradedNotebookInvalid && !showCreateGradedNotebookButton && ` (invalid)` }
                    <InfoTooltip
                        title={ masterNotebookTooltipContent }
                        trigger="hover"
                        iconProps={{ style: { fontSize: 13, marginLeft: 4 } }}
                    />
                </h5>
                <div style={{ width: "100%" }}>
                    { showCreateGradedNotebookButton ? (
                        <Fragment>
                            <button
                                className={ classNames(openFileBrowserButtonClass, creatingTemplateNotebook && disabledButtonClass) }
                                style={{ marginBottom: 0, width: "100%" }}
                                onClick={ () => createTemplateNotebook(true) }
                            >
                                { !creatingTemplateNotebook ? `Create Template Notebook${ multipleInstructors ? "*" : "" }` : (
                                    <CircularProgress color="inherit" size={ 16 } />
                                ) }
                            </button>
                            { multipleInstructors && (
                                <p style={{
                                    margin: 0,
                                    marginTop: 8,
                                    fontSize: 12,
                                    color: "var(--jp-ui-font-color2)",
                                    fontStyle: "italic"
                                }}>
                                    *Note: If you are not the instructor responsible for this assignment, please
                                    avoid creating or changing the master notebook. Only one instructor should be
                                    responsible for any given assignment.
                                </p>
                            ) }
                        </Fragment>
                    ) : (
                        <Select
                            error={ gradedNotebookInvalid }
                            defaultValue={ assignment.masterNotebookPath }
                            onChange={ (e: ChangeEvent<any>) => {
                                setGradedNotebookControlled(e.target.value)
                                onGradedNotebookChanged(e)
                            } }
                            style={{ width: "100%" }}
                        >
                            {
                                notebookFiles[assignment.id].map((notebook) => (
                                    <MenuItem key={ notebook } value={ notebook }>{ notebook }</MenuItem>
                                ))
                            }
                        </Select>
                    ) }
                    { !gradedNotebookInvalid && (
                        <div style={{ display: "flex", gap: 8 }}>
                            <FormHelperText style={{ color: "#1976d2" }}>
                                <a
                                    onClick={ openGradedNotebook }
                                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                                >
                                    Open notebook
                                </a>
                            </FormHelperText>
                            <FormHelperText style={{ color: creatingTemplateNotebook ? "var(--jp-ui-font-color2)" : "#1976d2" }}>
                                <a
                                    onClick={ () => createTemplateNotebook(false) }
                                    style={{ cursor: creatingTemplateNotebook ? "default" : "pointer", whiteSpace: "nowrap" }}
                                >
                                    Create template
                                </a>
                            </FormHelperText>
                            { !assignment.manualGrading && (
                                <FormHelperText style={{ color: creatingStudentNotebook ? "var(--jp-ui-font-color2)" : "#1976d2" }}>
                                    <a
                                        onClick={ createStudentNotebook }
                                        style={{ cursor: creatingStudentNotebook ? "default" : "pointer", whiteSpace: "nowrap" }}
                                    >
                                        { studentNotebookInvalid ? "Create" : "Recreate" } student version
                                    </a>
                                </FormHelperText>
                            ) }
                        </div>
                    )}
                </div>
            </div>
            {/* Displays an equivalent select with student notebook value as only option */}
            {/* <div className={ assignmentInfoSectionClass } style={{ marginTop: 0 }}>
                <h5 className={ assignmentInfoSectionHeaderClass }>
                    Student notebook
                    <InfoTooltip
                        title="This is the student copy of the notebook with hidden test cases"
                        trigger="hover"
                        iconProps={{ style: { fontSize: 13, marginLeft: 4 } }}
                    />
                </h5>
                <div style={{ width: "100%" }}>
                    <Select
                        readOnly
                        value={ assignment.studentNotebookPath }
                        style={{ width: "100%" }}
                    >
                        <MenuItem value={ assignment.studentNotebookPath }>{ assignment.studentNotebookPath }</MenuItem>
                    </Select>
                </div>
            </div> */}
        </div>
    )
}