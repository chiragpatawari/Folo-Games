import React, { useRef, useState } from 'react';
import {
  Download,
  Gamepad2,
  Loader2,
  RotateCcw,
  Send,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_PROMPTS = [
  'Minimalist 2048 sliding number puzzle with undo',
  'Memory card matching game with geometric symbols',
  'Arcade brick breaker with combo multiplier',
  '15-puzzle sliding tiles with move counter',
];

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'custom-game';
}

export function CreateGameTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Describe any puzzle or arcade game you want to play. Once built, test it live on the right, ask for tweaks, or export it as a standalone HTML file.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState<string>('');
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [iframeKey, setIframeKey] = useState<number>(0);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isGenerating) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          currentHtml: generatedHtml || undefined,
          history: nextHistory
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await response.json()) as {
        title?: string;
        summary?: string;
        html?: string;
        error?: string;
      };

      if (!response.ok || !data.html) {
        throw new Error(data.error || 'Unable to generate game.');
      }

      setGameTitle(data.title || 'Custom Game');
      setGeneratedHtml(data.html);
      setIframeKey((k) => k + 1);

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `${data.title || 'Game Ready'} — ${data.summary || 'Ready to play live.'}`,
        },
      ]);

      window.setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to build game.';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendPrompt(input);
  };

  const handleExportHtml = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugifyTitle(gameTitle)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E2DED5] pb-5">
        <h1 className="text-3xl font-bold text-[#18181B]">Create Game</h1>
        <p className="text-sm text-[#57534E] mt-1">
          Prompt any original puzzle or arcade game, play it live in the preview, and export it as a self-contained HTML file.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-stretch">
        {/* Chat Prompt Window */}
        <section className="bg-white border border-[#E2DED5] rounded-xl flex flex-col h-[620px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2DED5] bg-[#FAF9F6] flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#57534E]">
              Game Studio Chat
            </span>
            {generatedHtml && (
              <button
                type="button"
                onClick={() => {
                  setGeneratedHtml('');
                  setGameTitle('');
                  setMessages([messages[0]]);
                  setError(null);
                }}
                className="text-xs font-medium text-[#57534E] hover:text-[#18181B] transition-colors"
              >
                New Game
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#18181B] text-[#FAF9F6]'
                      : 'bg-[#F2EFE9] text-[#18181B]'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {messages.length === 1 && !isGenerating && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-medium text-[#57534E]">
                  Try an idea:
                </p>
                <div className="flex flex-col gap-1.5">
                  {STARTER_PROMPTS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => void sendPrompt(starter)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#18181B] transition-colors"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-[#F2EFE9] text-[#18181B] rounded-xl px-3.5 py-2.5 text-sm inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Building playable HTML game...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800">
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-[#E2DED5] bg-[#FAF9F6] flex items-end gap-2"
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendPrompt(input);
                }
              }}
              placeholder={
                generatedHtml
                  ? 'Ask to adjust rules, speed, colors, or controls...'
                  : 'Describe your game or custom puzzle idea...'
              }
              className="flex-1 resize-none rounded-lg border border-[#E2DED5] bg-white px-3 py-2 text-sm text-[#18181B] placeholder:text-[#78716C] focus:outline-2 focus:outline-[#18181B]"
            />
            <button
              type="submit"
              disabled={isGenerating || !input.trim()}
              aria-label="Send prompt"
              className="h-10 px-4 rounded-lg bg-[#18181B] hover:bg-zinc-800 disabled:opacity-40 text-[#FAF9F6] inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>

        {/* Live Playable Game Frame */}
        <section className="bg-white border border-[#E2DED5] rounded-xl flex flex-col h-[620px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2DED5] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Gamepad2 className="w-4 h-4 text-[#57534E] shrink-0" />
              <span className="text-sm font-semibold text-[#18181B] truncate">
                {gameTitle || 'Live Play Preview'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!generatedHtml}
                onClick={() => setIframeKey((k) => k + 1)}
                className="h-9 px-3 rounded-lg border border-[#E2DED5] bg-white hover:bg-[#F2EFE9] disabled:opacity-40 text-xs font-medium text-[#18181B] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>

              <button
                type="button"
                disabled={!generatedHtml}
                onClick={handleExportHtml}
                className="h-9 px-3.5 rounded-lg bg-[#18181B] hover:bg-zinc-800 disabled:opacity-40 text-xs font-semibold text-[#FAF9F6] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export File
              </button>
            </div>
          </div>

          <div className="flex-1 bg-[#F7F5F0] relative">
            {generatedHtml ? (
              <iframe
                key={iframeKey}
                title={gameTitle || 'Generated Game'}
                srcDoc={generatedHtml}
                sandbox="allow-scripts allow-forms"
                className="w-full h-full border-0 bg-white"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#E2DED5] flex items-center justify-center text-[#57534E]">
                  <Gamepad2 className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-[#18181B]">
                  Your playable game appears here
                </h2>
                <p className="text-sm text-[#57534E] max-w-sm">
                  Send a game or puzzle prompt in the chat window on the left to build and play it live, then download it as a standalone HTML file.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
