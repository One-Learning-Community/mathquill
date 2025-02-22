import type { Cursor } from '../cursor';
import { Controller } from '../services/textarea';
import { Direction, L, R } from '../utils';
import { MQNode } from '../services/MQNode';
import { Letter } from './math/letter';
import { Digit } from './math/digit';
import { CharCmds, LatexCmds } from '../tree';
import { latexMathParser } from '../services/latex';
import { domFrag } from '../domFragment';

import { VanillaSymbol } from './vanillaSymbol';

/**
 * Math tree node base class.
 * Some math-tree-specific extensions to MQNode.
 * Both MathBlock's and MathCommand's descend from it.
 */
export class MathElement extends MQNode {
  finalizeInsert(options: CursorOptions, cursor: Cursor) {
    var self = this;
    self.postOrder(function(node) {
      node.finalizeTree(options);
    });
    self.postOrder(function(node) {
      node.contactWeld(cursor);
    });

    // note: this order is important.
    // empty elements need the empty box provided by blur to
    // be present in order for their dimensions to be measured
    // correctly by 'reflow' handlers.
    self.postOrder(function(node) {
      node.blur(cursor);
    });

    self.postOrder(function(node) {
      node.reflow();
    });
    var selfR = self[R];
    var selfL = self[L];
    if (selfR) selfR.siblingCreated(options, L);
    if (selfL) selfL.siblingCreated(options, R);
    self.bubble(function(node) {
      node.reflow();
      return undefined;
    });
  }

  // If the maxDepth option is set, make sure
  // deeply nested content is truncated. Just return
  // false if the cursor is already too deep.
  prepareInsertionAt(cursor: Cursor) {
    var maxDepth = cursor.options.maxDepth;
    if (maxDepth !== undefined) {
      var cursorDepth = cursor.depth();
      if (cursorDepth > maxDepth) {
        return false;
      }
      this.removeNodesDeeperThan(maxDepth - cursorDepth);
    }
    return true;
  }

  // Remove nodes that are more than `cutoff`
  // blocks deep from this node.
  removeNodesDeeperThan(cutoff: number) {
    var depth = 0;
    var queue: [[MQNode, number]] = [[this, depth]];
    var current: [MQNode, number] | undefined;

    // Do a breadth-first search of this node's descendants
    // down to cutoff, removing anything deeper.
    while ((current = queue.shift())) {
      var c = current;
      c[0].children().each(function(child) {
        var i = child instanceof MathBlock ? 1 : 0;
        depth = c[1] + i;

        if (depth <= cutoff) {
          queue.push([child, depth]);
        } else {
          (i ? child.children() : child).remove();
        }
        return undefined;
      });
    }
  }
}

/**
 * Children and parent of MathCommand's. Basically partitions all the
 * symbols and operators that descend (in the Math DOM tree) from
 * ancestor operators.
 */
export class MathBlock extends MathElement {
  controller?: Controller;

  join(methodName: JoinMethod) {
    return this.foldChildren('', function(fold, child) {
      return fold + child[methodName]();
    });
  }

