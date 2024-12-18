import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application'
import { Dialog, showErrorMessage } from '@jupyterlab/apputils'
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser'
import { ISettingRegistry } from '@jupyterlab/settingregistry'
import { getServerSettings, IServerSettings } from './api'
import { submissionIcon } from './style/icons'
import { AssignmentWidget } from './widgets'

async function activate (
  app: JupyterFrontEnd,
  fileBrowser: IDefaultFileBrowser,
  restorer: ILayoutRestorer,
  shell: ILabShell,
  settingRegistry: ISettingRegistry
) {
  let serverSettings: IServerSettings
  try {
    serverSettings = await getServerSettings()
  } catch (e: any) {
    console.error('Failed to load the eduhelx_jupyterlab_prof extension settings', e)
    showErrorMessage(
      'Failed to load the eduhelx_jupyterlab_prof server extension',
      e.message,
      [Dialog.warnButton({ label: 'Dismiss' })]
    )
    return
  }

  Promise.all([app.restored, fileBrowser.model.restored]).then(() => {
    // A couple things are required to get jupyter to show dotfiles/~ files/etc.
    // This browser setting needs to be enabled for filebrowser, as well as
    // the server setting ContentsManager.allow_hidden=True
    settingRegistry.set("@jupyterlab/filebrowser-extension:browser", "showHiddenFiles", true)
  })


  // const model = new EduhelxSubmissionModel()
  // Promise.all([app.restored, fileBrowser.model.restored]).then(() => {
  //   model.currentPath = fileBrowser.model.path
  // })
  
  const submissionWidget = new AssignmentWidget(
    fileBrowser,
    app.commands,
    serverSettings
  )
  submissionWidget.id = 'jp-submission-widget'
  submissionWidget.title.icon = submissionIcon
  submissionWidget.title.caption = 'Eduhelx'

  restorer.add(submissionWidget, 'submission-widget')
  shell.add(submissionWidget, 'left', { rank: 200 })
}

/**
 * Initialization data for the eduhelx_jupyterlab_prof extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'eduhelx_jupyterlab_prof:plugin',
  description: 'A JupyterLab extension tfor submitting assignments in EduHeLx',
  autoStart: true,
  requires: [
    IDefaultFileBrowser,
    ILayoutRestorer,
    ILabShell,
    ISettingRegistry as any
  ],
  activate
};

export default plugin;
