const express = require("express");
const main = express.Router();
const axios = require("axios");
const ytdl = require("ytdl-core");
const { client, handleDb } = require("./session");
const { ProxyAgent } = require("proxy-agent");
const ytsr = require("@citoyasha/yt-search");
const ytsearch = require("yt-search");
const fs = require("fs")
const path = require("path")

const agent = new ProxyAgent("http://139.59.1.14:3128");

main.get("/audio/search", (req, res) => {
  res.render("search");
});
main.get("/audio/search/:q", async (req, res) => {
  let q = req.params.q;
  q = q.replace("-download-mp3", "");

  var youtubeSearchData = await ytsearch
    .search({ query: q, pages: 1 })
    .then((data) => data.all[0]);

  if (!youtubeSearchData) {
    res.status(500).write("server error due to unexpected search");
    res.end();
    return;
  }

  const render = {
    title: youtubeSearchData.title,
    description: youtubeSearchData.description,
    downloadUrl: `download/file/${youtubeSearchData.videoId}`,
  };
  res.render("index", render);
});

main.get("/stream/:id", async (req, res) => {
  const videoURL = req.params.id;

  try {
    // Generate a random filename for the temporary file
    const filename = Math.random().toString(36).substring(7) + ".mp3";

    // Path to the tmp folder (sibling of /server)
    const tmpFolderPath = path.join(__dirname, '../tmp');
    const tmpFilePath = path.join(tmpFolderPath, filename);

    // Create the temporary directory if it doesn't exist
    if (!fs.existsSync(tmpFolderPath)) {
      fs.mkdirSync(tmpFolderPath, { recursive: true });
    }

    // Download the entire audio file and save it to the temporary folder
    const writableStream = fs.createWriteStream(tmpFilePath);
    const stream = ytdl(videoURL, { quality: 'highestaudio', filter: 'audioonly' });

    stream.on("data", (chunk) => writableStream.write(chunk));

    stream.on("end", () => {
      writableStream.end();
      // Send the file after it has been written
      res.sendFile(tmpFilePath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
        } else {
          // Clean up the temporary file after it has been sent
          fs.unlinkSync(tmpFilePath);
        }
      });
    });

  } catch (error) {
    // Handle the error, for example, send a response indicating that the video is not found
    console.error('Error fetching video info:', error);
    res.status(404).send('Video not found or is no longer available');
  }
});



main.get("/search/:q", async (req, res) => {
  const q = req.params.q;

  var youtubeSearchData = await ytsr.search(q, 5);

  youtubeSearchData = youtubeSearchData.map((value) => {
    return {
      videoId: value.id,
      title: value.title,
      thumbnail: value.thumbnail,
    };
  });
  res.json(youtubeSearchData);
});

main.get("/getUrl/:id", (req, res) => {
  ytdl.getInfo(req.params.id).then((resp) => {
    res.json(resp.formats);
  });
});
main.post("/data/:options", async (req, res) => {
  switch (req.params.options) {
    case "save":
      await client
        .db("songData")
        .collection(req.session.username)
        .updateOne(req.body, { $set: req.body }, { upsert: true });
      break;
    case "get":
      client
        .db("songData")
        .collection(req.session.username)
        .find({})
        .toArray()
        .then((data) => {
          res.json(data);
        });
  }
});
module.exports = main;
