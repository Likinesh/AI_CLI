#!/usr/bin/env node
// This is to make this file executable

import dotenv from 'dotenv'
import chalk from 'chalk'
import figlet from 'figlet'
import {Command} from 'commander'
import { login, logout, whoami } from './commands/auth/login.js';
import { wakeup } from './commands/ai/wakeUp.js';

dotenv.config();

/**
 * Initialize and run the Orbital CLI: show the startup banner, register subcommands, and dispatch user input.
 *
 * Displays the ASCII banner and short description, configures the Commander program with version and description,
 * registers the `login`, `logout`, `whoami`, and `wakeup` subcommands, sets the default action to show help,
 * and parses command-line arguments to execute the requested command.
 */
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
    .addCommand(wakeup)

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