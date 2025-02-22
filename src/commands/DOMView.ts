import type { MathBlock } from './mathElement';

export class DOMView {
  constructor(
    public readonly childCount: number,
    public readonly render: (blocks: MathBlock[]) => Element
  ) {
  }
}