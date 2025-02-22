import type { MQNode } from './services/MQNode';
import type { Cursor } from './cursor';
import type { DOMFragment } from './domFragment';
import { eachNode, foldNodes, Fragment } from './tree';
import type { Ends } from './ends';

import { domFrag } from './domFragment';
import { Direction, L, pray, prayDirection, R } from './utils';
import { MQSelection } from './cursor';
import { Letter } from './commands/math/letter';
import { MathBlock } from './commands/mathElement';
import { SupSub } from './commands/math/supSub';

export class NodeBase {
  static idCounter = 0;

  static uniqueNodeId() {
    return (NodeBase.idCounter += 1);
  }

  // TODO - life would be so much better in typescript of these were undefined instead of
  // 0. The ! would save us in cases where we know a node is defined.
  [L]: NodeRef = 0;
  [R]: NodeRef = 0;

  // TODO - can this ever actually stay 0? if so we need to add null checks
  parent: MQNode = 0 as any as MQNode;

  /**
   * The (doubly-linked) list of this node's children.
   *
   * NOTE child classes may specify a narrower type for ends e.g. to
   * enforce that children are not empty, or that they have a certain
   * type. In those cases, this initializer may still run at
   * construction time, but this is expected to be followed by a call
   * to adopt that sets non-empty ends of the necessary types.
   *
   * Similarly, `Fragment::disown` may temporarily break non-empty
   * invariants, which are expected to be restored by a subsequent call
   * to `Fragment::adopt`.
   * */
  protected ends: Ends<NodeRef> = { [L]: 0, [R]: 0 };

  setEnds(ends: Ends<NodeRef>) {
    this.ends = ends;
    pray('No half-empty node ends', !!this.ends[L] === !!this.ends[R]);
  }

  getEnd(dir: Direction) {
    return this.ends[dir];
  }

  private _el: Element | Text | undefined;
  id = NodeBase.uniqueNodeId();
  ctrlSeq: string | undefined;
  ariaLabel: string | undefined;
  textTemplate: string[] | undefined;
  mathspeakName: string | undefined;
  sides:
    | {
    [L]: { ch: string; ctrlSeq: string };
    [R]: { ch: string; ctrlSeq: string };
  }
    | undefined;
  blocks: MathBlock[] | undefined;
  mathspeakTemplate: string[] | undefined;
  upInto: MQNode | undefined;
  downInto: MQNode | undefined;
  upOutOf?: MQNode | ((cursor: Cursor) => Cursor | undefined);
  downOutOf?: MQNode | ((cursor: Cursor) => Cursor | undefined);

  isPartOfOperator: boolean | undefined;

  toString() {
    return '{{ MathQuill Node #' + this.id + ' }}';
  }

  setDOM(el: Element | Text | undefined) {
    if (el) {
      pray(
        'DOM is an element or a text node',
        el.nodeType === Node.ELEMENT_NODE || el.nodeType === Node.TEXT_NODE
      );
    }

    this._el = el;
    return this;
  }

  domFrag(): DOMFragment {
    return domFrag(this._el);
  }

  createDir(dir: Direction, cursor: Cursor) {
    prayDirection(dir);
    var node = this;
    node.html();
    node.domFrag().insDirOf(dir, cursor.domFrag());
    cursor[dir] = node.adopt(cursor.parent, cursor[L]!, cursor[R]!); // TODO - assuming not undefined, could be 0
    return node;
  }

  createLeftOf(cursor: Cursor) {
    this.createDir(L, cursor);
  }

  selectChildren(leftEnd: MQNode, rightEnd: MQNode) {
    return new MQSelection(leftEnd, rightEnd);
  }

  bubble(yield_: (ancestor: MQNode) => boolean | undefined) {
    var self = this.getSelfNode();

    for (var ancestor: NodeRef = self; ancestor; ancestor = ancestor.parent) {
      var result = yield_(ancestor);
      if (result === false) break;
    }

    return this;
  }

  postOrder(yield_: (el: MQNode) => void) {
    var self = this.getSelfNode();

    (function recurse(descendant: MQNode) {
      if (!descendant) return false;
      descendant.eachChild(recurse);
      yield_(descendant);
      return true;
    })(self);

    return self;
  }

  isEmpty() {
    return this.ends[L] === 0 && this.ends[R] === 0;
  }

  isQuietEmptyDelimiter(dlms: { [id: string]: any } | undefined) {
    if (!this.isEmpty()) return false;
    if (!dlms) return false;
    if (!this.parent || this.parent.ctrlSeq === undefined) return false;
    // Remove any leading \left or \right from the ctrl sequence before looking it up.
    var key = this.parent.ctrlSeq.replace(/^\\(left|right)?/, '');
    return dlms.hasOwnProperty(key);
  }

