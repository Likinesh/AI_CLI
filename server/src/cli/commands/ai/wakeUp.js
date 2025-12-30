import chalk from "chalk";
import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { getStoredToken } from "../auth/login.js";
import prisma from "../../../lib/db.js";
import { select } from "@clack/prompts";
import { startChat } from "../../chat/chat.js";

const wakeUpAction = async() => {
    const token = await getStoredToken();

    if(!token?.access_token){
        console.log(
            chalk.red("Not Authenticated, Please Login")
        )
        return;
    }

    const spinner = yoctoSpinner({
        text:"Fetching User Information"
    })

    spinner.start();

    const user = await prisma.user.findFirst({
        where:{
            sessions:{
                some:{
                    token: token.access_token
                }
            }
        },
        select:{
            id:true,
            name:true,
            email:true,
            image:true,
        }
    })

    spinner.stop();

    if(!user){
        console.log(chalk.red("User Not Found"));
        return;
    }

    console.log(chalk.green(`Welcome back, ${user.name}!\n`));
    const choice = await select({
        message:"Select an Option:",
        options:[
            {
                value:"chat",
                label:"Chat",
                hint:"Simple chat with AI",
            },
            {
                value:"tool",
                label:"Tool Calling",
                hint:"Chat with tools (Google Search, Code Execution)",
            },
            {
                value:"agent",
                label:"Agentic Mode",
                hint:"Advanced AI agent (Building)"
            }
        ]
    });

    switch(choice){
        case "chat":
            await startChat("chat");
            break;
        case "tool":
            console.log("Tool");
            break;
        case "agent":
            console.log(chalk.yellow("Agent under progress"));
            break;
        default:
            console.log("default");
    }
}

export const wakeup = new Command("wakeup").description("Wake up AI").action(wakeUpAction);