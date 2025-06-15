// routes/main.js
const express = require("express");
const main = express.Router();
const axios = require("axios");
const ytdl = require("@distube/ytdl-core");
const { exec } = require("child_process");

const { client, handleDb } = require("./session");
const { ProxyAgent } = require("proxy-agent");
const ytsr = require("@citoyasha/yt-search");
const yturl = require("ytsr");
const fs = require("fs");
const path = require("path");

const agent = new ProxyAgent("http://139.59.1.14:3128");

process.env.YTDL_NO_UPDATE = '1';

main.get("/audio/search", (req, res) => {
  res.render("search");
});

main.get("/audio/search/:q", async (req, res) => {
  let q = req.params.q.replace("-download-mp3", "");
  let Cache = await client.db("ytomp3").collection("searchCache").find({ q }).toArray();

  if (Cache.length !== 0) {
    return res.render("index", Cache[0]);
  }

  try {
    var youtubeSearchData = await ytsr.search(q, 5).then(data => data[0]);
  } catch (error) {
    var result = await ytdl.validateURL(q);
    if (result) {
      return streamAudio(q, res);
    }
    return res.status(500).send("Server error during search.");
  }

  if (!youtubeSearchData) {
    return res.status(500).send("No results found");
  }

  const render = {
    q,
    title: youtubeSearchData.title,
    description: youtubeSearchData.description,
    downloadUrl: `download/file/${youtubeSearchData.id}`,
  };
  res.render("index", render);

  try {
    await axios.get("https://ytomp3updaterapi.onrender.com/api/update/" + encodeURI(q));
  } catch (error) {
    console.log("Error while updating");
  }
});

main.get("/stream/:id", async (req, res) => {
  const videoURL = req.params.id;

  if (!videoURL) return res.status(400).send("Invalid video URL");

  try {
    const videoInfo = await ytdl.getInfo(videoURL, {
      quality: 'highestaudio',
      filter: 'audioonly',
      requestOptions: { agent }
    });

    const url = videoInfo.formats.find(f => f.hasAudio)?.url;
    if (!url) throw new Error("No audio format found");

    const headers = req.headers;
    const response = await axios({
      method: "get",
      url,
      responseType: 'stream',
      headers: {
        Range: headers['range'],
        'If-Range': headers['if-range']
      }
    });

    const head = response.headers;
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Range', head['content-range']);
    res.set('Accept-Ranges', head['accept-ranges']);
    res.set('Content-Length', head['content-length']);

    res.status(response.status);
    response.data.pipe(res);

  } catch (error) {
    const filename = videoURL + ".mp3";
    const tmpPath = path.join(__dirname, '../tmp', filename);

    fs.access(tmpPath, fs.constants.F_OK, err => {
      if (err) {
        if (!fs.existsSync(path.dirname(tmpPath))) {
          fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
        }

        const stream = ytdl(videoURL, { quality: 'highestaudio', filter: 'audioonly' });
        const writable = fs.createWriteStream(tmpPath);

        stream.pipe(writable);
        writable.on("finish", () => res.sendFile(tmpPath));
        stream.on("error", () => res.status(404).send("Stream error"));
      } else {
        res.sendFile(tmpPath);
      }
    });
  }
});

main.get("/search/:q", async (req, res) => {
  const q = req.params.q;
  try {
    let results = await ytsr.search(q, 5);
    results = results.map(val => ({
      videoId: val.id,
      title: val.title,
      thumbnail: val.thumbnail
    }));
    res.json(results);
  } catch {
    res.sendStatus(500);
  }
});

main.get("/getUrl/:id", (req, res) => {
  ytdl.getInfo(req.params.id).then(info => res.json(info.formats));
});

main.post("/data/:options", async (req, res) => {
  const col = client.db("songData").collection(req.session.username);
  switch (req.params.options) {
    case "save":
      await col.updateOne(req.body, { $set: req.body }, { upsert: true });
      break;
    case "get":
      const data = await col.find({}).toArray();
      res.json(data);
      break;
  }
});

main.get("/download/file/:query", async (req, res) => {
  const videoURL = decodeURIComponent(req.params.query);
  if (!videoURL || videoURL === "undefined") {
    return res.status(400).send("Invalid video URL");
  }
  streamAudio(videoURL, res);
});

function streamAudio(videoURL, res) {
  const stream = ytdl(videoURL, {
    quality: "highestaudio",
    filter: "audioonly",
    highWaterMark: 1 << 25,
    requestOptions: { agent },
  });

  res.set("Content-Type", "audio/mpeg");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=ytomp3-${Math.floor(Math.random() * 90000) + 10000}.mp3`
  );

  stream.pipe(res);
  stream.on("error", (err) => {
    console.error("YTDL error:", err.message);
    res.redirect("/stream/" + encodeURIComponent(videoURL));
  });
}

module.exports = main;
