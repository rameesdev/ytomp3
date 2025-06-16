const express = require('express');
const main = express.Router();
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const { client } = require('./session');
const ytsr = require('@citoyasha/yt-search');

// Disable ytdl-core update check
process.env.YTDL_NO_UPDATE = '1';

main.get('/audio/search', (req, res) => {
  res.render('search');
});
main.get('/audio/:q', async (req, res) => {
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
    const isValid = await ytdl.validateURL(q);
    if (isValid) return streamAudio(q, res);
    res.status(500).send('Search failed.');
  }
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
    const isValid = await ytdl.validateURL(q);
    if (isValid) return streamAudio(q, res);
    res.status(500).send('Search failed.');
  }
});

main.get('/stream/:id', async (req, res) => {
  const videoURL = req.params.id;
  if (!videoURL) return res.status(400).send('Invalid video URL');

  try {
    const info = await ytdl.getInfo(videoURL, {
      quality: 'highestaudio',
      filter: 'audioonly',
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      }
    });

    const streamUrl = info.formats.find(f => f.hasAudio && f.mimeType.includes('audio'))?.url;
    if (!streamUrl) throw new Error('No audio stream available');

    const headers = req.headers;
    const response = await axios.get(streamUrl, {
      responseType: 'stream',
      headers: {
        Range: headers['range'],
        'If-Range': headers['if-range'],
        'User-Agent': 'Mozilla/5.0',
      },
      timeout: 30000,
    });

    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }

    res.status(response.status);
    response.data.pipe(res);

  } catch (err) {
    console.error('Stream error:', err.message); 
    const fileName = videoURL + '.mp3';
    const tmpPath = path.join(__dirname, '../tmp', fileName);

    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(path.dirname(tmpPath), { recursive: true });

      const stream = ytdl(videoURL, {
        quality: 'highestaudio',
        filter: 'audioonly',
        highWaterMark: 1 << 25,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        }
      });

      const writable = fs.createWriteStream(tmpPath);
      stream.pipe(writable);
      writable.on('finish', () => res.sendFile(tmpPath));
      stream.on('error', (err) => {
        console.error('File stream error:', err.message);
        res.status(404).send('Stream error');
      });

    } else {
      res.sendFile(tmpPath);
    }
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

main.get('/getUrl/:id', async (req, res) => {
  try {
    const info = await ytdl.getInfo(req.params.id, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }
    });
    res.json(info.formats);
  } catch (err) {
    console.error('Get URL error:', err.message);
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
    console.error('Invalid video ID:', videoID);
    return res.status(400).send('Invalid video ID');
  }

  try {
    // 🔄 Call the external conversion API
    const response = await axios.post('https://cnvmp3.com/check_database.php', {
      youtube_id: videoID,
      quality: 4,
      formatValue: 1
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const { success, data } = response.data;

    if (!success || !data?.server_path) {
      return res.status(404).send('MP3 not available for this video');
    }

    const downloadUrl = encodeURI(data.server_path);
    const fileName = `ytomp3-${Math.floor(Math.random() * 90000) + 10000}.mp3`;

    // 📤 Proxy the MP3 file to the client
    const stream = await axios.get(downloadUrl, {
      responseType: 'stream',
      headers: {
        'Referer': 'https://cnvmp3.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': '*/*',
        'Connection': 'keep-alive',
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'audio/mpeg');

    stream.data.pipe(res);

  } catch (err) {
    console.error('External API/download error:', err.message);
    res.status(500).send('Failed to fetch MP3');
  }
});


module.exports = main;
