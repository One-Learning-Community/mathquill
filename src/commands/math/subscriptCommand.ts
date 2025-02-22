import { DOMView } from '../DOMView';
import { U_ZERO_WIDTH_SPACE } from '../../unicode';
import { L } from '../../utils';
import { insLeftOfMeUnlessAtEnd } from './insLeftOfMeUnlessAtEnd';
import { SupSub } from './supSub';

export class SubscriptCommand extends SupSub {
  supsub = 'sub' as const;

  domView = new DOMView(1, (blocks) =>
    h('span', { class: 'mq-supsub mq-non-leaf' }, [
      h.block('span', { class: 'mq-sub' }, blocks[0]),
      h('span', { style: 'display:inline-block;width:0' }, [
        h.text(U_ZERO_WIDTH_SPACE)
      ])
    ])
  );

  textTemplate = ['_'];

  mathspeakTemplate = ['Subscript,', ', Baseline'];

  ariaLabel = 'subscript';

  finalizeTree() {
    this.downInto = this.sub = this.getEnd(L);
    this.sub.upOutOf = insLeftOfMeUnlessAtEnd;
    super.finalizeTree();
  }
}