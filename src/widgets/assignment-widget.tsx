import React from 'react'
import { ReactWidget } from '@jupyterlab/apputils'
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser'
import { CommandRegistry } from '@lumino/commands'
import { StylesProvider } from '@material-ui/core/styles'
import { AssignmentPanel } from '../components'
import { IServerSettings } from '../api'
import { AssignmentProvider, CommandsProvider, SettingsProvider, BackdropProvider, SnackbarProvider, WebsocketProvider } from '../contexts'
import { IEduhelxSubmissionModel } from '../tokens'

export class AssignmentWidget extends ReactWidget {
    private fileBrowser: IDefaultFileBrowser
    private commands: CommandRegistry
    private serverSettings: IServerSettings

    constructor(
        fileBrowser: IDefaultFileBrowser,
        commands: CommandRegistry,
        serverSettings: IServerSettings
    ) {
        super()

        this.fileBrowser = fileBrowser
        this.commands = commands
        this.serverSettings = serverSettings
    }

    render() {
        return (
            <StylesProvider injectFirst>
                <CommandsProvider commands={ this.commands }>
                    <SettingsProvider settings={ this.serverSettings }>
                        <BackdropProvider>
                            <SnackbarProvider>
                                <WebsocketProvider>
                                    <AssignmentProvider fileBrowser={ this.fileBrowser }>
                                        <AssignmentPanel />
                                    </AssignmentProvider>
                                </WebsocketProvider>
                            </SnackbarProvider>
                        </BackdropProvider>
                    </SettingsProvider>
                </CommandsProvider>
            </StylesProvider>
        )
    }
}