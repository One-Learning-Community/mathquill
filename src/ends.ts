import { L, R } from './utils';

export type Ends<T> = {
  readonly [L]: T;
  readonly [R]: T;
};