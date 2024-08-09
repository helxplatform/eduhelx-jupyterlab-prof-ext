import { style } from 'typestyle'

export const assignmentBucketContainerClass = (style as any)({
    '& .MuiExpansionPanelSummary-expandIcon': {
        paddingLeft: 6,
        paddingRight: 6
    }
})

export const assignmentListItemClass = (style as any)({
    '&:first-child': {
        paddingTop: '0 !important',
    },
    '&:first-child > .MuiListItemText-root': {
        marginTop: '0 !important'
    }
})

export const assignmentListHeaderClass = style({
    color: 'var(--jp-ui-font-color0)',
    fontSize: 13,
    fontWeight: 500
})

export const downloadAssignmentButtonClass = style({
    backgroundColor: 'var(--md-blue-500)',
    border: 0,
    borderRadius: 0,
    cursor: 'pointer',
    color: 'white',
    fontSize: 'var(--jp-ui-font-size1)',
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
})

export const assignmentsListClass = (style as any)({
    flexGrow: 1,
    height: 0,
    overflowY: 'auto',
    padding: 0,
    /** Adjusting clashing styles caused by using accordion summaries as ListItem components */
    '& .MuiExpansionPanel-root, & .MuiExpansionPanel-root.Mui-expanded': {
        boxShadow: 'none',
        margin: 0,
    },
    '& .MuiExpansionPanel-root::before, & > div.MuiExpansionPanel-root.Mui-expanded::before': {
        top: -1,
        left: 0,
        right: 0,
        height: 1,
        content: '""',
        opacity: 1,
        position: 'absolute',
        display: 'block !important'
    },
    '& .MuiExpansionPanel-root:first-child::before, & > div.MuiExpansionPanel-root.Mui-expanded:first-child::before': {
        display: 'none !important'
    },
    '& .MuiExpansionPanelSummary-root, & .MuiExpansionPanelSummary-root.Mui-expanded': {
        padding: 0,
        minHeight: 'unset'
    },
    '& .MuiExpansionPanelSummary-content, & .MuiExpansionPanelSummary-content.Mui-expanded': {
        margin: 0
    },
    '& .MuiListItem-root': {
        paddingLeft: 12,
        paddingRight: 12
    },
    '& .MuiExpansionPanelSummary-expandIcon': {
        marginRight: 0
    },
    '& .MuiExpansionPanelDetails-root': {
        paddingLeft: 12,
        paddingRight: 12
    },
    '& .MuiExpansionPanelDetails-root > .MuiCard-root': {
        borderWidth: 0,
        borderLeftWidth: '2px !important',
        // So that the border aligns with the assignment number,
        // and the text aligns with the commit summary
        paddingLeft: 22,
        marginLeft: 8,
        borderRadius: 0
    },
    '& .MuiExpansionPanelDetails-root > .MuiCard-root > .MuiCardContent-root': {
        paddingLeft: 0
    }
})