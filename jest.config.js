module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 15000, // Redis/Postgres round trips need more than Jest's 5s default
  forceExit: true, // Redis/pg keep-alive connections can hang Jest otherwise
  verbose: true,
};