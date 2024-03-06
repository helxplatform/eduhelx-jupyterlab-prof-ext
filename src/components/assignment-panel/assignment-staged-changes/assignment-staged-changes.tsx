import React, { useEffect, useMemo, useState } from 'react'
import { folderIcon, fileIcon } from '@jupyterlab/ui-components'
import { assignmentStagedChangesClass, assignmentStagedChangesFolderIconClass, largeBulletClass, modifiedTypeBadgeClass, showMoreBtnClass, stagedChangeListItemClass, stagedChangesListClass } from './style'
import { TextDivider } from '../../text-divider'
import { useAssignment } from '../../../contexts'
import { IStagedChange } from '../../../api/staged-change'

const SHOW_MORE_CUTOFF = 8

interface ModifiedTypeBadgeProps {
    modificationType: IStagedChange["modificationType"]
}

interface AssignmentStagedChangesProps extends React.HTMLAttributes<HTMLDivElement> {
}

const ModifiedTypeBadge = ({ modificationType }: ModifiedTypeBadgeProps) => {
    const [text, title, color] = useMemo(() => {
        switch (modificationType) {
            case "??": {
                return [
                    "+",
                    "Added (untracked)",
                    "var(--md-green-500)"
                ]
            }
            case "M": {
                return [
                    <span className={ largeBulletClass } style={{ backgroundColor: "var(--md-orange-500)" }} />,
                    "Modified",
                    undefined
                ]
            }
            case "D": {
                return [
                    "-",
                    "Deleted",
                    "var(--md-red-500)"
                ]
            }
            default: {
                return [
                    modificationType.slice(0, 3),
                    modificationType,
                    undefined
                ]
            }
        }
    }, [])
    return (
        <div
            className={ modifiedTypeBadgeClass }
            style={{ color }}
            title={ title }
        >
            { text }
        </div>
    )
}

export const AssignmentStagedChanges = ({ ...props }: AssignmentStagedChangesProps) => {
    const { assignment } = useAssignment()!
    const [showMore, setShowMore] = useState<boolean>(false)

    const stagedChangesSource = useMemo<IStagedChange[]>(() => {
        if (!assignment) return []
        const unknownTypeOrder: string[] = []
        // Sort directories first, then files. Sort these internally by modification type
        return assignment.stagedChanges.sort((a, b) => {
            // Sort directories preferentially
            if (a.type !== b.type) {
                return a.type === "directory" ? -1 : 1
            }
            const modificationOrder = { "M": 0, "??": 1, "D": 2 } as any
            const aModificationOrder = modificationOrder[a.modificationType]
            const bModificationOrder = modificationOrder[b.modificationType]
            // Both have recognized modificationType
            if (aModificationOrder !== undefined && bModificationOrder !== undefined) {
                return aModificationOrder - bModificationOrder
            } else if (aModificationOrder !== undefined) {
                // `b` has an unrecognized modificationType
                return -1
            } else if (bModificationOrder !== undefined) {
                // `a` has an unrecognized modificationType
                return 1
            } else {
                // Both have an unrecognized `modificationType`
                if (!unknownTypeOrder.includes(a.modificationType)) unknownTypeOrder.push(a.modificationType)
                if (!unknownTypeOrder.includes(b.modificationType)) unknownTypeOrder.push(b.modificationType)
                const aIdx = unknownTypeOrder.indexOf(a.modificationType)
                const bIdx = unknownTypeOrder.indexOf(b.modificationType)
                return aIdx - bIdx
            }
        })
    }, [assignment?.stagedChanges, showMore])

    const hideShowMoreButton = useMemo(() => !showMore && stagedChangesSource.length <= SHOW_MORE_CUTOFF, [showMore, stagedChangesSource])

    useEffect(() => {
        if (stagedChangesSource.length <= SHOW_MORE_CUTOFF) setShowMore(false)
    }, [stagedChangesSource])

    return (
        <div className={ assignmentStagedChangesClass } { ...props }>
            {/* <TextDivider innerStyle={{ fontSize: 'var(--jp-ui-font-size2)' }} style={{ marginBottom: 4 }}>Unsubmitted changes</TextDivider> */}
            <div className={ stagedChangesListClass }>
            {
                stagedChangesSource.slice(0, showMore ? undefined : SHOW_MORE_CUTOFF).map((change) => (
                    <div className={ stagedChangeListItemClass }>
                        <div style={{ display: "flex", alignItems: "center" }}>
                            { change.type === "directory" ? (
                                <folderIcon.react
                                    className={ assignmentStagedChangesFolderIconClass }
                                    tag="span"
                                /> 
                            ) : (
                                <fileIcon.react tag="span" />
                            ) }
                            <span style={{ marginLeft: 8 }}>
                                { !change.pathFromAssignmentRoot.startsWith("/") ? "/" : "" }
                                { change.pathFromAssignmentRoot }
                                { change.type === "directory" && !change.pathFromAssignmentRoot.endsWith("/") ? "/*" : "" }
                            </span>
                        </div>
                        <ModifiedTypeBadge modificationType={ change.modificationType } />
                    </div>
                ))
            }
            { assignment && !hideShowMoreButton && (
                <button
                    className={ showMoreBtnClass }
                    onClick={ () => setShowMore(!showMore) }
                    style={{ marginTop: 2 }}
                >
                    { showMore ? "Show less" : `Show ${ stagedChangesSource.length - SHOW_MORE_CUTOFF  } more` }
                </button>
            ) }
            </div>
        </div>
    )
}