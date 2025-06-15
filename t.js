const axios = require('axios');
const fs = require('fs');
const path = require('path');

const videoId = 'a3Ue-LN5B9U';

async function getDownloadUrl(videoId) {
  try {
    const response = await axios.post('https://cnvmp3.com/check_database.php', {
      youtube_id: videoId,
      quality: 4,
      formatValue: 1
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const { success, data } = response.data;

    if (!success || !data?.server_path) {
      console.log('❌ MP3 not available for this video.');
      return;
    }

    const encodedUrl = encodeURI(data.server_path);
    console.log('✅ Download URL:', encodedUrl);

    await downloadFile(encodedUrl, `${videoId}.mp3`);

  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
}

async function downloadFile(url, filename) {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9,en-IN;q=0.8',
        'Connection': 'keep-alive',
        'Host': new URL(url).host,
        'Referer': 'https://cnvmp3.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0',
        'sec-ch-ua': '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      }
    });

    const filePath = path.resolve(__dirname, filename);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    writer.on('finish', () => {
      console.log(`✅ File downloaded: ${filename}`);
    });

    writer.on('error', (err) => {
      console.error('❌ Write failed:', err.message);
    });

  } catch (err) {
    console.error('❌ Download failed:', err.message);
  }
}

getDownloadUrl(videoId);
