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

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Webservice running\n");
});

server.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}/`);
});
