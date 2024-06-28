import { style } from 'typestyle'

export const assignmentStagedChangesClass = style({
    fontSize: 'var(--jp-ui-font-size1)',
    color: 'var(--jp-ui-font-color0)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 12px',
    flexGrow: 1,
    height: 0,
    overflow: 'auto'
})

export const stagedChangesListClass = style({
    marginTop: 0,
    marginBottom: 12
})

export const stagedChangeListItemClass = (style as any)({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    
    "&:last-child": {
        marginBottom: 0
    }
})

export const modifiedTypeBadgeClass = style({
    width: 24,
    height: "auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
})

export const largeBulletClass = style({
    borderRadius: "50%",
    display: "inline-block",
    height: 6,
    width: 6
})

export const assignmentStagedChangesFolderIconClass = (style as any)({
    "& > svg > path": {
        fill: "rgba(0, 0, 0, 0) !important",
        stroke: "var(--jp-inverse-layout-color3)",
        strokeWidth: "2.5px"
    }
})

export const showMoreBtnClass = (style as any)({
    fontSize: "var(--jp-ui-font-size1)",
    color: "#1890ff",
    background: "transparent",
    borderColor: "transparent",
    boxShadow: "none",
    cursor: "pointer",
    display: "inline-block",
    fontWeight: 400,
    position: "relative",
    textAlign: "center",
    touchAction: "manipulation",
    userSelect: "none",
    whiteSpace: "nowrap",
    padding: 0,

    "& > span": {
        display: "inline-block"
    }
})