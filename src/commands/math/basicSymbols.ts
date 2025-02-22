/*********************************
 * Symbols for Basic Mathematics
 ********************************/

import { baseOptionProcessors } from '../../services/baseOptionProcessors';
import {
  BinaryOperator,
  bindBinaryOperator,
  bindVanillaSymbol
} from '../math';
import { Direction, L, R } from '../../utils';
import { CharCmds, Fragment, LatexCmds } from '../../tree';
import { AutoDict, Options } from '../../services/options';
import { AnsBuilder, Bracket, PercentOfBuilder } from './commands';
import { domFrag } from '../../domFragment';
import { U_NO_BREAK_SPACE } from '../../unicode';
import { latexMathParser } from '../../services/latex';
import { Cursor } from '../../cursor';
import { MQNode } from '../../services/MQNode';
import { nodeEndsBinaryOperator } from './nodeEndsBinaryOperator';
import { Variable } from './variable';
import { Letter } from './letter';
import { BuiltInOpNames } from './opNames';
import { DigitGroupingChar } from './digitGroupingChar';
import { MQSymbol } from '../MQSymbol';
import { MathCommand } from '../mathCommand';
import { DOMView } from '../DOMView';
import { MathBlock } from '../mathElement';
import { VanillaSymbol } from '../vanillaSymbol';

function bindVariable(
  ch: string,
  htmlEntity: string,
  _unusedMathspeak?: string
) {
  return () => new Variable(ch, h.entityText(htmlEntity));
}

Options.prototype.autoCommands = {
  _maxLength: 0
};
baseOptionProcessors.autoCommands = function (cmds: string | undefined) {
  if (typeof cmds !== 'string' || !/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
    throw '"' + cmds + '" not a space-delimited list of only letters';
  }
  var list = cmds.split(' ');
  var dict: AutoDict = {};
  var maxLength = 0;

  for (var i = 0; i < list.length; i += 1) {
    var cmd = list[i];
    if (cmd.length < 2) {
      throw 'autocommand "' + cmd + '" not minimum length of 2';
    }

    if (LatexCmds[cmd] === OperatorName) {
      throw '"' + cmd + '" is a built-in operator name';
    }
    dict[cmd] = 1;
    maxLength = Math.max(maxLength, cmd.length);
  }
  dict._maxLength = maxLength;
  return dict;
};

Options.prototype.quietEmptyDelimiters = {};
baseOptionProcessors.quietEmptyDelimiters = function (dlms: string = '') {
  var list = dlms.split(' ');
  var dict: { [id: string]: any } = {};
  for (var i = 0; i < list.length; i += 1) {
    var dlm = list[i];
    dict[dlm] = 1;
  }
  return dict;
};

Options.prototype.autoParenthesizedFunctions = { _maxLength: 0 };
baseOptionProcessors.autoParenthesizedFunctions = function (cmds) {
  if (typeof cmds !== 'string' || !/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
    throw '"' + cmds + '" not a space-delimited list of only letters';
  }
  var list = cmds.split(' ');
  var dict: AutoDict = {};
  var maxLength = 0;
  for (var i = 0; i < list.length; i += 1) {
    var cmd = list[i];
    if (cmd.length < 2) {
      throw 'autocommand "' + cmd + '" not minimum length of 2';
    }
    dict[cmd] = 1;
    maxLength = Math.max(maxLength, cmd.length);
  }
  dict._maxLength = maxLength;
  return dict;
};

// are built-into LaTeX, see Section 3.17 of the Short Math Guide: http://tinyurl.com/jm9okjc
// MathQuill auto-unitalicizes some operator names not in that set, like 'hcf'
// and 'arsinh', which must be exported as \operatorname{hcf} and
// \operatorname{arsinh}. Note: over/under line/arrow \lim variants like
// \varlimsup are not supported

// the set of operator names that MathQuill auto-unitalicizes by default; overridable
Options.prototype.autoOperatorNames = defaultAutoOpNames();

