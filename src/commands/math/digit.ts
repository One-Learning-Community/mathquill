import type { Cursor } from '../../cursor';
import { L } from '../../utils';
import { Variable } from './variable';
import { DigitGroupingChar } from './digitGroupingChar';
import { SubscriptCommand } from './subscriptCommand';
import { SupSub } from './supSub';

export class Digit extends DigitGroupingChar {
  constructor(ch: string, mathspeak?: string) {
    super(
      ch,
      h('span', { class: 'mq-digit' }, [h.text(ch)]),
      undefined,
      mathspeak
    );
  }

  createLeftOf(cursor: Cursor) {
    const cursorL = cursor[L];
    const cursorLL = cursorL && cursorL[L];
    const cursorParentParentSub =
      cursor.parent.parent instanceof SupSub
        ? cursor.parent.parent.sub
        : undefined;

    if (
      cursor.options.autoSubscriptNumerals &&
      cursor.parent !== cursorParentParentSub &&
      ((cursorL instanceof Variable && cursorL.isItalic !== false) ||
        (cursorL instanceof SupSub &&
          cursorLL instanceof Variable &&
          cursorLL.isItalic !== false))
    ) {
      new SubscriptCommand().createLeftOf(cursor);
      super.createLeftOf(cursor);
      cursor.insRightOf(cursor.parent.parent);
    } else super.createLeftOf(cursor);
  }

  mathspeak(opts: MathspeakOptions) {
    if (opts && opts.createdLeftOf) {
      var cursor = opts.createdLeftOf;
      var cursorL = cursor[L];
      var cursorLL = cursorL && cursorL[L];
      const cursorParentParentSub =
        cursor.parent.parent instanceof SupSub
          ? cursor.parent.parent.sub
          : undefined;

      if (
        cursor.options.autoSubscriptNumerals &&
        cursor.parent !== cursorParentParentSub &&
        ((cursorL instanceof Variable && cursorL.isItalic !== false) ||
          (cursor[L] instanceof SupSub &&
            cursorLL instanceof Variable &&
            cursorLL.isItalic !== false))
      ) {
        return 'Subscript ' + super.mathspeak() + ' Baseline';
      }
    }
    return super.mathspeak();
  }
}