  html() {
    const fragment = document.createDocumentFragment();
    this.eachChild((el) => {
      const childHtml = el.html();
      fragment.appendChild(childHtml);
      return undefined;
    });
    return fragment;
  }

  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);
    this.eachChild((child) => child.latexRecursive(ctx));
    this.checkCursorContextClose(ctx);
  }

  text() {
    var endsL = this.getEnd(L);
    var endsR = this.getEnd(R);
    return endsL === endsR && endsL !== 0 ? endsL.text() : this.join('text');
  }

  mathspeak() {
    var tempOp = '';
    var autoOps: CursorOptions['autoOperatorNames'] = {};
    if (this.controller) autoOps = this.controller.options.autoOperatorNames;
    return (
      this.foldChildren<string[]>([], function(speechArray, cmd) {
        if (cmd.isPartOfOperator) {
          tempOp += cmd.mathspeak();
        } else {
          if (tempOp !== '') {
            if (autoOps._maxLength! > 0) {
              var x = autoOps[tempOp.toLowerCase()];
              if (typeof x === 'string') tempOp = x;
            }
            speechArray.push(tempOp + ' ');
            tempOp = '';
          }
          var mathspeakText = cmd.mathspeak();
          var cmdText = cmd.ctrlSeq;
          if (
            isNaN(cmdText as any) && // TODO - revisit this to improve the isNumber() check
            cmdText !== '.' &&
            (!cmd.parent ||
              !cmd.parent.parent ||
              !cmd.parent.parent.isTextBlock())
          ) {
            mathspeakText = ' ' + mathspeakText + ' ';
          }
          speechArray.push(mathspeakText);
        }
        return speechArray;
      })
        .join('')
        .replace(/ +(?= )/g, '')
        // For Apple devices in particular, split out digits after a decimal point so they aren't read aloud as whole words.
        // Not doing so makes 123.456 potentially spoken as "one hundred twenty-three point four hundred fifty-six."
        // Instead, add spaces so it is spoken as "one hundred twenty-three point four five six."
        .replace(/(\.)([0-9]+)/g, function(_match, p1, p2) {
          return p1 + p2.split('').join(' ').trim();
        })
    );
  }

  ariaLabel = 'block';

  keystroke(key: string, e: KeyboardEvent | undefined, ctrlr: Controller) {
    if (
      ctrlr.options.spaceBehavesLikeTab &&
      (key === 'Spacebar' || key === 'Shift-Spacebar')
    ) {
      e?.preventDefault();
      ctrlr.escapeDir(key === 'Shift-Spacebar' ? L : R, key, e);
      return;
    }
    return super.keystroke(key, e, ctrlr);
  }

  // editability methods: called by the cursor for editing, cursor movements,
  // and selection of the MathQuill tree, these all take in a direction and
  // the cursor
  moveOutOf(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
    var updownInto: NodeRef | undefined;
    if (updown === 'up') {
      updownInto = this.parent.upInto;
    } else if (updown === 'down') {
      updownInto = this.parent.downInto;
    }

    if (!updownInto && this[dir]) {
      const otherDir = -dir as Direction;
      cursor.insAtDirEnd(otherDir, this[dir] as MQNode);
      cursor.controller.aria.queueDirEndOf(otherDir).queue(cursor.parent, true);
    } else {
      cursor.insDirOf(dir, this.parent);
      cursor.controller.aria.queueDirOf(dir).queue(this.parent);
    }
  }

  selectOutOf(dir: Direction, cursor: Cursor) {
    cursor.insDirOf(dir, this.parent);
  }

  deleteOutOf(_dir: Direction, cursor: Cursor) {
    cursor.unwrapGramp();
  }

  seek(clientX: number, cursor: Cursor) {
    var node = this.getEnd(R);
    if (!node) return cursor.insAtRightEnd(this);
    const el = node.domFrag().oneElement();
    const left = getBoundingClientRect(el).left;
    if (left + el.offsetWidth < clientX) {
      return cursor.insAtRightEnd(this);
    }

    var endsL = this.getEnd(L) as MQNode;
    if (clientX < getBoundingClientRect(endsL.domFrag().oneElement()).left)
      return cursor.insAtLeftEnd(this);
    while (clientX < getBoundingClientRect(node.domFrag().oneElement()).left)
      node = node[L] as MQNode;
    return node.seek(clientX, cursor);
  }

  chToCmd(ch: string, options: CursorOptions) {
    var cons;
    // exclude f because it gets a dedicated command with more spacing
    if (ch.match(/^[a-eg-zA-Z]$/)) return new Letter(ch);
    else if (/^\d$/.test(ch)) return new Digit(ch);
    else if (options && options.typingSlashWritesDivisionSymbol && ch === '/')
      return (LatexCmds as LatexCmdsSingleCharBuilder)['÷'](ch);
    else if (options && options.typingAsteriskWritesTimesSymbol && ch === '*')
      return (LatexCmds as LatexCmdsSingleCharBuilder)['×'](ch);
    else if (options && options.typingPercentWritesPercentOf && ch === '%')
      return (LatexCmds as LatexCmdsSingleCharBuilder).percentof(ch);
    else if (
      (cons = (CharCmds as CharCmdsAny)[ch] || (LatexCmds as LatexCmdsAny)[ch])
    ) {
      if (cons.constructor) {
        return new cons(ch);
      } else {
        return cons(ch);
      }
    } else return new VanillaSymbol(ch);
  }

  write(cursor: Cursor, ch: string) {
    var cmd = this.chToCmd(ch, cursor.options);
    if (cursor.selection) cmd.replaces(cursor.replaceSelection());
    if (!cursor.isTooDeep()) {
      cmd.createLeftOf(cursor.show());
      // special-case the slash so that fractions are voiced while typing
      if (ch === '/') {
        cursor.controller.aria.alert('over');
      } else {
        cursor.controller.aria.alert(cmd.mathspeak({ createdLeftOf: cursor }));
      }
    }
  }

  writeLatex(cursor: Cursor, latex: string) {
    var all = Parser.all;
    var eof = Parser.eof;

    var block = latexMathParser
      .skip(eof)
      .or(all.result<false>(false))
      .parse(latex);

    if (block && !block.isEmpty() && block.prepareInsertionAt(cursor)) {
      block
        .children()
        .adopt(cursor.parent, cursor[L] as NodeRef, cursor[R] as NodeRef); // TODO - masking undefined. should be 0
      domFrag(block.html()).insertBefore(cursor.domFrag());
      cursor[L] = block.getEnd(R);
      block.finalizeInsert(cursor.options, cursor);
      var blockEndsR = block.getEnd(R);
      var blockEndsL = block.getEnd(L);
      var blockEndsRR = (blockEndsR as MQNode)[R];
      var blockEndsLL = (blockEndsL as MQNode)[L];
      if (blockEndsRR) blockEndsRR.siblingCreated(cursor.options, L);
      if (blockEndsLL) blockEndsLL.siblingCreated(cursor.options, R);
      cursor.parent.bubble(function(node) {
        node.reflow();
        return undefined;
      });
    }
  }

  focus() {
    this.domFrag().addClass('mq-hasCursor');
    this.domFrag().removeClass('mq-empty');

    return this;
  }

  blur(cursor: Cursor) {
    this.domFrag().removeClass('mq-hasCursor');
    if (this.isEmpty()) {
      this.domFrag().addClass('mq-empty');
      if (
        cursor &&
        this.isQuietEmptyDelimiter(cursor.options.quietEmptyDelimiters)
      ) {
        this.domFrag().addClass('mq-quiet-delimiter');
      }
    }
    return this;
  }
}