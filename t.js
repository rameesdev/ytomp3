const axios = require("axios");

async function downloadMP3(videoUrl) {
  try {
    // Step 1: Fetch metadata and mp3_task_url
    const infoRes = await axios.get("https://yt-cw.fabdl.com/youtube/get", {
      params: {
        url: videoUrl,
        mp3_task: 2,
      },
    });

    const result = infoRes.data.result;
    console.log("🎬 Title:", result.title);
    console.log("🎤 Author:", result.author);
    console.log("⏱️ Duration:", result.duration + "s");

    const taskUrl = result.mp3_task_url;

    if (!taskUrl) throw new Error("❌ mp3_task_url not found!");

    // Step 2: Convert and get final download URL
    const taskRes = await axios.get(taskUrl);
    const task = taskRes.data.result;

    if (!task || !task.download_url) throw new Error("❌ No download URL found!");

    const finalUrl = "https://api.fabdl.com" + task.download_url;

    console.log("✅ Download Link:", finalUrl);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

// Example video
downloadMP3("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
