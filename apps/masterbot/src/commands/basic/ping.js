module.exports = {
	config: {
		name: "ping",
		aliases: ["alias"],
		usage: "",
		category: "basic",
		description: "Pings the bot",
	},
	run: async (client, message) => {
		let wsPing = client.ws.ping

		message.channel.send("Pinging...").then((m) => {
			let ping = m.createdTimestamp - message.createdTimestamp

			m.edit(`Bot Latency: \`${ping}ms\`\nAPI Latency: \`${wsPing}ms\``)
		})
	},
}
