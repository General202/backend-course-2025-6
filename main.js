const { Command } = require('commander');
const http = require('http');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'server host')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <dir>', 'cache directory path');

program.parse(process.argv);

const { host, port, cache } = program.opts();

if (!fs.existsSync(cache)) {
  try {
    fs.mkdirSync(cache, { recursive: true });
    console.log(`Created cache directory at: ${cache}`);
  } catch (err) {
    console.error('Failed to create cache directory:', err);
    process.exit(1);
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is running');
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
