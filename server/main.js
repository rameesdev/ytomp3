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
  let Cache =await client.db("ytomp3").collection("searchCache").find({q}).toArray()
  console.log(Cache.length)
  if(Cache.length!=0){
    res.render("index",Cache[0]);


  }else{
  
  try {
    var youtubeSearchData = await ytsr.search(q, 5).then(data=>data[0]);
  console.log(youtubeSearchData)
  } catch (error) {
    res.status(500).write("server error due to unexpected search");
    res.end();
    axios.get("https://ytomp3updaterapi.cyclic.app/api/update/"+q)
    return;
  }
 axios.get("https://ytomp3updaterapi.cyclic.app/api/update/"+q)

  if (!youtubeSearchData) {
    res.status(500).write("server error due to unexpected search");
    res.end();
    return;
  }
  
  const render = {
    q,
    title: youtubeSearchData.title,
    description: youtubeSearchData.description,
    downloadUrl: `download/file/${youtubeSearchData.id}`,
    
  };
  res.render("index", render);
  
}
});

main.get("/stream/:id", async (req, res) => {  
  const videoURL = req.params.id;
  console.log(req.session)
  try {
    if (!videoURL) {
      return res.status(400).send('Please provide a valid YouTube video URL.');
    }
      const videoInfo = await ytdl.getInfo(videoURL,{quality: 'highestaudio',
         filter: 'audioonly',
        requestOptions:{agent}})
      url = videoInfo.formats.map((value) => {
          if (value.hasAudio) return value.url;
        })
        .filter((value) => {
          if (value != undefined) return true;
        })[0]
    const clientHeaders = req.headers;
  ; 
  const partialContentHeaders = {
    'Range': clientHeaders['range'],
    'If-Range': clientHeaders['if-range'],
  };
  
  const response = await axios({
    method: "get",
    url,responseType: 'stream',
    headers: {
      ...partialContentHeaders
    },
    
  });
  const head =response.headers
   res.set('Content-Type', 'audio/mpeg');
  res.set('Content-Range',head['content-range'])
   res.set('Accept-Ranges',head['accept-ranges'])
   res.set('Content-Length',head['content-length'])
    
    res.status(response.status)
    response.data.pipe(res)
    
  } catch (error) {
    
  const filename =videoURL+".mp3";

    const tmpFolderPath = path.join(__dirname, '../tmp');
    const tmpFilePath = path.join(tmpFolderPath, filename);
  
  fs.access(tmpFilePath, fs.constants.F_OK, (errAccess) => {
    if (errAccess) {
       {try {
    
    if (!fs.existsSync(tmpFolderPath)) {
      fs.mkdirSync(tmpFolderPath, { recursive: true });
    }

   
    const writableStream = fs.createWriteStream(tmpFilePath);
    const stream = ytdl(videoURL, { quality: 'highestaudio', filter: 'audioonly' });

    stream.pipe(writableStream)
    stream.on("finish",()=>{res.sendFile(tmpFilePath)}) 
    

  } catch (error) {
    
    console.error('Error fetching video info:', error);
    res.status(404).send('Video not found or is no longer available');
  }}
    } else {
      res.sendFile(tmpFilePath)
    }
  });}
 
});



main.get("/search/:q", async (req, res) => {
  const q = req.params.q;

  try{var youtubeSearchData = await ytsr.search(q, 5);

  youtubeSearchData = youtubeSearchData.map((value) => {
    return {
      videoId: value.id,
      title: value.title,
      thumbnail: value.thumbnail,
    };
  });
  res.json(youtubeSearchData);}catch{
    res.sendStatus(500);
  }
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
main.get("/download/file/:query", async (req, res) => {
  const videoURL = req.params.query; // Get the video URL from the query parameter
console.log(videoURL)
  if (!videoURL ||videoURL=="undefined") {
    return res.status(400).send("Please provide a valid YouTube video URL.");

  }
  const stream = ytdl(videoURL, {
    quality: "highestaudio",
    filter: "audioonly",
    requestOptions: { agent },
    highWaterMark: 1024 * 1024 * 3,
  });
  res.set("Content-Type", "audio/mpeg");
  res.setHeader(
    "Content-disposition",
    `attachment; filename=ytomp3-${
      Math.floor(Math.random() * 90000) + 10000
    }.mp3`
  );

  stream.on("data", (chunk) => {
    res.write(chunk);
  });

  stream.on("end", () => {
    res.end();
  });
});
module.exports = main;
