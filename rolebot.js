var os = require("os");
const f =require('string-format');
const Discord = require('discord.js');
const client = new Discord.Client();
const s = require('./config.json');
const path = require('path');
/**
 * @type {{ token: string, inviteme: string, prefix: string, aprefix: string, lang: string, messageId: string, messageId2: string, blacklistedGID: Array<string>, blacklistedDMUID: Array<string>, emojis: { tickYes: string, tickNo: string, pc: string, switch: string, mobile: string, ps4: string, xbox: string }, channels: { ad_application: string, ads: string, 'mod-log': string }}}
 */
let c = require('./config.json');
const lang = require('./lang/' + c.lang + '.json');
let fs = require('fs');
let process = require('process');
let log = new require('log');
let logger = null;
const cases = JSON.parse(fs.readFileSync('./data/cases.json'))
const handlers = {}
const approves = {}
const ids = JSON.parse(fs.readFileSync('./data/ads.json'))

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

client.on('ready', () => {
  logger = new log('info', fs.createWriteStream('latest.log', 'utf-8'));
  logger.info("Logged in as %s(%s)!", client.user.tag, client.token);
  console.log(`Logged in as ${client.user.tag}(Token:${client.token})!`);
  client.user.setActivity("[DMで宣伝許可申請] " + c.prefix + "help");
  logger.info("Bot has Fully startup.");
  console.log("Bot has Fully startup.");
});

function addRole(msg, rolename, isCommand = true) {
      var role = null;
      var member = null;
      try {
        role = msg.guild.roles.find(r => r.name === rolename) || msg.guild.roles.get(rolename.startsWith('id:') ? rolename.replace('id:', '') : null);
        member = msg.guild.members.get(msg.author.id);
        if (isCommand) {
          if (msg.member.roles.has(role.id || rolename.replace('id:', ''))) {
            member.removeRole(role).catch(console.error);
            let embed = new Discord.RichEmbed().setTitle(":wastebasket: ロールから削除").setColor([255,0,0]).setDescription("ロール[" + role.name + "] から削除しました。");
            msg.channel.send(embed);
          } else {
            member.addRole(role).catch(console.error);
            let embed = new Discord.RichEmbed().setTitle(":heavy_plus_sign: ロールへ追加").setColor([0,255,0]).setDescription("ロール[" + role.name + "] へ追加しました。");
            msg.channel.send(embed);
          }
        } else {
            member.addRole(role).catch(console.error);
            console.log(`added role: ${role.name}`);
        }
      } catch (e) {
        console.error("Caught exception: " + e);
        console.error(e.stack);
        logger.error("Caught exception! " + e);
        logger.error(e.stack);
      }
}
function removeRole(msg, rolename, isCommand = true) {
      var role = null;
      var member = null;
      try {
        role = msg.guild.roles.find("name", rolename);
        member = msg.guild.members.get(msg.author.id);
        if (isCommand) {
          if (msg.member.roles.has(role.id)) {
            member.removeRole(role).catch(console.error);
            let embed = new Discord.RichEmbed().setTitle(":wastebasket: ロールから削除").setColor([255,0,0]).setDescription("ロール[" + rolename + "] から削除しました。");
            msg.channel.send(embed);
          } else {
            member.addRole(role).catch(console.error);
            let embed = new Discord.RichEmbed().setTitle(":heavy_plus_sign: ロールへ追加").setColor([0,255,0]).setDescription("ロール[" + rolename + "] へ追加しました。");
            msg.channel.send(embed);
          }
        } else {
            member.removeRole(role).catch(console.error);
            console.log(`removed role: ${role.name}`);
        }
      } catch (e) {
        msg.channel.send(":x: エラー: " + e);
        console.error("Caught exception: " + e);
        console.error(e.stack);
        logger.error("Caught exception! " + e);
        logger.error(e.stack);
      }
}

