#!/usr/bin/env node
// This is to make this file executable

import dotenv from 'dotenv'
import chalk from 'chalk'
import figlet from 'figlet'
import {Command} from 'commander'
import { login, logout, whoami } from './commands/auth/login.js';

dotenv.config();

async function main() {
    // Display banner
    console.log(
        chalk.cyan(
            figlet.textSync("Orbital CLI",{
                font:"Standard",
                horizontalLayout:"default"
            })
        )
    )

    console.log(chalk.gray("A CLI based AI tool \n"))

    const program = new Command("orbital");

    program.version("0.0.1")
    .description("Orbital CLI - AI based CLI tool")
    .addCommand(login)
    .addCommand(logout)
    .addCommand(whoami)

    // Default Action
    program.action(() => {
        program.help();
    });

    program.parse();
}

main().catch((err) => {
    console.log(chalk.red("Error running Orbital CLI:"),err)
    process.exit(1);
});