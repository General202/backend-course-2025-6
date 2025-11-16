const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

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

let inventory = [];
let idCounter = 1;

const inventoryFile = path.join(cache, 'inventory.json');

if (fs.existsSync(inventoryFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
    inventory = data.inventory || [];
    idCounter = data.idCounter || 1;
  } catch (err) {
    console.error("Failed to load saved data:", err);
  }
}

function saveInventory() {
  fs.writeFileSync(
    inventoryFile,
    JSON.stringify({ inventory, idCounter }, null, 2),
    "utf8"
  );
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

const upload = multer({ dest: path.join(cache, 'uploads') });

app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) return res.status(400).send('Missing inventory_name');
  const item = {
    id: idCounter++,
    name: inventory_name,
    description: description || '',
    photo: req.file ? req.file.path : null
  };
  inventory.push(item);
  saveInventory();
  res.json(item);
});

app.get('/inventory', (req, res) => {
res.json(inventory.map(i => ({ id: i.id, name: i.name, description: i.description, photo: `/inventory/${i.id}/photo` })));
});

app.get('/inventory/:id', (req, res) => {
const item = inventory.find(i => i.id == req.params.id);
if (!item) return res.status(404).send('Not found');
res.json({ ...item, photo: `/inventory/${item.id}/photo` });
});

app.put('/inventory/:id', (req, res) => {
  const item = inventory.find(i => i.id == req.params.id);
  if (!item) return res.status(404).send('Not found');
  const { name, description } = req.body;
  if (name) item.name = name;
  if (description) item.description = description;
  res.json(item);
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

