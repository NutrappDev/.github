// Configuración central de commitlint para NutrappDev.
// Uso local (Husky commit-msg hook):
//   npx commitlint --config node_modules/@nutrappdev/commitlint-config/commitlint.config.js --edit $1
//
// O copiar este archivo como commitlint.config.js en la raíz del repo.

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Tipos válidos en NutrappDev (sobreescribe los defaults de config-conventional)
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'chore', 'build', 'test', 'release', 'hotfix', 'merge'],
    ],

    // Longitud del header
    'header-max-length': [2, 'always', 120],
    'header-min-length': [2, 'always', 15],

    // Descripción mínima (el subject)
    'subject-min-length': [2, 'always', 10],
    'subject-empty': [2, 'never'],

    // No forzar case en scope ni subject — los mensajes van en español
    'scope-case': [0],
    'subject-case': [0],

    // Tipo siempre en minúsculas
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
  },

  // Ignorar commits que no siguen el formato (commits de merge de git, skip-ci, etc.)
  ignores: [
    (commit) => /^Merge /.test(commit),
    (commit) => /^Revert /.test(commit),
    (commit) => /\[skip ci\]/i.test(commit),
    (commit) => /^Initial commit/i.test(commit),
  ],
};
