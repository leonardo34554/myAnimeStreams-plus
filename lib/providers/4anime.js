const request = require("request");
const NodeCache = require("node-cache");
const cache = new NodeCache();

const { get, put } = require("../db");
const { kitsu } = require("../kitsu");

const TITLE_AGE = 60 * 60 * 24 * 7;
const LINK_AGE = 60 * 30;

const HOST =
  "https://storage.googleapis.com/api-project-561310400045.appspot.com";

function search(query) {
  return new Promise((resolve, reject) => {
    request(
      {
        url: "https://4anime.to/wp-admin/admin-ajax.php",
        formData: {
          action: "ajaxsearchlite_search",
          aslp: query,
          asid: 1,
          options: "qtranslate_lang=0&set_intitle=None&customset%5B%5D=anime",
        },
        method: "POST",
      },
      (e, r, b) => {
        const broken = b.split("https://4anime.to/anime/").slice(1);
        const results = broken.map((x) => {
          const idx = x.indexOf('"');
          const cut = x.substring(0, idx);
          return cut;
        });
        const arr = [];
        if (results[0] != null) {
          arr.push(results[0]);
          if (results.includes(results[0] + "-dub")) {
            arr.push(results[0] + "-dub");
          }
        }
        resolve(arr);
      }
    );
  });
}

function get_link(episode) {
  return new Promise((resolve, reject) => {
    request(episode, (e, r, b) => {
      try {
        const idx = b.indexOf("|type|me|4animu|");
        const server = b.substring(idx + 16, idx + 18);
        const idx2 = b.indexOf("mirror_dl") + 19;
        const idx3 = b.indexOf("\\", idx2);
        const url = b.substring(idx2, idx3);
        const arr = url.split("/");
        const l = arr.length;
        const check = b.indexOf("centered|googleapis|ty");
        const link =
          check != -1 && !server.includes("<")
            ? `${HOST}/${server}.4animu.me/${arr[l - 2]}/${arr[l - 1]}`
            : url;

        resolve(link);
      } catch (error) {
        resolve();
      }
    });
  });
}

function get_episode(title, ep) {
  return new Promise((resolve, reject) => {
    request(`https://4anime.to/anime/${title}`, (e, r, b) => {
      const broken = b.split(`/?id=`);
      const results = broken.map((x) => {
        const idx = x.lastIndexOf('"');
        const cut = x.substring(idx + 1);
        return cut;
      });
      resolve(results[ep - 1]);
    });
  });
}

function get_stream(media, id, ep) {
  return new Promise(async (resolve, reject) => {
    if (!cache.get(media)) {
      if (!cache.get(id)) {
        if ((await get(id, "4anime")) == null) {
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
          await put(id, results, "4anime");
        }
        const res = await get(id, "4anime");
        cache.set(id, res.title, TITLE_AGE);
      }
      const titles = cache.get(id);

      const streams = await Promise.all(
        titles.map(async (x) => {
          const e = await get_episode(x, ep);
          return {
            name: "MAS+",
            title: `EP ${ep} SUB - MyAnimeStreams+`,
            url: e ? await get_link(e) : null,
          };
        })
      );

      cache.set(media, streams, LINK_AGE);
    }
    resolve(cache.get(media));
  });
}

module.exports = { get_stream };
