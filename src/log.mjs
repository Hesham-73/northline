export function log(level, message, fields = {}) {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, message, ...fields })}\n`);
}