client.on('message', async msg => {
 const invite = /discord\.gg\/(.......)/.exec(msg.content)
 if (invite) {
  if (invite[1]) {
    if (c.blacklistedGID.includes((await client.fetchInvite(invite[1])).guild.id)) {
      msg.delete();
      return true;
    }
  }
 }
 if (!msg.author.bot) {
 if (msg.channel.constructor.name === "DMChannel" || msg.channel.constructor.name === "GroupDMChannel") {
    if (c.blacklistedDMUID.includes(msg.author.id)) return true;
    const least = 2 // do not set to zero
    const id = getRandomInt(100, 100000) // 100 to 100000
    let msgurl
    if (!msg.content.includes("--dry-run")) msgurl = await client.channels.get(c.channels['ad_application']).send(`${msg.author.tag}から[宣伝ID:`+id+`]:\n` + "```\n" + msg.content.replace(/```/gm, "---") + "\n```\n宣伝メッセージ:```\n" + msg.content.split("```")[1] + "\n```\n\n(" + msg.createdAt + "に送信されました。)")
    msg.channel.send(":ok_hand: メッセージを送信しました(Message has been sent)。 [宣伝ID: "+id+"]" + (msg.content.includes("--dry-run") ? "(--dry-runが指定済みなので送信されていません)" : "") + "\n最低" + least + "人のAdminに承認される必要があります。")
    if (msgurl) {
      try {
        await msgurl.react(msgurl.guild.emojis.get(c.emojis['tickYes']))
        await msgurl.react(msgurl.guild.emojis.get(c.emojis['tickNo']))
      } catch(e) {
        msgurl.channel.send("Something went wrong, Oh no!\nShowing error: " + e.stack || e)
      }
    }
    const url = `https://discordapp.com/channels/${msgurl.guild.id}/${msgurl.channel.id}/${msgurl.id}`
    ids[id] = { status: "pending", "url": url, "note": "(none)", "by": msg.author.name, "avatarURL": msg.author.avatarURL }
    if (msg.content.includes("--dry-run")) ids[id].note = "Generated with dry-run option. Do not approve.";
    handlers[msgurl.id] = async (eid) => {
      if (eid === c.emojis['tickYes']) {
        approves[msgurl.id] = (typeof approves[msgurl.id] !== "undefined" ? approves[msgurl.id] + 1 : 1)
        if (approves[msgurl.id] >= least) {
          ids[id].status = "approved"
          msg.client.channels.get(c.channels['ad_application']).send(msg.guild.emojis.get(c.emojis['tickYes']) + " 宣伝ID: " + id + "は承認されました！")
          const webhook = await msg.client.channels.get(c.channels['ads']).createWebhook(msg.author.username, ids[id].avatarURL)
          await webhook.send("宣伝ID:"+id+"(``.get <宣伝ID>`` で状況を表示)\n" + (msg.content.split("```")[1] || msg.content.replace(/```/, "---")))
          webhook.delete()
          handlers[msgurl.id] = null
          delete handlers[msgurl.id]
        }
      } else if (eid === c.emojis['tickNo']) {
        ids[id].status = "rejected"
        msg.client.channels.get(c.channels['ad_application']).send(msg.guild.emojis.get(c.emojis['tickNo']) + " 宣伝ID: " + id + "は拒否されました。")
        handlers[msgurl.id] = null
        delete handlers[msgurl.id]
      }
      return true
    }
    return true
 }
  if (msg.content.startsWith(c.prefix)) {
    if (msg.content === c.prefix + "help") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      msg.channel.send(f(lang.userhelp, c.prefix, c.aprefix));
    } else if (msg.content.startsWith(c.prefix + "remindme ")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.prefix, "").split(" ")
      setTimeout(async () => {
        msg.reply(args[1])
      }, parseInt(args[2]) * 60 * 1000)
      msg.channel.send(":ok_hand:")
    } else if (msg.content === c.prefix + "members") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      msg.channel.send(f(lang.members, msg.guild.memberCount));
    } else if (msg.content === c.prefix + "pc") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      addRole(msg, "pc");
    } else if (msg.content === c.prefix + "ps4") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      addRole(msg, "ps4");
    } else if (msg.content === c.prefix + "switch") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      addRole(msg, "switch");
    } else if (msg.content === c.prefix + "kyoka" || msg.content === c.prefix + "許可") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      addRole(msg, "許可");
    } else if (msg.content === c.prefix + "stw" || msg.content === c.prefix + "世界を救え" || msg.content === c.prefix + "set-stw") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      addRole(msg, "世界を救う者");
    } else if (msg.content === c.prefix + "ios" || msg.content === c.prefix + "mobile" || msg.content === c.prefix + "スマホ") {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      addRole(msg, "スマホ");
    } else if (msg.content.startsWith(c.prefix + "roles")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      let embed = new Discord.RichEmbed()
        .setTitle(":fork_and_knife: 機種割り当て")
        .setColor([3,255,255])
        .setDescription(f(`
 | PC: \`{0}pc\`
 | PS4: \`{0}ps4\`
 | Xbox: \`{0}xbox\`
 | スマホ: \`{0}スマホ\`
 | Switch: \`{0}switch\`
 | ---------------
 | PvE: \`{0}stw\`
`, c.prefix));
      msg.channel.send(embed);
    } else if (msg.content.startsWith(c.prefix + "load")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      var la1 = os.loadavg()[0];
      var la2 = la1 * 100;
      var loadavg = Math.round(la2) / 100;
      msg.channel.send(f(lang.loadavg, loadavg));
    } else if (msg.content.startsWith(c.prefix + "get ")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.prefix, "").split(" ")
      if (!args[1]) return msg.channel.send("引数を指定してください。")
      if (!Number.isInteger(parseInt(args[1]))) return msg.channel.send("宣伝IDは数字でなければいけません。");
      if (!ids[parseInt(args[1])]) return msg.channel.send("指定された宣伝IDは存在しません。");
      const statuses = {
        "starred": "スター(Starred)",
        "approved": "承認済み(Approved)",
        "pending": "保留中(Pending)",
        "unapproved": "承認解除(UnApproved)",
        "rejected": "拒否(Rejected)",
      };
      const embed = new Discord.RichEmbed()
        .setTitle("指定された宣伝IDの情報")
        .addField("状態", statuses[ ids[parseInt(args[1])].status ])
        .addField("メッセージ", ids[parseInt(args[1])].url)
        .addField("注記", ids[parseInt(args[1])].note);
      msg.channel.send(embed)
    } else if (msg.content.startsWith(c.prefix + "getp ")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[1]) return msg.channel.send("引数を指定してください。(<処罰Case番号>)")
      console.log(Object.keys(cases))
      if (!Object.keys(cases).includes(args[1])) return msg.channel.send("引数が正しくありません。")
      const user = msg.client.users.get(cases[args[1]].user)
      const mod = msg.client.users.get(cases[args[1]].moderator)
      msg.channel.send(new Discord.RichEmbed()
        .setTitle(`${cases[args[1]].type} | Case #${args[1]}`)
        .addField("ユーザー", `${user.tag} (${user})`, true)
        .addField("モデレーター", mod.tag, true)
        .addField("理由", cases[args[1]].reason)
        .setDescription("メッセージ: ```"+cases[args[1]].message+"```")
        .setColor([255,0,0]))
    } else if (msg.content.startsWith(c.prefix + "say ")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const commandcut = msg.content.substr(c.prefix + "say ".length);
      let message = "";
      const argumentarray = commandcut.split(" ");
      argumentarray.forEach(function(element) {
        message += element + " ";
      }, this);
      msg.channel.send(message);
    } else if (msg.content.startsWith(c.prefix + "sayd ")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const commandcut = msg.content.substr(c.prefix + "say ".length);
      let message = "";
      const argumentarray = commandcut.split(" ");
      argumentarray.forEach(function(element) {
        message += element + " ";
      }, this);
      msg.delete(0).catch(function (error) { msg.channel.send(":no_good: Missing permission: 'manage message'"); console.error("Error: missing 'manage message' permission."); logger.alert("Error: missing 'manage message' permission."); });
      msg.channel.send(message);
    }
  }
 }
 if (msg.author != "<@445996883761037323>") {
  if (msg.content.startsWith(c.aprefix) && msg.member.hasPermission(8)) {
    if (msg.content === c.aprefix + "help") {
      logger.info("%s issued admin command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issuedadmin, msg.author.tag, msg.content));
      msg.channel.send(f(lang.adminhelp, c.aprefix, c.prefix));
    } else if (msg.content.startsWith(c.aprefix + "reason")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[2]) return msg.channel.send("引数を指定してください。(<<該当するメッセージID> <理由>>)")
      if (!Object.keys(cases).includes(args[1])) return msg.channel.send("引数が正しくありません。")
      cases[args[1]].reason = args.slice(2).join(' ');
      msg.channel.send(":white_check_mark: reasonを設定しました")
    } else if (msg.content.startsWith(c.aprefix + "warn") || msg.content.startsWith(c.aprefix + "warning")) {
      const random = getRandomInt(100, 100000)
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[1]) return msg.channel.send("引数を指定してください。(<<ユーザーID> [理由] [メッセージ]>)")
      if (!msg.client.users.has(args[1])) return msg.channel.send("引数が正しくありません。")
      const user = msg.client.users.get(args[1])
      const message = `
${msg.guild.name}サーバーのルール違反、もしくはDiscordガイドライン( https://discordapp.com/guidelines )違反、またはDiscord規約( https://discordapp.com/terms )違反が確認されました。

次回以降からは**キック**、もしくは**BAN**の対象となりますので、そのような行動は控えるようにしてください。

心当たりがない方は、Admin、もしくはOwnerまでお問い合わせください。
`;
      cases[random] = {
        type: "警告",
        message: message,
        user: args[1],
        reason: args.slice(2).join(' ') || ("Admin: `,reason "+random+" [理由]` を実行してください"),
        moderator: msg.author.id,
      };
      msg.client.users.get(args[1]).send(cases[random].message+`\n\n理由: ${cases[random].reason}`)
      msg.guild.channels.get(c.channels['mod-log']).send(new Discord.RichEmbed()
        .setTitle(`${cases[random].type} | Case #${random}`)
        .addField("ユーザー", `${user.tag} (${user})`, true)
        .addField("モデレーター", msg.author.tag, true)
        .addField("理由", cases[random].reason)
        .setColor([255,255,0]))
    } else if (msg.content.startsWith(c.aprefix + "ban")) {
      const random = getRandomInt(100, 100000)
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[1]) return msg.channel.send("引数を指定してください。(<<ユーザーID> [理由] [メッセージ]>)")
      if (!msg.client.users.has(args[1])) return msg.channel.send("引数が正しくありません。")
      const user = msg.client.users.get(args[1])
      const message = `
${msg.guild.name}サーバーのルール違反、もしくはDiscordガイドライン( https://discordapp.com/guidelines )違反、またはDiscord規約( https://discordapp.com/terms )違反が確認されたので、サーバーから**BAN**されました。

心当たりがない方は、Admin、もしくはOwnerまでお問い合わせください(BAN実行者: ${msg.author})。
`;
      cases[random] = {
        type: "BAN",
        message: message,
        user: args[1],
        reason: args.slice(2).join(' ') || ("Admin: `,reason "+random+" [理由]` を実行してください"),
        moderator: msg.author.id,
      };
      msg.client.users.get(args[1]).send(cases[random].message+`\n\n理由: ${cases[random].reason}`)
      msg.guild.channels.get(c.channels['mod-log']).send(new Discord.RichEmbed()
        .setTitle(`${cases[random].type} | Case #${random}`)
        .addField("ユーザー", `${user.tag} (${user})`, true)
        .addField("モデレーター", msg.author.tag, true)
        .addField("理由", cases[random].reason)
        .setColor([255,0,0]))
      msg.guild.members.get(args[1]).ban(cases[random].reason)
    } else if (msg.content.startsWith(c.aprefix + "kick")) {
      const random = getRandomInt(100, 100000)
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[1]) return msg.channel.send("引数を指定してください。(<<ユーザーID> [理由] [メッセージ]>)")
      if (!msg.client.users.has(args[1])) return msg.channel.send("引数が正しくありません。")
      const user = msg.client.users.get(args[1])
      const message = `
${msg.guild.name}サーバーのルール違反、もしくはDiscordガイドライン( https://discordapp.com/guidelines )違反、またはDiscord規約( https://discordapp.com/terms )違反が確認されたので、サーバーから**キック**されました。

心当たりがない方は、Admin、もしくはOwnerまでお問い合わせください(BAN実行者: ${msg.author})。
`;
      cases[random] = {
        type: "キック",
        message: message,
        user: args[1],
        reason: args.slice(2).join(' ') || ("Admin: `,reason "+random+" [理由]` を実行してください"),
        moderator: msg.author.id,
      };
      msg.client.users.get(args[1]).send(cases[random].message+`\n\n理由: ${cases[random].reason}`)
      msg.guild.channels.get(c.channels['mod-log']).send(new Discord.RichEmbed()
        .setTitle(`${cases[random].type} | Case #${random}`)
        .addField("ユーザー", `${user.tag} (${user})`, true)
        .addField("モデレーター", msg.author.tag, true)
        .addField("理由", cases[random].reason)
        .setColor([255,0,0]))
      msg.guild.members.get(args[1]).ban(cases[random].reason)
    } else if (msg.content.startsWith(c.aprefix + "setstatus")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[2]) return msg.channel.send("引数を指定してください。(<<宣伝ID> <ステータス>>)")
      if (!Number.isInteger(parseInt(args[1]))) return msg.channel.send("宣伝IDは数字でなければいけません。");
      if (!ids[parseInt(args[1])]) return msg.channel.send("指定された宣伝IDは存在しません。");
      if (!["starred", "approved", "pending", "unapproved", "rejected"].includes(args[2])) return msg.channel.send("ステータスは`starred` `approved` `pending` `unapproved` `rejected`のいずれかである必要があります。");
      ids[parseInt(args[1])].status = args[2];
      if (args[2] === "approved") ids[parseInt(args[1])].note = "手動で承認済み"
      if (args[2] === "starred") ids[parseInt(args[1])].note = "手動でスター済み"
      const statuses = {
        "starred": "スター(Starred)",
        "approved": "承認済み(Approved)",
        "pending": "保留中(Pending)",
        "unapproved": "承認解除(UnApproved)",
        "rejected": "拒否(Rejected)",
      };
      const embed = new Discord.RichEmbed()
        .setTitle("指定された宣伝IDの情報")
        .addField("状態", statuses[ ids[parseInt(args[1])].status ])
        .addField("メッセージ", ids[parseInt(args[1])].url)
        .addField("注記", ids[parseInt(args[1])].note);
      msg.channel.send(embed)
    } else if (msg.content.startsWith(c.aprefix + "setnote")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[2]) return msg.channel.send("引数を指定してください。")
      if (!Number.isInteger(parseInt(args[1]))) return msg.channel.send("宣伝IDは数字でなければいけません。");
      if (!ids[parseInt(args[1])]) return msg.channel.send("指定された宣伝IDは存在しません。");
      ids[parseInt(args[1])].note = args[2];
      const statuses = {
        "starred": "スター(Starred)",
        "approved": "承認済み(Approved)",
        "pending": "保留中(Pending)",
        "unapproved": "承認解除(UnApproved)",
        "rejected": "拒否(Rejected)",
      };
      const embed = new Discord.RichEmbed()
        .setTitle("指定された宣伝IDの情報")
        .addField("状態", statuses[ ids[parseInt(args[1])].status ])
        .addField("メッセージ", ids[parseInt(args[1])].url)
        .addField("注記", ids[parseInt(args[1])].note);
      msg.channel.send(embed)
    } else if (msg.content.startsWith(c.aprefix + "get ")) {
      logger.info("%s issued command: %s", msg.author.tag, msg.content);
      console.log(f(lang.issueduser, msg.author.tag, msg.content));
      const args = msg.content.replace(c.aprefix, "").split(" ")
      if (!args[1]) return msg.channel.send("引数を指定してください。")
      if (!Number.isInteger(parseInt(args[1]))) return msg.channel.send("宣伝IDは数字でなければいけません。");
      if (!ids[parseInt(args[1])]) return msg.channel.send("指定された宣伝IDは存在しません。");
      const statuses = {
        "starred": "スター(Starred)",
        "approved": "承認済み(Approved)",
        "pending": "保留中(Pending)",
        "unapproved": "承認解除(UnApproved)",
        "rejected": "拒否(Rejected)",
      };
      const embed = new Discord.RichEmbed()
        .setTitle("指定された宣伝IDの情報")
        .addField("状態", statuses[ ids[parseInt(args[1])].status ])
        .addField("メッセージ", ids[parseInt(args[1])].url)
        .addField("注記", ids[parseInt(args[1])].note);
      msg.channel.send(embed)
    } else if (msg.content === c.aprefix + "reload") {
      delete require.cache[path.resolve('./config.json')];
      delete require.cache['./config.json'];
      c = require('./config.json');
      msg.channel.send(":ok_hand:");
    } else if (msg.content === c.aprefix + "fetch") {
      async function fetch() {
        msg.delete(0);
        await msg.channel.fetchMessages();
        await msg.guild.fetchMembers();
      }
      fetch();
    }
  }
 }
});

