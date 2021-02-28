const request = require("request");
const { parse } = require("fast-html-parser");

const NodeCache = require("node-cache");
const cache = new NodeCache();

const { get, put } = require("../db");
const { kitsu } = require("../kitsu");

const TITLE_AGE = 60 * 60 * 24 * 7;
const LINK_AGE = 60 * 30;

const TYPES = {
  movie: "Movies",
  series: "Subbed",
};

function get_dubbed(title) {
  return new Promise((resolve, reject) => {
    request(
      `https://animekisa.tv/${title}`,
      { followRedirect: false },
      (e, r, b) => {
        try {
          resolve(r.statusCode == 200);
        } catch (error) {
          resolve(false);
        }
      }
    );
  });
}

function search(query, type) {
  return new Promise((resolve, reject) => {
    request(`https://animekisa.tv/search?q=${query}`, async (e, r, b) => {
      try {
        const html = parse(b);
        const t = html.querySelectorAll(".lisbg").map((x) => x.text);
        const idx = t.indexOf(TYPES[type]);
        const types = html.querySelectorAll(".similarbox");
        const results = types[idx]
          .querySelectorAll(".an")
          .map((x) => x.rawAttributes.href.substring(1));
        const arr = [];
        if (results[0] != null && results[0] != "/") {
          arr.push(results[0]);
          if (await get_dubbed(results[0] + "-dubbed")) {
            arr.push(results[0] + "-dubbed");
          }
        }
        resolve(arr);
      } catch (error) {
        resolve([]);
      }
    });
  });
}

function get_vidstream(url) {
  return new Promise((resolve, reject) => {
    request(url, (e, r, b) => {
      try {
        const json = JSON.parse(b);
        const link = json.source[0].file;
        resolve(link);
      } catch (error) {
        resolve(null);
      }
    });
  });
}

function get_fembed(url) {
  return new Promise((resolve, reject) => {
    request(url, { method: "POST" }, (e, r, b) => {
      try {
        const json = JSON.parse(b);
        const link = json.data[json.data.length - 1].file;
        resolve(link);
      } catch (error) {
        resolve(null);
      }
    });
  });
}

function get_episode(title, ep) {
  return new Promise((resolve, reject) => {
    request(`https://animekisa.tv/${title}-episode-${ep}`, async (e, r, b) => {
      const links = [];
      try {
        const idxv1 = b.indexOf('var VidStreaming = "') + 20;
        const idxv2 = b.indexOf('"', idxv1);
        const vidstream = b.substring(idxv1, idxv2).replace("load", "ajax");
        if (vidstream != "")
          links.push({ link: vidstream, method: get_vidstream });
      } catch (error) {}

      try {
        const idxf1 = b.indexOf('var Fembed = "') + 14;
        const idxf2 = b.indexOf('"', idxf1);
        const fembed = b.substring(idxf1, idxf2).replace("/v/", "/api/source/");
        if (fembed != "") links.push({ link: fembed, method: get_fembed });
      } catch (error) {}

      resolve(links);
    });
  });
}

function get_stream3(media, id, ep, type) {
  return new Promise(async (resolve, reject) => {
    if (!cache.get(media)) {
      if (!cache.get(id)) {
        if ((await get(id, "ak")) == null) {
          const { query } = await kitsu(id);
          if (!query) {
            resolve([]);
            return;
          }
          const results = await search(query, type);
          if (results.length == 0) {
            resolve([]);
            return;
          }
          await put(id, results, "ak");
        }
        const res = await get(id, "ak");
        cache.set(id, res.title, TITLE_AGE);
      }
      const titles = cache.get(id);

      const streams = await Promise.all(
        titles.map(async (x) => {
          const e = await get_episode(x, ep);
          return await Promise.all(
            e.map(async (y) => {
              return {
                name: "MAS+",
                title: `${ep ? `EP ${ep}` : ``} ${
                  x.includes("dub") ? "DUB" : "SUB"
                } - MyAnimeStreams+`,
                url: await y.method(y.link),
              };
            })
          );
        })
      );

      const red = streams.reduce((a, b) => a.concat(b));
      //console.log(red);

      cache.set(media, red, LINK_AGE);
    }
    resolve(cache.get(media));
  });
}

module.exports = { get_stream3 };
