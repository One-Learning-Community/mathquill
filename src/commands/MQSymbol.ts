import type { MQNode } from '../services/MQNode';
import type { Fragment } from '../tree';
import { Direction } from '../utils';
import type { Cursor } from '../cursor';
import { MathCommand } from './mathCommand';
import { DOMView } from './DOMView';

/**
 * Lightweight command without blocks or children.
 */
export class MQSymbol extends MathCommand {
  constructor(
    ctrlSeq?: string,
    html?: HTMLElement,
    text?: string,
    mathspeak?: string
  ) {
    super();
    this.setCtrlSeqHtmlTextAndMathspeak(
      ctrlSeq,
      html
        ? new DOMView(0, () => html.cloneNode(true) as HTMLElement)
        : undefined,
      text,
      mathspeak
    );
  }

  setCtrlSeqHtmlTextAndMathspeak(
    ctrlSeq?: string,
    html?: DOMView,
    text?: string,
    mathspeak?: string
  ) {
    if (!text && !!ctrlSeq) {
      text = ctrlSeq.replace(/^\\/, '');
    }

    this.mathspeakName = mathspeak || text;
    super.setCtrlSeqHtmlAndText(ctrlSeq, html, [text || '']);
  }

  parser(): Parser<MQNode | Fragment> {
    return Parser.succeed(this);
  }

  numBlocks() {
    return 0 as const;
  }

  replaces(replacedFragment: Fragment) {
    replacedFragment.remove();
  }

  createBlocks() {
  }

  moveTowards(dir: Direction, cursor: Cursor) {
    cursor.domFrag().insDirOf(dir, this.domFrag());
    cursor[-dir as Direction] = this;
    cursor[dir] = this[dir];
    cursor.controller.aria.queue(this);
  }

  deleteTowards(dir: Direction, cursor: Cursor) {
    cursor[dir] = this.remove()[dir];
  }

  seek(clientX: number, cursor: Cursor) {
    // insert at whichever side the click was closer to
    const el = this.domFrag().oneElement();
    const left = getBoundingClientRect(el).left;
    if (clientX - left < el.offsetWidth / 2) cursor.insLeftOf(this);
    else cursor.insRightOf(this);

    return cursor;
  }

  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);
    ctx.latex += this.ctrlSeq || '';
    this.checkCursorContextClose(ctx);
  }

  text() {
    return this.textTemplate.join('');
  }

  mathspeak(_opts?: MathspeakOptions) {
    return this.mathspeakName || '';
  }

  placeCursor() {
  }

  isEmpty() {
    return true;
  }
}