client.on("messageReactionAdd", (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.id == c.messageId || reaction.message.id == c.messageId2) {
    if (reaction.emoji.id === c.emojis['pc']) {
      addRole(reaction.message, "pc", false);
    }
    if (reaction.emoji.id === c.emojis['switch']) {
      addRole(reaction.message, "switch", false);
    }
    if (reaction.emoji.id === c.emojis['ps4']) {
      addRole(reaction.message, "ps4", false);
    }
    if (reaction.emoji.id === c.emojis['mobile']) {
      addRole(reaction.message, "スマホ", false);
    }
    if (reaction.emoji.id === "460328322153447444") {
      addRole(reaction.message, "許可", false);
    }
  }
  try {
    handlers[reaction.message.id](reaction.emoji.id)
  }catch(e){}
});

client.on("messageReactionRemove", (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.id == c.messageId || reaction.message.id == c.messageId2) {
    if (reaction.emoji.id === c.emojis['pc']) {
      removeRole(reaction.message, "pc", false);
    }
    if (reaction.emoji.id === c.emojis['switch']) {
      removeRole(reaction.message, "switch", false);
    }
    if (reaction.emoji.id === c.emojis['ps4']) {
      removeRole(reaction.message, "ps4", false);
    }
    if (reaction.emoji.id === c.emojis['mobile']) {
      removeRole(reaction.message, "スマホ", false);
    }
    if (reaction.emoji.id == "460328322153447444") {
      removeRole(reaction.message, "許可", false);
    }
  }
});

client.login(s.token);

fs.writeFileSync('./data/cases.json', JSON.stringify(cases))
fs.writeFileSync('./data/ads.json', JSON.stringify(ids))

setInterval(() => {
  fs.writeFileSync('./data/cases.json', JSON.stringify(cases))
  fs.writeFileSync('./data/ads.json', JSON.stringify(ids))
}, 60 * 1000)
