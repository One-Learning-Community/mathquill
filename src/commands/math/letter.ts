import { Variable } from './variable';
import { Cursor } from '../../cursor';
import { Direction, L, R } from '../../utils';
import { Fragment, isMQNodeClass, LatexCmds } from '../../tree';
import { MQNode } from '../../services/MQNode';
import { TempSingleCharNode } from '../../services/latex';
import { Bracket, SummationNotation } from './commands';
import { BinaryOperator } from '../math';
import { BuiltInOpNames, TwoWordOpNames } from './opNames';
import { SupSub } from './supSub';

function letterSequenceEndingAtNode(node: NodeRef, maxLength: number) {
  let str = '';
  let i = 0;
  // Inelegant approach to avoid counting operatorname letters as letters here:
  // node.ctrlSeq === node.letter holds true unless node is:
  //  - first or last letter in an operator name like \operatorname{arcsinh}, or
  //    (`\operatorname{` is prepended to first, and `}` is appended to last)
  //  - first or last letter in a builtin like `\sin `
  //    (`\` is prepended to first, and ` ` (space) is appended to last)
  while (
    node instanceof Letter &&
    node.ctrlSeq === node.letter &&
    i < maxLength
    ) {
    str = node.letter + str;
    node = node[L];
    i += 1;
  }
  return str;
}

export class Letter extends Variable {
  letter: string;
  /**
   * If this is the last letter of an operatorname (`\operatorname{arcsinh}`)
   * or builtin (`\sin`), give its category, based on infixOperatorNames
   * and prefixOperatorNames. E.g. "for" may be infix and "sin" may be prefix.
   */
  endsCategory?: undefined | 'infix' | 'prefix';
  /**
   * Similarly to endsCategory, give the string name, e.g. "sin" or "arcsinh".
   */
  endsWord?: string;

  constructor(ch: string) {
    super(ch);
    this.letter = ch;
  }

  checkAutoCmds(cursor: Cursor) {
    //exit early if in simple subscript and disableAutoSubstitutionInSubscripts is set.
    if (this.shouldIgnoreSubstitutionInSimpleSubscript(cursor.options)) {
      return;
    }

    //handle autoCommands
    var autoCmds = cursor.options.autoCommands;
    var maxLength = autoCmds._maxLength || 0;
    if (maxLength > 0) {
      // want longest possible autocommand, so join together longest
      // sequence of letters
      let str = letterSequenceEndingAtNode(this, maxLength) ?? '';
      // check for an autocommand, going thru substrings longest to shortest
      while (str.length) {
        if (autoCmds.hasOwnProperty(str)) {
          let l: NodeRef = this;
          for (let i = 1; l && i < str.length; i += 1, l = l[L]) ;

          new Fragment(l, this).remove();
          cursor[L] = (l as MQNode)[L];

          var cmd = LatexCmds[str];
          var node;
          if (isMQNodeClass(cmd)) {
            node = new (cmd as typeof TempSingleCharNode)(str); // TODO - How do we know that this class expects a single str input?
          } else {
            node = cmd(str);
          }

          return node.createLeftOf(cursor);
        }
        str = str.slice(1);
      }
    }
  }

  autoParenthesize(cursor: Cursor) {
    //exit early if already parenthesized
    var right = cursor.parent.getEnd(R);
    if (right && right instanceof Bracket && right.ctrlSeq === '\\left(') {
      return;
    }

    //exit early if in simple subscript and disableAutoSubstitutionInSubscripts is set.
    if (this.shouldIgnoreSubstitutionInSimpleSubscript(cursor.options)) {
      return;
    }

    //handle autoParenthesized functions
    var str = '';
    var l: NodeRef = this;
    var i = 0;

    var autoParenthesizedFunctions = cursor.options.autoParenthesizedFunctions;
    var maxLength = autoParenthesizedFunctions._maxLength || 0;
    var autoOperatorNames = cursor.options.autoOperatorNames;
    while (l instanceof Letter && i < maxLength) {
      (str = l.letter + str), (l = l[L]), (i += 1);
    }
    // check for an autoParenthesized functions, going thru substrings longest to shortest
    // only allow autoParenthesized functions that are also autoOperatorNames
    while (str.length) {
      if (
        autoParenthesizedFunctions.hasOwnProperty(str) &&
        autoOperatorNames.hasOwnProperty(str)
      ) {
        return cursor.parent.write(cursor, '(');
      }
      str = str.slice(1);
    }
  }

  createLeftOf(cursor: Cursor) {
    super.createLeftOf(cursor);

    this.checkAutoCmds(cursor);
    this.autoParenthesize(cursor);
  }

