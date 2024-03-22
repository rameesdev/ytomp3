const { MongoClient } = require("mongodb");
const uuid = require("uuid");

const uri =
""; // Change to your MongoDB URI

const client = new MongoClient(uri, {});

// Connect to the database
var handleDb = async (data) => {
  switch (data.method) {
    case "insert":
      return await client
        .db("ytomp3")
        .collection(data.collection)
        .insertOne(data.body);
      break;
    case "get":
      return await client
        .db("ytomp3")
        .collection(data.collection)
        .find(data.find)
        .toArray();
      break;
    case "update":
      return await client
        .db("ytomp3")
        .collection(data.collection)
        .updateOne(data.find, data.body);
        break;
  }
};
var session = async (req, res, next) => {
  var tempSid = uuid.v4();
  if (req.cookies == null) {
  } else if (
    (await handleDb({
      find: { sid: req.cookies.sid },
      collection: "session",
      method: "get",
    }).then((data) => {
      return data.length;
    })) == 0
  ) {
    
  } else {
    req.session = await handleDb({
      find: { sid: req.cookies.sid },
      collection: "session",
      method: "get",
    }).then((data) => {
      return data[0];
    });
  }

  next();
};
var save =async (req) => {
  if (req.session != undefined) {
    req.session.lastModified = new Date();
    if(req.session.isFirst==true){
      
      handleDb({
        body: req.session,
        method: "insert",
        collection: "session"
      }).then((err) => null);
    }
    else if(req.session.isFirst==false){
      
      handleDb({
      body: { $set: req.session },
      method: "update",
      collection: "session",
      find: { sid: req.session.sid },
    }).then((err) => null);
    }
  }
};
module.exports = { session, client, save, handleDb, uuid };
