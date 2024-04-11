import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import {
  html,
  askClaude,
  askTitan,
} from './bedrock-tools'
// } from '../../../../tools'

// import { run } from '../../../../process-page'
// Remember to rename these classes and interfaces!

interface ObsiBotPluginSettings {
  awsKeyId: string;
  awsSecretKey: string;
  alwaysInsertAtTheEnd: boolean;
}

const DEFAULT_SETTINGS: ObsiBotPluginSettings = {
  awsKeyId: 'default',
  awsSecretKey: 'default',
  alwaysInsertAtTheEnd: false
}

export default class ObsiBotPlugin extends Plugin {
  settings: ObsiBotPluginSettings;

  async onload() {
    await this.loadSettings();
    console.log('ObsiBot Plugin loaded');

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon('bot', 'ObsiBot', async (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      new Notice('asking claude!');

      const view = this.app.workspace.getActiveViewOfType(MarkdownView);

      // Make sure the user is editing a Markdown file.
      if (view) {
        const editor = view.editor
        // const str = '[[this text]] [[other#example]]';
        const matches = view.data.match(/\[\[(.+?)\]\]/g) || []
        const matchesSet = new Set(matches?.map(item =>
          item.replace('[[', '').replace(']]', '')))

        console.log(matchesSet)

        let prompt = editor.getSelection()
        if (prompt === '') prompt = editor.getValue()
        const allfiles = this.app.vault.getMarkdownFiles()

        let relevantFiles = allfiles.filter(file => matchesSet.has(file.name.replace('.md', '')))

        console.log('relevantFiles')
        console.log(relevantFiles)

        const relevantContent = await Promise.all(relevantFiles.map(file => {
          const fileContent = this.app.vault.cachedRead(file)
          // return {
          //   name: file.name,
          //   content: fileContent
          // }
          return  fileContent.then(content => ({ file, content }))
        }))

        relevantContent.forEach((item, index) => {
          console.log(item.file.name)
          // prompt = content + '\n\n---\n\n' + prompt
          // console.log([...matchesSet][index], content)
          prompt = prompt.replace(`[[${item.file.name.replace('.md', '')}]]`, item.content)
        })



        // console.log(relevantContent)
        // editor.replaceRange(prompt,
        //   editor.getCursor()
        // );
        // return


        askClaude(prompt)
          .then(response => {

            const currentCursor = editor.getCursor()
            if (this.settings.alwaysInsertAtTheEnd) editor.setCursor(editor.lastLine())

            editor.replaceRange(
              `\n\n## ObsiBot:\n\n${response}`,
              editor.getCursor()
            );
            editor.setCursor(currentCursor)
          })
      }

      // run()
    });

    // Perform additional things with the ribbon
    ribbonIconEl.addClass('my-plugin-ribbon-class');

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('Status Bar Text');


    this.addCommand({
      id: 'ask-titan',
      name: 'Ask Titan',
      editorCallback(editor, ctx) {
        editor.replaceRange(
          `\n\n## ObsiBot:`,
          editor.getCursor()
        );
      },
    })

    this.addCommand({
      id: 'ask-claude',
      name: 'Ask Claude',
      editorCallback(editor, ctx) {
        // @ts-ignore
        const prompt = ctx.data

        askClaude(prompt)
          .then(response => {

            editor.replaceRange(
              `\n\n## ObsiBot:\n\n${response}`,
              editor.getCursor()
            );
          })
      },
    })

    this.addCommand({
      id: 'ask-titan-image',
      name: 'Ask Titan Image',
      editorCallback(editor, ctx) {
        editor.replaceRange(
          `\n\n## ObsiBot:`,
          editor.getCursor()
        );
      },
    })

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-sample-modal-simple',
      name: 'Open sample modal (simple)',
      callback: () => {
        new SampleModal(this.app).open();
      }
    });
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: 'sample-editor-command',
      name: 'Sample editor command',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        console.log(editor.getSelection());
        editor.replaceSelection('Sample Editor Command');
      }
    });
    // This adds a complex command that can check whether the current state of the app allows execution of the command
    this.addCommand({
      id: 'open-sample-modal-complex',
      name: 'Open sample modal (complex)',
      checkCallback: (checking: boolean) => {
        // Conditions to check
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
          // If checking is true, we're simply "checking" if the command can be run.
          // If checking is false, then we want to actually perform the operation.
          if (!checking) {
            new SampleModal(this.app).open();
          }

          // This command will only show up in Command Palette when the check function returns true
          return true;
        }
      }
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
      console.log('click', evt);
      console.log(document)
    });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
  }

  onunload() {

  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: ObsiBotPlugin;

  constructor(app: App, plugin: ObsiBotPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('AWS_KEY_ID')
      .setDesc('AWS key id')
      .addText(text => text
        .setPlaceholder('Enter your key')
        .setValue(this.plugin.settings.awsKeyId)
        .onChange(async (value) => {
          this.plugin.settings.awsKeyId = value;
          await this.plugin.saveSettings();
        }));


    new Setting(containerEl)
      .setName('AWS_SECRET_KEY')
      .setDesc('AWS secret key')
      .addText(text => text
        .setPlaceholder('Enter your secret')
        .setValue(this.plugin.settings.awsSecretKey)
        .onChange(async (value) => {
          this.plugin.settings.awsSecretKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('responses at the end of the note')
      .setDesc('Insert responses at the end of the file? if no, responses will be inserted at the cursor')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.alwaysInsertAtTheEnd)
        .onChange(async (value) => {
          this.plugin.settings.alwaysInsertAtTheEnd = value;
          await this.plugin.saveSettings();
        })
      )


  }
}
