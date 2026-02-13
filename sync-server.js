const express = require("express");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(express.json({limit:"5mb"}));
app.use(cors());

const FILE = "users.json";

app.post("/backup", (req,res)=>{
  fs.writeFileSync(FILE, JSON.stringify(req.body,null,2));
  res.json({ok:true});
});

app.get("/restore", (req,res)=>{
  if(!fs.existsSync(FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(FILE)));
});

app.listen(4000, ()=>console.log("MyBank sync server running on port 4000"));
