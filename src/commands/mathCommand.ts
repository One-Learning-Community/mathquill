import { Fragment } from '../tree';
import { Ends } from '../ends';
import { MQNode } from '../services/MQNode';
import { Direction, L, pray, R } from '../utils';
import { latexMathParser } from '../services/latex';
import { Anticursor, Cursor, MQSelection } from '../cursor';
import { NodeBase } from '../nodeBase';
import { MathElement } from './mathElement';
import { DOMView } from './DOMView';
import { MathBlock } from './mathElement';

/**
 * Commands and operators, like subscripts, exponents, or fractions.
 * Descendant commands are organized into blocks.
 */
export class MathCommand extends MathElement {
  replacedFragment: Fragment | undefined;
  protected domView: DOMView;
  protected ends: Ends<MQNode>;

  constructor(ctrlSeq?: string, domView?: DOMView, textTemplate?: string[]) {
    super();
    this.setCtrlSeqHtmlAndText(ctrlSeq, domView, textTemplate);
  }

  setEnds(ends: Ends<MQNode>) {
    pray('MathCommand ends are never empty', ends[L] && ends[R]);
    this.ends = ends;
  }

  getEnd(dir: Direction): MQNode {
    return this.ends[dir];
  }

  setCtrlSeqHtmlAndText(
    ctrlSeq?: string,
    domView?: DOMView,
    textTemplate?: string[]
  ) {
    if (!this.ctrlSeq) this.ctrlSeq = ctrlSeq;
    if (domView) this.domView = domView;
    if (textTemplate) this.textTemplate = textTemplate;
  }

  // obvious methods
  replaces(replacedFragment: Fragment) {
    replacedFragment.disown();
    this.replacedFragment = replacedFragment;
  }

  isEmpty() {
    return this.foldChildren(true, function(isEmpty, child) {
      return isEmpty && child.isEmpty();
    });
  }

  parser(): Parser<MQNode | Fragment> {
    var block = latexMathParser.block;

    return block.times(this.numBlocks()).map((blocks) => {
      this.blocks = blocks;

      for (var i = 0; i < blocks.length; i += 1) {
        blocks[i].adopt(this, this.getEnd(R), 0);
      }

      return this;
    });
  }

  // createLeftOf(cursor) and the methods it calls
  createLeftOf(cursor: Cursor) {
    var cmd = this;
    var replacedFragment = cmd.replacedFragment;

    cmd.createBlocks();
    super.createLeftOf(cursor);
    if (replacedFragment) {
      const cmdEndsL = cmd.getEnd(L);
      replacedFragment.adopt(cmdEndsL, 0, 0);
      replacedFragment.domFrag().appendTo(cmdEndsL.domFrag().oneElement());
      cmd.placeCursor(cursor);
      cmd.prepareInsertionAt(cursor);
    }
    cmd.finalizeInsert(cursor.options, cursor);
    cmd.placeCursor(cursor);
  }

  createBlocks() {
    var cmd = this,
      numBlocks = cmd.numBlocks(),
      blocks = (cmd.blocks = Array(numBlocks));

    for (var i = 0; i < numBlocks; i += 1) {
      var newBlock = (blocks[i] = new MathBlock());
      newBlock.adopt(cmd, cmd.getEnd(R), 0);
    }
  }

  placeCursor(cursor: Cursor) {
    //insert the cursor at the right end of the first empty child, searching
    //left-to-right, or if none empty, the right end child
    cursor.insAtRightEnd(
      this.foldChildren(this.getEnd(L), function(leftward, child) {
        return leftward.isEmpty() ? leftward : child;
      })
    );
  }

  // editability methods: called by the cursor for editing, cursor movements,
  // and selection of the MathQuill tree, these all take in a direction and
  // the cursor
  moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
    var updownInto: NodeRef | undefined;
    if (updown === 'up') {
      updownInto = this.upInto;
    } else if (updown === 'down') {
      updownInto = this.downInto;
    }

