const express = require('express');
const main = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { client } = require('./session');
const ytsr = require('@citoyasha/yt-search');

main.get('/audio/search', (req, res) => {
  res.render('search');
});

main.get('/audio/search/:q', async (req, res) => {
  let q = req.params.q.replace('-download-mp3', '');
  let Cache = await client.db('ytomp3').collection('searchCache').find({ q }).toArray();

  if (Cache.length !== 0) return res.render('index', Cache[0]);

  try {
    const youtubeSearchData = await ytsr.search(q, 5).then(data => data[0]);
    if (!youtubeSearchData) throw new Error('No results');

    const render = {
      q,
      title: youtubeSearchData.title,
      description: youtubeSearchData.description,
      downloadUrl: `download/file/${youtubeSearchData.id}`,
    };

    res.render('index', render);
    axios.get('https://ytomp3updaterapi.onrender.com/api/update/' + encodeURIComponent(q)).catch(() => {});
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).send('Search failed.');
  }
});

main.get('/search/:q', async (req, res) => {
  try {
    let results = await ytsr.search(req.params.q, 5);
    results = results.map(v => ({
      videoId: v.id,
      title: v.title,
      thumbnail: v.thumbnail,
    }));
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.sendStatus(500);
  }
});

main.post('/data/:options', async (req, res) => {
  const col = client.db('songData').collection(req.session.username);
  switch (req.params.options) {
    case 'save':
      await col.updateOne(req.body, { $set: req.body }, { upsert: true });
      res.sendStatus(200);
      break;
    case 'get':
      const data = await col.find({}).toArray();
      res.json(data);
      break;
  }
});

main.get('/download/file/:query', async (req, res) => {
  const videoID = decodeURIComponent(req.params.query);
  if (!videoID || videoID === 'undefined') {
    console.error('Invalid video URL:', videoID);
    return res.status(400).send('Invalid video URL');
  }

  try {
    const fullURL = `https://www.youtube.com/watch?v=${videoID}`;
    const infoRes = await axios.get("https://yt-cw.fabdl.com/youtube/get", {
      params: {
        url: fullURL,
        mp3_task: 2,
      },
    });

    const result = infoRes.data.result;
    if (!result || !result.mp3_task_url) throw new Error("mp3_task_url not found");

    const taskRes = await axios.get(result.mp3_task_url);
    const task = taskRes.data.result;

    if (!task || !task.download_url) throw new Error("No download URL found");

    const finalUrl = "https://api.fabdl.com" + task.download_url;

    const fileName = `ytomp3-${Math.floor(Math.random() * 90000) + 10000}.mp3`;
    const writer = fs.createWriteStream(path.join(__dirname, '../tmp', fileName));

    const audioStream = await axios({
      method: 'get',
      url: finalUrl,
      responseType: 'stream',
    });

    audioStream.data.pipe(writer);
    writer.on('finish', () => res.download(path.join(__dirname, '../tmp', fileName), fileName));
    writer.on('error', () => res.status(500).send('Failed to stream audio'));

  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).send('Download failed');
  }
});

module.exports = main;
