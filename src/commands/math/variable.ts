import { BinaryOperator } from '../math';
import { L, R } from '../../utils';
import { MQNode } from '../../services/MQNode';
import { MQSymbol } from '../MQSymbol';
import { SupSub } from './supSub';

export class Variable extends MQSymbol {
  isItalic?: boolean;

  constructor(chOrCtrlSeq: string, html?: ChildNode) {
    super(chOrCtrlSeq, h('var', {}, [html || h.text(chOrCtrlSeq)]));
  }

  text() {
    var text = this.ctrlSeq || '';
    if (this.isPartOfOperator) {
      if (text[0] == '\\') {
        text = text.slice(1, text.length);
      } else if (text[text.length - 1] == ' ') {
        text = text.slice(0, -1);
      }
    } else {
      if (
        this[L] &&
        !(this[L] instanceof Variable) &&
        !(this[L] instanceof BinaryOperator) &&
        (this[L] as MQNode).ctrlSeq !== '\\ '
      )
        text = '*' + text;
      if (
        this[R] &&
        !(this[R] instanceof BinaryOperator) &&
        !(this[R] instanceof SupSub)
      )
        text += '*';
    }
    return text;
  }

  mathspeak() {
    var text = this.ctrlSeq || '';
    if (
      this.isPartOfOperator ||
      text.length > 1 ||
      (this.parent && this.parent.parent && this.parent.parent.isTextBlock())
    ) {
      return super.mathspeak();
    } else {
      // Apple voices in VoiceOver (such as Alex, Bruce, and Victoria) do
      // some strange pronunciation given certain expressions,
      // e.g. "y-2" is spoken as "ee minus 2" (as if the y is short).
      // Not an ideal solution, but surrounding non-numeric text blocks with quotation marks works.
      // This bug has been acknowledged by Apple.
      return '"' + text + '"';
    }
  }
}