# Tests

Run all tests with:

```sh
npm test
```

`regression.test.mjs` locks important UI/PWA/audio invariants.
`mutation.test.mjs` deliberately mutates those invariants and verifies the regression checks detect each mutation.
