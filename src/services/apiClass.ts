import { Controller } from './textarea';
import { MathBlock } from '../commands/mathElement';

export const EMBEDS: Record<string, (data: EmbedOptionsData) => EmbedOptions> = {};
export const API: APIClassBuilders = {};

export interface APIClasses {
  StaticMath?: IBaseMathQuillClass;
  MathField?: IEditableFieldClass;
  InnerMathField?: IEditableFieldClass;
  TextField?: IEditableFieldClass;
  AbstractMathQuill: IBaseMathQuillClass;
  EditableField: IEditableFieldClass;
}

export type APIClassBuilders = {
  StaticMath?: (APIClasses: APIClasses) => IBaseMathQuillClass;
  MathField?: (APIClasses: APIClasses) => IEditableFieldClass;
  InnerMathField?: (APIClasses: APIClasses) => IEditableFieldClass;
  TextField?: (APIClasses: APIClasses) => IEditableFieldClass;
};

export interface IBaseMathQuill extends BaseMathQuill, InternalMathQuillInstance {}

export interface IBaseMathQuillClass {
  new (ctrlr: Controller): IBaseMathQuill;
  RootBlock: typeof MathBlock;
}

export interface IEditableField extends EditableMathQuill, InternalMathQuillInstance {}

export interface IEditableFieldClass {
  new (ctrlr: Controller): IEditableField;
  RootBlock: typeof MathBlock;
}

/** MathQuill instance fields/methods that are internal, not exposed in the public type defs. */
export interface InternalMathQuillInstance {
  __controller: Controller;
  __options: CursorOptions;
  id: number;
  data: { [key: string]: any };
  mathquillify(classNames: string): void;
  __mathquillify(
    opts: ConfigOptions,
    _interfaceVersion: number
  ): IBaseMathQuill;
}

export type KIND_OF_MQ = 'StaticMath' | 'MathField' | 'InnerMathField' | 'TextField';