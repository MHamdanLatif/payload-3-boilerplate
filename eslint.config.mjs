import next from 'eslint-config-next'

export default [
  ...next,
  {
    ignores: [
      'tmp/**',
      'test-results/**',
      'playwright-report/**',
      'src/payload-types.ts',
      'src/app/(payload)/admin/importMap.js',
    ],
  },
]
