import { cancel, confirm, intro , isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from 'better-auth/client';
import { deviceAuthorizationClient } from "better-auth/client/plugins"; 
import chalk from 'chalk'
import { Command } from "commander";
import fs from 'node:fs/promises'
import open from "open"
import os from "os"
import path from "path";
import yoctoSpinner from "yocto-spinner"
import * as z from 'zod/v4'
import 'dotenv/config'
import prisma from "../../../lib/db.js";

const URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3005}`;
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CONFIG_DIR = path.join(os.homedir(),".orbital-cli");
const TOKEN_FILE = path.join(CONFIG_DIR,"token.json");

// Token Mgmt
export async function getStoredToken() {
    try {
        const data = await fs.readFile(TOKEN_FILE,"utf-8");
        const token = JSON.parse(data);
        return token;
    } catch (error) {
        return null;
    }
}

export async function storeToken(token) {
  try {
    // Ensure config directory exists
    await fs.mkdir(CONFIG_DIR, { recursive: true });

    // Store token with metadata
    const tokenData = {
      access_token: token.access_token,
      refresh_token: token.refresh_token, // Store if available
      token_type: token.token_type || "Bearer",
      scope: token.scope,
      expires_at: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null,
      created_at: new Date().toISOString(),
    };

    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(chalk.red("Failed to store token:"), error.message);
    return false;
  }
}

export async function clearStoredToken() {
  try {
    await fs.unlink(TOKEN_FILE);
    return true;
  } catch (error) {
    // File doesn't exist or can't be deleted
    return false;
  }
}

export async function isTokenExpired() {
  const token = await getStoredToken();
  if (!token || !token.expires_at) {
    return true;
  }

  const expiresAt = new Date(token.expires_at);
  const now = new Date();

  // Consider expired if less than 5 minutes remaining
  return expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;
}

export async function requireAuth() {
  const token = await getStoredToken();

  if (!token) {
    console.log(
      chalk.red("❌ Not authenticated. Please run 'your-cli login' first.")
    );
    process.exit(1);
  }

  if (await isTokenExpired()) {
    console.log(
      chalk.yellow("⚠️  Your session has expired. Please login again.")
    );
    console.log(chalk.gray("   Run: orbital login\n"));
    process.exit(1);
  }

  return token;
}

// login commands
export async function loginAction(opts){
    const options  = z.object({
        serverUrl: z.string().optional(),
        clientId:z.string().optional()
    })

    const serverUrl = options.serverUrl || URL;
    const clientId = options.clientId || CLIENT_ID;

    intro(chalk.bold("Better Auth CLI Login"))

    const exisitngtoken = await getStoredToken(); //need to change with token mgmt utils
    const expired = await isTokenExpired();

    if(exisitngtoken && !expired){
        const shouldReAuth = await confirm({
            message:"You are already loggedIn. Do You want to login again?",
            initialValue: false
        });

        if(isCancel(shouldReAuth) || !shouldReAuth){
            cancel("Login Cancelled");
            process.exit(0);
        }
    }

    const authClient = createAuthClient({
        baseURL: serverUrl,
        plugins:[deviceAuthorizationClient()],
    })

    const spinner = yoctoSpinner({text: "Requesting device authorization..."});
    spinner.start();

    try {
        const { data, error } = await authClient.device.code({
            client_id:clientId,
            scope:"openid profile email"
        });
        spinner.stop();
           
        if(error || !data){
            logger.error(`Failed to request device authorization: ${error.error_description}`);
            process.exit(1);
        }

        const {
            device_code,
            user_code,
            verification_uri,
            verification_uri_complete,
            expires_in,
            interval
        } = data;

        console.log("");
        console.log(chalk.cyan("📱 Device Authorization Required"));
        console.log("");
        console.log(
        `Please visit: ${chalk.underline.blue(
            verification_uri_complete || verification_uri
        )}`
        );
        console.log(`Enter code: ${chalk.bold.green(user_code)}`);
        console.log("");


        const shouldOpen = await confirm({
            message:"Open browser automatically",
            initialValue:true
        });

        if(!isCancel(shouldOpen) && shouldOpen){
            const urlToOpen = verification_uri_complete || verification_uri;
            await open(urlToOpen)
        }
        // After this user poll for request
        
        console.log(
            chalk.gray(
                `Waiting for authorization (expires in ${Math.floor(
                    expires_in / 60
                )} minutes)...`
            )
        );

        const token = await pollToken(
            authClient, device_code, clientId, interval
        )

        if(token){
            const saved = await storeToken(token);
            if(!saved){
                console.log(
                    chalk.yellow("\n Warning: Could not save authentication token")
                )
                console.log(
                    chalk.yellow("You may need to login again on next use")
                )
            }
            
            // Need to add user data
            const { data: session } = await authClient.getSession({
                fetchOptions: {
                    headers: {
                        Authorization: `Bearer ${token.access_token}`,
                    }
                }
            });

            outro(
                chalk.green(
                `✅ Login successful! Welcome ${
                    session?.user?.name || session?.user?.email || "User"
                }`
                )
            );

            console.log(chalk.gray(`\n📁 Token saved to: ${TOKEN_FILE}`));
            console.log(
                chalk.gray(" You can now use AI commands without logging in again.\n")
            );
        }
    } catch (err) {
        spinner.stop();
        console.error(chalk.red("\n Login Failed :"),err.message);
        process.exit(1);
    }
}

async function pollToken(authClient, device_code, clientId, interval) {
    let pollingInterval = interval
    const spinner = yoctoSpinner({text:"", color:"cyan"});
    let dots = 0;

    return new Promise((resolve, reject)=>{
        const poll = async () => {
            dots = (dots+1)%4;
            spinner.text = chalk.gray(
                `Polling for authorization ${".".repeat(dots)}${" ".repeat(3-dots)}`
            );
            if(!spinner.isSpinning) 
                spinner.start();

            try {
                const {data,error} = await authClient.device.token({
                    grant_type:"urn:ietf:params:oauth:grant-type:device_code",
                    device_code: device_code,
                    client_id: clientId,
                    fetchOptions: {
                        headers: {
                            "user-agent": `My CLI`,
                        },
                    },
                });

                if(data?.access_token){
                    console.log(
                        chalk.bold.yellow(`Your access token: ${data.access_token}`)
                    );
                    spinner.stop();
                    resolve(data);
                    return;
                }
                else if(error){
                    switch (error.error) {
                        case "authorization_pending":
                            // Continue polling
                            break;
                        case "slow_down":
                            pollingInterval += 5;
                            break;
                        case "access_denied":
                            spinner.stop();
                            logger.error("Access was denied by the user");
                            process.exit(1);
                            break;
                        case "expired_token":
                            spinner.stop();
                            logger.error("The device code has expired. Please try again.");
                            process.exit(1);
                            break;
                        default:
                            spinner.stop();
                            logger.error(`Error: ${error.error_description}`);
                            process.exit(1);
                    }
                }
            } catch (err) {
                spinner.stop();
                logger.error(`Network error: ${err.message}`);
                process.exit(1);
            }

            setTimeout(poll, pollingInterval * 1000);
        };
        setTimeout(poll, pollingInterval * 1000)
    })
}

// Logout Cmd
export async function logoutAction() {
  intro(chalk.bold("👋 Logout"));

  const token = await getStoredToken();

  if (!token) {
    console.log(chalk.yellow("You're not logged in."));
    process.exit(0);
  }

  const shouldLogout = await confirm({
    message: "Are you sure you want to logout?",
    initialValue: false,
  });

  if (isCancel(shouldLogout) || !shouldLogout) {
    cancel("Logout cancelled");
    process.exit(0);
  }

  const cleared = await clearStoredToken();

  if (cleared) {
    outro(chalk.green("✅ Successfully logged out!"));
  } else {
    console.log(chalk.yellow("⚠️  Could not clear token file."));
  }
}

// WHOAMI COMMAND
export async function whoamiAction(opts) {
  const token = await requireAuth();
  if (!token?.access_token) {
    console.log("No access token found. Please login.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: token.access_token,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  if (!user) {
    console.log(chalk.red("User not found. Token may be invalid."));
    process.exit(1);
  }

  // Output user session info
  console.log(
    chalk.bold.greenBright(`\n👤 User: ${user.name}
📧 Email: ${user.email}
👤 ID: ${user.id}`)
  );
}

// Command Setup:

export const login = new Command("login")
.description("Login using better-auth")
.option("--server-url <url>","Better Auth server URL",URL)
.option("--client-id <id>","OAuth Client ID",CLIENT_ID)
.action(loginAction)

export const logout = new Command("logout")
.description("Logout and clear stored credentials")
.action(logoutAction)

export const whoami = new Command("whoami")
.description("Show current authenticated user")
.option("--server-url <url>","Better-auth server URL",URL)
.action(whoamiAction)