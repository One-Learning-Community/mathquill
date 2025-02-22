import type { MQNode } from '../../services/MQNode';
import type { Anticursor, Cursor } from '../../cursor';
import { R } from '../../utils';

export function insLeftOfMeUnlessAtEnd(this: MQNode, cursor: Cursor) {
  // cursor.insLeftOf(cmd), unless cursor at the end of block, and every
  // ancestor cmd is at the end of every ancestor block
  var cmd = this.parent;
  var ancestorCmd: MQNode | Anticursor | Cursor = cursor;
  do {
    if (ancestorCmd[R]) return cursor.insLeftOf(cmd);
    ancestorCmd = ancestorCmd.parent.parent;
  } while (ancestorCmd !== cmd);
  cursor.insRightOf(cmd);
  return undefined;
}