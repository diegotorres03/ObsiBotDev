import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon } from 'obsidian';

import {
  changeCredentials,
  html,
  askClaude,
  askTitan,
} from './bedrock-tools'
// } from '../../../../tools'


import { TimestreamQueryClient, QueryCommand, QueryRequest } from '@aws-sdk/client-timestream-query'


import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'

/**
 * query AWS Timestream table
 *
 * @param {TimestreamQueryClient} client
 * @param {string} query
 * @param {*} params
 * @return {*} 
 */
async function queryTimestream(client: TimestreamQueryClient, query, params?) {


  const command = new QueryCommand({ QueryString: query })

  console.log(command)

  const response = await client.send(command)

  console.log(response)

  const columns = response.ColumnInfo?.map(column => column.Name)

  const rows = response.Rows?.map(row => row.Data?.map(data => {
    const key = Object.keys(data).shift() || 'ScalarValue'
    return data[key]
  }))

  console.log(rows)
  return { columns, rows, query }
}

// import { run } from '../../../../process-page'
// Remember to rename these classes and interfaces!

interface ObsiBotPluginSettings {
  awsKeyId: string
  awsSecretKey: string
  awsSessionToken: string
  alwaysInsertAtTheEnd: boolean
}

const DEFAULT_SETTINGS: ObsiBotPluginSettings = {
  awsKeyId: '',
  awsSecretKey: '',
  awsSessionToken: '',
  alwaysInsertAtTheEnd: false
}

export default class ObsiBotPlugin extends Plugin {
  settings: ObsiBotPluginSettings;

  isReading = false

