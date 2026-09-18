import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clipboard,
  Code2,
  GitBranch,
  Languages,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const starterText = "feat: add dark mode toggle to settings\n\nUsers can now switch between light and dark themes from their profile preferences.";

function normalizeInput(value: string) {
  return value.replace(/\r?\n|\r/g, " ").replace(/[ \t]+/g, " ").trimStart();
}

export default function Home() {
  const [source, setSource] = useState(starterText);
  const [translated, setTranslated] = useState("");
  const [copied, setCopied] = useState(false);
  const translateMutation = trpc.translation.translate.useMutation({
    onSuccess: (data) => {
      setTranslated(data.translatedText);
      setCopied(false);
    },
  });

  const charCount = useMemo(() => source.length, [source]);

  function handleTranslate() {
    if (!source.trim()) return;
    translateMutation.mutate({
      text: source,
      sourceLanguage: "inglês",
      targetLanguage: "português do Brasil",
    });
  }

  async function handleCopy() {
    if (!translated) return;
    await navigator.clipboard.writeText(translated);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleClear() {
    setSource("");
    setTranslated("");
    setCopied(false);
    translateMutation.reset();
  }

  function useExample() {
    setSource(starterText);
    setTranslated("");
    translateMutation.reset();
  }

  const errorMessage = translateMutation.error?.message;

  return (
    <div className="min-h-screen overflow-hidden bg-ink text-paper">
      <div className="grain" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex max-w-[1280px] items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <a className="group flex items-center gap-3" href="#top" aria-label="Commit Lingo, início">
          <span className="brand-mark"><GitBranch size={18} strokeWidth={2.5} /></span>
          <span className="font-display text-lg font-semibold tracking-[-0.03em]">commit lingo</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-paper sm:flex" aria-label="Navegação principal">
          <a className="nav-link" href="#tradutor">Tradutor</a>
          <a className="nav-link" href="#fluxo">Como funciona</a>
          <span className="language-chip"><span className="status-dot" /> PT-BR</span>
        </nav>
        <span className="language-chip sm:hidden"><span className="status-dot" /> PT-BR</span>
      </header>

      <main id="top" className="relative z-10 mx-auto max-w-[1280px] px-5 pb-20 sm:px-8 lg:px-12">
        <section className="hero-grid py-12 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="eyebrow animate-rise"><Sparkles size={14} /> tradução técnica, sem ruído</div>
            <h1 className="font-display animate-rise delay-1 mt-7 max-w-4xl text-[clamp(3.5rem,8.5vw,7.6rem)] font-semibold leading-[0.88] tracking-[-0.075em]">
              Commit em inglês.<br /><em>Contexto em português.</em>
            </h1>
            <p className="animate-rise delay-2 mt-8 max-w-xl text-lg leading-relaxed text-muted-paper sm:text-xl">
              Traduza mensagens de commit com o contexto certo para o seu time — mantendo o formato técnico, a intenção e o histórico legível.
            </p>
          </div>
          <div className="hero-note animate-rise delay-2 hidden self-end justify-self-end lg:block">
            <span className="note-line" />
            <p>Agora conectado ao NVIDIA NIM<br />com tradução contextual em tempo real.</p>
          </div>
        </section>

        <section id="tradutor" className="editor-shell animate-rise delay-3">
          <div className="editor-topbar">
            <div className="flex items-center gap-3">
              <div className="window-dots"><i /><i /><i /></div>
              <span className="mono text-[11px] uppercase tracking-[0.16em] text-muted-paper">commit-translator / workspace</span>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-paper sm:flex"><Code2 size={14} /> riva-translate-4b</div>
          </div>

          <div className="editor-columns">
            <div className="editor-pane input-pane">
              <div className="pane-header">
                <div><span className="pane-index">01</span><span className="pane-title">Mensagem original</span></div>
                <button className="text-button" onClick={handleClear} type="button"><RotateCcw size={13} /> limpar</button>
              </div>
              <label className="sr-only" htmlFor="commit-source">Mensagem de commit em inglês</label>
              <textarea
                id="commit-source"
                value={source}
                onChange={(event) => setSource(normalizeInput(event.target.value))}
                placeholder="Cole aqui a mensagem do commit em inglês..."
                spellCheck="false"
              />
              <div className="pane-footer"><span>{charCount} caracteres{charCount > 1925 ? " · será dividido automaticamente" : ""}</span><span className="mono">EN → PT-BR</span></div>
            </div>

            <div className="translate-divider" aria-hidden="true"><ArrowRight size={16} /></div>

            <div className="editor-pane output-pane">
              <div className="pane-header">
                <div><span className="pane-index accent-index">02</span><span className="pane-title">Versão em português</span></div>
                <span className="ready-label"><span className="status-dot" /> {translateMutation.isPending ? "traduzindo" : translated ? "pronto para colar" : "aguardando"}</span>
              </div>
              <div className={`output-content ${translateMutation.isPending ? "is-translating" : ""}`} aria-live="polite">
                {translateMutation.isPending ? <span className="placeholder-output">Consultando o NVIDIA NIM...</span> : translated ? <pre>{translated}</pre> : <span className="placeholder-output">A tradução formatada aparece aqui.</span>}
              </div>
              <div className="pane-footer output-footer">
                <span className="quality-label"><WandSparkles size={13} /> {translated ? "contexto preservado pelo NIM" : "modelo pronto para traduzir"}</span>
                <button className={`copy-button ${copied ? "copied" : ""}`} onClick={handleCopy} type="button" disabled={!translated}>
                  {copied ? <><Check size={14} /> copiado</> : <><Clipboard size={14} /> copiar</>}
                </button>
              </div>
            </div>
          </div>

          <div className="editor-actionbar">
            <div className="action-hint"><Languages size={16} /><span>Preserva Conventional Commits, identificadores e quebras de linha.</span></div>
            <button className="translate-button" onClick={handleTranslate} type="button" disabled={translateMutation.isPending || !source.trim()}>
              {translateMutation.isPending ? "traduzindo..." : "traduzir com nim"}<ArrowUpRight size={17} />
            </button>
          </div>
          {errorMessage && <div className="error-banner" role="alert">{errorMessage}</div>}
        </section>

        <section id="fluxo" className="how-section">
          <div className="section-kicker"><span>o fluxo</span><span className="kicker-rule" /></div>
          <div className="how-grid">
            <div>
              <h2 className="font-display max-w-xl text-4xl font-semibold leading-[0.95] tracking-[-0.055em] sm:text-5xl">Menos tradução literal.<br /><em>Mais intenção.</em></h2>
              <p className="mt-6 max-w-md leading-relaxed text-muted-paper">Uma camada rápida entre o que você escreveu e o contexto que o time precisa entender.</p>
            </div>
            <div className="steps-grid">
              <div className="step-card"><span>01</span><h3>cole</h3><p>Traga a mensagem do commit em inglês, com título e corpo.</p></div>
              <div className="step-card"><span>02</span><h3>traduza</h3><p>O Riva adapta o texto para um português técnico e natural.</p></div>
              <div className="step-card"><span>03</span><h3>envie</h3><p>Copie o resultado e mantenha seu histórico consistente.</p></div>
            </div>
          </div>
        </section>

        <footer className="mt-20 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-xs text-muted-paper sm:flex-row">
          <span className="mono">commit lingo / riva-nim</span>
          <span>feito para times que cuidam do contexto.</span>
        </footer>
      </main>
    </div>
  );
}
