import {Client, Collection, Snowflake} from "discord.js"
import * as path from "path"
import fetch from "node-fetch"
import WebSocket from "ws"
import { BotConfig, BotConfigEmotes } from "../types/FAGCBot"

import WebSocketHandler from "./websockethandler"

import { InfoChannels, PrismaClient } from "@prisma/client"

import config from "../../config"
import Logger, { LogType } from "../utils/logger"
import { GuildConfig } from ".prisma/client"
import { FAGCConfig } from "../types/FAGC"
import Command from "./Command"
import { PlayerJoin } from "./FAGCHandler"

import "./serverhandler"

class FAGCBot extends Client {
	public config: BotConfig
	static emotes: BotConfigEmotes
	public RateLimit: Collection<Snowflake, number>
	public commands: Collection<string, Command>
	public aliases: Collection<string, string>
	public logger: (message: String, type?: LogType) => void
	public prisma: PrismaClient
	static GuildConfig: GuildConfig
	static infochannels: InfoChannels[]
	static fagcconfig: FAGCConfig
	static config: BotConfig
	public wsHandler: (arg0: Object, arg1: FAGCBot) => void
	private messageSocket: WebSocket
	constructor(options) {
		super(options)
		
		this.config = config
		FAGCBot.config = config
		FAGCBot.emotes = this.config.emotes

		// setup rate limit
		this.RateLimit = new Collection()

		this.commands = new Collection()
		this.aliases = new Collection()
		this.logger = Logger

		this.prisma = new PrismaClient()
		FAGCBot.GuildConfig = null
		FAGCBot.fagcconfig = null

		this.wsHandler = WebSocketHandler
		this.messageSocket = new WebSocket(FAGCBot.config.websocketurl)
		this.messageSocket.on("message", (message) => {
			this.wsHandler(JSON.parse(message.toString('utf-8')), this)
		})
		this.messageSocket.on("close", (code, reason) => {
			const recconect = setInterval(() => {
				if (this.messageSocket.readyState === this.messageSocket.OPEN) {
					console.log("connected")
					return clearInterval(recconect)
				}
				// if not connected, try connecting again
				try {
					this.messageSocket = new WebSocket(FAGCBot.config.websocketurl)
				} catch (e) {}
				console.log("reconnection attempt")
			}, 5000)
		})
		this.messageSocket.on("open", () => {
			this.messageSocket.send(Buffer.from(JSON.stringify({
				guildid: FAGCBot.GuildConfig.guildid
			})))
		})
		this._asyncInit()
	}
	async _asyncInit() {
		await this.getConfig()
		// await this.getGuildConfig()
		FAGCBot.infochannels = await this.prisma.infoChannels.findMany()
	}
	/**
	 * Check if a user has sent a command in the past X milliseconds
	 * @param {string} uid - Discord user's ID snowflake
	 * @param {Number} time - Time in ms to check
	 * @returns {Boolean} True if the user has sent a command, false if they haven't
	 */
	checkTimeout(uid: Snowflake, time: number) {
		const lastTime = this.RateLimit.get(uid)
		if (!lastTime) return false
		if (lastTime < (Date.now() - time)) return false
		return true
	}
	async loadCommand(commandPath: string, commandName: string) { // load a command
		try {
			const command = (await import(`.${commandPath}${path.sep}${commandName}`))?.command
			this.commands.set(command.name, command) // adds command to commands collection
			command.aliases?.forEach((alias: string) => {
				this.aliases.set(alias, command.name) // adds command to alias collection
			})
			return false
		} catch (e) {
			return `Unable to load command ${commandName}: ${e}`
		}
	}
	async unloadCommand(commandPath, commandName) { // unload a command
		let command
		if (this.commands.has(commandName)) {
			command = this.commands.get(commandName)
		} else if (this.aliases.has(commandName)) {
			command = this.commands.get(this.aliases.get(commandName))
		}
		if (!command) {
			return `The command \`${commandName}\` doesn't seem to exist, nor is it an alias. Try again!`
		}
		if (command.shutdown) {
			await command.shutdown(this)
		}
		delete require.cache[require.resolve(`.${commandPath}${path.sep}${commandName}.js`)]
		return false
	}
	async getConfig() {
		if (FAGCBot.GuildConfig) return FAGCBot.GuildConfig
		const config = await this.prisma.guildConfig.findFirst()
		if (!config) return null
		FAGCBot.GuildConfig = config
		return config
	}
	async setConfig(config: GuildConfig) {
		if (FAGCBot.GuildConfig) {
			const update = await this.prisma.guildConfig.update({
				data: config,
				where: {id: 1}
			})
			return update
		} else {
			const set = await this.prisma.guildConfig.create({data: config})
			if (set.id) {
				FAGCBot.GuildConfig = set
				// tell the websocket to the api that we have this guild ID
				this.messageSocket.send(Buffer.from(JSON.stringify({
					guildid: FAGCBot.GuildConfig.guildid
				})))

				return set
			} else return set
		}
	}
	async getGuildConfig() {
		if (FAGCBot.fagcconfig) return FAGCBot.fagcconfig
		// this case should like literally never happen as the config will get sent when it is updated. here just in case.
		FAGCBot.fagcconfig = await fetch(`${this.config.apiurl}/communities/getconfig?guildid=${FAGCBot.GuildConfig.guildid}`).then(c => c.json())
		setTimeout(() => FAGCBot.fagcconfig = undefined, 1000*60*15) // times itself out after 
		return FAGCBot.fagcconfig
	}
}

export default FAGCBot