function defaultAutoOpNames() {
  const AutoOpNames: AutoDict = {
    _maxLength: 9
  };
  var mostOps = (
    'arg deg det dim exp gcd hom inf ker lg lim ln log max min sup' +
    ' limsup liminf injlim projlim Pr'
  ).split(' ');
  for (var i = 0; i < mostOps.length; i += 1) {
    BuiltInOpNames[mostOps[i]] = AutoOpNames[mostOps[i]] = 1;
  }

  var builtInTrigs =
    'sin cos tan arcsin arccos arctan sinh cosh tanh sec csc cot coth'.split(
      // why coth but not sech and csch, LaTeX?
      ' '
    );
  for (var i = 0; i < builtInTrigs.length; i += 1) {
    BuiltInOpNames[builtInTrigs[i]] = 1;
  }

  var autoTrigs = 'sin cos tan sec cosec csc cotan cot ctg'.split(' ');
  for (var i = 0; i < autoTrigs.length; i += 1) {
    AutoOpNames[autoTrigs[i]] =
      AutoOpNames['arc' + autoTrigs[i]] =
      AutoOpNames[autoTrigs[i] + 'h'] =
      AutoOpNames['ar' + autoTrigs[i] + 'h'] =
      AutoOpNames['arc' + autoTrigs[i] + 'h'] =
        1;
  }

  // compat with some of the nonstandard LaTeX exported by MathQuill
  // before #247. None of these are real LaTeX commands so, seems safe
  var moreNonstandardOps = 'gcf hcf lcm proj span'.split(' ');
  for (var i = 0; i < moreNonstandardOps.length; i += 1) {
    AutoOpNames[moreNonstandardOps[i]] = 1;
  }
  return AutoOpNames;
}

baseOptionProcessors.autoOperatorNames = function (cmds) {
  if (typeof cmds !== 'string') {
    throw '"' + cmds + '" not a space-delimited list';
  }
  if (!/^[a-z\|\-]+(?: [a-z\|\-]+)*$/i.test(cmds)) {
    throw '"' + cmds + '" not a space-delimited list of letters or "|"';
  }
  var list = cmds.split(' ');
  var dict: AutoDict = {};
  var maxLength = 0;
  for (var i = 0; i < list.length; i += 1) {
    var cmd = list[i];
    if (cmd.length < 2) {
      throw '"' + cmd + '" not minimum length of 2';
    }
    if (cmd.indexOf('|') < 0) {
      // normal auto operator
      dict[cmd] = cmd;
      maxLength = Math.max(maxLength, cmd.length);
    } else {
      // this item has a speech-friendly alternative
      var cmdArray = cmd.split('|');
      if (cmdArray.length > 2) {
        throw '"' + cmd + '" has more than 1 mathspeak delimiter';
      }
      if (cmdArray[0].length < 2) {
        throw '"' + cmd[0] + '" not minimum length of 2';
      }
      dict[cmdArray[0]] = cmdArray[1].replace(/-/g, ' '); // convert dashes to spaces for the sake of speech
      maxLength = Math.max(maxLength, cmdArray[0].length);
    }
  }
  dict._maxLength = maxLength;
  return dict;
};

Options.prototype.infixOperatorNames = {};
baseOptionProcessors.infixOperatorNames = splitWordsIntoDict;

Options.prototype.prefixOperatorNames = {};
baseOptionProcessors.prefixOperatorNames = splitWordsIntoDict;

Options.prototype.disableAutoSubstitutionInSubscripts = false;
baseOptionProcessors.disableAutoSubstitutionInSubscripts = function (
  opt: unknown
) {
  if (typeof opt === 'boolean') return opt;
  if (typeof opt !== 'object' || opt === null || !('except' in opt)) {
    throw '"' + opt + '" not an object with property "except"';
  }
  return { except: splitWordsIntoDict((opt as any).except) };
};

function splitWordsIntoDict(cmds: unknown) {
  if (typeof cmds !== 'string') {
    throw '"' + cmds + '" not a space-delimited list';
  }
  if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
    throw '"' + cmds + '" not a space-delimited list of letters';
  }
  var list = cmds.split(' ');
  var dict: { [word in string]?: true } = {};
  for (var i = 0; i < list.length; i += 1) {
    var cmd = list[i];
    if (cmd.length < 2) {
      throw '"' + cmd + '" not minimum length of 2';
    }
    dict[cmd] = true;
  }
  return dict;
}

class OperatorName extends MQSymbol {
  ctrlSeq: string;
  constructor(fn?: string) {
    super(fn || '');
  }
  createLeftOf(cursor: Cursor) {
    var fn = this.ctrlSeq;
    for (var i = 0; i < fn.length; i += 1) {
      new Letter(fn.charAt(i)).createLeftOf(cursor);
    }
  }
  parser() {
    var fn = this.ctrlSeq;
    var block = new MathBlock();
    for (var i = 0; i < fn.length; i += 1) {
      new Letter(fn.charAt(i)).adopt(block, block.getEnd(R), 0);
    }
    return Parser.succeed(block.children());
  }
}

