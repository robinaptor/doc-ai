import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are a helpful assistant.",
      },
      history: [
        { role: 'user', parts: [{ text: 'Hello, my name is Robin.' }] },
        { role: 'model', parts: [{ text: 'Nice to meet you, Robin.' }] }
      ]
    });
    const result = await chat.sendMessage({ message: 'What is my name?' });
    console.log("Response:", result.text);
  } catch(e) {
    console.error("Failed:", e.message);
  }
}
test();