  italicize(bool: boolean) {
    this.isItalic = bool;
    this.isPartOfOperator = !bool;
    if (bool) {
      delete this.endsCategory;
      delete this.endsWord;
    }
    this.domFrag().toggleClass('mq-operator-name', !bool);
    return this;
  }

  finalizeTree(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }

  siblingDeleted(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }

  siblingCreated(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }

  sharedSiblingMethod(opts: CursorOptions, dir: Direction) {
    // don't auto-un-italicize if the sibling to my right changed (dir === R or
    // undefined) and it's now a Letter, it will un-italicize everyone
    if (dir !== L && this[R] instanceof Letter) return;
    this.autoUnItalicize(opts);
  }

  autoUnItalicize(opts: CursorOptions) {
    var autoOps = opts.autoOperatorNames;
    if (autoOps._maxLength === 0) return;

    //exit early if in simple subscript and disableAutoSubstitutionInSubscripts is set.
    if (this.shouldIgnoreSubstitutionInSimpleSubscript(opts)) {
      return;
    }

    // want longest possible operator names, so join together entire contiguous
    // sequence of letters
    var str = this.letter;
    for (var l = this[L]; l instanceof Letter; l = l[L]) str = l.letter + str;
    for (var r = this[R]; r instanceof Letter; r = r[R]) str += r.letter;

    // removeClass and delete flags from all letters before figuring out
    // which, if any, are part of an operator name
    var lR = l && l[R];
    var rL = r && r[L];

    new Fragment(lR || this.parent.getEnd(L), rL || this.parent.getEnd(R)).each(
      function(el) {
        if (el instanceof Letter) {
          el.italicize(true)
            .domFrag()
            .removeClass('mq-first mq-last mq-followed-by-supsub');
          el.ctrlSeq = el.letter;
        }
        return undefined;
      }
    );

    let autoOpsLength = autoOps._maxLength || 0;

    // check for operator names: at each position from left to right, check
    // substrings from longest to shortest
    outer: for (
      var i = 0, first = (l as MQNode)[R] || this.parent.getEnd(L);
      first && i < str.length;
      i += 1, first = (first as MQNode)[R]
    ) {
      for (
        var len = Math.min(autoOpsLength, str.length - i);
        len > 0;
        len -= 1
      ) {
        var word = str.slice(i, i + len);
        var last: Letter = undefined!; // TODO - TS complaining that we use last before assigning to it

        if (autoOps.hasOwnProperty(word)) {
          for (
            var j = 0, letter: NodeRef = first;
            j < len;
            j += 1, letter = (letter as MQNode)[R]
          ) {
            if (letter instanceof Letter) {
              letter.italicize(false);
              last = letter;
            }
          }

          var isBuiltIn = BuiltInOpNames.hasOwnProperty(word);
          first.ctrlSeq =
            (isBuiltIn ? '\\' : '\\operatorname{') + first.ctrlSeq;
          last.ctrlSeq += isBuiltIn ? ' ' : '}';
          last.endsWord = word;
          if (opts.infixOperatorNames[word]) {
            last.endsCategory = 'infix';
          } else if (opts.prefixOperatorNames[word]) {
            last.endsCategory = 'prefix';
          }

          if (TwoWordOpNames.hasOwnProperty(word)) {
            const lastL = last[L];
            const lastLL = lastL && lastL[L];
            const lastLLL = (lastLL && lastLL[L]) as MQNode;
            lastLLL.domFrag().addClass('mq-last');
          }

          if (!this.shouldOmitPadding(first[L]))
            first.domFrag().addClass('mq-first');
          if (!this.shouldOmitPadding(last[R])) {
            if (last[R] instanceof SupSub) {
              var supsub = last[R] as MQNode; // XXX monkey-patching, but what's the right thing here?
              // Have operatorname-specific code in SupSub? A CSS-like language to style the
              // math tree, but which ignores cursor and selection (which CSS can't)?
              var respace =
                (supsub.siblingCreated =
                  supsub.siblingDeleted =
                    function() {
                      supsub
                        .domFrag()
                        .toggleClass(
                          'mq-after-operator-name',
                          !(supsub[R] instanceof Bracket)
                        );
                    });
              respace();
            } else {
              last
                .domFrag()
                .toggleClass('mq-last', !(last[R] instanceof Bracket));
            }
          }

          i += len - 1;
          first = last;
          continue outer;
        }
      }
    }
  }

  shouldOmitPadding(node: NodeRef) {
    // omit padding if no node
    if (!node) return true;

    // do not add padding between letter and '.'
    if (node.ctrlSeq === '.') return true;

    // do not add padding between letter and binary operator. The
    // binary operator already has padding
    if (node instanceof BinaryOperator && node.isBinaryOperator()) return true;

    if (node instanceof SummationNotation) return true;

    return false;
  }
}