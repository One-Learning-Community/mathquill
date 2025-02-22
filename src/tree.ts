/*************************************************
 * Base classes of edit tree-related objects
 *
 * Only doing tree node manipulation via these
 * adopt/ disown methods guarantees well-formedness
 * of the tree.
 ************************************************/

import { Direction, L, pray, prayDirection, R } from './utils';
import type { DOMFragment } from './domFragment';
import { domFrag } from './domFragment';
import { MQNode } from './services/MQNode';
import type { NodeBase } from './nodeBase';
import type { Ends } from './ends';

/** A cursor-like location in an mq node tree. */
export class Point {
  /** The node to the left of this point (or 0 for the position before a first child) */
  [L]: NodeRef;
  /** The node to the right of this point (or 0 for the position after a last child) */
  [R]: NodeRef;
  parent: MQNode;

  constructor(parent: MQNode, leftward: NodeRef, rightward: NodeRef) {
    this.init(parent, leftward, rightward);
  }

  // keeping init around only for tests
  init(parent: MQNode, leftward: NodeRef, rightward: NodeRef) {
    this.parent = parent;
    this[L] = leftward;
    this[R] = rightward;
  }

  static copy(pt: Point) {
    return new Point(pt.parent, pt[L], pt[R]);
  }
}

export function eachNode(
  ends: Ends<NodeRef>,
  yield_: (el: MQNode) => boolean | undefined | void
) {
  var el = ends[L];
  if (!el) return;

  var stop = ends[R];
  if (!stop) return; //shouldn't happen because ends[L] is defined;
  stop = stop[R];

  // TODO - this cast as MQNode is actually important to keep tests passing. I went to
  // fix this code to gracefully handle an undefined el and there are tests that actually
  // verify that this will throw an error. So I'm keeping the behavior but ignoring the
  // type error.
  for (; el !== stop; el = (el as MQNode)[R]) {
    var result = yield_(el as MQNode); // TODO - might be passing in 0 intead of a MQNode, but tests want this
    if (result === false) break;
  }
}

export function foldNodes<T>(
  ends: Ends<NodeRef>,
  fold: T,
  yield_: (fold: T, el: MQNode) => T
): T {
  var el = ends[L];
  if (!el) return fold;

  var stop = ends[R];
  if (!stop) return fold; //shouldn't happen because ends[L] is defined;
  stop = stop[R];

  // TODO - this cast as MQNode is actually important to keep tests passing. I went to
  // fix this code to gracefully handle an undefined el and there are tests that actually
  // verify that this will throw an error. So I'm keeping the behavior but ignoring the
  // type error.
  for (; el !== stop; el = (el as MQNode)[R]) {
    fold = yield_(fold, el as MQNode); // TODO - might be passing in 0 intead of a MQNode, but tests want this
  }

  return fold;
}

export type ElementTrackingNode = {
  mqBlockNode?: NodeBase;
  mqCmdNode?: NodeBase;
};

function prayWellFormed(parent: MQNode, leftward: NodeRef, rightward: NodeRef) {
  pray('a parent is always present', parent);
  pray(
    'leftward is properly set up',
    (function () {
      // either it's empty and `rightward` is the left end child (possibly empty)
      if (!leftward) return parent.getEnd(L) === rightward;

      // or it's there and its [R] and .parent are properly set up
      return leftward[R] === rightward && leftward.parent === parent;
    })(),
    {
      parent: parent,
      leftward: leftward,
      leftwardL: leftward && leftward[L],
      leftwardR: leftward && leftward[R],
      rightwardL: rightward && rightward[L],
      rightwardR: rightward && rightward[R]
    }
  );

  pray(
    'rightward is properly set up',
    (function () {
      // either it's empty and `leftward` is the right end child (possibly empty)
      if (!rightward) return parent.getEnd(R) === leftward;

      // or it's there and its [L] and .parent are properly set up
      return rightward[L] === leftward && rightward.parent === parent;
    })(),
    {
      parent: parent,
      rightward: rightward,
      leftwardL: leftward && leftward[L],
      leftwardR: leftward && leftward[R],
      rightwardL: rightward && rightward[L],
      rightwardR: rightward && rightward[R],
      rightwardParent: rightward && rightward.parent
    }
  );
}

/**
 * An entity outside the virtual tree with one-way pointers (so it's only a
 * "view" of part of the tree, not an actual node/entity in the tree) that
 * delimits a doubly-linked list of sibling nodes.
 * It's like a fanfic love-child between HTML DOM DocumentFragment and the Range
 * classes: like DocumentFragment, its contents must be sibling nodes
 * (unlike Range, whose contents are arbitrary contiguous pieces of subtrees),
 * but like Range, it has only one-way pointers to its contents, its contents
 * have no reference to it and in fact may still be in the visible tree (unlike
 * DocumentFragment, whose contents must be detached from the visible tree
 * and have their 'parent' pointers set to the DocumentFragment).
 */
export class Fragment {
  /**
   * The (doubly-linked) list of nodes contained in this fragment.
   *
   * NOTE child classes may specify a narrower type for ends e.g. to
   * enforce that the Fragment is not empty.
   * */
  protected ends: Ends<NodeRef>;
  disowned: boolean = false;

