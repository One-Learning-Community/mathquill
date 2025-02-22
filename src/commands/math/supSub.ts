import { MathCommand } from '../mathCommand';
import { MathBlock } from '../mathElement';
import { Ends } from '../../ends';
import { Direction, L, pray, R } from '../../utils';
import type { Cursor } from '../../cursor';
import { Point } from '../../tree';
import type { MQNode } from '../../services/MQNode';
import { MQSymbol } from '../MQSymbol';
import { domFrag } from '../../domFragment';
import { U_ZERO_WIDTH_SPACE } from '../../unicode';
import { insLeftOfMeUnlessAtEnd } from './insLeftOfMeUnlessAtEnd';
import { linkElementByBlockNode } from '../../nodeFunctions';
import { h } from '../../dom';

export class SupSub extends MathCommand {
  ctrlSeq = '_{...}^{...}';
  sub?: MathBlock;
  sup?: MathBlock;
  supsub: 'sup' | 'sub';

  protected ends: Ends<MathBlock>;

  setEnds(ends: Ends<MathBlock>) {
    pray(
      'SupSub ends must be MathBlocks',
      ends[L] instanceof MathBlock && ends[R] instanceof MathBlock
    );
    this.ends = ends;
  }

  getEnd(dir: Direction): MathBlock {
    return this.ends[dir];
  }

  createLeftOf(cursor: Cursor) {
    if (
      !this.replacedFragment &&
      !cursor[L] &&
      cursor.options.supSubsRequireOperand
    )
      return;
    return super.createLeftOf(cursor);
  }

  contactWeld(cursor: Cursor) {
    // Look on either side for a SupSub, if one is found compare my
    // .sub, .sup with its .sub, .sup. If I have one that it doesn't,
    // then call .addBlock() on it with my block; if I have one that
    // it also has, then insert my block's children into its block,
    // unless my block has none, in which case insert the cursor into
    // its block (and not mine, I'm about to remove myself) in the case
    // I was just typed.
    // TODO: simplify

    // equiv. to [L, R].forEach(function(dir) { ... });
    for (var dir: L | R | false = L; dir; dir = dir === L ? R : false) {
      const thisDir = this[dir];
      let pt;
      if (thisDir instanceof SupSub) {
        // equiv. to 'sub sup'.split(' ').forEach(function(supsub) { ... });
        for (
          var supsub: 'sub' | 'sup' | false = 'sub';
          supsub;
          supsub = supsub === 'sub' ? 'sup' : false
        ) {
          var src = this[supsub],
            dest = thisDir[supsub];
          if (!src) continue;
          if (!dest) thisDir.addBlock(src.disown());
          else if (!src.isEmpty()) {
            // ins src children at -dir end of dest
            src
              .domFrag()
              .children()
              .insAtDirEnd(-dir as Direction, dest.domFrag().oneElement());
            var children = src.children().disown();
            pt = new Point(dest, children.getEnd(R), dest.getEnd(L));
            if (dir === L) children.adopt(dest, dest.getEnd(R), 0);
            else children.adopt(dest, 0, dest.getEnd(L));
          } else {
            pt = new Point(dest, 0, dest.getEnd(L));
          }
          this.placeCursor = (function(dest, src) {
            // TODO: don't monkey-patch
            return function(cursor: Cursor) {
              cursor.insAtDirEnd(-dir as Direction, dest || src);
            };
          })(dest, src);
        }
        this.remove();
        if (cursor && cursor[L] === this) {
          if (dir === R && pt) {
            if (pt[L]) {
              cursor.insRightOf(pt[L] as MQNode);
            } else {
              cursor.insAtLeftEnd(pt.parent);
            }
          } else cursor.insRightOf(thisDir);
        }
        break;
      }
    }
  }

  finalizeTree() {
    var endsL = this.getEnd(L);
    endsL.write = function(cursor: Cursor, ch: string) {
      if (
        cursor.options.autoSubscriptNumerals &&
        this === (this.parent as SupSub).sub &&
        '0123456789'.indexOf(ch) >= 0
      ) {
        var cmd = this.chToCmd(ch, cursor.options);
        if (cmd instanceof MQSymbol) cursor.deleteSelection();
        else cursor.clearSelection().insRightOf(this.parent);
        cmd.createLeftOf(cursor.show());
        cursor.controller.aria
          .queue('Baseline')
          .alert(cmd.mathspeak({ createdLeftOf: cursor }));
        return;
      }
      if (
        cursor[L] &&
        !cursor[R] &&
        !cursor.selection &&
        cursor.options.charsThatBreakOutOfSupSub.indexOf(ch) > -1
      ) {
        cursor.insRightOf(this.parent);
        cursor.controller.aria.queue('Baseline');
      }
      MathBlock.prototype.write.call(this, cursor, ch);
    };
  }

  moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
    if (cursor.options.autoSubscriptNumerals && !this.sup) {
      cursor.insDirOf(dir, this);
    } else super.moveTowards(dir, cursor, updown);
  }

  deleteTowards(dir: Direction, cursor: Cursor) {
    if (cursor.options.autoSubscriptNumerals && this.sub) {
      var cmd = this.sub.getEnd(-dir as Direction);
      if (cmd instanceof MQSymbol) cmd.remove();
      else if (cmd)
        cmd.deleteTowards(dir, cursor.insAtDirEnd(-dir as Direction, this.sub));

      // TODO: factor out a .removeBlock() or something
      if (this.sub.isEmpty()) {
        this.sub.deleteOutOf(L, cursor.insAtLeftEnd(this.sub));
        if (this.sup) cursor.insDirOf(-dir as Direction, this);
        // Note `-dir` because in e.g. x_1^2| want backspacing (leftward)
        // to delete the 1 but to end up rightward of x^2; with non-negated
        // `dir` (try it), the cursor appears to have gone "through" the ^2.
      }
    } else super.deleteTowards(dir, cursor);
  }

  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    if (this.sub) {
      ctx.latex += '_{';
      const beforeLength = ctx.latex.length;
      this.sub.latexRecursive(ctx);
      const afterLength = ctx.latex.length;
      if (beforeLength === afterLength) {
        // nothing was written. so we write a space
        ctx.latex += ' ';
      }

      ctx.latex += '}';
    }

    if (this.sup) {
      ctx.latex += '^{';
      const beforeLength = ctx.latex.length;
      this.sup.latexRecursive(ctx);
      const afterLength = ctx.latex.length;
      if (beforeLength === afterLength) {
        // nothing was written. so we write a space
        ctx.latex += ' ';
      }

      ctx.latex += '}';
    }

    this.checkCursorContextClose(ctx);
  }

  text() {
    function text(prefix: string, block: NodeRef | undefined) {
      var l = (block && block.text()) || '';
      return block
        ? prefix + (l.length === 1 ? l : '(' + (l || ' ') + ')')
        : '';
    }

    return text('_', this.sub) + text('^', this.sup);
  }

  addBlock(block: MathBlock) {
    if (this.supsub === 'sub') {
      this.sup = this.upInto = (this.sub as MQNode).upOutOf = block;
      block.adopt(this, this.sub as MQNode, 0).downOutOf = this.sub;
      block.setDOM(
        domFrag(h('span', { class: 'mq-sup' }))
          .append(block.domFrag().children())
          .prependTo(this.domFrag().oneElement())
          .oneElement()
      );
      linkElementByBlockNode(block.domFrag().oneElement(), block);
    } else {
      this.sub = this.downInto = (this.sup as MQNode).downOutOf = block;
      block.adopt(this, 0, this.sup as MQNode).upOutOf = this.sup;
      this.domFrag().removeClass('mq-sup-only');
      block.setDOM(
        domFrag(h('span', { class: 'mq-sub' }))
          .append(block.domFrag().children())
          .appendTo(this.domFrag().oneElement())
          .oneElement()
      );
      linkElementByBlockNode(block.domFrag().oneElement(), block);
      this.domFrag().append(
        domFrag(
          h('span', { style: 'display:inline-block;width:0' }, [
            h.text(U_ZERO_WIDTH_SPACE)
          ])
        )
      );
    }

    // like 'sub sup'.split(' ').forEach(function(supsub) { ... });
    for (var i = 0; i < 2; i += 1)
      (function(
        cmd: SupSub,
        supsub: 'sup' | 'sub',
        oppositeSupsub: 'sup' | 'sub',
        updown: 'up' | 'down'
      ) {
        const cmdSubSub = cmd[supsub]!;
        cmdSubSub.deleteOutOf = function(dir: Direction, cursor: Cursor) {
          cursor.insDirOf(this[dir] ? (-dir as Direction) : dir, this.parent);
          if (!this.isEmpty()) {
            var end = this.getEnd(dir);
            this.children()
              .disown()
              .withDirAdopt(
                dir,
                cursor.parent,
                cursor[dir],
                cursor[-dir as Direction]
              )
              .domFrag()
              .insDirOf(-dir as Direction, cursor.domFrag());
            cursor[-dir as Direction] = end;
          }
          cmd.supsub = oppositeSupsub;
          delete cmd[supsub];
          delete cmd[`${updown}Into`];
          const cmdOppositeSupsub = cmd[oppositeSupsub]!;
          cmdOppositeSupsub[`${updown}OutOf`] = insLeftOfMeUnlessAtEnd;
          delete (cmdOppositeSupsub as any).deleteOutOf; // TODO - refactor so this method can be optional
          if (supsub === 'sub') {
            cmd.domFrag().addClass('mq-sup-only').children().last().remove();
          }
          this.remove();
        };
      })(
        this,
        'sub sup'.split(' ')[i] as 'sup' | 'sup',
        'sup sub'.split(' ')[i] as 'sup' | 'sup',
        'down up'.split(' ')[i] as 'up' | 'down'
      );
  }
}