  async onload() {
    await this.loadSettings();
    console.log('ObsiBot Plugin loaded')

    const key = this.settings.awsKeyId
    const secret = this.settings.awsSecretKey
    const token = this.settings.awsSessionToken
    changeCredentials(key, secret, token)


    addIcon('audio-waveform', '<svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-audio-lines"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></svg>')

    // Read Selected Text or the entire page
    const readTextBtn = this.addRibbonIcon('audio-waveform', 'Read out loud', async (event: MouseEvent) => {
      new Notice('readong out loud!')

      const view = this.app.workspace.getActiveViewOfType(MarkdownView)

      if (!view) return
      const editor = view.editor
      const selection = editor.getSelection()

      const textToAnalyze = selection || view.data

      console.log('preparing to read out loud')
      console.log(textToAnalyze)

      const credentials = {
        accessKeyId: this.settings.awsKeyId || process.env.AWS_KEY_ID || '', secretAccessKey: this.settings.awsSecretKey || process.env.AWS_SECRET_KEY || '',
        // sessionToken: this.settings.token || process.env.AWS_SESSION_TOKEN || ''
      }
      const client = new PollyClient({
        region: 'us-east-2',
        credentials
      })

      /*
      //  VoiceId: "Aditi" || "Amy" || "Astrid" || "Bianca" || "Brian" || "Camila" || "Carla" || "Carmen" || "Celine" || "Chantal" || "Conchita" || "Cristiano" || "Dora" || "Emma" || "Enrique" || "Ewa" || "Filiz" || "Gabrielle" || "Geraint" || "Giorgio" || "Gwyneth" || "Hans" || "Ines" || "Ivy" || "Jacek" || "Jan" || "Joanna" || "Joey" || "Justin" || "Karl" || "Kendra" || "Kevin" || "Kimberly" || "Lea" || "Liv" || "Lotte" || "Lucia" || "Lupe" || "Mads" || "Maja" || "Marlene" || "Mathieu" || "Matthew" || "Maxim" || "Mia" || "Miguel" || "Mizuki" || "Naja" || "Nicole" || "Olivia" || "Penelope" || "Raveena" || "Ricardo" || "Ruben" || "Russell" || "Salli" || "Seoyeon" || "Takumi" || "Tatyana" || "Vicki" || "Vitoria" || "Zeina" || "Zhiyu" || "Aria" || "Ayanda" || "Arlet" || "Hannah" || "Arthur" || "Daniel" || "Liam" || "Pedro" || "Kajal" || "Hiujin" || "Laura" || "Elin" || "Ida" || "Suvi" || "Ola" || "Hala" || "Andres" || "Sergio" || "Remi" || "Adriano" || "Thiago" || "Ruth" || "Stephen" || "Kazuha" || "Tomoko" || "Niamh" || "Sofie" || "Lisa" || "Isabelle" || "Zayd" || "Danielle" || "Gregory" || "Burcu", // required

      */
      const command = new SynthesizeSpeechCommand({
        // "LexiconNames": [
        //   "example"
        // ],
        "OutputFormat": "ogg_vorbis",
        "SampleRate": "8000",
        "Text": textToAnalyze,
        "TextType": "text",
        "VoiceId": "Salli"
      })
      /** @type {ReadableStream} */
      let audioStream: ReadableStream = new ReadableStream()

      const response = await client.send(command).catch(err => {
        console.warn(err.$response)
        console.error(err)
        audioStream = err.$response.body
        console.log(err.$response.body)
        if (err.$response.body) return err.$response.body
      })
      console.log('audioStream', audioStream)

      console.log(response)



      const reader = await audioStream.getReader()
      const stream = new ReadableStream({
        start(controller) {
          return pump();
          function pump() {
            return reader.read().then(({ done, value }) => {
              // When no more data needs to be consumed, close the stream
              if (done) {
                controller.close();
                return;
              }
              // Enqueue the next data chunk into our target stream
              controller.enqueue(value);
              return pump();
            });
          }
        },
      });
      const res = new Response(stream)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      console.log('url', url)

      const audio = new Audio()
      audio.src = url
      audio.play()


      // this is the text I'll send to be read
      // use amazon polly to read textToAnalyze



    })

    // This creates an icon in the left ribbon.
    const promptBotBtn = this.addRibbonIcon('bot', 'ObsiBot', async (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      new Notice('asking claude!');

      const view = this.app.workspace.getActiveViewOfType(MarkdownView);

      // Make sure the user is editing a Markdown file.
      if (!view) return
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
        return fileContent.then(content => ({ file, content }))
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
    });

    // Perform additional things with the ribbon
    promptBotBtn.addClass('my-plugin-ribbon-class');

    const queryDBBtn = this.addRibbonIcon('database', 'Query DB', async (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      new Notice('querying db!');
      const view = this.app.workspace.getActiveViewOfType(MarkdownView)

      const timeStreamRegex = /```timestream\n([\s\S]*?)\n```/gm


      if (!view) return
      const editor = view.editor
      const selection = editor.getSelection()

      const textToAnalyze = selection || view.data

      const matches = textToAnalyze.match(timeStreamRegex) || []
      console.log(matches)

      if (matches.length === 0) {
        new Notice('No Timestream queries found in selection')
        return
      }


      const credentials = {
        accessKeyId: this.settings.awsKeyId || process.env.AWS_KEY_ID || '', secretAccessKey: this.settings.awsSecretKey || process.env.AWS_SECRET_KEY || '',
        // sessionToken: this.settings.token || process.env.AWS_SESSION_TOKEN || ''
      }

      const client = new TimestreamQueryClient({
        region: 'us-east-2',
        credentials
      })


      const responsePromises = matches.map(match => {
        const query = match.replace('```timestream\n', '').replace('\n```', '')
        console.log('query', query)
        return queryTimestream(client, query)
      })


      function renderMDTable({ columns, rows }) {


        const insertSeparators = number => {
          let separators = ''
          for (let i = 0; i < number; i++) {
            separators += '---|'
          }
          return separators
        }

        const table = `|${columns?.join(' | ')}|\n|${insertSeparators(columns?.length || 1)}\n${rows?.map(row => `|${row?.join(' | ')}|`).join('\n')}
  `

        console.log(table)
        return table
      }

      const responses = await Promise.all(responsePromises)

      console.log(responses)

      responses.forEach(res => {
        console.log('working on ', res.query)
        const table = renderMDTable(res)

        const currentCursor = editor.getCursor()
        if (this.settings.alwaysInsertAtTheEnd) editor.setCursor(editor.lastLine())


        editor.replaceRange(
          `\n\n#### Timestream Query result\n${table}`,
          editor.getCursor()
        );
        editor.setCursor(currentCursor)
        // console.log(table)
        // view.data.replace(res.query, res.query + '\n\n' + table)
      })




    })

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
        }))


    new Setting(containerEl)
      .setName('AWS_SESSION_TOKEN')
      .setDesc('AWS session token')
      .addText(text => text
        .setPlaceholder('Enter your secret')
        .setValue(this.plugin.settings.awsSessionToken)
        .onChange(async (value) => {
          this.plugin.settings.awsSessionToken = value;
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