  constructor(withDir: NodeRef, oppDir: NodeRef, dir?: Direction) {
    if (dir === undefined) dir = L;
    prayDirection(dir);

    pray('no half-empty fragments', !withDir === !oppDir, {
      withDir,
      oppDir
    });

    if (!withDir || !oppDir) {
      this.setEnds({ [L]: 0, [R]: 0 });
      return;
    }

    pray('withDir is passed to Fragment', withDir instanceof MQNode);
    pray('oppDir is passed to Fragment', oppDir instanceof MQNode);
    pray(
      'withDir and oppDir have the same parent',
      withDir.parent === oppDir.parent
    );

    const ends = {
      [dir as Direction]: withDir,
      [-dir as Direction]: oppDir
    } as Ends<MQNode>;

    this.setEnds(ends);

    let maybeRightEnd = 0 as NodeRef;
    this.each((el) => {
      maybeRightEnd = el;
    });
    pray(
      'following direction siblings from start reaches end',
      maybeRightEnd === ends[R]
    );
  }

  protected getDOMFragFromEnds() {
    const left = this.ends[L];
    const right = this.ends[R];
    if (left === 0 || right === 0) {
      return domFrag();
    } else if (left === right) {
      // Note, joining a DOMFragment to itself is not allowed, so
      // don't attempt to join the end fragments if the ends are equal
      return left.domFrag();
    } else {
      return left.domFrag().join(right.domFrag());
    }
  }

  /**
   * Note, children may override this to enforce extra invariants,
   * (e.g. that ends are always defined). Ends should only be set
   * through this function.
   */
  setEnds(ends: Ends<NodeRef>) {
    this.ends = ends;
  }

  getEnd(dir: Direction): NodeRef {
    return this.ends ? this.ends[dir] : 0;
  }

  domFrag(): DOMFragment {
    return this.getDOMFragFromEnds();
  }

  // like Cursor::withDirInsertAt(dir, parent, withDir, oppDir)
  withDirAdopt(
    dir: Direction,
    parent: MQNode,
    withDir: NodeRef,
    oppDir: NodeRef
  ) {
    return dir === L
      ? this.adopt(parent, withDir, oppDir)
      : this.adopt(parent, oppDir, withDir);
  }
  /**
   * Splice this fragment into the given parent node's children, at the position between the adjacent
   * children `leftward` (or the beginning if omitted) and `rightward` (or the end if omitted).
   *
   * TODO: why do we need both leftward and rightward? It seems to me that `rightward` is always expected to be `leftward ? leftward[R] : parent.ends[L]`.
   */
  adopt(parent: MQNode, leftward: NodeRef, rightward: NodeRef) {
    prayWellFormed(parent, leftward, rightward);

    var self = this;
    this.disowned = false;

    var leftEnd = self.ends[L];
    if (!leftEnd) return this;

    var rightEnd = self.ends[R];
    if (!rightEnd) return this;

    var ends = { [L]: parent.getEnd(L), [R]: parent.getEnd(R) };

    if (leftward) {
      // NB: this is handled in the ::each() block
      // leftward[R] = leftEnd
    } else {
      ends[L] = leftEnd;
    }

    if (rightward) {
      rightward[L] = rightEnd;
    } else {
      ends[R] = rightEnd;
    }

    parent.setEnds(ends);

    rightEnd[R] = rightward;

    self.each(function (el: MQNode) {
      el[L] = leftward;
      el.parent = parent;
      if (leftward) leftward[R] = el;

      leftward = el;
      return true;
    });

    return self;
  }

  /**
   * Remove the nodes in this fragment from their parent.
   */
  disown() {
    var self = this;
    var leftEnd = self.ends[L];

    // guard for empty and already-disowned fragments
    if (!leftEnd || self.disowned) return self;

    this.disowned = true;

    var rightEnd = self.ends[R];
    if (!rightEnd) return self;
    var parent = leftEnd.parent;

    prayWellFormed(parent, leftEnd[L], leftEnd);
    prayWellFormed(parent, rightEnd, rightEnd[R]);

    var ends = { [L]: parent.getEnd(L), [R]: parent.getEnd(R) };
    if (leftEnd[L]) {
      var leftLeftEnd = leftEnd[L] as MQNode;
      leftLeftEnd[R] = rightEnd[R];
    } else {
      ends[L] = rightEnd[R];
    }

    if (rightEnd[R]) {
      var rightRightEnd = rightEnd[R] as MQNode;
      rightRightEnd[L] = leftEnd[L];
    } else {
      ends[R] = leftEnd[L];
    }

    if (ends[L] && ends[R]) {
      parent.setEnds(ends);
    } else {
      // some child classes of MQNode try to enforce that their ends
      // are never empty through the type system. However, disown may
      // temporarily break this invariant in which case it's expected
      // that adopt will later be called to fix the invariant.
      //
      // Cast away the protected status of the ends property and write
      // to it directly to get around runtime assertions in setEnds that
      // enforce non-emptyness.
      (parent as any).ends = ends;
    }

    return self;
  }

  remove() {
    this.domFrag().remove();
    return this.disown();
  }

  each(yield_: (el: MQNode) => boolean | undefined | void) {
    eachNode(this.ends, yield_);
    return this;
  }

  fold<T>(fold: T, yield_: (fold: T, el: MQNode) => T) {
    return foldNodes(this.ends, fold, yield_);
  }
}

/**
 * Registry of LaTeX commands and commands created when typing
 * a single character.
 *
 * (Commands are all subclasses of Node.)
 */
export const LatexCmds: LatexCmds = {};
export const CharCmds: CharCmds = {};

export function isMQNodeClass(cmd: any): cmd is typeof MQNode {
  return cmd && cmd.prototype instanceof MQNode;
}
