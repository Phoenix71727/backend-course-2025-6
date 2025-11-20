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

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: options.cache });

function getItemPath(id) {
    return path.join(options.cache, `${id}.json`);
}

function getPhotoPath(id) {
    return path.join(options.cache, `${id}.jpg`);
}

app.post("/register", upload.single("photo"), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        return res.status(400).json({ error: "Name is required" });
    }

    const id = Date.now().toString();
    const item = {
        id,
        inventory_name,
        description: description || "",
        photo: `/inventory/${id}/photo`
    };

    fs.writeFileSync(getItemPath(id), JSON.stringify(item, null, 2));

    if (req.file) {
        fs.renameSync(req.file.path, getPhotoPath(id));
    }

    res.status(201).json({ message: "Created", id });
});

app.get("/inventory", (req, res) => {
    const files = fs.readdirSync(options.cache)
        .filter(f => f.endsWith(".json"));

    const items = files.map(f => {
        return JSON.parse(fs.readFileSync(path.join(options.cache, f)));
    });

    res.json(items);
});

app.get("/inventory/:id", (req, res) => {
    const file = getItemPath(req.params.id);

    if (!fs.existsSync(file)) {
        return res.status(404).send("Not found");
    }

    const data = JSON.parse(fs.readFileSync(file));
    res.json(data);
});

app.put("/inventory/:id", (req, res) => {
    const file = getItemPath(req.params.id);

    if (!fs.existsSync(file)) {
        return res.status(404).send("Not found");
    }

    let data = JSON.parse(fs.readFileSync(file));
    const { inventory_name, description } = req.body;

    if (inventory_name) data.inventory_name = inventory_name;
    if (description) data.description = description;

    fs.writeFileSync(file, JSON.stringify(data, null, 2));

    res.json({ message: "Updated" });
});

app.get("/inventory/:id/photo", (req, res) => {
    const file = getPhotoPath(req.params.id);

    if (!fs.existsSync(file)) {
        return res.status(404).send("Photo not found");
    }

    res.setHeader("Content-Type", "image/jpeg");
    fs.createReadStream(file).pipe(res);
});

app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
    const id = req.params.id;

    if (!fs.existsSync(getItemPath(id))) {
        return res.status(404).send("Not found");
    }

    if (!req.file) {
        return res.status(400).send("No photo uploaded");
    }

    fs.renameSync(req.file.path, getPhotoPath(id));

    res.json({ message: "Photo updated" });
});

app.delete("/inventory/:id", (req, res) => {
    const id = req.params.id;
    const json = getItemPath(id);
    const photo = getPhotoPath(id);

    if (!fs.existsSync(json)) {
        return res.status(404).send("Not found");
    }

    fs.unlinkSync(json);
    if (fs.existsSync(photo)) fs.unlinkSync(photo);

    res.json({ message: "Deleted" });
});

app.get("/RegisterForm.html", (req, res) => {
    res.sendFile(path.join(__dirname, "RegisterForm.html"));
});


app.get("/SearchForm.html", (req, res) => {
    res.sendFile(path.join(__dirname, "SearchForm.html"));
});

app.post("/search", (req, res) => {
    const { id, includePhoto } = req.body;

    const file = getItemPath(id);
    if (!fs.existsSync(file)) {
        return res.status(404).send("Not found");
    }

    let data = JSON.parse(fs.readFileSync(file));

    if (includePhoto) {
        data.photo_url = `/inventory/${id}/photo`;
    }
    res.json(data);
    console.log(req.body);
});

app.get("/search", (req, res) => {
    const { id, includePhoto } = req.query;

    const file = getItemPath(id);
    if (!fs.existsSync(file)) {
        return res.status(404).send("Not found");
    }

    let data = JSON.parse(fs.readFileSync(file));

    if (includePhoto === "true") {
        data.photo_url = `/inventory/${id}/photo`;
    }

    res.json(data);
});

app.use((req, res) => {
    res.status(405).send("Method Not Allowed");
});

const server = http.createServer(app);

server.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}/`);
});
