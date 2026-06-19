import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const apiKey = process.env.GEMINI_API_KEY
console.log('API Key exists:', !!apiKey)

if (!apiKey) {
  process.exit(1)
}

const ai = new GoogleGenerativeAI(apiKey)

async function run() {
  try {
    console.log('Calling gemini-2.5-flash...')
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const res = await model.generateContent('Hello')
    console.log('Response from gemini-2.5-flash:', res.response.text())
  } catch (err: any) {
    console.error('Error from gemini-2.5-flash:', err.message || err)
  }

  try {
    console.log('Calling gemini-2.0-flash...')
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const res = await model.generateContent('Hello')
    console.log('Response from gemini-2.0-flash:', res.response.text())
  } catch (err: any) {
    console.error('Error from gemini-2.0-flash:', err.message || err)
  }

  try {
    console.log('Calling gemini-1.5-flash...')
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const res = await model.generateContent('Hello')
    console.log('Response from gemini-1.5-flash:', res.response.text())
  } catch (err: any) {
    console.error('Error from gemini-1.5-flash:', err.message || err)
  }
}

run()
