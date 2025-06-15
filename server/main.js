// routes/main.js
const express = require("express");
const main = express.Router();
const axios = require("axios");
const ytdl = require("@distube/ytdl-core");
const fs = require("fs");
const path = require("path");
const { client } = require("./session");
const ytsr = require("@citoyasha/yt-search");
const { createProxyAgent } = require("@distube/ytdl-core");

// Disable ytdl-core update check
process.env.YTDL_NO_UPDATE = '1';

// Load proxy list from http.txt
const proxyList = fs.readFileSync(path.join(__dirname, 'http.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map(p => (p.startsWith('http://') || p.startsWith('https://') ? p : 'http://' + p));


function getRandomProxyAgent() {
  const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
  return createProxyAgent({ uri: proxy });
}

async function withProxyRetry(fn, retries = 3) {
  let error;
  for (let i = 0; i < retries; i++) {
    const client = getRandomProxyAgent();
    try {
      return await fn(client);
    } catch (err) {
      error = err;
      console.warn(`Proxy attempt ${i + 1} failed: ${err.message}`);
    }
  }
  throw error;
}

main.get("/audio/search", (req, res) => {
  res.render("search");
});

main.get("/audio/search/:q", async (req, res) => {
  let q = req.params.q.replace("-download-mp3", "");
  let Cache = await client.db("ytomp3").collection("searchCache").find({ q }).toArray();

  if (Cache.length !== 0) return res.render("index", Cache[0]);

  try {
    const youtubeSearchData = await ytsr.search(q, 5).then(data => data[0]);
    if (!youtubeSearchData) throw new Error("No results");

    const render = {
      q,
      title: youtubeSearchData.title,
      description: youtubeSearchData.description,
      downloadUrl: `download/file/${youtubeSearchData.id}`,
    };

    res.render("index", render);
    axios.get("https://ytomp3updaterapi.onrender.com/api/update/" + encodeURIComponent(q)).catch(() => {});
  } catch (error) {
    const isValid = await ytdl.validateURL(q);
    if (isValid) return streamAudio(q, res);
    res.status(500).send("Search failed.");
  }
});

main.get("/stream/:id", async (req, res) => {
  const videoURL = req.params.id;
  if (!videoURL) return res.status(400).send("Invalid video URL");

  try {
    const info = await withProxyRetry((client) =>
      ytdl.getInfo(videoURL, {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: { client },
      })
    );

    const streamUrl = info.formats.find(f => f.hasAudio)?.url;
    if (!streamUrl) throw new Error("No audio stream available");

    const headers = req.headers;
    const response = await axios.get(streamUrl, {
      responseType: 'stream',
      headers: {
        Range: headers['range'],
        'If-Range': headers['if-range']
      }
    });

    for (const [key, value] of Object.entries(response.headers)) {
      res.set(key, value);
    }
    res.status(response.status);
    response.data.pipe(res);
  } catch (err) {
    const fileName = videoURL + ".mp3";
    const tmpPath = path.join(__dirname, '../tmp', fileName);
    if (!fs.existsSync(tmpPath)) {
      if (!fs.existsSync(path.dirname(tmpPath))) fs.mkdirSync(path.dirname(tmpPath), { recursive: true });

      const stream = ytdl(videoURL, { quality: 'highestaudio', filter: 'audioonly' });
      const writable = fs.createWriteStream(tmpPath);
      stream.pipe(writable);
      writable.on("finish", () => res.sendFile(tmpPath));
      stream.on("error", () => res.status(404).send("Stream error"));
    } else {
      res.sendFile(tmpPath);
    }
  }
});

main.get("/search/:q", async (req, res) => {
  try {
    let results = await ytsr.search(req.params.q, 5);
    results = results.map(v => ({
      videoId: v.id,
      title: v.title,
      thumbnail: v.thumbnail
    }));
    res.json(results);
  } catch {
    res.sendStatus(500);
  }
});

main.get("/getUrl/:id", async (req, res) => {
  try {
    const info = await ytdl.getInfo(req.params.id);
    res.json(info.formats);
  } catch {
    res.sendStatus(500);
  }
});

main.post("/data/:options", async (req, res) => {
  const col = client.db("songData").collection(req.session.username);
  switch (req.params.options) {
    case "save":
      await col.updateOne(req.body, { $set: req.body }, { upsert: true });
      res.sendStatus(200);
      break;
    case "get":
      const data = await col.find({}).toArray();
      res.json(data);
      break;
  }
});

main.get("/download/file/:query", async (req, res) => {
  const videoURL = decodeURIComponent(req.params.query);
  if (!videoURL || videoURL === "undefined") return res.status(400).send("Invalid video URL");
  streamAudio(videoURL, res);
});

function streamAudio(videoURL, res) {
  withProxyRetry((client) => {
    const stream = ytdl(videoURL, {
      quality: "highestaudio",
      filter: "audioonly",
      highWaterMark: 1 << 25,
      requestOptions: { client },
    });

    res.set("Content-Type", "audio/mpeg");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=ytomp3-${Math.floor(Math.random() * 90000) + 10000}.mp3`
    );

    stream.pipe(res);
    stream.on("error", () => {
      res.status(500).send("Streaming error");
    });
  }).catch(() => {
    res.status(500).send("Proxy all failed");
  });
}

module.exports = main;