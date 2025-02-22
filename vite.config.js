const path = require('path');
const { defineConfig } = require('vite');
import concat from '@vituum/vite-plugin-concat'

module.exports = defineConfig({
  build: {
    emitAssets: true,
    lib: {
      entry: path.resolve(__dirname, 'src/full-entry.ts'),
      name: 'mathquill',
      fileName: (format ) => `mathquill.${format}.js`,
    }
  },
  plugins: [
    concat({
      input: [
        'src/full.ts',
      ],
      files: {
        'src/full.ts': [
          'src/utils.ts',
          'src/dom.ts',
          'src/unicode.ts',
          'src/browser.ts',
          'src/animate.ts',
          'src/services/aria.ts',
          'src/domFragment.ts',
          'src/tree.ts',
          'src/cursor.ts',
          'src/controller.ts',
          'src/publicapi.ts',
          'src/services/parser.util.ts',
          'src/services/saneKeyboardEvents.util.ts',
          'src/services/exportText.ts',
          'src/services/focusBlur.ts',
          'src/services/keystroke.ts',
          'src/services/latex.ts',
          'src/services/mouse.ts',
          'src/services/scrollHoriz.ts',
          'src/services/textarea.ts',
          'src/commands/math.ts',
          'src/commands/text.ts',
          'src/commands/math/advancedSymbols.ts',
          'src/commands/math/basicSymbols.ts',
          'src/commands/math/commands.ts',
          'src/commands/math/LatexCommandInput.ts',
        ]
      }
    }),
  ],
});