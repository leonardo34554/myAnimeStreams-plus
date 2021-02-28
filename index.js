const express = require("express");
const addon = express();

const { get_stream } = require("./lib/providers/4anime");
const { get_stream2 } = require("./lib/providers/gogo");
const { get_stream3 } = require("./lib/providers/kisa");

const MANIFEST = require("./manifest.json");

const unique = new Set();

function respond(res, data) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  res.send(data);
}

addon.get("/manifest.json", (req, res) => {
  respond(res, MANIFEST);
});

addon.param("type", (req, res, next, val) => {
  if (MANIFEST.types.includes(val)) {
    next();
  } else {
    next("Unsupported type " + val);
  }
});

addon.get("/stream/:type/:media.json", async (req, res, next) => {
  unique.add(req.headers["x-forwarded-for"] || req.connection.remoteAddress);
  const { media, type } = req.params;
  const arr = media.split(":");
  const id = arr[1];
  const ep = arr[2] ? arr[2] : 1;

  const sources = [get_stream, get_stream2, get_stream3];

  const s = await Promise.all(
    sources.map(async (x) => await x(media, id, ep, type))
  );

  const links = s.reduce((a, b) => a.concat(b));

  const set = new Set();
  const streams = [];

  links.forEach((x) => {
    if (!set.has(x.url)) {
      set.add(x.url);
      streams.push(x);
    }
  });

  respond(res, {
    streams: streams,
  });

  console.log("\n");
  console.log("\n");
  console.log(set);
  console.log("\n");
  console.log("\n");
});

addon.get("/check", (req, res) => {
  res.send(unique.size + " ");
});

addon.get("/", (req, res) => {
  res.send("Hey there!");
});

addon.listen(process.env.PORT || 7000, () => {
  console.log("Add-on Repository URL: http://127.0.0.1:7000/manifest.json");
});

const request = require("request");
