import { MQSymbol } from './MQSymbol';

export class VanillaSymbol extends MQSymbol {
  constructor(ch: string, html?: ChildNode, mathspeak?: string) {
    super(ch, h('span', {}, [html || h.text(ch)]), undefined, mathspeak);
  }
}