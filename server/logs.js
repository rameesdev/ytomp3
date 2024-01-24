const { WebSocketServer } = require("ws");

const { client } = require("./session");

const log = require("express").Router()
log.use((req,res,next)=>{
    if(req.path!="/status"){const logObj = {
        username:req.session?req.session.username:"NA",
        ipaddress:(req.ip=='::1')?(req.headers["x-forwarded-for"] || '').split(',')[0].trim():req.ip||req.connection.remoteAddress,
        path:decodeURIComponent(req.path),
        timestamp:(new Date()).toISOString(),
        referer:req.get("referer")?req.get("referer"):"/"
    }
    filter = ["3.134.238.10","3.129.111.220","52.15.118.168"]
    if(filter.includes(logObj.ipaddress)){
        next();
        return;
    }
    client.db("ytomp3").collection("logs").insertOne(logObj)
    }
    next();
})
log.get("/status",(req,res)=>{
    res.sendStatus(200)
})
log.get("/admin",async(req,res)=>{
      if(req.query.pass=="rameesftwisback")
         res.render("dashboard");
        else res.sendStatus(404);
})

var watchDb = (wss) =>{
    wss.on("connection",async(socket)=>{
        console.log("connected")
        socket.on("message",(data)=>{console.log(data.toString())})
        
        const storedLogs =await client.db("ytomp3").collection("logs").find().sort({timestamp:-1}).toArray()
        socket.send(JSON.stringify(storedLogs))
        let logListner = client.db("ytomp3").collection("logs").watch();
logListner.on("change",(change)=>{
    socket.send(JSON.stringify([change.fullDocument]))
})
    })

}

module.exports = {log,watchDb}