  isStyleBlock() {
    return false;
  }

  isTextBlock() {
    return false;
  }

  children() {
    return new Fragment(this.getEnd(L), this.getEnd(R));
  }

  eachChild(yield_: (el: MQNode) => boolean | undefined | void) {
    eachNode(this.ends, yield_);
    return this;
  }

  foldChildren<T>(fold: T, yield_: (fold: T, el: MQNode) => T) {
    return foldNodes(this.ends, fold, yield_);
  }

  withDirAdopt(
    dir: Direction,
    parent: MQNode,
    withDir: NodeRef,
    oppDir: NodeRef
  ) {
    const self = this.getSelfNode();
    new Fragment(self, self).withDirAdopt(dir, parent, withDir, oppDir);
    return this;
  }

  /**
   * Add this node to the given parent node's children, at the position between the adjacent
   * children `leftward` (or the beginning if omitted) and `rightward` (or the end if omitted).
   * See `Fragment#adopt()`
   */
  adopt(parent: MQNode, leftward: NodeRef, rightward: NodeRef) {
    var self = this.getSelfNode();
    new Fragment(self, self).adopt(parent, leftward, rightward);
    return this.getSelfNode();
  }

  disown() {
    var self = this.getSelfNode();
    new Fragment(self, self).disown();
    return this;
  }

  remove() {
    this.domFrag().remove();
    return this.disown();
  }

  shouldIgnoreSubstitutionInSimpleSubscript(options: CursorOptions) {
    const opt = options.disableAutoSubstitutionInSubscripts;
    if (!opt) return false;
    if (!this.parent) return false;
    if (!(this.parent.parent instanceof SupSub)) return false;

    // Allow substitution in e.g. log subscripts
    const before = this.parent.parent[L];
    if (
      typeof opt === 'object' &&
      before instanceof Letter &&
      before.endsWord &&
      opt.except[before.endsWord]
    ) {
      return false;
    }

    // Mathquill is gross. There are many different paths that
    // create subscripts and sometimes we don't even construct
    // true instances of `LatexCmds._`. Another problem is that
    // the relationship between the sub and the SupSub isn't
    // completely setup during a paste at the time we check
    // this. I wanted to use: `this.parent.parent.sub !== this.parent`
    // but that check doesn't always work. This seems to be the only
    // check that always works. I'd rather live with this than try
    // to change the init order of things.
    if (!this.parent.domFrag().hasClass('mq-sub')) return false;

    return true;
  }

  getSelfNode() {
    // dumb dance to tell typescript that we eventually become a MQNode
    return this as any as MQNode;
  }

  // Overridden by child classes
  parser(): Parser<MQNode | Fragment> {
    pray('Abstract parser() method is never called', false);
  }

  /** Render this node to DOM */
  html(): Node | DocumentFragment {
    throw new Error('html() unimplemented in NodeBase');
  }

  text(): string {
    return '';
  }

  latex() {
    let ctx: LatexContext = { latex: '', startIndex: -1, endIndex: -1 };
    this.latexRecursive(ctx);
    return ctx.latex;
  }

  latexRecursive(_ctx: LatexContext): void {
  }

  checkCursorContextOpen(ctx: LatexContext) {
    if (ctx.startSelectionBefore === this) {
      ctx.startIndex = ctx.latex.length;
    }
    if (ctx.endSelectionBefore === this) {
      ctx.endIndex = ctx.latex.length;
    }
  }

  checkCursorContextClose(ctx: LatexContext) {
    if (ctx.startSelectionAfter === this) {
      ctx.startIndex = ctx.latex.length;
    }
    if (ctx.endSelectionAfter === this) {
      ctx.endIndex = ctx.latex.length;
    }
  }

  finalizeTree(_options: CursorOptions, _dir?: Direction) {
  }

  contactWeld(_cursor: Cursor, _dir?: Direction) {
  }

  blur(_cursor?: Cursor) {
  }

  focus() {
  }

  intentionalBlur() {
  }

  reflow() {
  }

  registerInnerField(_innerFields: InnerFields, _mathField: InnerMathField) {
  }

  chToCmd(_ch: string, _options?: CursorOptions): this {
    pray('Abstract chToCmd() method is never called', false);
  }

  mathspeak(_options?: MathspeakOptions) {
    return '';
  }

  seek(_clientX: number, _cursor: Cursor) {
  }

  siblingDeleted(_options: CursorOptions, _dir: Direction) {
  }

  siblingCreated(_options: CursorOptions, _dir: Direction) {
  }

  finalizeInsert(_options: CursorOptions, _cursor: Cursor) {
  }

  fixDigitGrouping(_opts: CursorOptions) {
  }

  writeLatex(_cursor: Cursor, _latex: string) {
  }

  write(_cursor: Cursor, _ch: string) {
  }
}