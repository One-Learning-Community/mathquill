
const processedOptions = {
  handlers: true,
  autoCommands: true,
  quietEmptyDelimiters: true,
  autoParenthesizedFunctions: true,
  autoOperatorNames: true,
  infixOperatorNames: true,
  prefixOperatorNames: true,
  leftRightIntoCmdGoes: true,
  maxDepth: true,
  interpretTildeAsSim: true,
  disableAutoSubstitutionInSubscripts: true
};
type ProcessedOption = keyof typeof processedOptions;

/** Map of functions transforming client-provided config options to the internal representation (i.e. property of the Options class) */
export type OptionProcessors = Partial<{
  [K in ProcessedOption]: (optionValue: ConfigOptions[K]) => CursorOptions[K];
}>;

export const baseOptionProcessors: OptionProcessors = {};