for (var fn in Options.prototype.autoOperatorNames)
  if (Options.prototype.autoOperatorNames.hasOwnProperty(fn)) {
    (LatexCmds as LatexCmdsAny)[fn as string] = OperatorName;
  }

LatexCmds.operatorname = class extends MathCommand {
  createLeftOf() {}
  numBlocks() {
    return 1 as const;
  }
  parser() {
    return latexMathParser.block.map(function (b) {
      // Check for the special case of \operatorname{ans}, which has
      // a special html representation
      var isAllLetters = true;
      var str = '';
      var children = b.children();
      children.each(function (child) {
        if (child instanceof Letter) {
          str += child.letter;
        } else {
          isAllLetters = false;
        }
        return undefined;
      });
      if (isAllLetters && str === 'ans') {
        return AnsBuilder();
      }
      // In cases other than `ans`, just return the children directly
      return children;
    });
  }
};

LatexCmds.f = class extends Letter {
  letter: string;
  constructor() {
    var letter = 'f';
    super(letter);

    this.letter = letter;
    this.domView = new DOMView(0, () =>
      h('var', { class: 'mq-f' }, [h.text('f')])
    );
  }
  italicize(bool: boolean) {
    // Why is this necesssary? Does someone replace the `f` at some
    // point?
    this.domFrag().eachElement((el: HTMLElement) => (el.textContent = 'f'));
    this.domFrag().toggleClass('mq-f', bool);
    return super.italicize(bool);
  }
};

// VanillaSymbol's
LatexCmds[' '] = LatexCmds.space = () =>
  new DigitGroupingChar('\\ ', h('span', {}, [h.text(U_NO_BREAK_SPACE)]), ' ');

LatexCmds['.'] = () =>
  new DigitGroupingChar(
    '.',
    h('span', { class: 'mq-digit' }, [h.text('.')]),
    '.'
  );

LatexCmds["'"] = LatexCmds.prime = bindVanillaSymbol("'", '&prime;', 'prime');
LatexCmds['″'] = LatexCmds.dprime = bindVanillaSymbol(
  '″',
  '&Prime;',
  'double prime'
);

LatexCmds.backslash = bindVanillaSymbol('\\backslash ', '\\', 'backslash');
if (!CharCmds['\\']) CharCmds['\\'] = LatexCmds.backslash;

LatexCmds.$ = bindVanillaSymbol('\\$', '$', 'dollar');

LatexCmds['□'] = LatexCmds.square = bindVanillaSymbol(
  '\\square ',
  '\u25A1',
  'square'
);
LatexCmds.mid = bindVanillaSymbol('\\mid ', '\u2223', 'mid');

// does not use Symbola font
class NonSymbolaSymbol extends MQSymbol {
  constructor(ch: string, html?: ChildNode, _unusedMathspeak?: string) {
    super(ch, h('span', { class: 'mq-nonSymbola' }, [html || h.text(ch)]));
  }
}

LatexCmds['@'] = () => new NonSymbolaSymbol('@');
LatexCmds['&'] = () =>
  new NonSymbolaSymbol('\\&', h.entityText('&amp;'), 'and');
LatexCmds['%'] = class extends NonSymbolaSymbol {
  constructor() {
    super('\\%', h.text('%'), 'percent');
  }
  parser() {
    var optWhitespace = Parser.optWhitespace;
    var string = Parser.string;

    // Parse `\%\operatorname{of}` as special `percentof` node so that
    // it will be serialized properly and deleted as a unit.
    return optWhitespace
      .then(
        string('\\operatorname{of}').map(function () {
          return PercentOfBuilder();
        })
      )
      .or(super.parser());
  }
};

LatexCmds['∥'] = LatexCmds.parallel = bindVanillaSymbol(
  '\\parallel ',
  '&#x2225;',
  'parallel'
);

LatexCmds['∦'] = LatexCmds.nparallel = bindVanillaSymbol(
  '\\nparallel ',
  '&#x2226;',
  'not parallel'
);

LatexCmds['⟂'] = LatexCmds.perp = bindVanillaSymbol(
  '\\perp ',
  '&#x27C2;',
  'perpendicular'
);

//the following are all Greek to me, but this helped a lot: http://www.ams.org/STIX/ion/stixsig03.html

//lowercase Greek letter variables

function bindLowercaseGreek(latex: string) {
  return bindVariable('\\' + latex + ' ', '&' + latex + ';', latex);
}

