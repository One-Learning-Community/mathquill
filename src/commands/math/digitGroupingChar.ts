import { Direction, L, pray, R } from '../../utils';
import { MQSymbol } from '../MQSymbol';

const SPACE = '\\ ';
const DOT = '.';

export class DigitGroupingChar extends MQSymbol {
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
    // don't try to fix digit grouping if the sibling to my right changed (dir === R or
    // undefined) and it's now a DigitGroupingChar, it will try to fix grouping
    if (dir !== L && this[R] instanceof DigitGroupingChar) return;
    this.fixDigitGrouping(opts);
  }

  fixDigitGrouping(opts: CursorOptions) {
    if (!opts.enableDigitGrouping) return;
    // `this` is a digit 0-9, or a SPACE, or a DOT
    var left: NodeRef = this;

    // traverse left as far as possible (starting at this char)
    var node: NodeRef = left;
    do {
      if (/^[0-9]$/.test(node.ctrlSeq!)) {
        left = node;
      } else if (node.ctrlSeq === SPACE) {
        left = node;
      } else if (node.ctrlSeq === DOT) {
        left = node;
      } else {
        break;
      }
    } while ((node = left[L]));

    // Traverse right from the left node.
    // 'left' is the leftmost 0-9, SPACE, or DOT contiguous from this.
    DigitGroupingChar.fixDigitGroupingFromLeft(opts, left);
  }

  /** Treat `left` as the start of a number. Scan right. */
  static fixDigitGroupingFromLeft(opts: CursorOptions, left: NodeRef) {
    // trim the leading spaces
    while (left && left.ctrlSeq === SPACE) {
      if (!left[R]) return;
      left = left[R];
    }

    if (!(left instanceof DigitGroupingChar)) {
      // Trimmed off all spaces, and left with non-digit, e.g. `\\ a`
      return;
    }

    var node: NodeRef = left;
    pray('node', node);
    var right: NodeRef = left;
    var spacesFound = 0;
    var dotStreak = 0;
    var dots: DigitGroupingChar[] = [];
    // traverse right as far as possible (starting to right of this char)
    do {
      // Invariant: "right" is a DigitGroupingChar
      if (/^[0-9]$/.test(node.ctrlSeq!)) {
        right = node;
        dotStreak = 0;
      } else if (node.ctrlSeq === SPACE) {
        right = node;
        spacesFound += 1;
        dotStreak = 0;
      } else if (node.ctrlSeq === DOT && node instanceof DigitGroupingChar) {
        right = node;
        dots.push(node);
        if (opts.tripleDotsAreEllipsis) {
          dotStreak += 1;
        }
      } else {
        break;
      }
      if (dotStreak == 3) {
        break;
      }
    } while ((node = right[R]));

    // Exited the loop for one of two reasons:
    // 1. `dotStreak == 3`. In this case, trim off the three trailing dots,
    // and continue again from the character after the ellipsis.
    if (dotStreak === 3) {
      const rightDot = dots.pop()!;
      const middleDot = dots.pop()!;
      const leftDot = dots.pop()!;
      if (rightDot[R] instanceof DigitGroupingChar) {
        DigitGroupingChar.fixDigitGroupingFromLeft(opts, rightDot[R]);
      }
      rightDot.setGroupingClass('mq-ellipsis-end');
      middleDot.setGroupingClass('mq-ellipsis-middle');
      leftDot.setGroupingClass('mq-ellipsis-start');
      right = leftDot[L];
      if (left === leftDot) {
        // e.g. `[-...5]` afer typing the `-`.
        // `left` is the left `.`, and `right` is the `-`.
        return;
      }
      // Else, fallthrough. `left` through `right` (inclusive) is a sequence of
      // `DigitGroupingChar`s containing no three consecutive dots.
    }
    // 2. `!right[R]` or `right[R]` is not a digit grouping char.
    // In this case, `right` is the rightmost digit of the number.
    // Case 1 (`dotStreak == 3`) falls to this: after `right = right[L][L][L]`,
    // then `right` is the rightmost digit before the ellipsis.

    // trim the trailing spaces
    while (right !== left && right && right.ctrlSeq === SPACE) {
      right = right[L];
      spacesFound -= 1;
    }

    // happens when you only have a space
    if (left === right && left && left.ctrlSeq === SPACE) return;

    var disableFormatting = spacesFound > 0 || dots.length > 1;
    if (disableFormatting) {
      DigitGroupingChar.removeGroupingBetween(left, right);
    } else if (dots[0]) {
      if (dots[0] !== left) {
        DigitGroupingChar.addGroupingBetween(dots[0][L], left);
      }
      if (dots[0] !== right) {
        // we do not show grouping to the right of a decimal place #yet
        // Remove the grouping for the decimal itself and the digits to the right.
        DigitGroupingChar.removeGroupingBetween(dots[0], right);
      }
    } else {
      DigitGroupingChar.addGroupingBetween(right, left);
    }
  }

  static removeGroupingBetween(left: NodeRef, right: NodeRef) {
    var node = left;
    do {
      if (node instanceof DigitGroupingChar) {
        node.setGroupingClass(undefined);
      }
      if (!node || node === right) break;
    } while ((node = node[R]));
  }

  // Works right-to-left, so `start` is the rightmost, and `end` is the leftmost.
  // Assumes all nodes from `end` to `start` are `DigitGroupingChar`s.
  static addGroupingBetween(start: NodeRef, end: NodeRef) {
    var node = start;
    var count = 0;
    var totalDigits = 0;
    while (node) {
      totalDigits += 1;
      pray('digit', node instanceof DigitGroupingChar);

      if (node === end) break;
      node = node[L];
    }

    var numDigitsInFirstGroup = totalDigits % 3;
    if (numDigitsInFirstGroup === 0) numDigitsInFirstGroup = 3;

    var node = start;
    while (node) {
      count += 1;

      var cls = undefined;

      // only do grouping if we have at least 4 numbers
      if (totalDigits >= 4) {
        if (count === totalDigits) {
          cls = 'mq-group-leading-' + numDigitsInFirstGroup;
        } else if (count % 3 === 0) {
          if (count !== totalDigits) {
            cls = 'mq-group-start';
          }
        }

        if (!cls) {
          cls = 'mq-group-other';
        }
      }

      if (node instanceof DigitGroupingChar) {
        node.setGroupingClass(cls);
      }

      if (node === end) break;
      node = node[L] as DigitGroupingChar;
    }
  }

  _groupingClass?: string;

  setGroupingClass(cls: string | undefined) {
    // nothing changed (either class is the same or it's still undefined)
    if (this._groupingClass === cls) return;

    // remove existing class
    if (this._groupingClass) this.domFrag().removeClass(this._groupingClass);

    // add new class
    if (cls) this.domFrag().addClass(cls);

    // cache the groupingClass
    this._groupingClass = cls;
  }
}