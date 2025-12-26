import express from "express";
import "dotenv/config";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import cors from "cors"

const app = express();

app.use(
    cors({
        origin: "http://localhost:3000",
        methods: ["GET","POST","PUT","DELETE"],
        credentials: true,
    })
)

app.all('/api/auth/{*any}', toNodeHandler(auth));

app.use(express.json());

app.get("/api/me", async(req,res)=>{
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    return res.json(session);
})

app.get("/health", (req,res)=>{
    res.send("OK");
})

app.listen(process.env.PORT,()=>{
    console.log(`Server running on http://localhost:${process.env.PORT}`);
})