LatexCmds['α'] = LatexCmds.alpha = bindLowercaseGreek('alpha');
LatexCmds['β'] = LatexCmds.beta = bindLowercaseGreek('beta');
LatexCmds['γ'] = LatexCmds.gamma = bindLowercaseGreek('gamma');
LatexCmds['δ'] = LatexCmds.delta = bindLowercaseGreek('delta');
LatexCmds['ζ'] = LatexCmds.zeta = bindLowercaseGreek('zeta');
LatexCmds['η'] = LatexCmds.eta = bindLowercaseGreek('eta');
LatexCmds['θ'] = LatexCmds.theta = bindLowercaseGreek('theta');
LatexCmds['ι'] = LatexCmds.iota = bindLowercaseGreek('iota');
LatexCmds['κ'] = LatexCmds.kappa = bindLowercaseGreek('kappa');
LatexCmds['μ'] = LatexCmds.mu = bindLowercaseGreek('mu');
LatexCmds['ν'] = LatexCmds.nu = bindLowercaseGreek('nu');
LatexCmds['ξ'] = LatexCmds.xi = bindLowercaseGreek('xi');
LatexCmds['ρ'] = LatexCmds.rho = bindLowercaseGreek('rho');
LatexCmds['σ'] = LatexCmds.sigma = bindLowercaseGreek('sigma');
LatexCmds['τ'] = LatexCmds.tau = bindLowercaseGreek('tau');
LatexCmds['χ'] = LatexCmds.chi = bindLowercaseGreek('chi');
LatexCmds['ψ'] = LatexCmds.psi = bindLowercaseGreek('psi');
LatexCmds['ω'] = LatexCmds.omega = bindLowercaseGreek('omega');

//why can't anybody FUCKING agree on these
LatexCmds['ϕ'] = LatexCmds.phi = bindVariable('\\phi ', '&#981;', 'phi'); //W3C or Unicode?

LatexCmds['φ'] =
  LatexCmds.phiv =
  LatexCmds.varphi =
    bindVariable('\\varphi ', '&phi;', 'phi'); //Elsevier and 9573-13 //AMS and LaTeX

LatexCmds['ϵ'] = LatexCmds.epsilon = bindVariable(
  '\\epsilon ',
  '&#1013;',
  'epsilon'
); //W3C or Unicode?

LatexCmds['ε'] =
  LatexCmds.epsiv =
  LatexCmds.varepsilon =
    bindVariable(
      //Elsevier and 9573-13 //AMS and LaTeX
      '\\varepsilon ',
      '&epsilon;',
      'epsilon'
    );

LatexCmds['ϖ'] =
  LatexCmds.piv =
  LatexCmds.varpi =
    bindVariable('\\varpi ', '&piv;', 'piv'); //W3C/Unicode and Elsevier and 9573-13 //AMS and LaTeX

LatexCmds['ς'] = // Unicode
  LatexCmds.sigmaf = //W3C/Unicode
  LatexCmds.sigmav = //Elsevier
  LatexCmds.varsigma = //LaTeX
    bindVariable('\\varsigma ', '&sigmaf;', 'sigma');

LatexCmds['ϑ'] = // Unicode
  LatexCmds.thetav = //Elsevier and 9573-13
  LatexCmds.vartheta = //AMS and LaTeX
  LatexCmds.thetasym = //W3C/Unicode
    bindVariable('\\vartheta ', '&thetasym;', 'theta');

LatexCmds['υ'] =
  LatexCmds.upsilon =
  LatexCmds.upsi =
    bindVariable(
      //AMS and LaTeX and W3C/Unicode //Elsevier and 9573-13
      '\\upsilon ',
      '&upsilon;',
      'upsilon'
    );

//these aren't even mentioned in the HTML character entity references
LatexCmds['Ϝ'] =
  LatexCmds.gammad = //Elsevier
  LatexCmds.Gammad = //9573-13 -- WTF, right? I dunno if this was a typo in the reference (see above)
  LatexCmds.digamma = //LaTeX
    bindVariable('\\digamma ', '&#989;', 'gamma');

LatexCmds['ϰ'] =
  LatexCmds.kappav =
  LatexCmds.varkappa =
    bindVariable(
      //Elsevier //AMS and LaTeX
      '\\varkappa ',
      '&#1008;',
      'kappa'
    );

LatexCmds['ϱ'] =
  LatexCmds.rhov =
  LatexCmds.varrho =
    bindVariable('\\varrho ', '&#1009;', 'rho'); //Elsevier and 9573-13 //AMS and LaTeX

