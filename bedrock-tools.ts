const { writeFile } = require('fs/promises')


const cheerio = require('cheerio')

const {
  InvokeModelCommand,
  BedrockRuntimeClient,
} = require('@aws-sdk/client-bedrock-runtime')

// const lancedb = require('vectordb')
const TurnDown = require('turndown')
const toMD = new TurnDown()

// function getTitanEmbeddings() { }

let client = new BedrockRuntimeClient({
  region: 'us-west-2'
})


function changeCredentials(key, secret, token) {
  client = new BedrockRuntimeClient({
    region: 'us-west-2',
    credentials: {
      accessKeyId: key,
      secretAccessKey: secret,
      sessionToken: token,
    },
  })
}




async function getPage(url, name) {
  const res = await fetch(url)
  const html = await res.text()
  const $ = cheerio.load(html)
  const body = $('#app').html()
  // const md = toMD.turndown(html)
  const md = toMD.turndown(body)
  // const parts = body
  // const embeddings = await getTitanEmbeddings(md)
  return {
    html: body,
    md,
    // embeddings, 
    name,
  }
}


// test()
async function test() {
  // const res = await askTitan('How are you?')
  // console.log(res)

  // https://mermaid.js.org/syntax/flowchart.html
  const { md, html } = await getPage('https://mermaid.js.org/syntax/flowchart.html', 'Sintax/flochart')
  // console.log(md)
  // await writeFile('mermaid.md', md)
  // await writeFile('mermaid.html', html)
  // <cloudformation-template>
  //   ${template}
  // </cloudformation-template>

  const res = await askTitan(`please read this document:
    <document>${md}</document>
    
    Summarize how to use mermaid in to a set of rules that I can use in future prompts
  `)
  console.log(res.message)

  const emmbedings = await getTitanEmbeddings(res.message)
  console.log(emmbedings)

}

async function createVectorDB(dbName) {

  const uri = `data/${dbName}`
  // const db = await lancedb.connect(uri)

}

/**
 *
 *
 * @param {*} prompt
 * @param {{systemPrompt: string, messages: string[]}} options
 * @return {*} 
 */
async function askTitan(prompt, options?) {
  const { systemPrompt, messages } = options || {}

  const input = {
    body: JSON.stringify({
      inputText: `${
        systemPrompt? systemPrompt + '\n' : ''
      }${
        Array.isArray(messages)? messages.join('\n'):''
      }User: ${prompt}\nBot:`,
      textGenerationConfig: {
        maxTokenCount: 2000,
      },
    }),
    contentType: 'application/json',
    accept: 'application/json',
    modelId: 'amazon.titan-text-express-v1', // amazon.titan-text-lite-v1
  }

  const command = new InvokeModelCommand(input)
  const clientRes = await client.send(command)
  const response = JSON.parse(Buffer.from(clientRes.body).toString('utf8'))

  return {
    response, message: response.results[0].outputText
  }

}

async function askClaude(message,  options = { version: 'v1', messages: [] }) {
  const versionMap = {
    v1: 'anthropic.claude-instant-v1',
    v2: 'anthropic.claude-v2',
  }

  const prompt = `${options?.messages || ''}\n\nHuman: ${message}\nAssistant:`
  console.log('PROMPT:', prompt)

  const command = new InvokeModelCommand({
    modelId: versionMap[options.version] || 'anthropic.claude-instant-v1',
    accept: '*/*',
    contentType: 'application/json',
    body: JSON.stringify({
      prompt,
      max_tokens_to_sample: 3000,
      temperature: 0.5,
      top_k: 250,
      top_p: 1,
    })
  })

  const response = await client.send(command).catch(err => {
    console.log('bedrock error')
    console.error(err)
    throw err
  })
  const textResponse = JSON.parse(Buffer.from(response.body, 'base64').toString('utf8')).completion
  // console.log('RESPONSE:', textResponse)
  return textResponse.trim()

}


async function getTitanEmbeddings(inputText) {
  const input = {
    body: JSON.stringify({ inputText }),
    contentType: 'application/json',
    accept: 'application/json',
    modelId: 'amazon.titan-embed-text-v1',
  }

  const command = new InvokeModelCommand(input)
  const clientRes = await client.send(command)
  // console.log(clientRes)

  const response = JSON.parse(Buffer.from(clientRes.body).toString('utf8'))
  return response.embedding
}

/**
 *
 *
 * @param {lancedb.Table} table
 * @param {*} text
 */
async function save(table, item) {
  const embeddings = await getTitanEmbeddings(item.description)
  item.vector = embeddings
  table.add([item])
}

function html(templates, ...values) {
  let str = ''
  templates.forEach((template, index) => {
    str += template
    str = values[index] ? str + values[index] : str
  })
  return str.trim()
}

module.exports = {
  changeCredentials,
  getTitanEmbeddings,
  askTitan,
  createVectorDB,
  askClaude,
  save,
  html,
}