    const el = updownInto || this.getEnd(-dir as Direction);
    cursor.insAtDirEnd(-dir as Direction, el);
    cursor.controller.aria
      .queueDirEndOf(-dir as Direction)
      .queue(cursor.parent, true);
  }

  deleteTowards(dir: Direction, cursor: Cursor) {
    if (this.isEmpty()) cursor[dir] = this.remove()[dir];
    else this.moveTowards(dir, cursor);
  }

  selectTowards(dir: Direction, cursor: Cursor) {
    cursor[-dir as Direction] = this;
    cursor[dir] = this[dir];
  }

  selectChildren(): MQSelection {
    return new MQSelection(this, this);
  }

  unselectInto(dir: Direction, cursor: Cursor) {
    const antiCursor = cursor.anticursor as Anticursor;
    const ancestor = antiCursor.ancestors[this.id] as MQNode;
    cursor.insAtDirEnd(-dir as Direction, ancestor);
  }

  seek(clientX: number, cursor: Cursor) {
    function getBounds(node: MQNode) {
      const el = node.domFrag().oneElement();
      const l = getBoundingClientRect(el).left;
      var r: number = l + el.offsetWidth;
      return {
        [L]: l,
        [R]: r
      };
    }

    var cmd = this;
    var cmdBounds = getBounds(cmd);

    if (clientX < cmdBounds[L]) return cursor.insLeftOf(cmd);
    if (clientX > cmdBounds[R]) return cursor.insRightOf(cmd);

    var leftLeftBound = cmdBounds[L];
    cmd.eachChild(function(block) {
      var blockBounds = getBounds(block);
      if (clientX < blockBounds[L]) {
        // closer to this block's left bound, or the bound left of that?
        if (clientX - leftLeftBound < blockBounds[L] - clientX) {
          if (block[L]) cursor.insAtRightEnd(block[L] as MQNode);
          else cursor.insLeftOf(cmd);
        } else cursor.insAtLeftEnd(block);
        return false;
      } else if (clientX > blockBounds[R]) {
        if (block[R]) leftLeftBound = blockBounds[R];
        // continue to next block
        else {
          // last (rightmost) block
          // closer to this block's right bound, or the cmd's right bound?
          if (cmdBounds[R] - clientX < clientX - blockBounds[R]) {
            cursor.insRightOf(cmd);
          } else cursor.insAtRightEnd(block);
        }
        return undefined;
      } else {
        block.seek(clientX, cursor);
        return false;
      }
    });

    return undefined;
  }

  numBlocks() {
    return this.domView.childCount;
  }

  /**
   * Render the entire math subtree rooted at this command to a DOM node. Assumes `this.domView` is defined.
   *
   * See dom.test.js for example templates and intended outputs.
   */
  html(): Element | DocumentFragment {
    const blocks = this.blocks;
    pray('domView is defined', this.domView);
    const template = this.domView;
    const dom = template.render(blocks || []);
    this.setDOM(dom);
    NodeBase.linkElementByCmdNode(dom, this);
    return dom;
  }

  // methods to export a string representation of the math tree
  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    ctx.latex += this.ctrlSeq || '';
    this.eachChild((child) => {
      ctx.latex += '{';

      let beforeLength = ctx.latex.length;
      child.latexRecursive(ctx);
      let afterLength = ctx.latex.length;
      if (beforeLength === afterLength) {
        // nothing was written so we write a space
        ctx.latex += ' ';
      }

      ctx.latex += '}';
    });

    this.checkCursorContextClose(ctx);
  }

  textTemplate = [''];

  text() {
    var cmd = this,
      i = 0;
    return cmd.foldChildren(cmd.textTemplate[i], function(text, child) {
      i += 1;
      var child_text = child.text();
      if (
        text &&
        cmd.textTemplate[i] === '(' &&
        child_text[0] === '(' &&
        child_text.slice(-1) === ')'
      )
        return text + child_text.slice(1, -1) + cmd.textTemplate[i];
      return text + child_text + (cmd.textTemplate[i] || '');
    });
  }

  mathspeakTemplate = [''];

  mathspeak() {
    var cmd = this,
      i = 0;
    return cmd.foldChildren(
      cmd.mathspeakTemplate[i] || 'Start' + cmd.ctrlSeq + ' ',
      function(speech, block) {
        i += 1;
        return (
          speech +
          ' ' +
          block.mathspeak() +
          ' ' +
          (cmd.mathspeakTemplate[i] + ' ' || 'End' + cmd.ctrlSeq + ' ')
        );
      }
    );
  }
}