require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  ComponentType
} = require('discord.js');

const database = require('./src/database');
const tiktokMonitor = require('./src/tiktokMonitor');
const { commands, PASSWORD } = require('./src/commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHECK_INTERVAL = 2 * 60 * 1000;

client.once('ready', async () => {
  console.log(`✅ البوت جاهز! ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.data.toJSON()) }
    );

    console.log('✅ تم تسجيل أوامر السلاش');
  } catch (error) {
    console.error('❌ خطأ في تسجيل الأوامر:', error);
  }

  startMonitoring();
});

client.on('interactionCreate', async interaction => {

  /* ======================
     SLASH COMMANDS
  ====================== */

  if (interaction.isChatInputCommand()) {
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);

      const method = interaction.replied || interaction.deferred ? 'editReply' : 'reply';

      await interaction[method]({
        content: '❌ حدث خطأ أثناء تنفيذ الأمر',
        flags: 64
      });
    }
  }

  /* ======================
     MODAL SUBMIT
  ====================== */

  if (interaction.isModalSubmit()) {

    if (interaction.customId === 'addChannelModal') {

      const password = interaction.fields.getTextInputValue('passwordInput').trim();
      const username = interaction.fields.getTextInputValue('usernameInput');
      const videoMessage = interaction.fields.getTextInputValue('videoMessageInput');
      const liveMessage = interaction.fields.getTextInputValue('liveMessageInput');

      if (password !== PASSWORD.trim()) {
        return interaction.reply({
          content: '❌ كلمة السر غير صحيحة!',
          flags: 64
        });
      }

      await interaction.deferReply({ flags: 64 });

      const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId(`channelSelect_${username}_${Date.now()}`)
        .setPlaceholder('اختر قناة Discord')
        .setChannelTypes([0, 5]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const response = await interaction.editReply({
        content: 'اختر القناة التي سيتم النشر فيها:',
        components: [row]
      });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        time: 60000
      });

      collector.on('collect', async i => {

        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: '❌ هذه القائمة ليست لك!',
            flags: 64
          });
        }

        const selectedChannel = i.channels.first();

        try {

          await database.addChannel(
            username,
            selectedChannel.id,
            videoMessage,
            liveMessage
          );

          await i.update({
            content: `✅ تمت إضافة قناة **${username}**\nسيتم النشر في <#${selectedChannel.id}>`,
            components: []
          });

          collector.stop();

        } catch (error) {

          if (error.code === '23505') {

            await i.update({
              content: '❌ هذه القناة مضافة بالفعل!',
              components: []
            });

          } else {

            console.error(error);

            await i.update({
              content: '❌ حدث خطأ أثناء إضافة القناة',
              components: []
            });

          }

          collector.stop();
        }

      });

      collector.on('end', collected => {

        if (collected.size === 0) {
          interaction.editReply({
            content: '❌ انتهى الوقت ولم يتم اختيار قناة',
            components: []
          });
        }

      });

    }

    /* ======================
       DELETE CHANNEL
    ====================== */

    else if (interaction.customId.startsWith('deletePasswordModal_')) {

      const username = interaction.customId.replace('deletePasswordModal_', '');
      const password = interaction.fields.getTextInputValue('passwordInput').trim();

      if (password !== PASSWORD.trim()) {
        return interaction.reply({
          content: '❌ كلمة السر غير صحيحة!',
          flags: 64
        });
      }

      await interaction.deferReply();

      try {

        await database.deleteChannel(username);

        await interaction.editReply(
          `✅ تم حذف قناة **${username}** من المراقبة`
        );

      } catch (error) {

        console.error(error);

        await interaction.editReply('❌ حدث خطأ أثناء الحذف');

      }

    }

  }

});

/* ======================
   TIKTOK MONITOR
====================== */

async function startMonitoring() {

  console.log('🔄 بدء نظام المراقبة');

  setInterval(async () => {

    try {

      const channels = await database.getAllChannels();

      for (const channelData of channels) {
        await checkChannelUpdates(channelData);
      }

    } catch (error) {

      console.error('خطأ في المراقبة:', error);

    }

  }, CHECK_INTERVAL);

}

async function checkChannelUpdates(channelData) {

  try {

    const latestVideo = await tiktokMonitor.getLatestVideo(channelData.tiktok_username);

    if (
      latestVideo &&
      latestVideo.id !== channelData.last_video_id &&
      channelData.last_video_id !== ''
    ) {

      const discordChannel = await client.channels.fetch(channelData.discord_channel_id).catch(() => null);

      if (discordChannel) {

        await discordChannel.send(
          `@everyone\n${channelData.video_message}\n${latestVideo.url}`
        );

        console.log(`🎥 فيديو جديد من ${channelData.tiktok_username}`);

      }

    }

    if (latestVideo && latestVideo.id !== channelData.last_video_id) {
      await database.updateChannelVideo(channelData.tiktok_username, latestVideo.id);
    }

    const liveStatus = await tiktokMonitor.checkLiveStatus(channelData.tiktok_username);

    if (liveStatus.isLive && !channelData.is_live) {

      const discordChannel = await client.channels.fetch(channelData.discord_channel_id).catch(() => null);

      if (discordChannel) {

        await discordChannel.send(
          `@everyone\n${channelData.live_message}\n${liveStatus.liveUrl}`
        );

        console.log(`🔴 بث مباشر من ${channelData.tiktok_username}`);

      }

      await database.updateChannelLiveStatus(channelData.tiktok_username, true);

    }

    else if (!liveStatus.isLive && channelData.is_live) {

      await database.updateChannelLiveStatus(channelData.tiktok_username, false);

    }

  }

  catch (error) {

    console.error(`خطأ في فحص ${channelData.tiktok_username}:`, error);

  }

}

client.login(process.env.DISCORD_TOKEN);