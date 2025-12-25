import express from "express";
import "dotenv/config";

const app = express();

app.get("/health", (req,res)=>{
    res.send("OK");
})

app.listen(process.env.PORT,()=>{
    console.log(`Server running on http://localhost:${process.env.PORT}`);
})