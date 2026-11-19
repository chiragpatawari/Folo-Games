import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `You are an expert interactive game and puzzle engineer.
When given a user prompt (and optional prior HTML + follow-up refinement), build a complete, polished, immediately playable standalone HTML5 game or puzzle.

Strict technical requirements for the generated "html" field:
1. Must be a single, complete, self-contained HTML5 document starting with <!DOCTYPE html> and ending with </html>.
2. ALL CSS must be inside a <style> tag and ALL JavaScript must be inside a <script> tag.
3. NEVER include external scripts, external stylesheets, external fonts, CDN links, fetch() calls, or external image URLs. It must work 100% offline when exported as an .html file.
4. Design & Layout:
   - Clean, tactile, responsive layout that fits comfortably inside a 100vw x 100vh viewport without unintended page scrolling.
   - Crisp typography using system-ui / sans-serif / monospace for scores and timers.
   - High-contrast, polished palette appropriate to the game's genre.
   - Clear game title, concise 1-line control instructions, live Score / Level / Timer HUD, and a working Restart / Play Again button.
5. Interactivity & Gameplay:
   - Support both mouse/touch controls AND keyboard controls (and prevent arrow/space default scrolling when playing).
   - Include proper win, loss, or round-complete detection with a clean summary overlay and immediate Restart without reloading the page.
   - Write bug-free, defensive JavaScript with no syntax errors or undefined references.`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/generate-game', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      const body = req.body as {
        prompt?: unknown;
        currentHtml?: unknown;
        history?: unknown;
      };

      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt || prompt.length > 2000) {
        res.status(400).json({
          error: 'Please enter a game idea between 1 and 2,000 characters.',
        });
        return;
      }

      const currentHtml =
        typeof body.currentHtml === 'string' && body.currentHtml.length <= 200000
          ? body.currentHtml
          : '';

      const history = Array.isArray(body.history)
        ? body.history
            .filter(
              (m): m is { role: string; content: string } =>
                Boolean(m) &&
                typeof m === 'object' &&
                typeof (m as { role?: unknown }).role === 'string' &&
                typeof (m as { content?: unknown }).content === 'string'
            )
            .slice(-6)
        : [];

      const parts: string[] = [];
      if (history.length > 0) {
        parts.push(
          'Recent conversation:\n' +
            history
              .map((m) => `${m.role === 'user' ? 'User' : 'Builder'}: ${m.content}`)
              .join('\n')
        );
      }
      if (currentHtml) {
        parts.push(
          `Existing standalone HTML game to modify/enhance:\n\`\`\`html\n${currentHtml}\n\`\`\``
        );
      }
      parts.push(`User request: ${prompt}`);

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: parts.join('\n\n'),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Short, punchy title for the generated game (2-5 words).',
              },
              summary: {
                type: Type.STRING,
                description:
                  'One concise, helpful sentence explaining how to play and what was built or updated.',
              },
              html: {
                type: Type.STRING,
                description:
                  'Complete, self-contained <!DOCTYPE html> document with inline CSS and JS.',
              },
            },
            required: ['title', 'summary', 'html'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Empty response from game generator.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        summary?: string;
        html?: string;
      };

      if (!parsed.html || typeof parsed.html !== 'string') {
        res.status(502).json({ error: 'Generated output did not contain valid HTML.' });
        return;
      }

      res.json({
        title: (parsed.title || 'Custom Game').slice(0, 80),
        summary: (parsed.summary || 'Your game is ready to play.').slice(0, 400),
        html: parsed.html,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate game.';
      console.error('Error in /api/generate-game:', message);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Folio Games server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
