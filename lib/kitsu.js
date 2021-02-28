const request = require("request");

function kitsu(id) {
  return new Promise((resolve, reject) => {
    request(
      `https://anime-kitsu.strem.fun/meta/series/kitsu%3A${id}.json`,
      (e, r, b) => {
        try {
          const json = JSON.parse(b);
          const meta = json.meta;
          const name = meta.name;
          const title = name.replace(/[^a-z0-9 ]/gi, " ");
          const year = meta.year.substring(0, 4);
          resolve({
            query: title,
            year: year,
          });
        } catch (error) {
          resolve({
            query: undefined,
            year: undefined,
          });
        }
      }
    );
  });
}

module.exports = { kitsu };
