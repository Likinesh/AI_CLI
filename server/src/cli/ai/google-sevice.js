import { google } from '@ai-sdk/google';
import {convertToModelMessages, streamText} from "ai";
import { config } from "../../config/google.config.js";
import chalk from 'chalk';

export class AIService{
    constructor(){
        if(!config.googleApiKey){
            throw new Error("Google API Key is not set in env");
        }

        this.model = google(config.model, {
            apiKey: config.googleApiKey
        })
    }

    /**
     * Send msg and get stream response
     * @param {Array} messages
     * @param {Function} onChunk
     * @param {Object} tools
     * @param {Function} onToolCall
     * @returns {Promise<Object>}
     */

    async sendMessage(messages, onChunk, tools = undefined, onToolCall= null){
        try {
            const streamConfig = {
                model: this.model,
                messages: messages,
            }

            const result = streamText(streamConfig);
            let fullRes = "";

            for await ( const chunk of result.textStream){
                fullRes +=chunk;
                if(onChunk){
                    onChunk(chunk);
                }
            }

            const full_result = result;
            return{
                content: fullRes,
                finishResponse: full_result.finishReason,
                usage: full_result.usage
            }
        } catch (error) {
            console.error(chalk.red("AI Service Error:"),error.message);
            throw error;
        }
    }

    /**
     * Non streaming response
     * @param {Array} messages
     * @param {Object} tools
     * @returns {Promise<Object>}
     */
    async getMessage(messages, tools=undefined){
        let fullResponse = "";
        await this.sendMessage(messages,(chunk)=>{
            fullResponse += chunk;
        });

        return fullResponse;
    }
}