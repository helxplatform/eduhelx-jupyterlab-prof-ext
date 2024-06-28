import React, { useMemo } from 'react'
import { List, ListItem, ListItemIcon } from '@material-ui/core'
import { InsertDriveFileOutlined } from '@material-ui/icons'
import { fileIcon } from '@jupyterlab/ui-components'

enum ViolationType {
    MERGE_CONTROL = "MERGE_CONTROL",
    PROTECTED_FILE = "PROTECTED_FILE"
}

interface MergeControlMessageProps {
    remoteMessages: string[] 
    assignmentPath: string
}

const INFO_PREFIX = "ERROR: "
const MERGE_VIOLATION_PREFIX = "MERGE_VIOLATION: "
const PROTECTED_FILE_VIOLATION_PREFIX = "PROTECTED_VIOLATION:"

export const PushPolicyViolationMessage = ({ remoteMessages, assignmentPath }: MergeControlMessageProps) => {
    const [type, info, files] = useMemo(() => {
        let type: ViolationType | undefined = undefined
        const info: string[] = []
        const files: string[] = []

        remoteMessages.forEach((message) => {
            if (message.trim().startsWith(INFO_PREFIX)) info.push(message.trim().slice(INFO_PREFIX.length))
            if (message.trim().startsWith(MERGE_VIOLATION_PREFIX)) {
                type = ViolationType.MERGE_CONTROL
                const fullPath = message.trim().slice(MERGE_VIOLATION_PREFIX.length)
                // Remove the assignmentPath prefix, since we are in the assignment view already.
                const fileName = fullPath.split(assignmentPath).slice(1).join(assignmentPath)
                files.push(fileName.startsWith("/") ? fileName.slice(1) : fileName)
            }
            if (message.trim().startsWith(PROTECTED_FILE_VIOLATION_PREFIX)) {
                type = ViolationType.PROTECTED_FILE
                const fullPath = message.trim().slice(PROTECTED_FILE_VIOLATION_PREFIX.length)
                // Remove the assignmentPath prefix, since we are in the assignment view already.
                const fileName = fullPath.split(assignmentPath).slice(1).join(assignmentPath)
                files.push(fileName.startsWith("/") ? fileName.slice(1) : fileName)
            }
        })

        return [type, info, files]
    }, [remoteMessages])
    
    return (
        <div>
            { type === ViolationType.MERGE_CONTROL
                ? "This assignment has become available for students, so files can no longer be modified."
                : `Your staged changes contain ${ files.length === 1 ? "a file" : "some files" } which include sensitive information.`
            }
            <br />
            { type == ViolationType.MERGE_CONTROL
                ? "Please create a new revision of the following:"
                : "Please update the following files within your gitignore:"
            }
            <List>
                { files.map((file) => (
                    <ListItem key={ file }>
                        <InsertDriveFileOutlined style={{ fontSize: 20, marginRight: 8 }} />
                        { file }
                    </ListItem>
                )) }
            </List>
        </div>
    )
}