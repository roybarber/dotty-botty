import bash from '@shikijs/langs/bash';
import css from '@shikijs/langs/css';
import tsx from '@shikijs/langs/tsx';
import theme from '@shikijs/themes/github-dark-default';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

export type Lang = 'tsx' | 'bash' | 'css';

// Only the three grammars and one theme the page uses, with the JS regex
// engine so no WebAssembly is shipped.
const highlighter = createHighlighterCore({
  themes: [theme],
  langs: [tsx, bash, css],
  engine: createJavaScriptRegexEngine(),
});

export async function highlight(code: string, lang: Lang): Promise<string> {
  return (await highlighter).codeToHtml(code, { lang, theme: 'github-dark-default' });
}
