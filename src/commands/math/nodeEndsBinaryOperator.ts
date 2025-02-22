import { BinaryOperator } from '../math';

import { Letter } from './letter';

/**
 * Return true if:
 * - node is BinaryOperator (+, ×, -, etc), including PlusMinus which could
 *   siometimes be interpreted as unary, or
 * - node ends an infix word like "for" specified in `infixOperatorNames`
 */
export function nodeEndsBinaryOperator(node: NodeRef): boolean {
  return (
    node instanceof BinaryOperator ||
    (node instanceof Letter && node.endsCategory == 'infix')
  );
}