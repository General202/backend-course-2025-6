import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));

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
app.use(express.urlencoded());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const uploadDir = path.join(cache, 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = Date.now() + ext;
    cb(null, filename);
  }
});

const upload = multer({ storage });

app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) return res.status(400).send('Missing inventory_name');
  const item = {
    id: idCounter++,
    name: inventory_name,
    description: description || '',
    photo: req.file ? req.file.filename : null
  };
  inventory.push(item);
  saveInventory();
  res.json(item);
});

app.get('/inventory', (req, res) => {
res.status(200).json(inventory);
});

app.get('/inventory/:id', (req, res) => {
const item = inventory.find(i => i.id == req.params.id);
if (!item) return res.status(404).send('Not found');
res.status(200).json(item);
});

app.put('/inventory/:id', (req, res) => {
  const item = inventory.find(i => i.id == req.params.id);
  if (!item) return res.status(404).send('Not found');
  const { name, description } = req.body;
  if (name) item.name = name;
  if (description) item.description = description;
  res.status(200).json(item);
});

app.get('/inventory/:id/photo', (req, res) => {
  const item = inventory.find(i => i.id == req.params.id);
  if (!item || !item.photo) {
    return res.status(404).send('Photo not found');
  }

  const photoPath = path.resolve(uploadDir, item.photo);

  if (!fs.existsSync(photoPath)) {
    return res.status(404).send('Photo not found');
  }

  res.sendFile(photoPath);
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const item = inventory.find(i => i.id == req.params.id);
  if (!item) return res.status(404).send("Not Found");

  if (!req.file) return res.status(400).send("Missing photo");

  if (item.photo) {
    const oldPath = path.resolve(uploadDir, item.photo);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  item.photo = req.file.filename;
  saveInventory();

  res.status(200).json(item);
});

app.delete("/inventory/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = inventory.findIndex(i => i.id === id);

  if (index === -1) return res.status(404).send("Not Found");

  const item = inventory[index];

  if (item.photo) {
    const photoPath = path.resolve(uploadDir, item.photo);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  }

  inventory.splice(index, 1);
  saveInventory();

  res.status(200).json(item);
});

app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

app.get('/search', (req, res) => {
  const {id , includePhoto} = req.query;

  const itemId = parseInt(id);
  const hasPhoto = includePhoto === 'true';
  const item = inventory.find(item => item.id === itemId);

  if (!item) return res.status(404).send('Not found');

  const absolutePath = path.join(uploadDir, item.photo);
  res.status(200).json({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: hasPhoto ? absolutePath : null
  });
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

