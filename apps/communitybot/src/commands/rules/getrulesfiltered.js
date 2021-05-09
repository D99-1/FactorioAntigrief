const fetch = require("node-fetch")
const { MessageEmbed } = require("discord.js")
const ConfigModel = require("../../database/schemas/config")

module.exports = {
    config: {
        name: "getrulesfiltered",
        aliases: ["getfilteredrules", "getrules"],
        usage: "",
        category: "rules",
        description: "Gets all rules",
        accessibility: "Member",
    },
    run: async (client, message, args) => {
        const config = await ConfigModel.findOne({guildid: message.guild.id})
        if (config.filteredRules === undefined)
            return message.reply("No rules filtered")
        const resRaw = await fetch(`${client.config.apiurl}/rules/getall`)
        const rules = await resRaw.json()

        let embed = new MessageEmbed()
            .setTitle("FAGC Rules")
            .setColor("GREEN")
            .setTimestamp()
            .setAuthor("FAGC Community")
            .setDescription("Filtered FAGC Rules")

        let sent = 0
        rules.forEach((rule, i) => {
            if (sent == 25) {
                message.channel.send(embed)
                embed.fields = []
            }
            if (config.filteredRules.some(id => id === rule._id)) {
                embed.addField(`#${i + 1}/${rule._id}: ${rule.shortdesc}`, rule.longdesc)
                sent++
            }
        })
        message.channel.send(embed)
    },
}
