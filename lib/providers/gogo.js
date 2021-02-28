const request = require("request");
const NodeCache = require("node-cache");
const cache = new NodeCache();

const { get, put } = require("../db");
const { kitsu } = require("../kitsu");

const TITLE_AGE = 60 * 60 * 24 * 7;
const LINK_AGE = 60 * 30;

function search(query) {
  return new Promise((resolve, reject) => {
    request(
      `https://bypass-cors.vercel.app/cors.py?url=https://ajax.gogocdn.net/site/loadAjaxSearch?keyword=${query}`,
      (e, r, b) => {
        const broken = b.split("category/").slice(1);
        const search = broken.map((x) => {
          const idx = x.indexOf("\\");
          return x.substring(0, idx);
        });
        const arr = [];
        if (search[0] != null) {
          arr.push(search[0]);
          if (search.includes(search[0] + "-dub")) {
            arr.push(search[0] + "-dub");
          }
        }
        resolve(arr);
      }
    );
  });
}

function get_episode(title, ep) {
  return new Promise((resolve, reject) => {
    request(
      `https://vocal-cyclist-251202.df.r.appspot.com/iframeid?query=${title}-episode-${ep}`,
      { timeout: 9000 },
      (e, r, b) => {
        if (!r || r.statusCode != 200) {
          resolve();
          return;
        }
        const json = JSON.parse(b);
        const source = json.openload;
        const link = source.replace("streaming", "ajax");
        resolve(link);
      }
    );
  });
}

function get_link(episode) {
  return new Promise((resolve, reject) => {
    request(episode, (e, r, b) => {
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

function get_stream2(media, id, ep) {
  return new Promise(async (resolve, reject) => {
    if (!cache.get(media)) {
      if (!cache.get(id)) {
        if ((await get(id, "db")) == null) {
          const { query } = await kitsu(id);
          if (!query) {
            resolve([]);
            return;
          }
          const results = await search(query);
          if (results.length == 0) {
            resolve([]);
            return;
          }
          await put(id, results, "db");
        }
        const res = await get(id, "db");
        cache.set(id, res.title, TITLE_AGE);
      }
      const titles = cache.get(id);

      const streams = await Promise.all(
        titles.map(async (x) => {
          const e = await get_episode(x, ep);
          return {
            name: "MAS+",
            title: `${ep ? `EP ${ep}` : ``} ${
              x.includes("dub") ? "DUB" : "SUB"
            } - MyAnimeStreams+`,
            url: e ? await get_link(e) : null,
          };
        })
      );

      cache.set(media, streams, LINK_AGE);
    }
    resolve(cache.get(media));
  });
}

module.exports = { get_stream2 };