//Greek constants, look best in non-italicized Times New Roman
LatexCmds.pi = LatexCmds['π'] = () =>
  new NonSymbolaSymbol('\\pi ', h.entityText('&pi;'), 'pi');
LatexCmds['λ'] = LatexCmds.lambda = () =>
  new NonSymbolaSymbol('\\lambda ', h.entityText('&lambda;'), 'lambda');

//uppercase greek letters

LatexCmds['Υ'] =
  LatexCmds.Upsilon = //LaTeX
  LatexCmds.Upsi = //Elsevier and 9573-13
  LatexCmds.upsih = //W3C/Unicode "upsilon with hook"
  LatexCmds.Upsih = //'cos it makes sense to me
    () =>
      new MQSymbol(
        '\\Upsilon ',
        h('var', { style: 'font-family: serif' }, [h.entityText('&upsih;')]),
        'capital upsilon'
      ); //Symbola's 'upsilon with a hook' is a capital Y without hooks :(

//other symbols with the same LaTeX command and HTML character entity reference

function bindUppercaseGreek(latex: string) {
  return () =>
    new VanillaSymbol('\\' + latex + ' ', h.entityText('&' + latex + ';'));
}

LatexCmds['Γ'] = LatexCmds.Gamma = bindUppercaseGreek('Gamma');
LatexCmds['Δ'] = LatexCmds.Delta = bindUppercaseGreek('Delta');
LatexCmds['Θ'] = LatexCmds.Theta = bindUppercaseGreek('Theta');
LatexCmds['Λ'] = LatexCmds.Lambda = bindUppercaseGreek('Lambda');
LatexCmds['Ξ'] = LatexCmds.Xi = bindUppercaseGreek('Xi');
LatexCmds['Π'] = LatexCmds.Pi = bindUppercaseGreek('Pi');
LatexCmds['Σ'] = LatexCmds.Sigma = bindUppercaseGreek('Sigma');
LatexCmds['Φ'] = LatexCmds.Phi = bindUppercaseGreek('Phi');
LatexCmds['Ψ'] = LatexCmds.Psi = bindUppercaseGreek('Psi');
LatexCmds['Ω'] = LatexCmds.Omega = bindUppercaseGreek('Omega');
LatexCmds['∀'] = LatexCmds.forall = bindUppercaseGreek('forall');
// "exists" is in advancedSymbols

// symbols that aren't a single MathCommand, but are instead a whole
// Fragment. Creates the Fragment from a LaTeX string
class LatexFragment extends MathCommand {
  latexStr: string;

  constructor(latex: string) {
    super();
    this.latexStr = latex;
  }

  createLeftOf(cursor: Cursor) {
    var block = latexMathParser.parse(this.latexStr);
    block
      .children()
      .adopt(cursor.parent, cursor[L] as MQNode, cursor[R] as MQNode);
    cursor[L] = block.getEnd(R);
    domFrag(block.html()).insertBefore(cursor.domFrag());
    block.finalizeInsert(cursor.options, cursor);
    var blockEndsR = block.getEnd(R);
    var blockEndsRR = blockEndsR && blockEndsR[R];
    if (blockEndsRR) blockEndsRR.siblingCreated(cursor.options, L);
    var blockEndsL = block.getEnd(L);
    var blockEndsLL = blockEndsL && blockEndsL[L];
    if (blockEndsLL) blockEndsLL.siblingCreated(cursor.options, R);
    cursor.parent.bubble(function (node) {
      node.reflow();
      return undefined;
    });
  }
  mathspeak() {
    return latexMathParser.parse(this.latexStr).mathspeak();
  }
  parser() {
    var frag = latexMathParser.parse(this.latexStr).children();
    return Parser.succeed(frag);
  }
}

