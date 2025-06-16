var audio = document.getElementById("AUDIO");
var data = { volume: 1 };

document.getElementById("query").onkeydown = (e) => {
  if (e.key == "Enter") document.getElementById("send").click();
};
var renderSavedSong = async () => {
  const savedSongData = () => {
    return fetch("/data/get", { method: "POST" })
      .then((res) => res.json())
      .then((res) => {
        return res;
      });
  };
  const dom = (query) => {
    return document.querySelector(query);
  };
  var songData = await savedSongData();
  for (var i = 0; i < songData.length; i++) {
    const div = document.createElement("div");
    div.className = "p_song";
    const title = document.createElement("p");
    title.id = "p_title";
    title.textContent = songData[i].title;
    const button = document.createElement("button");
    button.setAttribute("onclick", `getUrl4Saved(${i})`);
    div.append(title, button);
    dom("#songdiv").append(div);
  }
  console.log(songData);
};
renderSavedSong();
var save = (i) => {
  console.log(searchData.data[i]);
  fetch("/data/save", {
    method: "POST", // Specify the POST method
    headers: {
      "Content-Type": "application/json", // Set the content type
    },
    body: JSON.stringify(searchData.data[i]),
  });
};
document.body.onload = () => {
  const temp = localStorage.getItem("data");
  if (temp != null) {
    fetch("getUrl/" + JSON.parse(temp).id, {
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((res) => {
        //     document.getElementById("title").innerText = res.title;
        // document.getElementById("img").src = searchData.data[i].thumbnail.url;
        audio.src =`/stream/${JSON.parse(temp).id}`
        audio.currentTime = JSON.parse(temp).currentTime;
        audio.play().catch(() => {
          console.log("welocome");
        });
      });

    document.getElementById("title").innerText = JSON.parse(temp).title;
    document.getElementById("img").src = JSON.parse(temp).thumbnail;
  }
};
var isUnloaded = false;
window.onbeforeunload = () => {
  if (!isUnloaded) {
    isUnloaded = true;
    const temp = JSON.parse(localStorage.getItem("data"));
    temp.currentTime = audio.currentTime;
    localStorage.setItem("data", JSON.stringify(temp));
  }
};
document.body.onbeforeunload = () => {
  if (!isUnloaded) {
    isUnloaded = true;
    const temp = JSON.parse(localStorage.getItem("data"));
    temp.currentTime = audio.currentTime;
    localStorage.setItem("data", JSON.stringify(temp));
  }
};
document.getElementById("mute").onclick = () => {
  if (audio.volume == 0) {
    audio.volume = data.volume;
    document.querySelector("#mute i").className = "bx bxs-volume-full";
  } else {
    data.volume = audio.volume;
    audio.volume = 0;
    document.querySelector("#mute i").className = "bx bxs-volume-mute";
  }
};
var searchData = {};

sidebar = () => {
  document.getElementById("options").classList.toggle("active2");
};
var open_p = () => {
  document.querySelector("#songdiv").classList.toggle("active");
};
var v;
document.getElementById("send").onclick = () => {
  document.getElementById("searchresults").innerHTML = "";
  fetch("/search/" + document.getElementById("query").value, {
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => res.json())
    .then((res) => {
      document.getElementById("searchresults").innerHTML = "";
      searchData.data = res;
      searchData.buttons = [];
      for (var i = 0; i < 5; i++) {
        var p = document.createElement("p");
        p.innerText = res[i].title;
        var div = document.createElement("div");
        var div2 = document.createElement("div");
        div2.id = "searchButtons";
        var button = document.createElement("button");

        button.className = "searchPlay";
        buttonAdd = button.cloneNode(true);
        button.setAttribute("onclick", `getUrl("${res[i].videoId}",${i})`);
        searchData.buttons.push(button);

        buttonAdd.innerHTML = `<i class='bx bx-save'></i>`;
        button.innerHTML = '<i class="bx bx-play" ></i>';
        buttonAdd.setAttribute("onclick", `save(${i})`);
        div2.append(button, buttonAdd);

        div.style.overflow = "hidden";
        div.className = "sugg";
        div.appendChild(p);
        var mainDiv = document.createElement("div");
        mainDiv.className = "mainDiv";
        mainDiv.append(div, div2);
        document.getElementById("searchresults").appendChild(mainDiv);
      }
    });
};

var getUrl = (videoID, i) => {
  searchData.prev = searchData.now;
  searchData.now = searchData.buttons[i];

  if (searchData.prev == searchData.now) {
    if (audio.paused) {
      audio.play();
      searchData.buttons[i].innerHTML = `<i class="bx bx-pause" ></i>`;
    } else {
      audio.pause();
      searchData.buttons[i].innerHTML = `<i class="bx bx-play" ></i>`;
    }
  } else {
    temp = JSON.parse(localStorage.getItem("data"));
    //if(temp==null)
    temp = {
      id: videoID,
      title: searchData.data[i].title,
      thumbnail: searchData.data[i].thumbnail,
    };

    localStorage.setItem("data", JSON.stringify(temp));
    audio.pause();
    document.getElementById("slider").value = 0;
    document.getElementById("tot").innerText = "0.00";

    // searchData.buttons[i].innerHTML=`<i class="bx bx-pause" ></i>`
    if (searchData.prev !== undefined) {
      searchData.prev.innerHTML = `<i class="bx bx-play" ></i>`;
    }
    document.getElementById("title").innerText = searchData.data[i].title;
    document.getElementById("img").src = searchData.data[i].thumbnail;
    document.title = "TYMP3\t|\t" + searchData.data[i].title;
    audio.src = `/stream/${videoID}`
    
    audio.play()
    
  }
};

document.getElementById("play_btn").onclick = () => {
  audio.paused ? audio.play() : audio.pause();
};
audio.onplay = () => {
  if (searchData.now) {
    searchData.now.innerHTML = '<i class="bx bx-pause" ></i>';
  }
  document.getElementById("playimg").className = "bx bx-pause";
};
audio.onpause = () => {
  if (searchData.now) {
    searchData.now.innerHTML = '<i class="bx bx-play" ></i>';
  }
  document.getElementById("playimg").className = "bx bx-play";
};
var playdur = (current) => {
  var minutes, hour;
  var seconds = current;
  hour = Math.floor(Math.floor(seconds / 60) / 60);
  seconds = seconds - hour * 60 * 60;
  minutes = Math.floor(seconds / 60);
  let extraSeconds = Math.floor(seconds % 60);
  let result;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  extraSeconds = extraSeconds < 10 ? "0" + extraSeconds : extraSeconds;

  if (hour != 0) result = hour + ":" + minutes + ":" + extraSeconds;
  else result = minutes + ":" + extraSeconds;
  return result;
};
// audio.onload = () => {};
audio.ondurationchange = (e) => {
  document.getElementById("tot").innerText = playdur(e.target.duration);
};
audio.ontimeupdate = (e) => {
  document.getElementById("current").innerText = playdur(audio.currentTime);
  var duration;
  if (!isNaN(audio.duration)) duration = audio.duration;
  else duration = 1;

  document.getElementById("slider").value =
    (audio.currentTime * 100) / duration;
};
document.getElementById("slider").oninput = (e) => {
  audio.currentTime = (e.target.value * audio.duration) / 100;
};
