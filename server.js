import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // We'll put frontend files in 'public'

// Initialize Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Endpoint to fetch and parse URL content
app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Use domcontentloaded to avoid infinite waits on complex SPAs
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Explicitly wait an extra moment to ensure client-side UI (like React) mounts text
    await new Promise(r => setTimeout(r, 4000));

    let pageTitle = await page.title();

    // Extract text directly within the browser context to ensure we get what is actually rendered
    let textContent = await page.evaluate(() => {
        // Remove non-content elements to clean up the output
        document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, svg').forEach(el => el.remove());
        
        // Return the visible text of the body
        return document.body.innerText;
    });

    await browser.close();
    
    // Clean up excessive whitespace and newlines
    textContent = textContent.replace(/\s+/g, ' ').trim();
    
    // Limit text length to avoid token limits (e.g., first 30000 characters)
    if (textContent.length > 50000) {
      textContent = textContent.substring(0, 50000) + '... [Content truncated due to length]';
    }

    res.json({ content: textContent, title: pageTitle || url });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    res.status(500).json({ error: `Erreur interne: ${error.message}` });
  }
});

// Endpoint to chat with the document using Gemini
app.post('/api/chat', async (req, res) => {
  const { question, context, history = [] } = req.body;
  if (!question || !context) {
    return res.status(400).json({ error: 'Question and context are required' });
  }

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return res.status(500).json({ error: 'Gemini API key is not configured.' });
  }

  try {
    // Convert our simple history format [{role: 'user'/'ai', text: '...'}] to Gemini's format
    const geminiHistory = history.map(msg => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text }]
    }));

    const systemInstruction = `
### RÔLE ET OBJECTIF
Tu es Doc-AI, un expert pédagogue en informatique et logiciels. Tu es un assistant IA qui aide les utilisateurs à comprendre des documentations techniques.

### CONTEXTE DE LA DOCUMENTATION
Voici le contenu extrait de la documentation fournie par l'utilisateur. Tu DOIS l'utiliser comme source CRITIQUE pour tes réponses :
<DOCUMENTATION_CONTEXT>
${context}
</DOCUMENTATION_CONTEXT>

### RÈGLES DE RÉPONSE OBLIGATOIRES (À RESPECTER STRICTEMENT)
1.  **LANGUE :** Tu DOIS IMPÉRATIVEMENT répondre EN FRANÇAIS. Ne réponds jamais dans une autre langue.
2.  **INTERDICTION DE REFUSER :** Tu n'as pas le droit d'utiliser des phrases comme "Je ne peux pas répondre" ou "La documentation ne dit rien". Tu DOIS TOUJOURS DONNER UNE RÉPONSE DÉTAILLÉE ET CONSTRUITE.
3.  **MÉMOIRE DE CONVERSATION :** Prends en compte l'historique de la conversation. Si l'utilisateur fait référence à une réponse précédente, utilise ce contexte.
4.  **RECHERCHE DANS LE CONTEXTE :** Cherche D'ABORD la réponse dans la section <DOCUMENTATION_CONTEXT>. Si l'information s'y trouve, utilise-la. Réponds précisément avec ces informations et cite les détails pertinents.
5.  **CONNAISSANCES GÉNÉRALES (FALLBACK OBLIGATOIRE) :** Si la *réponse précise* ne se trouve PAS dans le <DOCUMENTATION_CONTEXT>, tu NE DOIS PAS dire que tu ne trouves pas. Tu DOIS utiliser tes immenses connaissances générales pour répondre de manière experte. Dans ce cas, et UNIQUEMENT dans ce cas, tu dois OBLIGATOIREMENT commencer ta réponse exactement par cette ligne :
    "📚 *D'après mes connaissances générales* :"
6.  **FORMATAGE :** Sois clair, pédagogique, utilise des listes à puces ou des étapes numérotées si nécessaire. Si tu donnes du code, utilise les blocs Markdown classiques.
`;

    // Start a chat session with the provided history
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction: systemInstruction },
        history: geminiHistory
    });

    const result = await chat.sendMessage({ message: question });
    
    res.json({ answer: result.text });
  } catch (error) {
    console.error('Error with Gemini API:', error.message);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Serve index.html for root requests
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`DocAI server running on http://localhost:${port}`);
});