// for what seems to me like [stupid reasons][1], Unicode provides
// subscripted and superscripted versions of all ten Arabic numerals,
// as well as [so-called "vulgar fractions"][2].
// Nobody really cares about most of them, but some of them actually
// predate Unicode, dating back to [ISO-8859-1][3], apparently also
// known as "Latin-1", which among other things [Windows-1252][4]
// largely coincides with, so Microsoft Word sometimes inserts them
// and they get copy-pasted into MathQuill.
//
// (Irrelevant but funny story: though not a superset of Latin-1 aka
// ISO-8859-1, Windows-1252 **is** a strict superset of the "closely
// related but distinct"[3] "ISO 8859-1" -- see the lack of a dash
// after "ISO"? Completely different character set, like elephants vs
// elephant seals, or "Zombies" vs "Zombie Redneck Torture Family".
// What kind of idiot would get them confused.
// People in fact got them confused so much, it was so common to
// mislabel Windows-1252 text as ISO-8859-1, that most modern web
// browsers and email clients treat the MIME charset of ISO-8859-1
// as actually Windows-1252, behavior now standard in the HTML5 spec.)
//
// [1]: http://en.wikipedia.org/wiki/Unicode_subscripts_andsuper_scripts
// [2]: http://en.wikipedia.org/wiki/Number_Forms
// [3]: http://en.wikipedia.org/wiki/ISO/IEC_8859-1
// [4]: http://en.wikipedia.org/wiki/Windows-1252
LatexCmds['⁰'] = () => new LatexFragment('^0');
LatexCmds['¹'] = () => new LatexFragment('^1');
LatexCmds['²'] = () => new LatexFragment('^2');
LatexCmds['³'] = () => new LatexFragment('^3');
LatexCmds['⁴'] = () => new LatexFragment('^4');
LatexCmds['⁵'] = () => new LatexFragment('^5');
LatexCmds['⁶'] = () => new LatexFragment('^6');
LatexCmds['⁷'] = () => new LatexFragment('^7');
LatexCmds['⁸'] = () => new LatexFragment('^8');
LatexCmds['⁹'] = () => new LatexFragment('^9');

LatexCmds['¼'] = () => new LatexFragment('\\frac14');
LatexCmds['½'] = () => new LatexFragment('\\frac12');
LatexCmds['¾'] = () => new LatexFragment('\\frac34');

// this is a hack to make pasting the √ symbol
// actually insert a sqrt command. This isn't ideal,
// but it's way better than what we have now. I think
// before we invest any more time into this single character
// we should consider how to make the pipe (|) automatically
// insert absolute value. We also will want the percent (%)
// to expand to '% of'. I've always just thought mathquill's
// ability to handle pasted latex magical until I started actually
// testing it. It's a lot more buggy that I previously thought.
//
// KNOWN ISSUES:
// 1) pasting √ does not put focus in side the sqrt symbol
// 2) pasting √2 puts the 2 outside of the sqrt symbol.
//
// The first issue seems like we could invest more time into this to
// fix it, but doesn't feel worth special casing. I think we'd want
// to address it by addressing ALL pasting issues.
//
// The second issue seems like it might go away too if you fix paste to
// act more like simply typing the characters out. I'd be scared to try
// to make that change because I'm fairly confident I'd break something
// around handling valid latex as latex rather than treating it as keystrokes.
LatexCmds['√'] = () => new LatexFragment('\\sqrt{}');

