const http = require("http");
const fs = require("fs");
const path = require("path");
const { program } = require("commander");
const express = require("express");
const multer  = require("multer");

program
  .requiredOption("-h, --host <host>", "Server host")
  .requiredOption("-p, --port <port>", "Server port")
  .requiredOption("-c, --cache <path>", "Cache directory");

program.parse(process.argv);
const options = program.opts();

if (!fs.existsSync(options.cache)) {
    fs.mkdirSync(options.cache, { recursive: true });
    console.log(`Created cache directory: ${options.cache}`);
}

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory Webservice",
      version: "1.0.0",
      description: "Documentation for inventory API"
    }
  },
  apis: ["./main.js"] 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const upload = multer({ dest: options.cache });

function getItemPath(id) {
    return path.join(options.cache, `${id}.json`);
}

function getPhotoPath(id) {
    return path.join(options.cache, `${id}.jpg`);
}

/**
 * @openapi
 * /register:
 *   post:
 *     summary: Register a new inventory item
 *     tags:
 *       - Inventory
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 example: Laptop
 *               description:
 *                 type: string
 *                 example: Office device
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Item created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 id:
 *                   type: string
 */
app.post("/register", upload.single("photo"), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) return res.status(400).json({ error: "Name is required" });

    const id = Date.now().toString();
    const item = {
        id,
        inventory_name,
        description: description || "",
        photo: `/inventory/${id}/photo`
    };

    fs.writeFileSync(getItemPath(id), JSON.stringify(item, null, 2));

    if (req.file) fs.renameSync(req.file.path, getPhotoPath(id));

    res.status(201).json({ message: "Created", id });
});

/**
 * @openapi
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     tags:
 *       - Inventory
 *     responses:
 *       200:
 *         description: A list of items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
app.get("/inventory", (req, res) => {
    const files = fs.readdirSync(options.cache)
        .filter(f => f.endsWith(".json"));

    const items = files.map(f => {
        return JSON.parse(fs.readFileSync(path.join(options.cache, f)));
    });

    res.json(items);
});

/**
 * @openapi
 * /inventory/{id}:
 *   get:
 *     summary: Get item by ID
 *     tags:
 *       - Inventory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "1763673276957"
 *     responses:
 *       200:
 *         description: Item found
 *       404:
 *         description: Not found
 */
app.get("/inventory/:id", (req, res) => {
    const file = getItemPath(req.params.id);

    if (!fs.existsSync(file)) return res.status(404).send("Not found");

    const data = JSON.parse(fs.readFileSync(file));
    res.json(data);
});

/**
 * @openapi
 * /inventory/{id}:
 *   put:
 *     summary: Update inventory item
 *     tags:
 *       - Inventory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated successfully
 *       404:
 *         description: Not found
 */
app.put("/inventory/:id", (req, res) => {
    const file = getItemPath(req.params.id);

    if (!fs.existsSync(file)) return res.status(404).send("Not found");

    let data = JSON.parse(fs.readFileSync(file));
    const { inventory_name, description } = req.body;

    if (inventory_name) data.inventory_name = inventory_name;
    if (description) data.description = description;

    fs.writeFileSync(file, JSON.stringify(data, null, 2));

    res.json({ message: "Updated" });
});

/**
 * @openapi
 * /inventory/{id}/photo:
 *   get:
 *     summary: Get photo of item
 *     tags:
 *       - Inventory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Image returned
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Photo not found
 */
app.get("/inventory/:id/photo", (req, res) => {
    const file = getPhotoPath(req.params.id);

    if (!fs.existsSync(file)) return res.status(404).send("Photo not found");

    res.setHeader("Content-Type", "image/jpeg");
    fs.createReadStream(file).pipe(res);
});

/**
 * @openapi
 * /inventory/{id}/photo:
 *   put:
 *     summary: Update item's photo
 *     tags:
 *       - Inventory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo updated
 *       400:
 *         description: No photo uploaded
 *       404:
 *         description: Item not found
 */
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
    const id = req.params.id;

    if (!fs.existsSync(getItemPath(id))) return res.status(404).send("Not found");
    if (!req.file) return res.status(400).send("No photo uploaded");

    fs.renameSync(req.file.path, getPhotoPath(id));
    res.json({ message: "Photo updated" });
});

/**
 * @openapi
 * /inventory/{id}:
 *   delete:
 *     summary: Delete inventory item
 *     tags:
 *       - Inventory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
app.delete("/inventory/:id", (req, res) => {
    const id = req.params.id;
    const json = getItemPath(id);
    const photo = getPhotoPath(id);

    if (!fs.existsSync(json)) return res.status(404).send("Not found");

    fs.unlinkSync(json);
    if (fs.existsSync(photo)) fs.unlinkSync(photo);

    res.json({ message: "Deleted" });
});

/**
 * @openapi
 * /RegisterForm.html:
 *   get:
 *     summary: Serve register HTML form
 *     tags:
 *       - Web pages
 *     responses:
 *       200:
 *         description: HTML page
 */
app.get("/RegisterForm.html", (req, res) => {
    res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

/**
 * @openapi
 * /SearchForm.html:
 *   get:
 *     summary: Serve search HTML form
 *     tags:
 *       - Web pages
 *     responses:
 *       200:
 *         description: HTML page
 */
app.get("/SearchForm.html", (req, res) => {
    res.sendFile(path.join(__dirname, "SearchForm.html"));
});

/**
 * @openapi
 * /search:
 *   post:
 *     summary: Search item by ID
 *     tags:
 *       - Inventory
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               includePhoto:
 *                 type: string
 *                 enum: ["true", "false"]
 *     responses:
 *       200:
 *         description: Search result
 *       404:
 *         description: Not found
 */
app.post("/search", (req, res) => {
    const { id, includePhoto } = req.body;

    const file = getItemPath(id);
    if (!fs.existsSync(file)) return res.status(404).send("Not found");

    let data = JSON.parse(fs.readFileSync(file));

    if (includePhoto) data.photo_url = `/inventory/${id}/photo`;
    res.json(data);
    console.log(req.body);
});

app.use((req, res) => {
    res.status(405).send("Method Not Allowed");
});

const server = http.createServer(app);

server.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}/`);
});