// Binary operator determination is used in several contexts for PlusMinus nodes and their descendants.
// For instance, we set the item's class name based on this factor, and also assign different mathspeak values (plus vs positive, negative vs minus).
export function plusMinusIsBinaryOperator(node: NodeRef): boolean {
  if (!node) return false;

  const nodeL = node[L];

  if (nodeL) {
    // If the left sibling is a binary operator or a separator (comma, semicolon, colon, space),
    // consider the operator to be unary
    if (
      nodeEndsBinaryOperator(nodeL) ||
      (nodeL instanceof Letter && nodeL.endsCategory == 'prefix') ||
      (!(nodeL instanceof Bracket) && // exclude Bracket because ctrlSeq gives "(" even if `node` is after the ")"
        /^(\\ )|[,;:\(\[]$/.test(nodeL.ctrlSeq!))
    ) {
      return false;
    }
  } else if (
    node.parent &&
    node.parent.parent &&
    node.parent.parent.isStyleBlock()
  ) {
    //if we are in a style block at the leftmost edge, determine unary/binary based on
    //the style block
    //this allows style blocks to be transparent for unary/binary purposes
    return plusMinusIsBinaryOperator(node.parent.parent);
  } else {
    // This is reached when `node` is the first element in the MathBlock, for
    // example `node` is after an open bracket. E.g. `node` is "-" inside "(-5)".
    // Then `nodeL` is undefined since `node` is the start of the block.
    return false;
  }

  return true;
}

export const PlusMinus = class extends BinaryOperator {
  constructor(ch?: string, html?: ChildNode, mathspeak?: string) {
    super(ch, html, undefined, mathspeak, true);
  }

  isBinaryOperator(): boolean {
    return plusMinusIsBinaryOperator(this);
  }

  contactWeld(cursor: Cursor, dir?: Direction) {
    this.sharedSiblingMethod(cursor.options, dir);
  }
  siblingCreated(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }
  siblingDeleted(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }

  sharedSiblingMethod(_opts?: CursorOptions, dir?: Direction) {
    if (dir === R) return; // ignore if sibling only changed on the right
    this.domFrag().oneElement().className = plusMinusIsBinaryOperator(this)
      ? 'mq-binary-operator'
      : '';

    return this;
  }
};

LatexCmds['+'] = class extends PlusMinus {
  constructor() {
    super('+', h.text('+'));
  }
  mathspeak(): string {
    return plusMinusIsBinaryOperator(this) ? 'plus' : 'positive';
  }
};

//yes, these are different dashes, en-dash, em-dash, unicode minus, actual dash
class MinusNode extends PlusMinus {
  constructor() {
    super('-', h.entityText('&minus;'));
  }
  mathspeak(): string {
    return plusMinusIsBinaryOperator(this) ? 'minus' : 'negative';
  }
}
LatexCmds['−'] = LatexCmds['—'] = LatexCmds['–'] = LatexCmds['-'] = MinusNode;

LatexCmds['±'] =
  LatexCmds.pm =
  LatexCmds.plusmn =
  LatexCmds.plusminus =
    () => new PlusMinus('\\pm ', h.entityText('&plusmn;'), 'plus-or-minus');
LatexCmds.mp =
  LatexCmds.mnplus =
  LatexCmds.minusplus =
    () => new PlusMinus('\\mp ', h.entityText('&#8723;'), 'minus-or-plus');

CharCmds['*'] =
  LatexCmds.sdot =
  LatexCmds.cdot =
    bindBinaryOperator('\\cdot ', '&middot;', '*', 'times'); //semantically should be &sdot;, but &middot; looks better

class To extends BinaryOperator {
  constructor() {
    super('\\to ', h.entityText('&rarr;'), 'to');
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    if (dir === L) {
      var l = cursor[L] as MQNode;
      new Fragment(l, this).remove();
      cursor[L] = l[L];
      new MinusNode().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.deleteTowards(dir, cursor);
  }
}

LatexCmds['→'] = LatexCmds.to = To;

class Inequality extends BinaryOperator {
  strict: boolean;
  data: InequalityData;

  constructor(data: InequalityData, strict: boolean) {
    var strictness: '' | 'Strict' = strict ? 'Strict' : '';
    super(
      data[`ctrlSeq${strictness}`],
      h.entityText(data[`htmlEntity${strictness}`]),
      data[`text${strictness}`],
      data[`mathspeak${strictness}`]
    );

    this.data = data;
    this.strict = strict;
  }

  swap(strict: boolean) {
    this.strict = strict;
    var strictness: '' | 'Strict' = strict ? 'Strict' : '';
    this.ctrlSeq = this.data[`ctrlSeq${strictness}`];
    this.domFrag()
      .children()
      .replaceWith(domFrag(h.entityText(this.data[`htmlEntity${strictness}`])));
    this.textTemplate = [this.data[`text${strictness}`]];
    this.mathspeakName = this.data[`mathspeak${strictness}`];
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    if (dir === L && !this.strict) {
      this.swap(true);
      this.bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.deleteTowards(dir, cursor);
  }
}

var less: InequalityData = {
  ctrlSeq: '\\le ',
  htmlEntity: '&le;',
  text: '≤',
  mathspeak: 'less than or equal to',
  ctrlSeqStrict: '<',
  htmlEntityStrict: '&lt;',
  textStrict: '<',
  mathspeakStrict: 'less than'
};
var greater: InequalityData = {
  ctrlSeq: '\\ge ',
  htmlEntity: '&ge;',
  text: '≥',
  mathspeak: 'greater than or equal to',
  ctrlSeqStrict: '>',
  htmlEntityStrict: '&gt;',
  textStrict: '>',
  mathspeakStrict: 'greater than'
};

class Greater extends Inequality {
  constructor() {
    super(greater, true);
  }
  createLeftOf(cursor: Cursor) {
    const cursorL = cursor[L];
    if (cursorL instanceof BinaryOperator && cursorL.ctrlSeq === '-') {
      var l = cursorL;
      cursor[L] = l[L];
      l.remove();
      new To().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.createLeftOf(cursor);
  }
}

LatexCmds['<'] = LatexCmds.lt = () => new Inequality(less, true);
LatexCmds['>'] = LatexCmds.gt = Greater;
LatexCmds['≤'] =
  LatexCmds.le =
  LatexCmds.leq =
    () => new Inequality(less, false);
LatexCmds['≥'] =
  LatexCmds.ge =
  LatexCmds.geq =
    () => new Inequality(greater, false);
LatexCmds['∞'] =
  LatexCmds.infty =
  LatexCmds.infin =
  LatexCmds.infinity =
    bindVanillaSymbol('\\infty ', '&infin;', 'infinity');
LatexCmds['≠'] =
  LatexCmds.ne =
  LatexCmds.neq =
    bindBinaryOperator('\\ne ', '&ne;', 'not equal');

export class Equality extends BinaryOperator {
  constructor() {
    super('=', h.text('='), '=', 'equals');
  }
  createLeftOf(cursor: Cursor) {
    var cursorL = cursor[L];
    if (cursorL instanceof Inequality && cursorL.strict) {
      cursorL.swap(false);
      cursorL.bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.createLeftOf(cursor);
  }
}
LatexCmds['='] = Equality;

LatexCmds['×'] =
  LatexCmds.times =
  LatexCmds.cross =
    bindBinaryOperator('\\times ', '&times;', '[x]', 'times');

LatexCmds['÷'] =
  LatexCmds.div =
  LatexCmds.divide =
  LatexCmds.divides =
    bindBinaryOperator('\\div ', '&divide;', '[/]', 'over');

class Sim extends BinaryOperator {
  constructor() {
    super('\\sim ', h.text('~'), '~', 'tilde');
  }
  createLeftOf(cursor: Cursor) {
    if (cursor[L] instanceof Sim) {
      var l = cursor[L] as MQNode;
      cursor[L] = l[L];
      l.remove();
      new Approx().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.createLeftOf(cursor);
  }
}

class Approx extends BinaryOperator {
  constructor() {
    super('\\approx ', h.entityText('&approx;'), '≈', 'approximately equal');
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    if (dir === L) {
      var l = cursor[L] as MQNode;
      new Fragment(l, this).remove();
      cursor[L] = l[L];
      new Sim().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.deleteTowards(dir, cursor);
  }
}

LatexCmds.tildeNbsp = bindVanillaSymbol('~', U_NO_BREAK_SPACE, ' ');
LatexCmds.sim = Sim;
LatexCmds['≈'] = LatexCmds.approx = Approx;

// When interpreting raw LaTeX, we can either evaluate the tilde as its standard nonbreaking space
// or transform it to the \sim operator depending on whether the "interpretTildeAsSim" configuration option is set.
// Tilde symbols input from a keyboard will always be transformed to \sim.
CharCmds['~'] = LatexCmds.sim;
LatexCmds['~'] = LatexCmds.tildeNbsp;
baseOptionProcessors.interpretTildeAsSim = function (val: boolean | undefined) {
  const interpretAsSim = !!val;
  if (interpretAsSim) {
    LatexCmds['~'] = LatexCmds.sim;
  } else {
    LatexCmds['~'] = LatexCmds.tildeNbsp;
  }
  return interpretAsSim;
};

LatexCmds['◯'] = LatexCmds.bigcirc = bindVanillaSymbol(
  '\\bigcirc ',
  '&#9711;',
  'circle'
);

LatexCmds['∠'] =
  LatexCmds.ang =
  LatexCmds.angle =
    bindVanillaSymbol('\\angle ', '&ang;', 'angle');

// Using degree instead of ^\circ for compatibility
// with a pasted in unicode degree symbol
LatexCmds['°'] = LatexCmds.degree = bindVanillaSymbol(
  '\\degree ',
  '&deg;',
  'degrees'
);

LatexCmds['△'] = LatexCmds.triangle = bindVanillaSymbol(
  '\\triangle ',
  '&#9651;',
  'triangle'
);

LatexCmds['≅'] = LatexCmds.cong = bindBinaryOperator(
  '\\cong ',
  '&cong;',
  'cong',
  'congruent'
);

LatexCmds['∡'] = LatexCmds.measuredangle = bindVanillaSymbol(
  '\\measuredangle ',
  '&#8737;',
  'measured angle'
);

//not real LaTex command see https://github.com/mathquill/mathquill/pull/552 for more details
LatexCmds['▱'] = LatexCmds.parallelogram = bindVanillaSymbol(
  '\\parallelogram ',
  '&#9649;',
  'parallelogram'
);

LatexCmds['≇'] = LatexCmds.ncong = bindBinaryOperator(
  '\\ncong ',
  '&ncong;',
  'ncong',
  'not congruent'
);

LatexCmds['≁'] = LatexCmds.nsim = bindBinaryOperator(
  '\\nsim ',
  '&nsim;',
  'nsim',
  'not similar'
);
